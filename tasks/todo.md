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
