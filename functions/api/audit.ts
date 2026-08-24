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
import { readSiteMarkdown } from "../_lib/pages";
import { deriveTarget, hostFromUserUrl } from "../_lib/email-domain";
import { readContext, scoreSite } from "../_lib/audit-score";
import { remainingChecks, shortCitation, wins } from "../_lib/playbook";

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
  FIRECRAWL_API_KEY?: string;
  LOOPS_API_KEY?: string;
}

/**
 * The progress log, in order.
 *
 * Statuses are overwritten by real values where there is one to report (the
 * pricing page either was or was not found).
 *
 * TWO VOICES, deliberately. `label` + `status` is the dotted-leader log, where
 * reading DOWN the status column on lines five and six gives "YOU'RE /
 * WELCOME" — a gag that only works in a stacked column. `say` is the same step
 * as one plain line, for the hero's single status readout, where that gag
 * flattens into "so you don't have to — you're" and reads as gibberish. A joke
 * that depends on layout needs a fallback for every layout it does not get.
 */
const STEPS: { key: string; label: string; status: string; say: string }[] = [
  { key: "wake", label: "Waking up the crawler", status: "OK", say: "waking up the crawler" },
  { key: "home", label: "Reading your homepage", status: "OK", say: "reading your homepage" },
  { key: "pricing", label: "Finding your pricing", status: "EVENTUALLY", say: "looking for your pricing" },
  { key: "studies", label: "Reading 23 studies", status: "AGAIN", say: "loading 23 studies" },
  { key: "sodont", label: "So you don't have to", status: "YOU'RE", say: "so you don't have to" },
  { key: "science", label: "Applying the science", status: "WELCOME", say: "applying the research" },
];
// The arithmetic and the rounding used to close this list. Both were about
// producing a grade, and there is no grade any more — three checks is a sample,
// not a score. The statuses on the last two lines still read YOU'RE / WELCOME
// down the column, which is the joke and survives the trim.

/**
 * How often to emit a keepalive while the models are thinking.
 *
 * Well inside any proxy's idle tolerance, and slow enough that the counter on
 * screen reads as a clock rather than a flicker.
 */
const HEARTBEAT_MS = 5_000;

const LOOPS_ENDPOINT = "https://app.loops.so/api/v1/contacts/create";

/**
 * Where an audit taker lands: the audit list AND the newsletter.
 *
 * Both, deliberately. The audit list is the transactional one — it is what this
 * person actually asked for and what their result relates to. Field notes is
 * the standing publication, and someone who just handed over their domain to be
 * scored against published research is exactly its reader. Subscribing to only
 * the audit list would mean building an audience we have no way to write to
 * again.
 *
 * Ids, not names, because the names are editorial and change. Read the current
 * set with:
 *   curl https://app.loops.so/api/v1/lists -H "Authorization: Bearer $LOOPS_API_KEY"
 *
 * The Field notes id is duplicated from src/lib/categories.ts and
 * functions/api/subscribe.ts on purpose — Pages Functions bundle separately
 * from the Astro build, and whether an import from src/ resolves here is not a
 * thing to find out at deploy time. Change it in one place, change it in all
 * three.
 */
