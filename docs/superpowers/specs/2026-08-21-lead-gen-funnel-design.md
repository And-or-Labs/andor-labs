# Lead-generation funnel — design

Date: 2026-08-21
Status: in build on `lead-gen-funnel`. Scoring model revised 08-21 (grade, not score).
Branch: `lead-gen-funnel`

## What this is

A one-field lead magnet in the site header. A visitor types a work email; the
ANDOR/OS terminal in the hero expands into a modal, streams a live audit of
their site against peer-reviewed SaaS optimisation research, and shows three of
six scored areas. The other three are redacted behind a "Book a call". The email
lands in a new Loops list on submit.

Three surfaces change: the header (button becomes a field), the hero terminal
(gains a modal state and a corrected type scale), and `functions/` (gains a
streaming audit endpoint).

## Decisions already fixed

These were settled before this document and are not open:

| Decision | Choice |
|---|---|
| Header input | One field: email only |
| Where the URL comes from | Derived from the email's domain |
| Free-mail addresses | Fall through to a URL prompt in the modal |
| What a "finding" is | One of the six playbook subsections |
| Gate | Worst three shown open, other three redacted by name |
| Results surface | The hero terminal, expanded as a dismissable modal |
| Scoring execution | In-request, streamed response body |
| Loops write | On submit, before scoring starts |
| Loading copy | "Overshares about the process" variant |

## The positioning change (DONE — 08c484b)

Widened in this branch rather than separately, at VJ's call. Recorded here
because the hazards below are permanent facts about these files.

`src/config.ts` currently has `ICP = "adtech"`, with `ICP_STARTUPS` derived as
`ICP` plus the word "startups", so setting `ICP = "early-stage technology"`
yields the right noun phrase. Two hazards, both documented in `config.ts` itself and
both re-learned in `6cbbffa`:

- **`PROMISE` does not interpolate `ICP`.** It spells out "advertising
  technology" as a literal string, precisely so the sentence reads well — which
  means it is the one surface that will not follow automatically. `config.ts`'s
  own comment says the two must be moved together.
- **`ICP` is interpolated bare, not only via `ICP_STARTUPS`.** Nine files read
  it: `Newsletter`, `FAQ`, `FounderNote`, `Capabilities`, `blog/index`,
  `blog/rss.xml`, `llms.txt`, `lab/capabilities`, and `scripts/create-author.ts`.
  Each needs reading, not just recompiling — `6cbbffa` had to rewrite an FAQ
  answer that opened "Those three share a buyer" once the set stopped having
  three members.

Checked and NOT needed, contrary to the original scope: `SITE_TITLE` and the
`og.png` headline are both the H1 verbatim, which carries no ICP, so no card
re-render. `SiteFooter` has no positioning copy. The `"your ICP"` strings in
`Capabilities` are the marketing term, not the constant. Still outstanding: the
Sanity author document, which only refreshes on a `create-author.ts` re-run.

Resolved permanently: `PROMISE` now DERIVES from `ICP_STARTUPS`, so the hazard
above is retired rather than merely survived.

## Provenance of the rules

The rule set is the 26 recommendations in sections 1 and 2 of *The
Science-based Playbook of SaaS Optimization* (Science Says). That PDF is a paid
product, watermarked to a single purchaser on every page, so **the tool cites
the underlying peer-reviewed papers, not the playbook**. The playbook names its
source study for every rule (Wirtz et al., *Journal of Business Research*, 2021
for productization, and so on); those citations are the provenance the tool
publishes. No playbook text is reproduced.

This is a licensing decision, not a scoring one. The rules are unchanged.

## The rule set

26 rules across six subsections. Three are lifecycle behaviours invisible to an
outside crawl — in-trial engagement prompts, extensions-instead-of-discounts,
and the video quality-versus-features distinction — leaving **23 auditable**.

| § | Subsection | Rules | Auditable | Needs |
|---|---|---|---|---|
| 1 | Brand and messaging | 2 | 2 | homepage |
| 1 | Page design and visuals | 7 | 6 | homepage |
| 1 | Social proof and reviews | 3 | 3 | homepage |
| 2 | The plans | 8 | 8 | pricing page |
| 2 | Free trials | 4 | 2 | pricing page |
| 2 | Freemium | 2 | 2 | pricing page |

### Audience fit

`ICP` was narrowed to adtech in `6cbbffa`, and is now being widened again to
**early-stage technology startups**. That widening is a prerequisite for this
funnel making sense, and it is tracked separately (see "Depends on" below).

