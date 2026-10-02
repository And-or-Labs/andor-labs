## Development

Start the dev server with `npm run dev` (Astro 5).

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Project notes (And/or Labs)

- **Design (Oct 2026, "drawing sheet")**: the Mainline-verbatim rule is lifted. The site is a one-screen drawing sheet. The left pane holds the page content. The right pane holds a persistent ASCII figure that morphs per page (`src/scripts/figure.ts`). The bottom bar holds Book a call plus contact icons. The prototype lives in `.scratch/directions/c-cyanotype.html`.
- Layout: `src/layouts/Sheet.astro` uses `ClientRouter`. The figure `<aside>` is `transition:persist`, so it survives navigation and can morph. Each page sets `fig` and `color` on the layout.
- Type: Newsreader (serif) for headings and reading, Departure Mono only for labels, brackets and numbers. Colours: ink `#0b1533`, blue `#1B4DFF`, coral `#f0764f`, green `#19b37a`, lilac `#7c5cff`, butter `#f2b705`. The foreground is white. The margin uses the Making Software texture (`public/texture.svg`).
- Content lives in `src/data/site.ts`; blog posts are in `src/content/blog/` and served at `/notes/<slug>/` (`/blog/*` 301s).
- Copy rules: no em dashes, no exclamation marks. Claims rule: VJ led marketing and sales ops at Blockthrough and AdPushup through their acquisitions. Never "exited founder".
- Subscribe posts to `functions/api/subscribe.ts` (Loops). `LOOPS_API_KEY` is a Pages secret.
- Dev: `npm run dev`. Deploy: `npm run build && npx wrangler pages deploy dist --project-name andorlabs --branch <branch>` (Git auto-builds are disconnected). Preview branch: `rebuild-preview`.
