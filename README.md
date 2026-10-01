# andorlabs.ca

The And/or Labs site: a single-scroll parent-company landing page plus an MDX blog.

- **Stack:** Astro 7, Tailwind CSS 4, React islands, MDX. Started from the [Mainline](https://github.com/shadcnblocks/mainline-astro-template) template.
- **Design system:** [`@andor/ds`](https://github.com/eclecticv/andor-ds), pinned by git tag in `package.json`, with the `andor` theme. The header, footer, buttons, labels and section primitives all come from there. Don't restyle them here; change the DS and bump the tag.
- **Hosting:** Cloudflare Pages project `andorlabs`. Every push to `main` builds `npm run build` into `dist/`.
- **Functions:** `functions/api/subscribe.ts` forwards newsletter signups to Loops (`LOOPS_API_KEY` is a Pages secret).

## Where things live

| Thing | Path |
|---|---|
| All landing page copy | `src/data/site.ts` |
| Landing sections | `src/components/sections/` |
| Blog posts | `src/content/blog/*.mdx` (images in `public/blog/<slug>/`) |
| MDX components (`Figure`, `Callout`, `KeyStat`, `PullQuote`) | `src/components/blog/mdx.tsx` |
| Blog routes and RSS | `src/pages/blog/` |
| Theme import | `src/styles/global.css` |

## Develop

```sh
npm install
npm run dev      # http://localhost:4321
npm run build
```

To work on the design system and the site together, install the local checkout as a copy (a symlink duplicates React):

```sh
npm install --install-links ../andor-ds
```

Switch back to the pinned tag before committing.

## Writing a post

Add `src/content/blog/<slug>.mdx` with `title`, `description` and `pubDate` frontmatter. Optional: `standfirst`, `heroImage`, `heroAlt`, `heroCredit`, `keyTakeaways`, `faq`, `tags`, `draft`. The slug is the URL.
