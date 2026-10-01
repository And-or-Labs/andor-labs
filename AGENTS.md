## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

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

- One-page landing (`src/pages/index.astro`) plus MDX blog. All landing copy lives in `src/data/site.ts`.
- UI comes from `@andor/ds` (github:eclecticv/andor-ds, pinned tag). Shared chrome and tokens are changed there, not here.
- In Astro, DS `Button` takes `href` for links (do not use `asChild` with Astro children). Pass logos to `SiteHeader`/`SiteFooter` as `<AndorMark slot="logo" />`.
- Departure Mono (`font-label`) is for labels and numbers only. Headings and body are Geist.
- Claims rule: VJ led marketing and sales ops at Blockthrough and AdPushup through their acquisitions. Never "exited founder".
- Deploy: push to `main`; Cloudflare Pages project `andorlabs` builds it.
