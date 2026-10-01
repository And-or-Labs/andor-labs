// @ts-check
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://andorlabs.ca",
  output: "static",
  integrations: [mdx(), react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // @andor/ds ships TypeScript source; let Vite compile it rather than
    // externalising it to Node during the static build.
    ssr: { noExternal: ["@andor/ds"] },
    resolve: { dedupe: ["react", "react-dom"] },
  },
});
