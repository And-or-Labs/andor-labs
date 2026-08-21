/**
 * Candidate sweep for the Attention Economy collage cut-outs.
 *
 * The first pass took searchImage's single best hit per role and all three were
 * unusable: a Hungarian political billboard for "newspaper editor", a
 * half-cropped face for "official speaking podium". Two separate causes, and
 * neither is fixable by retrying the same query:
 *
 * 1. RELEVANCE. Openverse is Wikimedia/Flickr-heavy, so an occupational phrase
 *    ("newspaper editor office portrait") matches captions about the subject
 *    rather than photographs of one. Several plainer queries beat one clever
 *    one, so each role fans out and every hit is kept for inspection.
 * 2. CROP. `centre` is right for a texture-first 16:9 hero and wrong for an
 *    upright cut-out of a person — a centred crop of an off-centre subject
 *    takes their shoulder. `attention` is used here for exactly the reason
 *    dither.ts warns against it elsewhere: it seeks the high-contrast region,
 *    which on a portrait is the face and on a landscape hero was signage.
 *
 * Every candidate is written out numbered so a human picks the frame. Nothing
 * here selects automatically — the quality gate measures texture, not whether
 * the photograph is of the right thing.
 *
 *   npx tsx scripts/sweep-attention-cutouts.mts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ditherToDuotone } from "./lib/dither";
import { searchImage, attributionLine, fetchImageBytes } from "./lib/openverse";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = join(ROOT, ".scratch", "newsletter", "attention-economy");
const SWEEP = join(BASE, "sweep");
const DELAY_MS = 1200;

const ROLES = [
  {
    /**
     * PEOPLE, queried as people.
     *
     * The previous sweep asked for "person using chatbot" and similar — one
     * photograph carrying both halves of the idea — and returned a man hugging
     * a baby and a doll holding a knife. Openverse's commercially-licensed pool
     * is Wikimedia and Flickr documentation, which has plenty of people and
     * almost no modern AI stock.
     *
     * So the halves are separated: these supply the people, the brand marks
     * supply the AI, and the collage puts them in the same frame. That is what
     * a cut-out montage is for.
     */
    id: "person",
    w: 300,
    h: 380,
    queries: [
      "person using smartphone",
      "woman looking at phone",
      "man reading newspaper",
      "commuters looking at phones",
      "person working laptop office",
      "crowd smartphones concert",
    ],
  },
] as const;

mkdirSync(SWEEP, { recursive: true });
const credits: Record<string, string> = {};

for (const role of ROLES) {
  console.error(`\n── ${role.id} ──`);
  let n = 0;
  for (const q of role.queries) {
    const hit = await searchImage(q, { minWidth: 900 });
    await new Promise((r) => setTimeout(r, DELAY_MS));
    if (!hit) {
      console.error(`  "${q}" → nothing usable`);
      continue;
    }
    n += 1;
    const id = `${role.id}-${n}`;
    const rawPath = join(SWEEP, `${id}.src`);
    // Openverse indexes URLs that upstream has since moved or deleted — a dead
    // candidate is a normal result of searching, not a reason to abandon the
    // remaining roles.
    if (!existsSync(rawPath)) {
      try {
        writeFileSync(rawPath, await fetchImageBytes(hit.url));
      } catch (err) {
        console.error(`  ${id}  "${q}" → ${(err as Error).message.slice(0, 60)}`);
        n -= 1;
        continue;
      }
    }

    const png = await ditherToDuotone(readFileSync(rawPath), {
      width: role.w,
      height: role.h,
      pixel: 1,
      shadow: "#0A2EBF",
      highlight: "#EEF1FF",
      contrast: 1.06,
      trim: true,
      crop: "attention",
      autoLevels: true,
    });
    writeFileSync(join(SWEEP, `${id}.png`), png);
    credits[id] = attributionLine(hit);
    console.error(`  ${id}  "${q}"  ${hit.width}x${hit.height}  ${credits[id]}`);
    console.error(`         ${hit.title.slice(0, 70)}`);
  }
}

writeFileSync(join(SWEEP, "credits.json"), JSON.stringify(credits, null, 2) + "\n");

/**
 * Contact sheet. Inspecting candidates one file at a time is the slow part of
 * this loop, and the thing being judged — is this a photograph of the right
 * thing, and does it survive the threshold — is judged faster side by side.
 */
{
  const sharp = (await import("sharp")).default;
  const ids = Object.keys(credits);
  const CW = 200, CH = 250, COLS = 4;
  const rows = Math.ceil(ids.length / COLS);
  const composites = await Promise.all(
    ids.map(async (id, i) => ({
      input: await sharp(join(SWEEP, `${id}.png`)).resize(CW, CH, { fit: "contain", background: "#fff" }).toBuffer(),
      left: (i % COLS) * CW,
      top: Math.floor(i / COLS) * CH,
    })),
  );
  await sharp({
    create: { width: COLS * CW, height: rows * CH, channels: 3, background: "#ffffff" },
  }).composite(composites).png().toFile(join(SWEEP, "_contact.png"));
  console.error(`contact sheet → ${join(SWEEP, "_contact.png")}`);
  console.error(`order: ${ids.join(", ")}`);
}
console.error(`\n${Object.keys(credits).length} candidates → ${SWEEP}`);
