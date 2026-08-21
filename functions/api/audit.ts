/**
 * POST /api/audit — the header funnel's engine.
 *
 * Takes an email, derives the site from its domain, crawls it, scores it
 * against the playbook, and streams the whole thing back as it happens.
 *
 * THREE PLATFORM CONSTRAINTS SHAPE THIS FILE. All three were learned the
 * expensive way on the ranker and are not stylistic:
 *
 * 1. No `waitUntil`. It is bounded at 30 seconds. This run is longer than that,
 *    so the work happens INSIDE the request.
 *
 * 2. The body streams from the first millisecond. Cloudflare's edge cuts a
 *    request that has sent no bytes at roughly 100 seconds; a body already
 *    flowing has no such bound. The step lines are not decoration — they are
 *    what holds the connection open. Never buffer the result and send it at
 *    the end, however much tidier that reads.
 *
 * 3. Failures ship as HTTP 200 with {"t":"failed"}. Cloudflare Pages replaces
 *    the body of any 5xx with its own HTML error page, so a designed failure
 *    sent as 502 arrives at the browser as markup and the client's JSON parse
 *    throws instead of rendering the message. A 200 is the only way to get a
 *    sentence to the visitor.
 */
import { readSite } from "../_lib/crawl";
import { deriveTarget, hostFromUserUrl } from "../_lib/email-domain";
import { scoreSite } from "../_lib/audit-score";
import { auditBand, subsectionLabel, type SubsectionKey } from "../_lib/playbook";
import {
  checkRate,
  readCache,
  sweep,
  writeCache,
  type AuditStoreEnv,
} from "../_lib/audit-store";

interface Env extends AuditStoreEnv {
  GEMINI_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  OPENCODE_API_KEY?: string;
  CONTEXT_DEV_API_KEY?: string;
  LOOPS_API_KEY?: string;
}

/**
 * The progress log, in order.
 *
 * Statuses are overwritten by real values where there is one to report (the
 * pricing page either was or was not found), and left as written where the line
 * is a joke rather than a measurement. Reading DOWN the status column on lines
 * five and six gives "YOU'RE / WELCOME" — that is the gag, and it only works
 * while both labels sit at the same length in the leader column. If you change
 * either, change both.
 */
const STEPS: { key: string; label: string; status: string }[] = [
  { key: "wake", label: "Waking up the crawler", status: "OK" },
  { key: "home", label: "Reading your homepage", status: "OK" },
  { key: "pricing", label: "Finding your pricing", status: "EVENTUALLY" },
  { key: "studies", label: "Reading 23 studies", status: "AGAIN" },
  { key: "sodont", label: "So you don't have to", status: "YOU'RE" },
  { key: "science", label: "Applying the science", status: "WELCOME" },
  { key: "math", label: "Doing the arithmetic", status: "OK" },
  { key: "round", label: "Rounding in your favour", status: "NO" },
];

const LOOPS_ENDPOINT = "https://app.loops.so/api/v1/contacts/create";

/**
 * The audit list.
 *
 * TODO(vj): replace with the real Loops list id. The Loops API can read lists
 * but cannot create one, so this has to be made in the dashboard. Until it is,
 * the guard below skips the list rather than posting a bad id — a contact
 * created against a nonexistent list is worse than one created with none, since
 * it looks subscribed and receives nothing.
 */
const AUDIT_LIST_ID = "";

/**
 * Bank the lead before doing any work.
 *
 * Called without awaiting the result into the failure path on purpose: if the
 * crawl dies, the model ladder collapses or the visitor closes the tab, the
 * address is already gone. Gating the list write on a successful audit means a
 * broken site costs us the lead as well as the score.
 */
