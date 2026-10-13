// @ts-check
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://andorlabs.ca",
  integrations: [mdx(), sitemap()],
  output: "static",
  trailingSlash: "ignore",
  devToolbar: { enabled: false },
  vite: {
    server: {
      proxy: { "/api": "http://127.0.0.1:8788" },
    },
  },
});
