/**
 * Pixel-art avatars for the three panelists, run through the house dither.
 *
 * Two deliberate constraints:
 *
 * 1. REST, never the MCP. `pixellab-mcp` types the response `usage` field as a
 *    USD literal and this account is subscription-billed, so every MCP call
 *    fails validation AFTER the image is generated and billed. The REST call
 *    below is the only safe path.
 *
 * 2. Exactly three calls, and the raw PNGs are written to .scratch BEFORE any
 *    processing. Generation is metered; dithering is free and repeatable. If a
 *    treatment needs tuning, re-run with --redither and no quota is spent.
 *
 * The prompts describe each juror's CHARACTER rather than a generic avatar,
 * because the panel's whole premise is that these are three different readers.
 * Three interchangeable pixel heads would undo on the page what the system
 * prompts do in the model.
 *
 *   npx tsx scripts/gen-panelist-avatars.mts            # generate + dither
 *   npx tsx scripts/gen-panelist-avatars.mts --redither # re-treat, no API calls
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ditherToDuotone } from "./lib/dither";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, ".scratch", "avatars");
const OUT = join(ROOT, "public", "rank", "panel");

const KEY_PATH = join(process.env.HOME ?? "", ".pixellab-api-key");

/**
 * Portraits, not scenes. Each is a head-and-shoulders bust facing the viewer,
 * because these sit at ~72px next to a name and anything wider than a head is
 * unreadable at that size.
 */
const SUBJECTS = [
  {
    id: "nemotron",
    character: "Nemo",
    description:
      "pixel art bust portrait of a tired veteran backend engineer facing forward, " +
      "short dark hair, stubble, glasses, headphones around the neck, plain hoodie, " +
      "flat neutral background, front view, centered",
  },
  {
    id: "glm",
    character: "Atlas",
    description:
      "pixel art bust portrait of a composed venture capital partner facing forward, " +
      "neat side-parted hair, quarter-zip sweater over a collared shirt, faint smile, " +
      "flat neutral background, front view, centered",
  },
  {
    id: "gemini",
    character: "Juno",
    description:
      "pixel art bust portrait of a pragmatic operations executive facing forward, " +
      "short cropped hair, blazer over a plain tee, level unimpressed expression, " +
      "flat neutral background, front view, centered",
  },
] as const;

const NEGATIVE = "text, letters, watermark, signature, blurry, full body, hands, multiple people";

async function generate(description: string): Promise<Buffer> {
  const key = readFileSync(KEY_PATH, "utf8").trim();
  const res = await fetch("https://api.pixellab.ai/v1/generate-image-pixflux", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      description,
      negative_description: NEGATIVE,
      // 128 square: generated at 2x the display size so the dither has real
      // luminance detail to threshold rather than already-flat cells.
      image_size: { width: 128, height: 128 },
      // Opaque on purpose. The duotone thresholds LUMINANCE, and a transparent
      // background has none — it would land on whichever side of the threshold
      // zero alpha decodes to and pock the portrait with stray cells.
      no_background: false,
      outline: "single color black outline",
      shading: "basic shading",
      detail: "medium detail",
    }),
  });
  if (!res.ok) throw new Error(`pixellab ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { image?: { base64?: string } };
  if (!body.image?.base64) throw new Error("no image in response");
  return Buffer.from(body.image.base64, "base64");
}

const redither = process.argv.includes("--redither");
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

for (const s of SUBJECTS) {
  const rawPath = join(RAW, `${s.id}.png`);

  if (!existsSync(rawPath)) {
    if (redither) {
      console.error(`  ${s.character}: no raw PNG cached — run without --redither first`);
      continue;
    }
    console.error(`  ${s.character}: generating…`);
    writeFileSync(rawPath, await generate(s.description));
  } else {
    console.error(`  ${s.character}: raw PNG cached, no API call`);
  }

  /**
   * Avatar preset. Two values here were got wrong first time and are worth
   * stating, because the failure looked like a bad generation and was not:
   *
   * `pixel: 1`, not 2. The chunky cell size that makes a 1600px hero read as
   * texture is catastrophic on a face — at 96px square with 2px cells the
   * portrait had 48 cells to render hair, glasses and a jaw in, and resolved to
   * an unreadable blue smear. A face is the one subject where the dither must
   * carry detail rather than mood.
   *
   * `192`, not 96. The source is 128px, and the output is deliberately LARGER
   * than the 96px box it renders into: 192 is an exact 2:1 with that box, so
   * the cells land on whole device pixels on a retina display instead of
   * resampling into moiré. Nothing here was regenerated to fix this — the raw
   * PNGs are cached, so the whole correction cost zero API calls.
   *
   * `trim` stays off: these are generated square with the subject filling the
   * frame, so trimming a flat backdrop would crop into the head.
   */
  const png = await ditherToDuotone(readFileSync(rawPath), {
    width: 192,
    height: 192,
    pixel: 1,
    shadow: "#0A2EBF",
    highlight: "#EEF1FF",
    contrast: 1.06,
    trim: false,
    crop: "centre",
    autoLevels: true,
  });
  writeFileSync(join(OUT, `${s.id}.png`), png);
  console.error(`  ${s.character}: → public/rank/panel/${s.id}.png (${(png.length / 1024).toFixed(1)}KB)`);
}
console.error("done");