const AUDIT_LISTS = [
  "cmt7hwmfw2ics0j1517xf79f4", // Audit
  "cmsouuptw04kb0jx7h33a26b2", // Field notes by Vishveshwar Jatain
];

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
    body.mailingLists = Object.fromEntries(AUDIT_LISTS.map((id) => [id, true]));

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
        const site = await readSiteMarkdown(host, env.FIRECRAWL_API_KEY);

        send({ t: "step", ...STEPS[1], status: site.thin ? "BARELY" : "OK" });

        // ONE pricing check, shared with the scorer.
        //
        // This used to test /##\s*Pricing/ here while readContext() used a
        // broader match, so the log could print "NOPE" for a site the scorer
        // then went on to grade on its pricing rules. Two functions answering
        // the same question differently is how a report ends up arguing with
        // its own progress log.
        const ctx = readContext(site);
        send({ t: "step", ...STEPS[2], status: ctx.hasPricing ? "EVENTUALLY" : "NOPE" });
        send({ t: "step", ...STEPS[3] });
        send({ t: "step", ...STEPS[4] });

        // Heartbeat while the models think.
        //
        // Scoring is the long pole — measured at ~240s against a live site when
        // a provider 500s and the ladder has to climb. Printing all eight step
        // lines up front and then going silent for four minutes was wrong twice
        // over: the visitor watches a frozen screen, and a stream that sends
        // nothing for minutes is exactly the idle connection the edge is
        // entitled to cut. The step lines only hold the socket open if they
        // keep arriving.
        //
        // setInterval is avoided deliberately — racing the work against a sleep
        // keeps every timer owned by this scope, so nothing can outlive the
        // request and keep enqueuing into a closed controller.
        const scoring = scoreSite(host, site, env);
        let finished = false;
        void scoring.then(
          () => (finished = true),
          () => (finished = true),
        );
        let elapsed = 0;
        while (!finished) {
          await Promise.race([scoring.catch(() => {}), tick(HEARTBEAT_MS)]);
          if (finished) break;
          elapsed += HEARTBEAT_MS / 1000;
          send({ t: "tick", seconds: elapsed });
        }
        const result = await scoring;

        send({ t: "step", ...STEPS[5] });

        const body = gate(result);
        send({ t: "result", ...body, cached: false });

        // MEMOISE BEFORE CLOSING, not after.
        //
        // Work queued after controller.close() is work after the response is
        // complete, and Cloudflare is entitled to terminate the request there —
        // the same bound that makes waitUntil unusable here (see the header).
        // In production that meant audit_cache stayed EMPTY while audit_rate
        // filled up: the rate limiter writes mid-request and survived, the
        // cache wrote after close and did not. Every audit was a full paid
        // crawl, which is the exact failure the migration was written to
        // prevent, and it was invisible locally because wrangler dev does not
        // enforce the cutoff.
        //
        // The visitor already has their result — the line above is sent — so
        // one D1 insert before close costs them nothing they can perceive.
        await writeCache(env, host, body, result.passed, now);
        if (Math.random() < 0.05) await sweep(env, now);
        await banking;

        controller.close();
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
  const { checks } = result;

  // THREE WINS, NOT THREE VERDICTS.
  //
  // The button promises three quick wins, and a win is something to fix — so
  // what the page shows is the three heaviest FAILURES, framed as the fix
  // rather than as a mark against the reader. "You failed BRAND-2" is a verdict
  // on somebody who just handed over their domain; "lead with three key
  // benefits" is the thing they were promised.
  //
  // The wave scores six to find them. Fewer than three failures means fewer
  // than three wins — see wins(), which never pads with passes.
  const won = wins(checks);
  const items = won.map((c) => ({
    code: c.code,
    // The rule's own first sentence, which is already written as an
    // instruction: "Lead with three key benefits." That IS the win, so it is
    // the card's headline rather than the rule's short label.
    name: c.rule.split(/(?<=\.)\s/)[0],
    area: c.subsectionLabel,
    why: c.why,
    observed: c.evidence,
    citation: shortCitation(c.citation),
  }));

  // What the site already gets right. Named, not scored — it makes the wins
  // more credible rather than less, and it is the honest thing to show when a
  // site fails fewer than three.
  const passing = checks.filter((c) => c.verdict === "pass").map((c) => c.label);

  const ran = new Set(checks.map((c) => c.id));
  const held = remainingChecks(ran);

  return {
    host: result.host,
    items,
    passing,
    /** Areas the free audit did not touch, so the CTA can name the scope. */
    held,
    heldTotal: held.reduce((n, h) => n + h.count, 0),
  };
}

/** How many checks are shown before the gate. */
const OPEN_CHECKS = 3;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200, // Constraint 3. Never a 5xx.
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
