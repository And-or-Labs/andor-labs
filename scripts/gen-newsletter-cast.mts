/**
 * Pixel-art portraits of the newsletter's three columnists, run through the
 * house dither, for use on an issue cover.
 *
 * Same two constraints as scripts/gen-panelist-avatars.mts, for the same
 * reasons, and this file exists rather than a flag on that one because the
 * output size and destination differ: cover portraits render at 256px inside a
 * 1600x900 card, panel avatars at 96px next to a name.
 *
 * 1. REST, never the MCP — `pixellab-mcp` fails validation after the image is
 *    generated and billed on a subscription account.
 * 2. Raw PNGs land in .scratch BEFORE any processing, and a cached raw is never
 *    regenerated. Generation is metered; dithering is free and repeatable.
 *
 * The prompts describe each columnist's CHARACTER, not a generic head, because
 * the newsletter's premise is three different beats with three different
 * temperaments. They are also deliberately ungendered: nothing in the drafts
 * assigns a gender to any of the three, and a portrait should not invent one.
 *
 *   npx tsx scripts/gen-newsletter-cast.mts            # generate + dither
 *   npx tsx scripts/gen-newsletter-cast.mts --redither # re-treat, no API calls
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ditherToDuotone } from "./lib/dither";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, ".scratch", "newsletter", "cast-raw");
const OUT = join(ROOT, ".scratch", "newsletter", "cast");

const KEY_PATH = join(process.env.HOME ?? "", ".pixellab-api-key");

const SUBJECTS = [
  {
    id: "vex-halloran",
    character: "Vex Halloran",
    description:
      "pixel art bust portrait of a sharp tabloid gossip columnist facing forward, " +
      "slicked back hair, arched eyebrow, wry knowing smirk, press lanyard over a " +
      "leather jacket, flat neutral background, front view, centered",
  },
  {
    id: "cass",
    character: "Cass",
    description:
      "pixel art bust portrait of a solemn policy analyst facing forward, " +
      "plain neat hair, calm level unsmiling expression, high collared plain dark " +
      "coat, flat neutral background, front view, centered",
  },
  {
    id: "nova-reyes",
    character: "Nova Reyes",
    description:
      "pixel art bust portrait of a seasoned financial reporter facing forward, " +
      "curly hair tied back, reading glasses pushed up, skeptical raised brow, " +
      "rolled shirt sleeves and loosened tie, flat neutral background, front view, centered",
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
      // 256 square: the cover renders these at 256 CSS px on a 2x capture, so
      // the dithered output is 512 and the source wants to be half of that
      // rather than a 128px head upscaled four times into mush.
      image_size: { width: 256, height: 256 },
      // Opaque on purpose — the duotone thresholds luminance, which a
      // transparent background does not have.
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
   * `pixel: 1` and an output larger than the display box, both carried over
   * from the panel avatars: chunky cells destroy a face, and 512 into a 256px
   * box is an exact 2:1 so cells land on whole device pixels at 2x capture.
   * `trim` off — the subject fills the frame, so trimming would crop the head.
   */
  const png = await ditherToDuotone(readFileSync(rawPath), {
    width: 512,
    height: 512,
    pixel: 1,
    shadow: "#0A2EBF",
    highlight: "#EEF1FF",
    contrast: 1.06,
    trim: false,
    crop: "centre",
    autoLevels: true,
  });
  writeFileSync(join(OUT, `${s.id}.png`), png);
  console.error(`  ${s.character}: → .scratch/newsletter/cast/${s.id}.png (${(png.length / 1024).toFixed(1)}KB)`);
}
console.error("done");
