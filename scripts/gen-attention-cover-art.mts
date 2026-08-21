/**
 * Generates the dithered art panel for the Attention Economy issue cover.
 *
 * The source is synthetic rather than photographic, so this hands `dither.ts`
 * a field it built itself and then lets the HOUSE treatment do the thresholding
 * — same Bayer matrix, same brand duotone (#0A2EBF / #EEF1FF), same `pixel: 2`
 * cell. Reimplementing the dither here would let it drift from Photo.astro,
 * which is the one thing that file's header asks callers not to do.
 *
 * It does turn OFF `trim` and `autoLevels` and drops `contrast` to 1.0. Those
 * three are photo PREPARATION — they exist to rescue a dark studio shot with a
 * uniform backdrop. This source is authored with its levels already correct,
 * and `trim` in particular would eat the pale left edge that is supposed to
 * fade the art into the card.
 *
 * Rendered at CSS pixel size, not device pixels: the cover is captured at
 * deviceScaleFactor 2 with `image-rendering: pixelated`, so every source pixel
 * becomes a hard 2x2 block. Generating at 2x instead would make the browser
 * throw half the cells away on the way down.
 *
 *   npx tsx scripts/gen-attention-cover-art.mts
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ditherToDuotone } from "./lib/dither.ts";

const W = 440;
const H = 270;
const OUT = join(process.cwd(), ".scratch", "newsletter", "attention-economy", "art.png");

/**
 * The picture: a field of pages being drawn into the answer layer.
 *
 * Each square is a page the open web used to be paid for. They shrink as they
 * fall toward the mass on the right and are gone before they reach it — which
 * is the issue's own through-line ("value is moving into the AI interface,
 * while the click keeps thinning") drawn rather than restated.
 */
const CX = W * 0.95;      // mass centre, pushed off the right edge so it reads
const CY = H * 0.5;       // as larger than the frame that holds it
const CORE = H * 0.22;    // solid ink radius
const HALO = H * 1.12;    // falloff to paper
const CELL = 26;          // page pitch
const MAXSQ = 13;         // page size at full scale

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const buf = Buffer.alloc(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - CX, y - CY);

    // the mass: 0 = ink at the core, 1 = paper past the halo
    const mass = smoothstep(Math.min(1, Math.max(0, (r - CORE) / (HALO - CORE))));

    // the pages: full size far out, nothing left near the core
    const d = r / (1.15 * H);
    const scale = Math.pow(Math.min(1, Math.max(0, (d - 0.20) / 0.42)), 0.75);
    const half = (MAXSQ * scale) / 2;
    const inCell =
      Math.abs(((x % CELL) + CELL) % CELL - CELL / 2) < half &&
      Math.abs(((y % CELL) + CELL) % CELL - CELL / 2) < half;

    let v = Math.min(mass, inCell ? 0 : 1);

    // Fade the pages out at the left edge so the panel dissolves into the card
    // instead of ending on a hard column of squares.
    const edge = Math.pow(Math.min(1, x / (W * 0.26)), 1.1);
    v = v + (1 - v) * (1 - edge);

    buf[y * W + x] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }
}

const source = await sharp(buf, { raw: { width: W, height: H, channels: 1 } })
  .png()
  .toBuffer();

const png = await ditherToDuotone(source, {
  width: W,
  height: H,
  pixel: 2,
  contrast: 1.0,
  trim: false,
  autoLevels: false,
  crop: "centre",
});

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, png);
console.log(`✓ ${OUT} (${W}x${H})`);
