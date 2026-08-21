/**
 * Renders a LinkedIn newsletter cover from a /lab/ route to a PNG.
 *
 * A third renderer rather than a flag on render-newsletter-cover.mjs because
 * the SIZE is a third size and that file was uncommitted work in flight when
 * this was written. If both are still here later, they want to be one script
 * that takes --route and --size; that consolidation is a deliberate edit to
 * someone else's file, not a side effect of adding a cover.
 *
 *   1200x644 — LinkedIn's article / newsletter cover. Not the OG cards' 1200x600
 *   (X's 2:1 crop) and not the post heroes' 1600x900.
 *
 * Captured at deviceScaleFactor 2, so the file lands at 2400x1288 and survives
 * LinkedIn's own resizing with the dither cells intact.
 *
 *   node scripts/render-linkedin-cover.mjs [out.png]
 *
 * Requires the dev server on :4321 (npm run dev).
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = process.env.OG_ORIGIN ?? "http://127.0.0.1:4321";
const ROUTE = "/lab/cover-attention-economy";
const W = 1200;
const H = 644;
const OUT = resolve(
  process.argv[2] ??
    join(ROOT, ".scratch", "newsletter", "attention-economy", "cover.png"),
);

await mkdir(dirname(OUT), { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
  });

  const res = await page.goto(ORIGIN + ROUTE, { waitUntil: "networkidle" });
  if (!res?.ok()) throw new Error(`${res?.status()} from ${ORIGIN}${ROUTE} — is the dev server up?`);

  // The webfonts are the whole point of rendering this in a browser; capturing
  // before they load would produce a fallback-serif cover that looks almost
  // right and is wrong.
  await page.evaluate(() => document.fonts.ready);

  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: W, height: H } });
  console.log(`✓ ${OUT} (${W * 2}x${H * 2})`);
} finally {
  await browser.close();
}
