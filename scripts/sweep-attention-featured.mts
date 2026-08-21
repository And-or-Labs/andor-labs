/**
 * Candidate sweep for the Attention Economy featured image.
 *
 * The earlier sweeps looked for people; this one looks for the THEME, because
 * the brief changed to "capture the newsletter name" rather than the week's
 * stories. It also deliberately avoids consumer hardware: the first pick was a
 * 2011 Samsung, and any photograph whose subject is a device dates itself the
 * moment the device does. Billboards, screen walls, signage and crowds do not.
 *
 * Everything is baked at the real 1200x644 aspect and `crop: "centre"`, so what
 * the contact sheet shows is what a full-bleed cover would actually be —
 * saliency cropping is for small cut-outs and zooms past the composition here.
 *
 *   npx tsx scripts/sweep-attention-featured.mts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ditherToDuotone } from "./lib/dither";
import { searchImage, attributionLine, fetchImageBytes } from "./lib/openverse";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = join(ROOT, ".scratch", "newsletter", "attention-economy");
const POOL = join(BASE, "pool");
const DELAY_MS = 1100;

/** Each is a different literal reading of "the attention economy". */
const QUERIES = [
  "times square billboards night",
  "advertising billboards city street",
  "neon signs night street",
  "crowd holding phones concert",
  "wall of television screens",
  "control room monitors",
  "cinema audience watching screen",
  "led advertising screen street",
  "stadium crowd floodlights",
  "shopping street advertising signs",
  "newsstand magazines rack",
  "satellite dishes antennas roof",
];

mkdirSync(POOL, { recursive: true });
const credits: Record<string, string> = existsSync(join(POOL, "credits.json"))
  ? JSON.parse(readFileSync(join(POOL, "credits.json"), "utf8"))
  : {};

const W = 620, H = 333;
const tiles: { input: Buffer; id: string }[] = [];

let n = 0;
for (const q of QUERIES) {
  const hit = await searchImage(q, { minWidth: 1400 });
  await new Promise((r) => setTimeout(r, DELAY_MS));
  if (!hit) { console.error(`  "${q}" → nothing usable`); continue; }

  n += 1;
  const id = `p${String(n).padStart(2, "0")}`;
  const raw = join(POOL, `${id}.src`);
  if (!existsSync(raw)) {
    try { writeFileSync(raw, await fetchImageBytes(hit.url)); }
    catch (e) { console.error(`  ${id} "${q}" → ${(e as Error).message.slice(0, 50)}`); n -= 1; continue; }
  }
  credits[id] = attributionLine(hit);
  console.error(`  ${id}  "${q}"  ${hit.width}x${hit.height}  ${credits[id]}`);

  tiles.push({
    id,
    input: await ditherToDuotone(readFileSync(raw), {
      width: W, height: H, pixel: 2,
      shadow: "#0A2EBF", highlight: "#EEF1FF",
      contrast: 1.06, trim: true, crop: "centre", autoLevels: true,
    }),
  });
}

writeFileSync(join(POOL, "credits.json"), JSON.stringify(credits, null, 2) + "\n");
await sharp({
  create: { width: W * 2, height: H * Math.ceil(tiles.length / 2), channels: 3, background: "#ffffff" },
})
  .composite(tiles.map((t, i) => ({ input: t.input, left: (i % 2) * W, top: Math.floor(i / 2) * H })))
  .png()
  .toFile(join(BASE, "_pool.png"));
console.error(`\nsheet → ${join(BASE, "_pool.png")}`);
console.error(`order (2/row): ${tiles.map((t) => t.id).join(", ")}`);
