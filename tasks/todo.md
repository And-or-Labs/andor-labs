# And/or Labs rebuild (2026-10-01)

## Decisions

- Start fresh from Mainline (shadcn/ui + Tailwind 4 + Astro). The old site is in git history before this commit.
- Shared system: `@andor/ds` (public repo eclecticv/andor-ds, pinned tag) owns tokens, the header, footer and section primitives. Product themes change values only.
- Theme `andor`: white, electric blue action colour, four markers, soft radius. Geist for headings and body; Departure Mono for labels and numbers only.
- One-page landing plus MDX blog. Sanity, the ranker, the audit funnel, `/lab`, `/tools` and `/work` removed; old routes 301 to `/`.
- Claims: VJ led marketing and sales ops at Blockthrough and AdPushup through their acquisitions.

## Done

- [x] Mainline base, Vercel adapter and demo pages removed
- [x] `@andor/ds` v0.1.0 published with `andor` and `mediacontext` themes and README docs
- [x] Landing: hero, launch partners, lines of work, services and offers, Filament case study, testimonials, about, press, writing and signup, FAQ, closing CTA
- [x] 12 Sanity posts exported to MDX with hero images; blog index, post template, RSS at `/blog/rss.xml`
- [x] Desktop and 390px mobile pass

## Open

