# The AirOps output contract

This is the only thing that has to change inside AirOps.

AirOps no longer writes to Sanity. It produces **one JSON object per post** and
nothing else. A versioned script in this repo (`scripts/ingest-post.ts`) does
every schema-shaped thing: validation, markdown → Portable Text conversion,
byline resolution, the publish decision.

## Why it was moved

The Sanity field mapping used to live in the AirOps UI. That made the schema
contract untestable, unversioned and invisible to code review. When
`standfirst`, `category` and `publishedAt` became required in the August 2026
migration, nothing failed loudly — AirOps kept emitting documents the content
lake rejected, and the few that landed were typed `blogPost` (Filament's
document type, not ours). Those were invisible to every site query *and*
permanently unpublishable, because `_type` is immutable in Sanity.

Eight defects were catalogued. Every one of them is now either impossible or
caught before publication — but only because the contract is a file with tests
rather than a panel in a SaaS product. **Do not reconnect AirOps' Sanity
integration.** It is the failure mode, not the feature.

## What AirOps emits

One JSON object. No Sanity call, no Portable Text, no `_type`, no `_key`.

```json
{
  "title": "How to choose an ad server for a small publisher",
  "standfirst": "Most comparison posts rank ad servers by feature count. That is the wrong axis for a publisher doing under fifty million impressions a month.",
  "excerpt": "A practical guide to picking an ad server as a small publisher, judged on fill, support and exit cost rather than feature count.",
  "category": "resources",
  "targetQuery": "how to choose an ad server",
  "tags": ["adtech", "publishers", "ad serving"],
  "keyTakeaways": ["…", "…", "…"],
  "faq": [{"question": "…", "answer": "…"}],
  "bodyMarkdown": "## Section\n\nprose…",
  "sources": ["https://…"]
}
```

| Field | Rule | Enforced |
|---|---|---|
| `title` | required, no trailing punctuation | blocks the write |
| `standfirst` | required. The deck under the H1 — written to be read, not to rank. Never a truncated copy of `excerpt` | blocks the write |
| `excerpt` | required, **≤ 160 characters**. SERP meta description only; never shown on the page | blocks the write |
| `category` | required, must be `resources` | blocks the write |
| `keyTakeaways` | **exactly 3** strings. It is "The gist" — a summary, not an outline | blocks the write |
| `faq` | 3+ `{question, answer}` pairs. Emitted as `FAQPage` JSON-LD | blocks auto-publish |
| `targetQuery` | required. The one search query this post answers | blocks auto-publish |
| `tags` | 2–5 lowercase strings. Drives the related-posts fallback | blocks auto-publish |
| `bodyMarkdown` | required, the dialect below | blocks the write |
| `sources` | every URL cited. Each is fetched and must not 4xx/5xx | blocks auto-publish |

`category` is restricted to `resources` on purpose: it is the only category whose
`loopsList` is `null`. That null is what guarantees these posts are **never
emailed to the newsletter**. The ingest script refuses any category with a
mailing list attached rather than trusting configuration to stay correct.

## The markdown dialect

Narrower than markdown. Anything outside this list is a hard error, because the
`body` schema has no way to represent it and the historical failure was silent
degradation into literal characters on the page.

| Write | Becomes |
|---|---|
| `## `, `### `, `#### ` | h2 / h3 / h4 |
| `- item` / `1. item` | bullet / numbered list |
| `> quote` | blockquote |
| ` ```ts ` … ` ``` ` | `codeBlock` |
| `---` | `divider` |
| `**bold**`, `_italic_`, `` `code` `` | marks |
| `[text](url)` | a real link annotation |
| `:::callout note\|warning\|key <title>` … `:::` | `callout` |
| `:::stat` `value \| label \| source` `:::` | `keyStat` |
| `:::quote` text `—attribution` `:::` | `pullQuote` |
| `![alt](url)` | `figure` — alt text is mandatory |

### Forbidden

- **`# ` anywhere.** The post title is the only H1 on the page. Start at `## `.
- **Markdown tables.** `body` defines no table block. A table lands as literal
  pipes and dashes. Rewrite as a qualified list or a `:::callout`.
- **Headings deeper than h4.**
- **Repeating the title as the first line of the body.**
- **Inlining the FAQ as prose.** It goes in the `faq` field, or no `FAQPage`
  JSON-LD is emitted and the main answer-engine surface is lost.
- **Nesting inline marks** (bold inside a link, etc.). The parser is a flat
  scanner by design.

## Citation rules

These exist because the August audit found both failure modes in one draft.

1. **Never inflate precision.** If the source says 75%, write 75% — not "more
   than 75%". Do not combine categories the source reports separately ("very
   good or excellent" when the source only measured "very good").
2. **Cite the page a human can open.** The Edelman PDF 403s even with a browser
   user-agent; the write-up of it does not. Every URL in `sources` is fetched
   during ingest and a 4xx/5xx blocks auto-publish.
3. **Put a link in the same paragraph as a number.** Any paragraph containing a
   percentage, a multiple, or a currency figure with no link in it is flagged as
   an unsourced claim and blocks auto-publish. Statistics that stand alone
   belong in a `:::stat` with its `source` filled in.

## What happens after AirOps

```
AirOps  →  envelope.json
              ↓
        scripts/ingest-post.ts        validate, convert, write
              ↓
        drafts.post-<slug>            (no hero yet)
              ↓
        scripts/backfill-heroes.ts    Openverse → dither → upload
              ↓
        scripts/ingest-post.ts        re-run, same envelope
              ↓
        post-<slug>                   published
              ↓
        Sanity webhook → Cloudflare Pages deploy hook → live
```

Re-running `ingest-post.ts` with an unchanged envelope is a no-op: block keys are
derived from content, so identical input produces byte-identical output. That is
what makes the second run safe as a promotion step rather than a rewrite.

The publish decision is automatic but conditional. Content problems that only a
human should adjudicate — a dead citation, an unsourced statistic, a missing
`targetQuery` — leave the post as a draft with the reasons printed, rather than
publishing something wrong. A generation failure degrades to "waiting", never to
"live and wrong".

## Cadence

Two posts a week. Each is an independent envelope and an independent ingest run;
there is no batch mode, and a failure on one must never block the other.

## Running it

```bash
node --experimental-strip-types scripts/ingest-post.ts --file post.json
node --experimental-strip-types scripts/ingest-post.ts --file post.json --dry-run
node --experimental-strip-types scripts/ingest-post.ts --file post.json --draft
cat post.json | node --experimental-strip-types scripts/ingest-post.ts
```

Reads `SANITY_WRITE_TOKEN`, `SANITY_PROJECT_ID`, `SANITY_DATASET` from `.env`.