The wider ICP is a materially better fit. Early-stage technology startups are
self-serve SaaS almost by definition: they publish pricing, run free trials and
ship freemium tiers. All 23 auditable rules apply to them, and a *SaaS*
optimisation playbook stops being a strained fit for the audience and becomes
the obvious one. Under the adtech-only ICP, 12 of the 23 rules needed a pricing
page that enterprise adtech vendors routinely do not publish.

### The output is a GRADE, not a score

Revised 2026-08-21. The audit reports a grade, A–E. The percentage still exists
inside `playbook.ts` — ranking six subsections needs an ordering — but it never
crosses the wire, and a test asserts that.

The reason is structural, not presentational. **This battery is expected to
grow**: VJ is adding his own checks over time. Every check added moves the
denominator, so a site that changed nothing slides from 72 to 68 and a returning
visitor reads noise we created as a regression in their own work. A grade
absorbs that — the bands keep meaning the same thing while what feeds them
changes underneath.

### Two mechanisms, deliberately separate

**The denominator is dynamic.** A rule the crawl could not observe leaves the
numerator and the denominator both; it is never scored zero. That keeps the
internal ratio honest so subsection ranking means something, and it stops a
pre-launch startup being marked down twelve times for a page it has not built.

**Ceilings price the structural gaps.** A `GradeCap` is the highest grade
attainable while some condition holds. Two are declared:

| Condition | Ceiling | Why |
|---|---|---|
| No public pricing page | `C` | Most of how a buyer self-qualifies, and the precondition for half the rule set |
| Homepage renders client-side | `D` | Most of the site could not be read, so most of it cannot be credited |

A ceiling can only lower a grade, never raise one, and only **binding** caps are
reported — a site already at E trips the pricing condition, but telling that
visitor they are "capped at C" is nonsense and makes the scorer look broken.

This split is why a flawless site with no pricing page grades **C** rather than
either A (the old behaviour, indefensible) or 46/100 (the rejected alternative,
a punishment nobody can interpret). One legible sentence prints next to the
grade instead.

**Adding your own checks:** append to `RULES` for a new check, or `GRADE_CAPS`
for a new structural gate. Caps compose — the strictest wins — so a new one
cannot silently loosen an existing one, and none of the scoring maths changes.

## Architecture

```
header form  ──POST /api/audit──►  Pages Function
     │                                  │
     │  1. validate email               │
     │  2. derive host                  │
     │                                  ├─► Loops  (fire first, never awaited
     │                                  │           into the failure path)
     │                                  ├─► D1     (cache lookup by host)
     │                                  ├─► readSite()      crawl.ts
     │                                  └─► askLadder() ×2  providers.ts
     ▼                                        │
terminal modal  ◄──── streamed NDJSON ────────┘
```

### Endpoint

`POST /api/audit`, a new Pages Function. Responds `200` with a streamed
`application/x-ndjson` body. One JSON object per line:

```
{"t":"step","label":"Reading your homepage","status":"OK"}
{"t":"step","label":"Finding your pricing","status":"EVENTUALLY"}
{"t":"result","grade":"C","gradeLabel":"leaking","caps":[…],"findings":[…],"lockedItems":[…]}
```

Two hard constraints, both learned the expensive way on Rank My AdTech and
recorded in `docs/`:

- **No `waitUntil`.** It is bounded at 30 seconds and this run will not fit.
  Scoring happens inside the request.
- **The response body streams from the first millisecond.** Cloudflare's edge
  cuts a request that has sent no bytes at roughly 100 seconds; a body that is
  already flowing has no such bound. The step lines are not decoration — they
  are what holds the connection open.
- **Failures ship as `200` with `{"t":"failed"}`.** Cloudflare Pages replaces
  any 5xx body with its own error page, so a designed failure sent as 5xx
  reaches the browser as HTML and the client's JSON parse throws instead of
  rendering the message.

### Reuse

Taken as-is from the shelved Rank My AdTech engine, which stays shelved:

- `functions/_lib/crawl.ts` — `readSite()`, multi-page fetch with a
  context.dev JS-render fallback and a `thin` flag. Already fetches `/pricing`
  as a first-class page, which is exactly what §2 needs.
- `functions/_lib/providers.ts` — `askLadder()`, provider ladder with
  per-provider timeouts, JSON extraction and retries.
NOT `functions/_lib/bands.ts`. Its ladder is calibrated out of 30, so handing
it a percentage returns the top band for every site above 24/100. `playbook.ts`
carries its own grade ladder.

New: `functions/_lib/playbook.ts`, holding the 23 rules, their subsections,
weights, citations, and the observability predicate for each.

