-- Cache and rate limit for the header audit funnel.
--
-- /api/audit is public and every uncached call costs a multi-page crawl plus
-- two model calls. Both tables are on the request path from the first commit,
-- deliberately: the predecessor's cache (scripts/lib/rank-cache.ts) was written
-- and never wired in, so there was never a free replay and nobody noticed until
-- the bill. A cache that is not consulted is a file, not a cache.

-- One row per audited host. The payload is the finished result object, already
-- gated: the withheld findings are not in it, so a cache read cannot leak what
-- a live run would not have sent.
CREATE TABLE IF NOT EXISTS audit_cache (
  host        TEXT PRIMARY KEY,
  payload     TEXT NOT NULL,
  score       INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Reads are always "this host, is it fresh enough", so the TTL sweep and the
-- lookup both want created_at.
CREATE INDEX IF NOT EXISTS idx_audit_cache_created ON audit_cache (created_at);

-- Fixed-window rate limiting, 5 audits per hour per IP.
--
-- A fixed window rather than a sliding one on purpose. The failure mode of a
-- fixed window is that somebody gets ten runs across a boundary, which costs a
-- few cents; the failure mode of hand-rolling a sliding window in D1 is a row
-- per request and a cleanup job. The cheap approximation is the right one here.
CREATE TABLE IF NOT EXISTS audit_rate (
  ip          TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip, window_start)
);

CREATE INDEX IF NOT EXISTS idx_audit_rate_window ON audit_rate (window_start);
