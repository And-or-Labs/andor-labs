/**
 * Renders the newsletter issue cover from /lab/cover-newsletter to a PNG.
 *
 * Same jig as scripts/render-og.mjs, with two differences that are the reason
 * this is a separate file rather than another entry in that script's CARDS map:
 *
 * 1. SIZE. 1600x900, which is `ditherPreset.HERO` — the size every other post
 *    hero on this site is baked at. The OG cards are 1200x600 for X's crop.
 * 2. DESTINATION. .scratch, not public/. This image's home is the Sanity asset
 *    store, attached to one post; it is not a site asset.
 *
 * Captured at deviceScaleFactor 2, so the file lands at 3200x1800 and survives
 * the CDN's own resizing with the dither cells intact.
 *
 *   node scripts/render-newsletter-cover.mjs [out.png]
 *
 * Requires the dev server on :4321 (npm run dev).
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = process.env.OG_ORIGIN ?? "http://127.0.0.1:4321";
const OUT = resolve(
  process.argv[2] ?? join(ROOT, ".scratch", "newsletter", "cover.png"),
);

await mkdir(dirname(OUT), { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });

  const res = await page.goto(`${ORIGIN}/lab/cover-newsletter`, {
    waitUntil: "networkidle",
  });
  if (!res?.ok()) throw new Error(`${res?.status()} from ${ORIGIN}/lab/cover-newsletter`);

  // The webfonts are the whole point of rendering this in a browser; capturing
  // before they load would produce a fallback-serif cover that looks almost
  // right and is wrong.
  await page.evaluate(() => document.fonts.ready);

  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1600, height: 900 } });
  console.log(`✓ ${OUT}`);
} finally {
  await browser.close();
}
