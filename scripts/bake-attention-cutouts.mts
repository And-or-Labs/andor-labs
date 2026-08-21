/**
 * Bakes the three chosen collage cut-outs at their exact composite sizes.
 *
 * The sweep (scripts/sweep-attention-cutouts.mts) is the search; this is the
 * commit. It reads the raw sources the sweep already downloaded, so it makes no
 * network requests and can be re-run freely while the layout moves.
 *
 * SIZE IS NOT A STYLE CHOICE HERE. Each file is baked at the exact pixel size
 * the page composites it at, because the collage is captured at
 * deviceScaleFactor 2 with `image-rendering: pixelated`: a source at display
 * size doubles into hard 2x2 blocks, and a source at any other size makes the
 * browser resample the dither into greys the two-colour palette does not
 * contain. Change a size in the page, change it here too.
 *
 * All three chosen frames are CC0, which is why no credit line rides on the
 * finished image — a deliberate filter on the sweep results, not luck.
 *
 *   npx tsx scripts/bake-attention-cutouts.mts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ditherToDuotone } from "./lib/dither";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = join(ROOT, ".scratch", "newsletter", "attention-economy");
const SWEEP = join(BASE, "sweep");
const OUT = join(BASE, "cutouts");

/**
 * from: the sweep candidate id. The trio reads left to right as the brief's own
 * arc — printed page, then the screen, then the crowd already inside it.
 */
const CHOSEN = [
  { id: "commuters", from: "person-4", w: 330, h: 418 }, // metro carriage, every face lit, CC0
  { id: "screenlit", from: "person-2", w: 320, h: 240 }, // faces over a single phone, CC0
] as const;

/**
 * Two photographs, not three. A third frame was tried twice — a 1920s newspaper
 * scan and a phone-in-hand close-up — and both thresholded to an unreadable
 * pale abstract at 240x300. Neither was a crop or contrast problem to tune: the
 * sources have no tonal separation to survive a two-colour threshold at that
 * size. Two frames that work beat three where one is mush.
 */

mkdirSync(OUT, { recursive: true });

for (const c of CHOSEN) {
  const png = await ditherToDuotone(readFileSync(join(SWEEP, `${c.from}.src`)), {
    width: c.w,
    height: c.h,
    pixel: 1,
    shadow: "#0A2EBF",
    highlight: "#EEF1FF",
    contrast: (c as { contrast?: number }).contrast ?? 1.06,
    trim: true,
    // `attention` rather than `centre`: these are people, off-centre in wide
    // frames, and a centred crop of an off-centre subject takes their shoulder.
    crop: "attention",
    autoLevels: true,
  });
  writeFileSync(join(OUT, `${c.id}.png`), png);
  console.error(`  ${c.id} ← ${c.from}  (${c.w}x${c.h})`);
}
console.error("done");