- Delete the `GEMINI_API_KEY` secret and the Sanity project (awaiting VJ's go-ahead). Done 2026-10-05: the `andor-rankings` D1 database and the `RANKINGS` Pages binding (production and preview) were deleted; backup at `~/Developer/mediacontext/.scratch/infra-audit/andor-rankings-backup.sql`
- MediaContext adopts `@andor/ds` header, footer and `mediacontext` theme

## Rebuild on Mainline, verbatim (2026-10-01, later)

- [x] Reset to upstream Mainline f92afce (commit 10ffa9b)
- [x] Colour and font values only (00ee986)
- [x] Content swaps: strings, links, data entries, images at Mainline dimensions (4608b01)
- [x] Pricing removed from the homepage (no plans shown); block untouched
- [x] @andor/ds v0.2.0: Mainline verbatim + themes + `scripts/check.mjs`
- [x] Checker passes; preview at https://rebuild-preview.andorlabs.pages.dev

Review: the first rebuild re-authored Mainline's primitives in a new DS. This one is Mainline plus values and content; `check.mjs` enforces it.

## Five-line IA + Hairline figures (2026-10-05, uncommitted)

- [x] Right pane: ASCII canvas replaced by `@lucasmarkes/hairline` 0.3.0 SVG figures, clip-path wipe from menu leader line, readout `FIG.0n / NAME`, `transition:persist` kept
- [x] Menu 3 to 5: MediaContext [1], Forward deployed marketer [2] `/fdm/`, Lab [3] `/lab/`, Field notes [4] `/notes/`, On record [5] `/record/`
- [x] `/gtm/` rewritten as `/fdm/` single offer (Growth transformation, from $15,000 / 3 months); Filament section and Scott quote removed
- [x] `/lab/` revived (Megafly, zero-click clock); Writing split into `/notes/` (posts + subscribe) and `/record/` (bylines, coverage, reports, archives, subscribe)
- [x] `tone()` sets `--ct: var(--butter-ink)` on butter pages/menu items; text accents read `var(--ct, var(--c))`
- [x] Redirects: `/gtm` `/gtm/` → `/fdm/`; `/experiments` → `/lab/`; `/published` → `/record/`; `/lab/*` → `/` removed
- [x] Keys 1-5 navigate; ItemNav pages fall back via `data-menu-key`
- [x] eslint + astro build clean; screenshots `.scratch/hairline/shots/ia5/`; console clean; 1 `.fig-layer` after settle
- [x] Worklog: Obsidian `andorlabs/Worklog 2026-10-05 five-line IA.md`

Review: 1280x720 overflow fixed with a short-viewport block (all 5 rows fit at 720, 768, 800). Hairline later replaced by the in-house isometric test bed (`src/scripts/figure.ts`). zeroclick.grok.me returns 200.

## Engine figure r4: commercial turbofan pod rework (2026-10-12, uncommitted)

- [x] Nacelle rebuilt as one continuous smooth lathe (lip, max D at ~30% of 252 length, taper to fan nozzle); core cowl emerges ~0.55xD, primary nozzle ~0.38xD, slender plug; pink hot paint removed, faint exit glow only
- [x] Sawtooth chevron trailing edges: fan nozzle 14 teeth, core nozzle 11
- [x] Fan fills the bore: tips 66.5 / bore 68 = 97.8%; recessed annulus behind blades; 18 wide-chord swept scimitar blades with LE highlights; conical spinner 0.28xD with painted swirl
- [x] Line weights fixed: tone now emitted via data-tone (kit CSS keys on it); hi silhouettes, mid/lo seams
- [x] Gull-wing doors removed; phantom cutaway: casings ghost to ~6% fill + dashed hidden lines; internals crisp (LP/HP shafts, LPC 3 rows, HPC 9 rows tapered, combustor + injectors + heat glow, HPT 2, LPT 6 rows, NGV); rotor rings spin with N1/N2
- [x] Callouts: row above engine, sorted by anchor x, two tiers, vertical leaders, no THRUST REVERSER
- [x] heat.ts: premult-consistent shader (mix toward ink*a), darken-only schlieren <=2% only where displacement significant, element-opacity sampled into text raster, ?heat0 displacement-zero debug flag, plume narrowed to menu cone + thin tail to headline
- [x] Verify: build:engine + astro build pass; rAF avg 16.67 / p95 16.8 at TAKEOFF; nav home -> /notes/ -> home leaves 1 canvas, no errors; heat0-vs-DOM menu diff 7.5% (AA-only, visually identical at 3x); screenshots .scratch/engine/r4/

Review: fan ellipse ratio 0.725, exhaust ~-175deg. Compromises: OGV vanes read a little blocky at the bore edge; swirl is two arc lobes rather than a full spiral; canvas-vs-DOM AA diff is inherent to the texture approach.

## Engine figure r5: visible shimmer + smooth shell (2026-10-12, uncommitted)

- [x] heat.ts: displacement mix(2.5,9,heat) CSS px in plume core; low-frequency noise (dominant ~110 px, weak ~32 px octave) advected ~55 px/s along jet + 14 px/s buoyant drift; schlieren ink-dark only up to 6%, clipped out of the buoyant tail (tail displacement x0.4); ?heat=off removes layer entirely, ?heat0 kept
- [x] Shell smoothing: lathe steps 160 on nacelle/core cowl/nozzle/plug/spinner; chevrons drawn as one continuous modulated trailing-edge band (rounded tooth tips, 14 fan + 11 core)
- [x] Bore recess concentric with the fan plane (off-centre ring fixed); blades redrawn as smooth scimitar Beziers with LE highlight; spinner swirl = one clean Archimedean spiral on the cone face
- [x] Phantom cutaway declutter: LPC 2 rows, HPC 5, HPT 2, LPT 4; rotor blades slim bowed shapes via smooth paths
- [x] Verify: build:engine (306 KB, 78 items) + astro build pass; menu-region consecutive-frame MAE idle ~4.2 vs TAKEOFF ~12 (16-bit MAE, ~3x, both clearly non-zero); contact sheets + 8-frame series in .scratch/engine/r5/; nav home -> /notes/ -> home leaves exactly 1 canvas, 0 console errors; reduced-motion emulation removes canvas + ht-run; rAF capped at 33.33 ms (30 fps) by the headless environment (about:blank measures identically)

### r5 fix-up (same session)

- [x] heat.ts: plume centreline now anchored to `.menu` rect (source blends down onto menu centreline, holds across all four rows, weak rising tail only past menu's left edge); schlieren clipped to menu rect; `?heat=debug` red-tints the mask
- [x] Engine: core-nozzle chevrons removed; fan chevrons subtle (amp 2, ~3% of nozzle radius); combustor de-cluttered to clean annulus + glow; rotor rows are now a thin rim ellipse + 1px swept radial strokes
- [x] Acceptance: TAKEOFF consecutive-frame |d|>40 avg ~3225/pair (rows ~700/1500/680/580); logos + headline 0 px; debug tint covers all four rows only; nav teardown clean, 0 console errors

## Visitor briefing: Snitcher Spotter + Exa + Jev (2026-10-12, uncommitted)

- [x] Shared pure module `src/lib/brief/` (questions, interpret, copy, pipeline) used by the Pages Function, client and capture script
- [x] `functions/api/brief.ts`: POST, NDJSON stream (start/stage/notice/brief/error), same-origin 403, domain validation, KV `BRIEF` cache 7d + 5/hr rate limit + $8/mo Exa budget; `KVNamespace` ambient type in `functions/types.d.ts`
- [x] Client: `src/components/Briefing.astro`, `src/scripts/briefing.ts`, `src/styles/briefing.css`; wired into persistent `<aside class="viz">` on home only; consent-gated Snitcher Spotter, 4-segment progress bar, printer printout, typed form, reduced motion, mobile
- [x] Staging replay: `scripts/capture-brief-fixtures.mts` + `npm run build:staging`; `/brief-fixtures/` only under `PUBLIC_STAGE=staging`; REPLAY tag, random autoplay, `?replay=<domain>`, 37-button list, `visit <date>` on the Snitcher segment
- [x] Fixtures: 37/37 A+ orgs captured, 0 failures, total Exa spend $0.518 in `.scratch/briefing/fixtures/`
- [x] Cloudflare: KV `andorlabs-brief` (37b1291b169e4b648eb518231a26f0b9) bound as `BRIEF` on production + preview via API PATCH (all existing env vars preserved); EXA_API_KEY set on preview; EXA + TYPESAFE already present on production, TYPESAFE on preview
- [x] Deployed staging only: https://staging.andorlabs.pages.dev (deployment https://35ac182c.andorlabs.pages.dev)
- [x] Verify: eslint clean on new files; `npm run build` 18 pages; `rg -l MotherDuck dist` empty on plain build; local wrangler dev: klick.com streams signals, notadomain -> bad_domain, blank EXA -> exa_down, blank TYPESAFE -> jev_down; screenshots in `.scratch/briefing/shots/` (consent, mid-run, finished, 390px, 2 staging replays); no briefing console errors; 390px scrollWidth = 390

Review: `.ao` uses `visibility:hidden` (not `display:none`) on home so the heat-refraction canvas keeps its layout rect; `display:none` left DOM text transparent. Signal/source rows single-line ellipsis. Exa account hit "Payment required" immediately after capture run 37/37 - live staging typed lookups degrade to `exa_down` by design until balance is topped up. Replay needs fresh sessionStorage to run a second company (by design: one brief per session).

### r2 rework (same session, lead review)

- [x] Preview `EXA_API_KEY` set from `.dev.vars` (`.env` value was empty -> 402); poisoned `brief:v1:` entries for descript.com + klick.com deleted from KV
- [x] `*_down` briefs are never KV-cached (`cacheable` guard); spend accounting unchanged
- [x] Typed lookup with empty Exa result skips Jev: `jev` stage `ms:0 ok:false`, brief `guard:null`
- [x] JEV rows drop the `JEV › ` prefix at render (prefix kept in stored data for cache/fixture compat); "1 sourced event." pluralised
- [x] Exa description word-boundary cut <=220 + `…`; A+ line moved into the SNITCHER row `.sub` line (skipped when typed)
- [x] Progress bar: labels above segment start, ms below the track right-aligned, boundary ticks re-anchored to the track row; no 390px collision
- [x] Typed runs label seg 1 `01 Typed`, empty white fill (pink hatch = real failures only); session save/restore now records labels + per-fill states + frac
- [x] Mobile signal rows: `.l1` flex (label ellipsizes, bar + p pinned), `.l2` source + date on the wrapped second line
- [x] `link()` accepts only `http:`/`https:` via `new URL`, else plain text
- [x] Extra fixes found during verification: `readyState` fallback when module misses `astro:page-load`; `setFill(which=null)` now marks every fill in the segment (exa.news no longer stuck in `run` on bail)
- [x] Redeployed staging only: https://staging.andorlabs.pages.dev (deployment `88212b90`); descript.com live verified (real exa ms, jev, signals, then CACHED hit); r2 screenshots in `.scratch/briefing/shots/r2/`

## Visitor briefing — review round 3 (2026-10-12)

- [x] Signal rows: label/bar/probability/source are separate spans; desktop one line with fixed 1ch gaps (measured 8px each at 13px mono), no spacer before the bar, only the source ellipsizes; mobile keeps the same 1ch gaps on line 1 (label/bar/p) with source + date on line 2, probability never truncated
- [x] Replay + cache-hit rebuild: `interpret.ts` exports pure `shapeEntity`/`shapePassages`; `pipeline.ts` returns resolved `firmo` + `raw` inputs; `brief.ts` stores `raw`/`firmo` in KV and streams them on cache hits; `briefing.ts` `rebuildBrief()` re-runs `interpret()` on stored inputs for replays and `cached:true` payloads, falling back to the stored brief when raw is absent. Verified on staging: prebid.org replay prints "Jev found 1 sourced event." (old frozen "1 sourced events." gone); no API calls on replay/cache-hit rebuild
- [x] Print region scrolls independently inside the window (`overflow-y:auto`, `scrollbar-width:thin`, `overscroll-behavior:contain`, `flex:1;min-height:0`); stamp moved out of `.printout` into a pinned `.brief-foot` with the typed form; verified stamp + form always inside window bounds, SOURCES row reachable by scroll, `scrollTop` reset to 0 when printing finishes; stamp added to session save/restore, cleared on new runs
- [x] `@typesafe-ai/sdk` confirmed tree-shaken out of the client bundle (`sideEffects:false`; bundle has no TypeSafeClient/questionsFor)
- [x] `npm run build:staging` + `wrangler pages deploy --branch staging`: deployment `c86df87c`; live linear.app run verified (LIVE tag, "Briefed in 0.81 s · Exa $0.014 · Jev 5,258 tok"), cache-hit + replay verified on staging; console clean
- [x] Screenshots `.scratch/briefing/shots/r3/`: `desktop-finished-live.png` (1440x900, LINEAR LIVE), `desktop-replay-prebid.png` (1440x900, REPLAY), `mobile-390-live.png` (390x844, CACHED, scrollWidth 390); dev server restarted on http://localhost:8799/

## Visitor briefing — round 4: Paper specimen redesign + pipeline fixes (2026-10-12)

### A. Pipeline correctness
- [x] Entity host match: accept Exa company result only if result URL host (minus www) equals domain or ends with ".<domain>"; else entity=null + rejectedHost
- [x] Homepage fallback: Exa /contents on https://<domain> highlights "what this company does" -> exa.description + Jev state description; part of exa.entity stage; add cost; exa=null if it fails
- [x] Typed name chain: entity name -> request name (new field) -> domain 2nd-level label title case; then news
- [x] New plain remark: "Exa's best match was {host}, not {domain}. We left it out."
- [x] Cache key -> brief:v2:
- [x] Recapture 9 mismatched fixtures (1.5s gap); reinterpret all 37

### B. Seamless flow
- [x] Status on load: "Asking Snitcher who you are", caret at stop 1
- [x] Use existing window.Snitcher (GTM); poll 4s; inject official loader w/ profileId s1hZTV3y04 only if absent; identify w/ 5s timeout; undefined == not identified
- [x] Not identified / ISP / timeout / no consent -> immediate self-brief {andorlabs.ca, "And/or Labs"} + lead line per case
- [x] Late consent -> probe Spotter; identified business -> auto-run their brief; else keep self-brief
- [x] Typed form always visible; new run aborts in-flight (AbortController)
- [x] andorlabs.ca self-briefs skip the 5/hr rate limit
- [x] Session restore stays

### C. Paper design
- [x] Scoped tokens (#F6F6F3 card, #222 ink, #81ACEC line/shadow, #9BBCE8 coords, muted rgba(0,0,0,.5), #EEEEEB sel, dashed guides)
- [x] Floating windows SNITCHER/VISITOR ~300, EXA/COMPANY ~330 (+12px overlap, offset right), JEV/READ ~360 (back left); appear on stage resolve (fade+rise+scale 180ms, 30ms row stagger); title bars w/ x close; dl 1fr/auto rows 14/17; note box; no pink/saturated fills/block bars
- [x] Footer ruler: status line, caret ▼ sliding 320ms cubic-bezier(.2,.8,.2,1) w/ 2px bob while waiting, tick strip (1x4 every 8px, 8px at stops), 4 stop labels + coord ms (Snitcher real ms / Typed / Self / visit YYYY-MM-DD on replay; Exa "220+374"); role=progressbar
- [x] Form + stamp pinned below ruler; stack scrolls internally if tall; thin scrollbar + overscroll contain; no text occlusion (verify)
- [x] Staging: Live|Replay segmented pill (prod: muted text); A+ VISITORS / 37 window (dl rows, #EEEEEB selected, buttons >=40px)
- [x] Mobile <=860: stack normal flow alternating 0/16px insets, no overlap, footer under content, no h-overflow at 390

### D. Verify + ship
- [x] eslint touched files; build:staging; plain build w/ rg MotherDuck empty
- [x] staging API: andorlabs.ca + inferless.com show rejection remark + homepage fallback
- [x] shots/r4/: desktop self-brief finished, mid-run caret on Exa, live descript.com finished, prebid replay; 390x844 live; dsf2 crops (ruler + one window); paper.design/mono capture
- [x] text-occlusion check, console, deploy --branch staging, report id + recapture results + spend
- [x] dev server :8799 left running

### Round 4 results (deployed `4082fe49`, staging only)
- Pipeline: entity host accept (host==domain or ends .<domain>), homepage /contents fallback (highlights only, markdown # stripped), name chain entity->request->SLD label (firmo.name==domain treated as placeholder), rejection remark in brief.plain, cache brief:v2:, freePass for andorlabs.ca.
- Recaptured 9 mismatched fixtures sequentially @1.5s: 8/9 homepage fallback (voltaire.ai, perfectsync.io, allmindinvestments.com, teambotics.app, turbojot.com, inferless.com, buildinglink.com, performancemarketingexperts.com), moveo.com none (no usable highlights). Exa spend $0.1340. All 37 reinterpreted, no API calls.
- Flow: no consent / not identified / ISP -> immediate self-brief with per-case lead line; Self/Typed in stop 1; typed run aborts in-flight; session payload versioned v4 (old shapes rejected).
- Paper UI: floating windows + weight-ruler footer; verified live: occlusions 0, stack internal scroll 1717>562, footer pinned 857/900 desktop, static mobile, scrollW 390, insets 18/34.
- Fixed during verify: dl value column overflow (fit-content(62%) + wrap), stale r3 session restore, typed name fallback.
- Live API: inferless.com -> "Inferless" + infr.com rejection + homepage src; andorlabs.ca -> "And/or Labs" + andorlabs.com rejection + homepage src. KV delete needed ~60s+ edge propagation before endpoint reflected it.
- Shots r4: desktop-selfbrief, desktop-midrun (caret Exa), desktop-descript, desktop-replay-prebid, mobile-390-live, ruler-2x, window-jev-2x, dsf2-full, paper-metrics, paper-ruler.
- Console: zero errors (CookieYes/TCF noise only). eslint clean. builds 18p, MotherDuck rg empty.
- Deviation: moveo.com has no description (Exa returned no usable homepage highlights).

### Round 5 results (deployed `e2178122`, staging only)
- [x] Ruler type: .sl weight 400, .sm font-style normal
- [x] Stack auto-reveal: absolute-target scrollTo (converges mid-flight), re-reveal at +220ms settle; JEV incl note fully visible at finish (b:0 measured); stack-only, never page; instant under reduced motion
- [x] Humanise: humanise() + sectorLabel() in interpret.ts (media & adtech, government & nonprofit); signal labels sentence case + ai->AI in rows; interpret() emits humanised labels; copy.ts untouched (remarks already verbal)
- [x] Mobile <=860: stack display:contents + order -> windows, footer, A+ list (verified: jev 1668 < foot 1682-1857 < list 1857; scrollW 390)
- [x] shapeHome strips "<title> | " prefix when remainder repeats (andorlabs.ca now starts "We engineer growth...")
- Fixtures reinterpreted (labels humanised). ESLint clean. Dev server :8799 on fresh dist.
- Shots r5: desktop-selfbrief, desktop-descript (caret Print, note visible), mobile-390-live, ruler-2x (regular labels, roman ms), dsf2-full.

## Factsheet round (2026-10-13) — ribbon printer replaces teletype machine

- [x] Paper fills the entire right pane edge to edge (#FBFBF8); machine body, status window, Live|Replay pill, A+ list all removed
- [x] Thin print bar (~54px) pinned to pane bottom: dark ribbon strip, carriage head tracking the print column, blinking lamp while waiting, domain form (company.com + Print) and muted stage status
- [x] Prints nothing until the brief lands; bar narrates stages (Asking Snitcher / Asking Exa / Jev is reading... / Printing)
- [x] Line-by-line typing at ~30cps above the bar; sheet anchors to the bar while short; paper scrolls (thin scrollbar, overscroll contain, focusable) when it does not fit; scrolls to sheet top on finish; new run slides the old sheet up and away; reduced motion instant; session restore shows the finished sheet instantly (v6)
- [x] Pipeline: Exa news call removed entirely; entity search + homepage fallback kept; facts.ts parses entity properties + highlights into the metric set; questions.ts asks Jev only network-guard + one-of-eight verdict; verdict.ts renders the verdict line
- [x] printout.ts rewritten: 10-char label column, secondary figures at cols 23/36, name line with right-aligned domain link, JEV'S READ with right-aligned p, muted footer "date · 0.8 s · $0.010 | from cache"; missing rows omitted
- [x] KV key -> brief:v3:; fixture capture/reinterpret updated; snapshots in .scratch/briefing/pre-factsheet/
- [x] Verify: fixture sheets (descript/motherduck/perfectsync), 37-fixture Jev spread, live descript + raptive + self-brief, eslint, build, shots/sheet/ (1440x900 done + mid-print, 1280x800, 390x844, bad-domain, self)

### Factsheet round results (local only, not committed)

- facts()/verdictLine()/printout() unit-checked over 3 fixtures: descript (full metrics incl. traffic spark, offices), motherduck (+59.2% YoY, +77% 6mo, dbt/gRPC casing kept), perfectsync (entity rejected -> algosync.io, homepage fallback, sparse rows omitted, no dashes/n-a). Fixture sheets paste verified.
- Jev spread: ran only the Jev call over all 37 fixture raws @300ms gap. 37 results: too_early x9, leaky_funnel x13, growing_into_it x9, runway_soundtrack x4, quietly_profitable x1, moveo skipped (no data). All network p < 0.25, none >= 0.5, guard never fired. Question text unchanged.
- Live: self-brief andorlabs.ca (KV hit, "from cache"), descript.com (KV hit on repeat -> "from cache" footer verified), raptive.com (fresh: RAPTIVE, New York, 492 staff -5.4% YoY, $31.7M Series D, 172 tools, 9 countries, runway_soundtrack). Bad domain appends one muted line onto the existing sheet (append mode).
- Fixed during verify: .brief display:none kept the pane hidden; firstSentence() truncating "companie" (offset-2 dup match -> whitespace-separator required); errors wiping the sheet (-> append); session restore reusing desktop-wrapped lines at 390px (now stores logical unwrapped lines, re-wraps at restore; printed() removed from teletype API).
- eslint clean on touched files. npm run build: 18 pages, no errors.
- Shots .scratch/briefing/shots/sheet/: self-1440, descript-1440, descript-mid-print, raptive-1440, bad-domain, descript-1280, mobile-390 (post-fix, full sheet re-wrapped). All read; pane clean: paper edge to edge, bar at bottom, nothing else.
- Live Exa spend this round: raptive fresh ~$0.014; descript + self served from brief:v3 cache. No commits, no deploys; dev server left running on :4321 (+8788 wrangler).

### Factsheet r2 (2026-10-13, local only) — no leads, no form, self-driven

- [x] Heat shimmer removed: initHeat/destroyHeat + import dropped from site.ts (lead), .ht-run/.ht-flat CSS block deleted from site.css; heat.ts left on disk unused. briefing.css comment fixed; .ao stays visibility:hidden on home (still needed on mobile where .brief stacks in flow)
- [x] No lead/plain lines on the sheet ever: printout() lead param gone, Briefing.plain field gone, interpret() notices/rejectedHost params gone, all lead/error copy strings deleted (copy.ts keeps only status lines)
- [x] Domain form + Print button removed (markup, .bform/.vh CSS, handlers, busy()); Refs is root+tty only
- [x] Self-driven flow: no consent / not identified / ISP / spotter-run failure -> silent self-brief (no explanation lines); self-brief failure -> print nothing, bar idle, console.warn only; consume() throws on stream error events instead of printing them; late-consent probeSpotter kept
- [x] Test hook: ?domain=<domain> runs a typed lookup, gated on import.meta.env.DEV || PUBLIC_STAGE==="staging"; runs before session restore so it always prints fresh
- [x] icpTier removed from Firmo + pipeline/api/briefing payloads (only fed the A+ lead line)
- Verify: eslint clean, build 18 pages. Fixture script re-run: sheets print name/rows/JEV'S READ/stamp only. Live: fresh no-consent load -> self sheet (AND/OR LABS, from cache); ?domain=descript.com -> cached sheet, 19 lines; ?domain=not-a-domain -> 0 lines, bar idle; canvas:0 ht-run:0 on home; 390x844 scrollW 390 no overflow
- Shots .scratch/briefing/shots/sheet/r2/: self-1440, descript-1440, mobile-390
- Known limitation (unchanged): a printed sheet does not re-wrap on mid-session viewport resize; session restore re-wraps.

### Print-head ramp (2026-10-13, local only) — moving head, job-log box, pin bars

- [x] Job log box printed before each sheet: ┌ INTELLIGENCE BRIEF ── date ┐, staged lines (Initiating intelligence brief / Calling Snitcher|Target set to X / Querying Exa / Asking Jev for a verdict / Printing factsheet), └─┘; result lines indented under each bar; LogEntry model persists to sessionStorage v7 and rebuilds at pane width on restore
- [x] Live progress bars: 1-exp(-t/tau) capped 92% (Snitcher 1.2s, Exa 0.6s, Jev 0.3s), partial-cell glyphs + ▓▒░ taper, textContent-only ~30Hz, settle snaps to █ + pct + ms|cached|no match; 20 cells desktop / 10 narrow; real ms (event ms else measured); bar prefixes/tails type via serialized op chain
- [x] SVG printer front (72px, Paper style, no gradients): panel, platen + end caps, blue guide rail, end stops + screw dots, toothed belt that slides with the carriage, vent lines, coral LED while a stage is in flight, carriage = housing + ribbon cartridge + 9-pin column + ink nose pointing at the paper edge
- [x] Carriage mechanics: x tracks the struck DOM column (measured cell width + paper padding), spaces sweep without striking, pins flash 3-5 for 60ms + 0.5px jiggle per strike, eased return to col 0, parks at right end stop when idle, tracks bar fill edge during progress, LF = smooth scroll follow
- [x] Printer-front status line mirrors the live step (same copy as the log label)
- [x] Tractor-feed sprocket holes down both paper edges (CSS radial-gradient, scrolls with paper); perf-line ┄ entry between runs
- [x] a11y: role=log/aria-live/tabindex kept; all visible typed text aria-hidden, each line gets one .sr twin on completion ("Querying Exa, done in 461 ms" for bars); links stay live anchors
- [x] ?slow dev param: 8x typing + 8s settle hold so mid-run states are capturable (no effect without the param)
- Bug found+fixed: factsheet queue is rAF-driven; IntersectionObserver killed the loop when the pane was below the fold (mobile stacked layout) -> log box typed but sheet stalled at 9 lines. Loop now stays alive while printing/opsActive/liveBars and print() wakes it; offscreen runs complete before the user scrolls down
- Verify: eslint clean; npm run build 18 pages. Reduced-motion: whole run lands in ~4s, carriage parked. Session restore: instant log+sheet, re-wrapped, parked. Mobile 390: 34 lines, scrollW 390, no overflow
- Shots .scratch/briefing/shots/printhead/: mid-snitcher, mid-exa, mid-factsheet, finished-1440 (self-brief, no match + self sheet), descript-1440 (typed hook), mobile-390, front-2x (carriage detail), logbox-2x. All read

### Print-head r2 (2026-10-13, local only) — carriage reads as a dot-matrix head

- [x] Carriage rebuilt ~2.5x larger (~71x67px incl. strokes): stands up from the rail, overlaps the paper bottom ~12px so it sits on the printed line; housing + top bevel + 2 screw dots, ribbon cartridge on top, print-head nose with vertical column of 9 pin dots, cooling-fin lines on the side; struck pins fill ink 60ms per char strike
- [x] Full-width ink ribbon band (#222 at .85) across the paper at the print line, passing in front of the nose, dashed feed texture shifting left 3px per strike
- [x] Rail rod, end stops, toothed belt kept (belt teeth move with carriage). Meaningless bottom-left circle / bottom-right lines replaced: power LED + ONLINE label (Paper Mono 10px muted, coral while printing) left, engraved AND/OR LABS · LQ-24 plate right
- [x] Status fix: printer-front status now names the row the head is printing — log label while its row types (incl. live-bar ops), "Printing factsheet" during the sheet, "Idle" parked. setStatus() removed from briefing.ts entirely (copy.ts deleted, dead); pipeline timing stays on the bars
- [x] Tractor-feed margins: ~14px strips both sides, 1px dotted perforation line #9BBCE8 separating printable area, ~6px outlined holes every 34px (every 2 lines), scroll with the paper (local-attachment background layers, tear ghost matches)
- [x] Bug found: cw was measured on a span inheriting the pane's Departure Mono 14px (8.48px) while lines render Paper Mono 12px (7.27px) — box was ~10 cols short of the right perf and the head overshot columns ~15%. meas now carries the .pl font; cols()=70 at 1440, box right border lands ~1ch inside the right perf line, head tracks within ~1 col
- Verify: eslint clean on touched files; npm run build 18 pages, no errors. Live runs all KV-cached (zero spend)
- Shots .scratch/briefing/shots/printhead/r2/: mid-exa (?slow, live ▓▒░ taper + partial cell, status "Querying Exa", carriage at fill edge), mid-factsheet (status "Printing factsheet", nose under half-typed "descrip"), descript-1440 (finished, 26 lines, parked, Idle), mobile-390 (31 lines, scrollW 390), front-2x (cartridge + pin column + fins + plate), margin-2x (dotted perf + outlined holes). All read; carriage unmistakable at 1x

### Print-head r3 (2026-10-13, local only) — banded 96px front, parked carriage inside

- [x] Bar raised 72 -> 96px, two bands separated by a 1px #81ACEC line at y 73.5: mechanics on top (ribbon, platen, rail, belt, carriage travel), switchband below (LED + ONLINE left, status, LQ-24 plate right, all centred on cy~85). Nothing overlaps the belt anymore
- [x] parkX = w-56: parked carriage's shadow edge sits ~5px left of the right end stop, fully inside the panel (was w-30, clipped ~7px at the pane edge)
- [x] .sheet-status now right:126px / bottom:4px in the band; ellipsizes before the plate (mobile: status ends x263, plate x271 at 390)
- [x] Carriage still overlaps the paper bottom ~11px (nose tip at group y -11.5)
- Verify: eslint clean on teletype.ts; npm run build 18 pages. Live runs all KV-cached
- Shots .scratch/briefing/shots/printhead/r3/: finished-1440 (parked inside, bands clean), mid-factsheet (status in band, nose under "descript."), mobile-390 (scrollW 390, no overlap), front-2x (parked carriage + plate). All read

### Print-head r4 (2026-10-13, local only) — paper meets the rule, margins stripped

- [x] Paper left edge on the rule: the gap was the pane's last *partial* blueprint-guide cell (pane 757px, 120px grid -> 37px sliver between the last guide at x781 and the viz border at x818). Fixed at the cause: `html[data-home] .frame` snaps the pane column to whole guide cells (`calc(6 * 120px)` = 720px, gated min-width:1024px) so the boundary lands exactly on a guide line. Paper now starts at x782 against the x781 rule; measured, not hard-coded offsets. /fdm/ and other inner pages keep the proportional 1.35fr split (rule is home-scoped)
- [x] Tractor-feed margins removed entirely: --hole/--perf gradients, dotted perforation lines and the ghost sheet's copies all deleted; paper is plain #FBFBF8 with `padding: 20px 1.5ch 12px` (mobile `16px 1.5ch 10px`). cols() measures the real padding so the log box spans the new width (~78 cols at 1440); carriage column mapping unchanged (still padLeft-based)
- Verify: no TS touched (CSS only); npm run build 18 pages clean. Live runs KV-cached, zero spend
- Shots .scratch/briefing/shots/printhead/r4/: descript-1440 (paper flush on the boundary rule, plain margins, box spans the sheet), mid-factsheet (carriage mid-line under "descript."), descript-1280, mobile-390 (scrollW 390, no overflow), fdm-1440 (inner page unchanged). All read
