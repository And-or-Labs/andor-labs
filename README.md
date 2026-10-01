# andorlabs.ca

The And/or Labs site: the [Mainline](https://github.com/shadcnblocks/mainline-astro-template) template, unmodified, with And/or colour, fonts and content.

- **Stack:** Mainline as shipped (Astro 5, Tailwind CSS 4, shadcn/ui, React islands, MDX), upstream commit `f92afce`.
- **Rule:** only colour values, font declarations and content differ from Mainline. See `AGENTS.md`. Check with `node ../andor-ds/scripts/check.mjs .`
- **Theme values:** [`@andor/ds`](https://github.com/eclecticv/andor-ds) `themes/andor.css`.
- **Hosting:** Cloudflare Pages project `andorlabs`. `functions/api/subscribe.ts` forwards newsletter signups to Loops.

## Where things live

| Thing | Path |
|---|---|
| Homepage blocks (content only) | `src/components/blocks/` |
| Site metadata | `src/consts.ts` |
| Colour and font values | `src/styles/global.css`, `src/components/BaseHead.astro` |
| Blog posts | `src/content/blog/*.mdx` (images in `public/blog/<slug>/`) |

## Develop

```sh
npm ci
npm run dev      # http://localhost:4321
npm run build
```

## Writing a post

Add `src/content/blog/<slug>.mdx` with `title`, `description`, `pubDate`, `image`, `authorName` and `authorImage` frontmatter (the Mainline schema). Use plain Markdown; Mainline has no custom MDX components.