Two ladder calls, not 23. One scores §1 from the homepage read, one scores §2
from the pricing read. Batching by section is what keeps the run inside a
sensible latency budget; prompt length is the latency budget.

### Cost control

The endpoint is public and every call costs a crawl plus two model calls.

- **D1 cache keyed by host**, 30-day TTL. A repeat submission for a host
  already scored replays from cache and streams the step lines at a synthetic
  cadence so the experience is identical.
- **Rate limit** by IP in the same D1 table: 5 audits per hour.

The predecessor's cache (`scripts/lib/rank-cache.ts`) was written but never
wired to the request path, so there was never a free replay. This one is on the
request path from the first commit or it is not worth writing.

## The header

`SiteHeader.astro`'s primary CTA is currently a `Book a call` button pointing at
`BOOKING_URL`. It becomes an email field.

Note what that does to the page: **the header stops asking for a booking
directly.** The gate CTA inside the modal is also `Book a call`, so the ask is
not removed, it is deferred by one step and arrives with a score attached. The
hero's own `Book a call` button is untouched and remains the direct path.

The mobile menu keeps its `Book a call` button. A sticky-header form at ≤560px
is a worse experience than the button it would replace, and the mobile menu is
already the overflow surface for exactly this kind of thing.

## The terminal

### Type scale and ratio

Today, at the 1200px container: `(1200 − 48 gutter − 64 gap) / 2` = **544px per
column**, and `aspect-ratio: 9/4` makes the screen **544 × 242px**.

The widest boot line is 35 characters. At `font-size: 12px` and Departure Mono's
0.6564em effective advance (0.6364 advance + 0.02 tracking), that is 276px of
text plus 28px of padding = **304px in a 544px box. 44% of the screen is empty.**