async function bankLead(env: Env, email: string, host: string | null): Promise<void> {
  if (!env.LOOPS_API_KEY) {
    console.error("[audit] LOOPS_API_KEY is not set — lead dropped:", email);
    return;
  }
  try {
    const body: Record<string, unknown> = {
      email,
      source: "header-audit",
      subscribed: true,
      userGroup: "website",
      auditDomain: host ?? "",
    };
    if (AUDIT_LIST_ID) body.mailingLists = { [AUDIT_LIST_ID]: true };

    const res = await fetch(LOOPS_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.LOOPS_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    // 409 means already a contact, which from our side is a success.
    if (!res.ok && res.status !== 409) {
      console.error(`[audit] Loops ${res.status}:`, (await res.text().catch(() => "")).slice(0, 300));
    }
  } catch (err) {
    console.error("[audit] Loops unreachable:", err);
  }
}

/** One NDJSON line. */
const line = (obj: unknown) => new TextEncoder().encode(`${JSON.stringify(obj)}\n`);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: { email?: unknown; url?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ t: "failed", message: "Malformed request." });
  }

  const target = deriveTarget(typeof payload.email === "string" ? payload.email : "");
  if (!target) {
    return json({ t: "failed", message: "That doesn't look like an email address." });
  }

  // A URL supplied by the visitor always wins — it is either the answer to the
  // free-mail prompt or a correction to a domain we guessed wrong.
  const supplied = typeof payload.url === "string" ? hostFromUserUrl(payload.url) : null;
  const host = supplied ?? target.host;

  // Bank the lead first, always, whatever happens next.
  const banking = bankLead(env, target.email, host);

  if (!host) {
    await banking;
    return json({
      t: "need-url",
      message: "That's a personal address — what's the site you'd like audited?",
    });
  }

  const now = Date.now();
  const ip = request.headers.get("cf-connecting-ip") ?? "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(line(obj));
      // Opening byte goes out before ANY slow work. This is constraint 2.
      send({ t: "open", host });

      try {
        const cached = await readCache(env, host, now);

        if (!cached) {
          const rate = await checkRate(env, ip, now);
          if (!rate.allowed) {
            send({
              t: "failed",
              message: "That's a few audits in one hour. Try again shortly, or just book the call.",
            });
            controller.close();
            return;
          }
        }

        if (cached) {
          // Replay at a cadence so a cached result feels like the live one
          // rather than a suspicious instant answer.
          for (const s of STEPS) {
            send({ t: "step", ...s });
            await tick(90);
          }
          send({ t: "result", ...(cached.payload as object), cached: true });
          controller.close();
          await banking;
          return;
        }

        send({ t: "step", ...STEPS[0] });
        const site = await readSite(host, env.CONTEXT_DEV_API_KEY);

        send({ t: "step", ...STEPS[1], status: site.thin ? "BARELY" : "OK" });
        const sawPricing = /##\s*Pricing/i.test(site.pages);
        send({ t: "step", ...STEPS[2], status: sawPricing ? "EVENTUALLY" : "NOPE" });
        send({ t: "step", ...STEPS[3] });
        send({ t: "step", ...STEPS[4] });

        const result = await scoreSite(host, site, env);

        send({ t: "step", ...STEPS[5] });
        send({ t: "step", ...STEPS[6] });
        send({ t: "step", ...STEPS[7] });

        const body = gate(result);
        send({ t: "result", ...body, cached: false });
        controller.close();

        // Memoise and tidy after the visitor has their answer.
        await writeCache(env, host, body, result.score, now);
        if (Math.random() < 0.05) await sweep(env, now);
        await banking;
      } catch (err) {
        console.error("[audit] run failed:", err);
        send({
          t: "failed",
          message: "We couldn't read that site well enough to score it. Book a call and we'll look properly.",
        });
        controller.close();
        await banking;
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      // Buffering proxies would defeat the entire point of streaming.
      "x-accel-buffering": "no",
    },
  });
};

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Build the wire payload — and enforce the gate.
 *
 * THE WITHHELD FINDINGS DO NOT GO IN. `locked` carries subsection names and
 * nothing else, so there is no body, score or reason in the response for the
 * three that are redacted. This is what makes the redaction bars a gate rather
 * than a blur: a CSS blur ships the whole payload and loses to View Source.
 */
function gate(result: Awaited<ReturnType<typeof scoreSite>>) {
  return {
    host: result.host,
    score: result.score,
    outOf: 100,
    grade: auditBand(result.score),
    findings: result.open.map((s) => ({
      name: s.label,
      score: s.earned === null ? "n/a" : `${Math.round((s.ratio ?? 0) * 100)} / 100`,
      body: s.reason ?? result.notes.get(s.key as SubsectionKey) ?? "",
    })),
    lockedItems: result.locked.map((s) => subsectionLabel(s.key as SubsectionKey)),
  };
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200, // Constraint 3. Never a 5xx.
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
