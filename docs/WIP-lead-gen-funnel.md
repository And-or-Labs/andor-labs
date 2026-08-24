# Lead-gen funnel — WIP, 2026-08-22

The hero's email field runs a free audit of the sender's own domain and streams
the result in place.

**It runs THREE checks, not twenty-three.** One from each of three subsections
of the Science Says SaaS playbook, picked by `sampleChecks()`. The other twenty
are never run — they are named, by area and count, as the offer.

That is a deliberate reversal. Scoring all twenty-three cost six model calls, a
completion round and thirty to forty-five seconds, and then published a
pass/fail for every one of them: the gate withheld the evidence but gave away
the verdict, which is most of what a visitor came for. A sample is faster,
costs a fraction, and leaves the rest genuinely unopened.

**There is no grade.** A letter derived from a three-check sample is a
fabricated metric, and on a page that sells peer-reviewed method it is the
fabrication a reader would be right to catch. The header states what ran and
what it found.

Branch `lead-gen-funnel`. **Not deployed.**

## Running it locally

Two processes. The API is a Pages Function, so `astro dev` alone serves the page
but not `/api/audit`; astro proxies `/api` to the worker.

```
npm run dev        # astro, 127.0.0.1:4321  (via portless: https://andor.localhost)
npm run dev:api    # wrangler pages dev on :8788, serving dist/
```

`dev:api` needs a `dist/`, so run `npm run build` first and again after any
change to `functions/`.

⚠️ **Bind D1 by database_id, never by name.** `--d1 RANKINGS=andor-rankings` is
accepted and silently binds a local store keyed by that *string*, which is a
different database from the one `wrangler d1 migrations apply --local` writes
(keyed by `database_id`). Symptom: `no such table: audit_cache` in the worker
log, an empty `audit_cache` after successful runs, and every request paying for
a full crawl. `npm run dev:api` has the id baked in — use the script.

Apply migrations locally once:

```
npx wrangler d1 migrations apply andor-rankings -c d1.wrangler.jsonc --local
```

## Verified 2026-08-22

Against `plausible.io`, through the real form, on `127.0.0.1:4321`:

| | |
|---|---|
| Cold run | **9.4s**, 3 checks run, 1 failed, 20 named |
| Cached replay | **0.7s**, `cached: true`, no ticks |
| `audit_cache` after a run | one row, score 59 |
| `audit_rate` after a run | count 1 |
| Main-frame navigations across submit | **0** |
| Page errors | none |

## Blockers before deploy

1. **Migration `0012_audit_funnel.sql` is not applied in production.** Confirmed
   2026-08-22: `audit_cache` and `audit_rate` are both absent from the remote
   database. Both failures are caught and logged rather than raised — by design,
   since a visitor's audit should not fail because the memo did not save — so
   deploying without this does not break the feature, it just makes every single
   audit an uncached, unthrottled, fully paid crawl. That is the exact failure
   the migration's own comment was written about.

   ```
   npx wrangler d1 migrations apply andor-rankings -c d1.wrangler.jsonc --remote
   ```

2. **`AUDIT_LIST_ID` is empty** in `functions/api/audit.ts`. VJ creates the list
   in the Loops dashboard — the API can list lists but cannot create one — and
   the id gets wired in last.

3. **`FIRECRAWL_API_KEY` is not set in production.**

   ```
   npx wrangler pages secret put FIRECRAWL_API_KEY --project-name andorlabs
   ```

`LOOPS_API_KEY` is absent from the local worker too, so local runs log
`lead dropped` and bank nothing. That is expected locally and not a code fault.

## Known gap

There is no client-side timeout on the stream. A run that never sends `result`
leaves the bar sitting and the visitor with no message. The server path is
in-request and streams heartbeats, so the edge cannot silently cut it, but a
stalled upstream would still present as an indefinite wait.

⚠️ An earlier note here cited two observed stalls as evidence for this. That
evidence was wrong: the test harness called
`page.waitForFunction(fn, { timeout })`, whose second positional argument is
`arg`, not `options` — so the timeout was passed as a page argument and the wait
silently used Playwright's 30s default. The runs were not stalling; the harness
was giving up. The gap above is still a real design observation, but nothing has
been seen to hit it. Use `waitForFunction(fn, null, { timeout })`.