The existing responsive rules size the log in `vw`. The constraint is not the
viewport — it is the grid column, and the two diverge the moment the layout has
two tracks. That is why three separate breakpoint patches still leave desktop
broken. The comment in `components.css` already identifies the problem
correctly ("the constraint is continuous and a stepped breakpoint cannot satisfy
it") and then reaches for the wrong unit.

Fix:

```css
.aol-term__screen { container-type: inline-size; }

.aol-term__log {
  font-size: clamp(9px, 3.2cqw, 17.5px);
  line-height: 1.6;
  padding: 1.6em 1.15em;
}

@media (min-width: 881px) { .aol-term__screen { aspect-ratio: 5 / 3; } }
```

Delete the `881–1000px`, `≤560px` and `≤480px` font-size overrides. They exist
only to compensate for the wrong unit, and deleting them also removes the
source-order hazard the surrounding comment warns about.

`LEADER_COL` goes from 24 to 26, because the chosen loading copy's longest label
is 23 characters and a single dot reads as a full stop rather than a leader.
That makes the widest line 38 characters.

Resulting geometry at the 544px column: 17.4px type, widest line 436px + 40px
padding = **476px of 544, an 87% fill**. Ten lines at 1.6 leading = 278px plus
56px padding = 334px, against `5/3` = 326px — content wins by 8px, which is the
documented and intended behaviour. The 8-line resting log fits with slack.

Ratio and font-size are one decision, not two: `white-space: pre` plus a fixed
character count gives the log its own intrinsic ratio, and any hardcoded
`aspect-ratio` that disagrees with the type scale produces dead space on one
axis. `5/3` is derived from the content at the corrected type scale, not chosen.

### The NVIDIA stamp

At 17.4px the log lines reach x≈476 and the stamp's box starts at x≈435. They
collide. The stamp is **hidden whenever the terminal is in audit or modal
state** — it is a hero credential, not part of somebody's scorecard. It is
unchanged in the resting state, where the log is short enough to clear it.

### Modal

Native `<dialog>`, not a bespoke overlay: focus trap, Esc, background `inert`
and `::backdrop` all come free, and each is a thing not to write or get wrong.

- Dismissable three ways: Esc, backdrop click, and an `[ESC]` control replacing
  `CRT-01` in the head strip.
- Opening FLIPs from the hero terminal's measured rect to the dialog rect, so it
  reads as the terminal expanding rather than a modal arriving. Closing
  reverses. Under `prefers-reduced-motion` it shows and hides with no transform.
- The hero terminal stays in the DOM and keeps its resting boot log. The modal
  is a second instance of the same chrome, so the two states cannot drift.
- ≤560px: near-fullscreen, head strip pinned, screen scrolls.

### Loading copy

Same dotted-leader grammar. Reading down the status column on lines 5 and 6
gives "YOU'RE / WELCOME" — that alignment is the joke and must survive any
future change to `LEADER_COL`.

```
Waking up the crawler ..... OK
Reading your homepage ..... OK
Finding your pricing ...... EVENTUALLY
Reading 23 studies ........ AGAIN
So you don't have to ...... YOU'RE
Applying the science ...... WELCOME
Doing the arithmetic ...... OK
Rounding in your favour ... NO

> report ready
```

Steps are driven by the stream, not a timer. A step that resolves faster than
its predecessor still prints in order; the client queues lines at a minimum
cadence so the log never flickers past unread.

## Results rendering

`ScorecardReport` from the canonical Claude Design system
(`951d1bec`, `components/data/ScorecardReport.jsx`) — the "tractor" component,
named for the tractor-feed exploration it came from. **It is not in the local
`~/Developer/andor-design-system` checkout, which is stale; pull, do not push.**

Its interface already is this feature:

```ts
findings: ScorecardFinding[];  // "Exactly three are rendered — the ungated preview."
lockedItems?: string[];        // "rendered as redaction bars, never as readable text"
ctaLabel?: string;             // default "Book a call"
```

`ScorecardFinding.score` is a string (`"9 / 20"`), which is what makes the
six-subsection model the right granularity — a per-rule model would have wanted
a boolean.

**The gate is enforced server-side.** `lockedItems` carries subsection *names*
only. The withheld findings are never serialised into the stream, so the gate
survives View Source. A CSS blur would ship the whole payload to the browser and
defeat itself.

Astro renders it; the modal needs a React island (`client:load`) since the DS
component is JSX. `@astrojs/react@6` is already required by this repo — not v5.

## Loops

`functions/api/subscribe.ts` already maps list keys to Loops ids in
`LIST_BY_CATEGORY` and is the model to follow. The audit adds:

- a new list key `saas-audit` → its Loops list id
- a new allowed source, `header-audit`
- the contact carries `auditDomain` and `auditScore` as properties, so the
  nurture sequence can reference the score

`LOOPS_API_KEY` **is set in production** — verified 2026-08-21 via
`wrangler pages secret list --project-name andorlabs`. This closes the disputed
note that claimed subscribe may be 503-ing. `CONTEXT_DEV_API_KEY`,
`GEMINI_API_KEY`, `NVIDIA_API_KEY` and `OPENCODE_API_KEY` are all set too, so
every secret this feature needs is already provisioned.

**Open action for VJ:** the Loops list itself must be created in the Loops
dashboard and its id pasted into `LIST_BY_CATEGORY`. The Loops API lists
existing lists but does not create them. This is the one thing that cannot be
done from the repo.

## Error handling

| Condition | Behaviour |
|---|---|
| Malformed email | Inline field error, no request sent |
| Free-mail domain | Modal opens, asks for the URL, then proceeds |
| Host does not resolve | `{"t":"failed"}`, modal offers a URL correction |
| Crawl returns `thin` | Audit proceeds; §1 findings say the page was unreadable, affected rules leave the denominator |
| No pricing page found | §2 subsections render `n/a` with the reason; denominator shrinks |
| Whole ladder fails | `{"t":"failed"}`, modal shows a retry and the booking link. Email is already in Loops |
| Rate limited | `{"t":"failed"}` with a plain-language message |

The email reaching Loops does not depend on any of these. That write happens
before the crawl starts.

## Testing

- **Unit** — `playbook.ts`: the observability predicate, the dynamic
  denominator, subsection ranking, and that exactly three findings and three
  locked names come out of six subsections.
- **Unit** — gate integrity: a serialised result never contains withheld
  finding bodies. This is the test that keeps the gate real.
- **Unit** — domain derivation: free-mail list, subdomains, plus-addressing,
  uppercase, trailing dots.
- **Unit** — NDJSON framing: partial lines across chunk boundaries.
- **Integration** — endpoint against a fixture site, asserting the first byte
  arrives well before the model calls resolve.
- **Manual** — the type scale at 1200px, 1000px, 881px, 560px and 375px, since
  the whole point is that it is continuous. Preview from the dev build
  (`portless andor npm run dev`), not production — the DEV-gated CopyDiffer and
  Agentation are stripped from prod.

## Out of scope

- Permalink pages per audited domain, and OG cards for them
- Emailing the full report; the withheld half is released on the call, which is
  the entire point of the gate
- Section 3 of the playbook (LTV and MRR) — post-signup lifecycle, invisible to
  a crawl
- Restoring anything from Rank My AdTech to the site
