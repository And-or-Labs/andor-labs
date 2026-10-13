/**
 * POST /api/brief: the live visitor briefing behind the home-page window.
 *
 * Streams newline-delimited JSON over a TransformStream: a `start` line,
 * one `stage` line per pipeline step as it lands, `notice` lines for
 * non-fatal degradations, then the final `brief`. Fatal input problems are a
 * single `error` line.
 *
 * KV binding BRIEF (optional; local dev works without it):
 *   brief:v3:<domain>     7-day cache of stage events + the final brief
 *   rl:<ip>:<utc hour>    rate limit, 5 uncached lookups per IP per hour
 *   spend:<YYYY-MM>       running Exa dollars; >= 8.00 skips Exa
 *
 * Secrets: EXA_API_KEY, TYPESAFE_API_KEY (Pages → andorlabs → Settings).
 * A missing key degrades to the matching *_down notice, never a crash.
 */
import { interpret, type Firmo } from "../../src/lib/brief/interpret.ts";
import { runBrief, type BriefEvent } from "../../src/lib/brief/pipeline.ts";

interface Env {
  EXA_API_KEY?: string;
  TYPESAFE_API_KEY?: string;
  BRIEF?: KVNamespace;
}

interface SnitcherBody {
  name?: string;
  industry?: string;
  size?: string;
  city?: string;
  country?: string;
  type?: string;
}

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

const HEADERS = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" };

const line = (body: unknown, status = 200) => new Response(`${JSON.stringify(body)}\n`, { status, headers: HEADERS });

const normalizeDomain = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return d.length <= 253 && DOMAIN_RE.test(d) ? d : null;
};

const stream = (write: (w: WritableStreamDefaultWriter<string>) => Promise<void>) => {
  const { readable, writable } = new TransformStream<string, string>();
  const writer = writable.getWriter();
  write(writer).finally(() => writer.close().catch(() => {}));
  return new Response(readable, { headers: HEADERS });
};

const isLocalHost = (host: string) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const origin = request.headers.get("origin");
  const reqHost = new URL(request.url).host;
  const originHost = origin ? new URL(origin).host : reqHost;
  if (originHost !== reqHost && !(isLocalHost(originHost) && isLocalHost(reqHost)))
    return line({ t: "error", code: "bad_domain" }, 403);

  let body: { domain?: unknown; source?: unknown; name?: unknown; snitcher?: SnitcherBody };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return line({ t: "error", code: "bad_domain" });
  }

  const domain = normalizeDomain(body.domain);
  if (!domain) return line({ t: "error", code: "bad_domain" });

  const kv = env.BRIEF;
  // v3: factsheet shape (entity metrics + verdict); v2 held news passages.
  const cacheKey = `brief:v3:${domain}`;
  // Self-briefs are the fallback path for unidentified visitors; they must
  // never eat a visitor's 5/hr budget (or be blocked by it).
  const freePass = domain === "andorlabs.ca";

  if (kv) {
    try {
      const hit = await kv.get(cacheKey);
      if (hit) {
        const stored = JSON.parse(hit) as {
          events: BriefEvent[];
          brief: unknown;
          totalMs: number;
          exaCost: number;
          jevTokens: number | null;
          raw?: unknown;
          firmo?: unknown;
          rejectedHost?: string | null;
        };
        return stream(async (w) => {
          const write = async (o: unknown) => w.write(`${JSON.stringify(o)}\n`);
          await write({ t: "start", domain, cached: true });
          for (const e of stored.events) await write(e);
          await write({ t: "brief", brief: stored.brief, raw: stored.raw, firmo: stored.firmo, totalMs: stored.totalMs, exaCost: stored.exaCost, jevTokens: stored.jevTokens, rejectedHost: stored.rejectedHost, cached: true });
        });
      }
    } catch {
      // A broken cache read is not a reason to fail the brief.
    }

    if (!freePass) {
      const ip = request.headers.get("cf-connecting-ip") ?? "anon";
      const rlKey = `rl:${ip}:${new Date().toISOString().slice(0, 13)}`;
      try {
        const n = parseInt((await kv.get(rlKey)) ?? "0", 10);
        if (n >= 5) return line({ t: "error", code: "rate_limited" });
        await kv.put(rlKey, String(n + 1), { expirationTtl: 3700 });
      } catch {
        // Rate limiting is best-effort; a KV miss never blocks a brief.
      }
    }
  }

  let exaBudget = false;
  const spendKey = `spend:${new Date().toISOString().slice(0, 7)}`;
  if (kv) {
    try {
      exaBudget = parseFloat((await kv.get(spendKey)) ?? "0") >= 8.0;
    } catch {
      exaBudget = false;
    }
  }

  const s = body.snitcher ?? {};
  const source = body.source === "spotter" ? "spotter" : "typed";
  const firmo: Partial<Firmo> = {
    industry: s.industry ?? null,
    size: s.size ?? null,
    city: s.city ?? null,
    country: s.country ?? null,
    source,
  };
  return stream(async (w) => {
    const write = async (o: unknown) => w.write(`${JSON.stringify(o)}\n`);
    await write({ t: "start", domain, cached: false });
    const events: BriefEvent[] = [];
    const emit = (e: BriefEvent) => {
      events.push(e);
      void write(e);
    };
    try {
      const r = await runBrief({
        domain,
        name: s.name ?? (typeof body.name === "string" ? body.name.trim().slice(0, 200) || undefined : undefined),
        firmo,
        exaKey: env.EXA_API_KEY,
        jevKey: env.TYPESAFE_API_KEY,
        exaBudget,
        emit,
      });
      await write({ t: "brief", brief: r.brief, totalMs: r.totalMs, exaCost: r.exaCost, jevTokens: r.jevTokens, rejectedHost: r.rejectedHost });
      // A degraded brief must not sit in the cache for a week.
      const cacheable = !r.notices.some((n) => n.endsWith("_down"));
      if (kv) {
        waitUntil(
          Promise.all([
            cacheable
              ? kv.put(cacheKey, JSON.stringify({ events, brief: r.brief, raw: r.raw, firmo: r.firmo, totalMs: r.totalMs, exaCost: r.exaCost, jevTokens: r.jevTokens, rejectedHost: r.rejectedHost }), {
                  expirationTtl: 7 * 86400,
                })
              : Promise.resolve(),
            r.exaCost > 0
              ? kv.get(spendKey).then((cur) => kv.put(spendKey, String((parseFloat(cur ?? "0") || 0) + r.exaCost), { expirationTtl: 45 * 86400 }))
              : Promise.resolve(),
          ]).catch(() => {}),
        );
      }
    } catch {
      // runBrief guards its own API calls; this is a last-resort net so the
      // client always gets a terminal event instead of a hung stream.
      const fallback = interpret({
        firmo: { name: s.name ?? domain, domain, founded: null, ...firmo } as Firmo,
        entityRaw: null,
        home: null,
        jev: null,
      });
      await write({ t: "brief", brief: fallback, totalMs: 0, exaCost: 0, jevTokens: null });
    }
  });
};
