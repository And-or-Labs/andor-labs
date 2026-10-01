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

- Delete the `andor-rankings` D1 database, the Pages D1 binding, the `GEMINI_API_KEY` secret and the Sanity project (awaiting VJ's go-ahead)
- MediaContext adopts `@andor/ds` header, footer and `mediacontext` theme
