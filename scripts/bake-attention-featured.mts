/**
 * The Attention Economy issue featured image — one full-bleed dithered frame.
 *
 * No Astro jig here, unlike the OG cards and the Weekly Overfit cover. Those
 * are compositions: type, tiles, a card. This is a single photograph filling
 * the frame edge to edge, so a browser adds nothing but a round trip — the
 * dither IS the image, and sharp can write it directly at final size.
 *
 * Baked straight at 2400x1288 rather than 1200x644 doubled: LinkedIn's article
 * cover is 1200x644 and serving 2x keeps it sharp on retina. `pixel: 3` at this
 * size is the same apparent cell as ditherPreset.HERO's `pixel: 2` at 1600 wide.
 *
 *   npx tsx scripts/bake-attention-featured.mts          # contact sheet of candidates
 *   npx tsx scripts/bake-attention-featured.mts person-4 # final, at full size
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ditherToDuotone } from "./lib/dither";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = join(ROOT, ".scratch", "newsletter", "attention-economy");
const SWEEP = join(BASE, "sweep");

const W = 2400;
const H = 1288; // LinkedIn article/newsletter cover 1200x644, at 2x

const pick = process.argv[2];
const cropArg = (process.argv[3] as "centre" | "attention") ?? "attention";

async function bake(src: Buffer, w: number, h: number, pixel: number) {
  return ditherToDuotone(src, {
    width: w,
    height: h,
    pixel,
    shadow: "#0A2EBF",
    highlight: "#EEF1FF",
    contrast: 1.06,
    trim: true,
    /**
     * `centre` for the final full-bleed frame, `attention` for the candidate
     * pass. Saliency is the right tool for a small cut-out of a person — it
     * finds the face — and the wrong one for a full-bleed image, where it zooms
     * past the composition into the highest-contrast detail. On the chosen
     * source it cropped straight through the phone, which is the subject.
     */
    crop: cropArg,
    autoLevels: true,
  });
}

if (pick) {
  const png = await bake(readFileSync(join(SWEEP, `${pick}.src`)), W, H, 3);
  const out = join(BASE, "featured.png");
  writeFileSync(out, png);
  console.error(`✓ ${out}  (${W}x${H}, from ${pick})`);
} else {
  // Candidate pass: every source baked to the real aspect so the crop is judged
  // as it will actually ship, then tiled into one sheet.
  const ids = readdirSync(SWEEP)
    .filter((f) => f.endsWith(".src"))
    .map((f) => f.replace(/\.src$/, ""))
    .sort();
  const CW = 600, CH = 322;
  const tiles = await Promise.all(
    ids.map(async (id) => ({
      input: await bake(readFileSync(join(SWEEP, `${id}.src`)), CW, CH, 2),
      id,
    })),
  );
  mkdirSync(BASE, { recursive: true });
  await sharp({
    create: { width: CW * 2, height: CH * Math.ceil(tiles.length / 2), channels: 3, background: "#ffffff" },
  })
    .composite(tiles.map((t, i) => ({ input: t.input, left: (i % 2) * CW, top: Math.floor(i / 2) * CH })))
    .png()
    .toFile(join(BASE, "_featured-candidates.png"));
  console.error(`candidates → ${join(BASE, "_featured-candidates.png")}`);
  console.error(`order (2 per row): ${ids.join(", ")}`);
}
