/**
 * Cache and rate limit for the audit endpoint.
 *
 * Separate from the endpoint because both halves are worth testing without a
 * crawl, and because the request path reads better when "is this allowed" and
 * "have we already done this" are two named calls rather than eight lines of
 * inline SQL.
 *
 * Every function here fails OPEN. A D1 outage must not take the funnel down: a
 * missed cache hit costs a crawl, and a missed rate-limit check costs a few
 * cents, but a thrown exception costs the lead. The one thing we never do is
 * let a storage problem become the visitor's problem.
 */

export interface AuditStoreEnv {
  RANKINGS?: D1Database;
}

/** How long a result stays fresh. Sites do not change their pricing weekly. */
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Fixed window, and how many runs are allowed inside one. */
export const RATE_WINDOW_MS = 60 * 60 * 1000;
export const RATE_LIMIT = 5;

export interface CachedAudit {
  payload: unknown;
  score: number;
  ageMs: number;
}

/**
 * A previous result for this host, if one is still fresh.
 *
 * The stored payload is the already-gated result — withheld findings were never
 * serialised into it — so replaying from cache cannot leak more than a live run
 * would have sent.
 */
export async function readCache(
  env: AuditStoreEnv,
  host: string,
  now: number,
): Promise<CachedAudit | null> {
  if (!env.RANKINGS) return null;
  try {
    const row = await env.RANKINGS.prepare(
      "SELECT payload, score, created_at FROM audit_cache WHERE host = ?1",
    )
      .bind(host)
      .first<{ payload: string; score: number; created_at: number }>();

    if (!row) return null;

    const ageMs = now - row.created_at;
    if (ageMs > CACHE_TTL_MS) return null;

    return { payload: JSON.parse(row.payload), score: row.score, ageMs };
  } catch (err) {
    // A malformed row is a cache miss, not an error. Same for an unreachable D1.
    console.error("[audit] cache read failed:", err);
    return null;
  }
}

export async function writeCache(
  env: AuditStoreEnv,
  host: string,
  payload: unknown,
  score: number,
  now: number,
): Promise<void> {
  if (!env.RANKINGS) return;
  try {
    await env.RANKINGS.prepare(
      `INSERT INTO audit_cache (host, payload, score, created_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(host) DO UPDATE SET
         payload = excluded.payload,
         score = excluded.score,
         created_at = excluded.created_at`,
    )
      .bind(host, JSON.stringify(payload), score, now)
      .run();
  } catch (err) {
    // The audit already succeeded and is already streaming. Failing to memoise
    // it is not worth turning into a visible failure.
    console.error("[audit] cache write failed:", err);
  }
}

export interface RateVerdict {
  allowed: boolean;
  /** Runs left in the current window, after this one. */
  remaining: number;
  /** When the window rolls over, for the message. */
  resetsAt: number;
}

/**
 * Count this request against the caller's hourly allowance.
 *
 * Called only on a cache MISS. A cached replay costs nothing to serve, so
 * metering it would punish the cheap path and push people toward the expensive
 * one — the opposite of what the limit is for.
 */
export async function checkRate(
  env: AuditStoreEnv,
  ip: string,
  now: number,
): Promise<RateVerdict> {
  const windowStart = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  const resetsAt = windowStart + RATE_WINDOW_MS;

  if (!env.RANKINGS || !ip) return { allowed: true, remaining: RATE_LIMIT, resetsAt };

  try {
    // Upsert-and-read in one statement: two round trips would race two tabs
    // against each other, and D1 gives us RETURNING to avoid it.
    const row = await env.RANKINGS.prepare(
      `INSERT INTO audit_rate (ip, window_start, count)
       VALUES (?1, ?2, 1)
       ON CONFLICT(ip, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
      .bind(ip, windowStart)
      .first<{ count: number }>();

    const count = row?.count ?? 1;
    return { allowed: count <= RATE_LIMIT, remaining: Math.max(0, RATE_LIMIT - count), resetsAt };
  } catch (err) {
    console.error("[audit] rate check failed:", err);
    return { allowed: true, remaining: RATE_LIMIT, resetsAt };
  }
}

/**
 * Drop expired rows.
 *
 * Called opportunistically on a small fraction of requests rather than on a
 * schedule, because Pages Functions have no cron and a table this small does
 * not justify a Worker. Rate windows are swept aggressively; cache rows live
 * out their TTL.
 */
export async function sweep(env: AuditStoreEnv, now: number): Promise<void> {
  if (!env.RANKINGS) return;
  try {
    await env.RANKINGS.batch([
      env.RANKINGS.prepare("DELETE FROM audit_rate WHERE window_start < ?1").bind(
        now - RATE_WINDOW_MS * 2,
      ),
      env.RANKINGS.prepare("DELETE FROM audit_cache WHERE created_at < ?1").bind(
        now - CACHE_TTL_MS,
      ),
    ]);
  } catch (err) {
    console.error("[audit] sweep failed:", err);
  }
}
