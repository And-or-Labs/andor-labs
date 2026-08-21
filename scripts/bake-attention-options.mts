/**
 * Bakes the four featured-image options at full size, plus a preview sheet.
 *
 * Four different readings of "The Attention Economy" rather than four crops of
 * one idea — the choice being offered is what the image ARGUES, not which frame
 * is prettiest.
 *
 * Sources live in two folders because they came from two sweeps; `dir` says
 * which. All are baked 2400x1288 (LinkedIn 1200x644 at 2x), `crop: "centre"`
 * so the photographer's composition survives, `pixel: 3` for the same apparent
 * cell as ditherPreset.HERO.
 *
 *   npx tsx scripts/bake-attention-options.mts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ditherToDuotone } from "./lib/dither";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = join(ROOT, ".scratch", "newsletter", "attention-economy");
const OUT = join(BASE, "options");

const W = 2400, H = 1288;

const OPTIONS = [
  { n: 1, id: "p01", dir: "pool",  reads: "the market — dense city signage over a moving crowd" },
  { n: 2, id: "p11", dir: "pool",  reads: "saturation — a newsstand rack, every cover competing" },
  { n: 3, id: "person-6", dir: "sweep", reads: "capture — a phone held up over a lit crowd" },
  { n: 4, id: "crawler-2", dir: "sweep", reads: "the plumbing — server cabling, the abstract option" },
] as const;

mkdirSync(OUT, { recursive: true });

const tiles: Buffer[] = [];
for (const o of OPTIONS) {
  const png = await ditherToDuotone(readFileSync(join(BASE, o.dir, `${o.id}.src`)), {
    width: W, height: H, pixel: 3,
    shadow: "#0A2EBF", highlight: "#EEF1FF",
    contrast: 1.06, trim: true, crop: "centre", autoLevels: true,
  });
  writeFileSync(join(OUT, `option-${o.n}.png`), png);
  tiles.push(await sharp(png).resize(900, 483).toBuffer());
  console.error(`  option-${o.n}  ${o.id}  — ${o.reads}`);
}

await sharp({ create: { width: 1800, height: 966, channels: 3, background: "#ffffff" } })
  .composite(tiles.map((input, i) => ({ input, left: (i % 2) * 900, top: Math.floor(i / 2) * 483 })))
  .png()
  .toFile(join(BASE, "_options.png"));
console.error(`\nsheet → ${join(BASE, "_options.png")}   (1|2 top, 3|4 bottom)`);
