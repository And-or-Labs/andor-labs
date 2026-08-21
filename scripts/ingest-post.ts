/**
 * Turn one generated post envelope into a Sanity `post`.
 *
 * This is the piece that was missing. Previously AirOps wrote to Sanity
 * directly, which meant the schema contract lived inside a field-mapping panel
 * in a SaaS UI — untestable, unversioned, invisible to code review. When
 * `standfirst`, `category` and `publishedAt` became required in the August
 * migration nothing failed loudly; the generator simply kept emitting documents
 * the content lake rejects, and the ones that did land were typed `blogPost`
 * (Filament's type, not ours) so they were invisible to every site query AND
 * unpublishable, because `_type` is immutable in Sanity.
 *
 * The contract now lives here, in git, with tests. The generator's only job is
 * to emit an envelope; everything schema-shaped is this script's problem.
 *
 * ## The envelope
 *
 * ```json
 * {
 *   "title":        "…",
 *   "slug":         "optional-override",
 *   "standfirst":   "the deck under the H1, written to be read",
 *   "excerpt":      "SERP meta description, <= 160 chars",
 *   "keyTakeaways": ["exactly", "three", "lines"],
 *   "faq":          [{"question": "…", "answer": "…"}],
 *   "category":     "resources",
 *   "tags":         ["…"],
 *   "targetQuery":  "the search query this answers",
 *   "bodyMarkdown": "## Section\n\nprose…",
 *   "sources":      ["https://…"]
 * }
 * ```
 *
 * ## Publish policy
 *
 * The run is autonomous but not unconditional. Every check below has to pass
 * before the post publishes itself; any failure lands it as `drafts.<id>` with
 * the reasons printed, so a bad generation degrades to "waiting for a human"
 * rather than to "live and wrong". Two of the eight defects found in the August
 * audit were a fabricated statistic and a citation that 403s — both reach
 * readers before they reach anyone who could catch them, which is exactly the
 * class of failure a gate is for.
 *
 * Run with:
 *   node --experimental-strip-types scripts/ingest-post.ts --file post.json
 *   …            --dry-run    convert and check, write nothing
 *   …            --draft      force a draft even if every check passes
 *
 * Reads SANITY_WRITE_TOKEN / SANITY_PROJECT_ID / SANITY_DATASET from .env.
 */
import fs from "node:fs";
import path from "node:path";
import {createClient} from "@sanity/client";

import {
  ConversionError,
  auditBody,
  markdownToPortableText,
  plain,
  type Block,
  type TextBlock,
} from "./lib/markdown-to-portable-text.ts";

/* ---------------------------------------------------------------- config */

/**
 * The closed category set, duplicated from src/lib/categories.ts and
 * sanity/schemaTypes/post.ts on purpose — those are separate builds and this is
 * a third consumer. A category typed here that does not exist there renders an
 * empty eyebrow, so the set is asserted rather than trusted.
 */
const CATEGORIES = ["ai-newsletter", "field-notes", "explainer", "resources"] as const;
type Category = (typeof CATEGORIES)[number];

/**
 * Categories with no mailing list. `resources` is the lane for this pipeline
 * precisely because its `loopsList` is null: a reader who subscribed for field
 * notes did not ask to be emailed a keyword guide. If a future category is
 * added with a list attached, publishing into it from here would start sending
 * machine-written mail, so the allowed set is named rather than inferred.
 */
const NEVER_EMAILED: readonly string[] = ["resources"];

/**
 * Byline for machine-written posts. The agent carries the byline; VJ is emitted
 * as schema.org `editor`, never as `author` — that separation is what lets a
 * machine-written post name the human who checked it without putting a human
 * byline on text a human did not write.
 */
const DEFAULT_AUTHOR = "author-claude-opus";
const DEFAULT_EDITOR = "author-vishveshwar-jatain";

const MAX_EXCERPT = 160;
const REQUIRED_TAKEAWAYS = 3;
const MIN_FAQ = 3;
const MIN_H2 = 2;

/* ----------------------------------------------------------------- types */

interface FaqItem {
  question: string;
  answer: string;
}

interface Envelope {
  title?: string;
  slug?: string;
  standfirst?: string;
  excerpt?: string;
  keyTakeaways?: string[];
  faq?: FaqItem[];
  category?: string;
  tags?: string[];
  targetQuery?: string;
  bodyMarkdown?: string;
  sources?: string[];
  authors?: string[];
  editor?: string;
  publishedAt?: string;
}

/** A reason the post may not publish itself. `hard` also blocks writing a draft. */
interface Problem {
  hard: boolean;
  message: string;
}

/* ------------------------------------------------------------------- env */

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {...(process.env as Record<string, string>)};
  const file = path.join(process.cwd(), ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      // Real process env wins: a shell override is a deliberate act, a .env
      // value is a default.
      if (m && !process.env[m[1]]) out[m[1]] = m[2];
    }
  }
  return out;
}

/* ------------------------------------------------------------ validation */

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
    .replace(/-+$/g, "");
}

/**
 * Numeric claims that cite nothing.
 *
 * The August audit found "more than 75%" where the source says exactly 75%, and
 * a combined measure the source never reported. Precision drifts toward drama
 * when a model drafts from its own summary of a source rather than the source.
 * This cannot detect a misquoted figure — only a figure with no link anywhere
 * near it, which is the shape that misquotes take. It is a prompt for a human,
 * not proof of a lie, so it blocks auto-publish rather than the write.
 */
function unsourcedNumericClaims(blocks: Block[]): string[] {
  const flagged: string[] = [];
  const NUMERIC = /(\b\d{1,3}(?:\.\d+)?%|\b\d+(?:\.\d+)?\s?(?:x|times)\b|\$\s?\d[\d,.]*\s?(?:bn|billion|m|million|k)?\b)/i;

  for (const b of blocks) {
    if (b._type !== "block") continue;
    const tb = b as TextBlock;
    if (tb.style !== "normal" && tb.style !== "blockquote") continue;
    const text = tb.children.map((c) => c.text).join("");
    const m = NUMERIC.exec(text);
    if (!m) continue;
    if (tb.markDefs.length > 0) continue; // cites something inline
    flagged.push(`"${m[1]}" in: ${text.slice(0, 110)}${text.length > 110 ? "…" : ""}`);
  }
  return flagged;
}

/** Confirm a citation is reachable. A dead link is a defect the audit already found. */
async function checkUrl(url: string): Promise<string | null> {
  const attempt = async (method: "HEAD" | "GET") => {
    const ctl = AbortController ? new AbortController() : null;
    const t = setTimeout(() => ctl?.abort(), 15_000);
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: ctl?.signal,
        // Some publishers 403 a bare fetch but serve a browser UA. Presenting one
        // is the difference between "this link is dead" and "this link refuses
        // robots", and only the first is the author's problem.
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        },
      });
      return res.status;
    } finally {
      clearTimeout(t);
    }
  };

  try {
    let status = await attempt("HEAD");
    if (status === 405 || status === 403 || status === 501) status = await attempt("GET");
    if (status >= 400) return `${url} → HTTP ${status}`;
    return null;
  } catch (err) {
    return `${url} → ${(err as Error).message}`;
  }
}

/* ------------------------------------------------------------------ main */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const env = loadEnv();
  const dryRun = has("dry-run");
  const forceDraft = has("draft");

  const file = arg("file");
  const rawJson = file
    ? fs.readFileSync(file, "utf8")
    : fs.readFileSync(0, "utf8"); // stdin, so a workflow can pipe straight in

  let env0: Envelope;
  try {
    env0 = JSON.parse(rawJson);
  } catch (e) {
    console.error(`Envelope is not valid JSON: ${(e as Error).message}`);
    process.exit(1);
  }

  const problems: Problem[] = [];
  const hard = (message: string) => problems.push({hard: true, message});
  const soft = (message: string) => problems.push({hard: false, message});

  /* -- scalar fields --------------------------------------------------- */

  const title = (env0.title ?? "").trim();
  if (!title) hard("title is missing");

  const standfirst = (env0.standfirst ?? "").trim();
  if (!standfirst) hard("standfirst is missing (required by the schema since August)");

  const excerpt = (env0.excerpt ?? "").trim();
  if (!excerpt) hard("excerpt is missing (required)");
  else if (excerpt.length > MAX_EXCERPT)
    hard(`excerpt is ${excerpt.length} chars; the schema caps it at ${MAX_EXCERPT}`);

  const category = (env0.category ?? "").trim() as Category;
  if (!CATEGORIES.includes(category))
    hard(`category "${category}" is not one of: ${CATEGORIES.join(", ")}`);
  else if (!NEVER_EMAILED.includes(category))
    hard(
      `category "${category}" has a mailing list attached — this pipeline publishes only into ` +
        `never-emailed categories (${NEVER_EMAILED.join(", ")})`,
    );

  const targetQuery = (env0.targetQuery ?? "").trim();
  if (!targetQuery) soft("targetQuery is empty — the whole point of this category is one query");

  const takeaways = (env0.keyTakeaways ?? []).map((s) => s.trim()).filter(Boolean);
  if (takeaways.length !== REQUIRED_TAKEAWAYS)
    hard(
      `keyTakeaways has ${takeaways.length} entries; "The gist" is always exactly ` +
        `${REQUIRED_TAKEAWAYS} — it is a summary, not an outline`,
    );

  const faq = (env0.faq ?? []).filter((f) => f?.question?.trim() && f?.answer?.trim());
  if (faq.length < MIN_FAQ)
    soft(
      `faq has ${faq.length} usable entries; fewer than ${MIN_FAQ} makes the FAQPage JSON-LD ` +
        `barely worth emitting`,
    );

  const tags = (env0.tags ?? []).map((s) => s.trim()).filter(Boolean);
  if (tags.length === 0) soft("no tags — related-posts fallback matches on tags");

  const slug = (env0.slug ?? slugify(title)).trim();
  if (!slug) hard("slug could not be derived from the title");

  /* -- body ------------------------------------------------------------ */

  let body: Block[] = [];
  const markdown = env0.bodyMarkdown ?? "";
  if (!markdown.trim()) {
    hard("bodyMarkdown is empty");
  } else {
    try {
      body = markdownToPortableText(markdown);
    } catch (e) {
      if (e instanceof ConversionError) hard(`body will not convert — ${e.message}`);
      else throw e;
    }
  }

  if (body.length > 0) {
    for (const p of auditBody(body)) hard(`body audit — ${p}`);

    const h2s = body.filter((b) => b._type === "block" && (b as TextBlock).style === "h2");
    if (h2s.length < MIN_H2)
      soft(`body has ${h2s.length} h2 sections; the TOC and outline need at least ${MIN_H2}`);

    // The title must not be repeated as the first line of the body — it was, in
    // the August drafts, which put the same sentence on the page twice.
    const first = body.find((b) => b._type === "block") as TextBlock | undefined;
    if (first && plain(first.children.map((c) => c.text).join("")).toLowerCase() === title.toLowerCase())
      hard("the body repeats the title as its first block");

    for (const claim of unsourcedNumericClaims(body))
      soft(`numeric claim with no citation in its paragraph — ${claim}`);
  }

  /* -- citations ------------------------------------------------------- */

  const linked = body
    .filter((b): b is TextBlock => b._type === "block")
    .flatMap((b) => b.markDefs.map((d) => d.href));
  const sources = [...new Set([...(env0.sources ?? []), ...linked])].filter((u) =>
    /^https?:\/\//.test(u),
  );

  if (sources.length === 0) soft("no citations anywhere in the post");

  const deadLinks = (await Promise.all(sources.map(checkUrl))).filter(
    (x): x is string => x !== null,
  );
  for (const d of deadLinks) soft(`citation does not resolve — ${d}`);

  /* -- report ---------------------------------------------------------- */

  const hardProblems = problems.filter((p) => p.hard);
  const softProblems = problems.filter((p) => !p.hard);

  console.log(`\n${title || "(untitled)"}`);
  console.log(`  slug          ${slug}`);
  console.log(`  category      ${category}${NEVER_EMAILED.includes(category) ? " (never emailed)" : ""}`);
  console.log(`  body          ${body.length} blocks`);
  console.log(`  takeaways     ${takeaways.length}`);
  console.log(`  faq           ${faq.length}`);
  console.log(`  citations     ${sources.length}${deadLinks.length ? ` (${deadLinks.length} dead)` : ""}`);

  if (hardProblems.length) {
    console.error(`\n✗ ${hardProblems.length} blocking problem(s) — nothing was written:`);
    for (const p of hardProblems) console.error(`  · ${p.message}`);
    process.exit(1);
  }

  if (softProblems.length) {
    console.log(`\n⚠ ${softProblems.length} problem(s) — will land as a DRAFT for review:`);
    for (const p of softProblems) console.log(`  · ${p.message}`);
  }

  // Eligible on content grounds. Whether it actually publishes also depends on
  // the hero, which cannot be known until the document is read back.
  const publishEligible = softProblems.length === 0 && !forceDraft;

  if (dryRun) {
    console.log(
      `\n(dry run) content checks ${publishEligible ? "PASS" : "FAIL"}; nothing written.`,
    );
    return;
  }

  /* -- write ----------------------------------------------------------- */

  const token = env.SANITY_WRITE_TOKEN;
  if (!token) {
    console.error("SANITY_WRITE_TOKEN is not set — cannot write.");
    process.exit(1);
  }

  const client = createClient({
    projectId: env.SANITY_PROJECT_ID ?? "2b9cfqwh",
    dataset: env.SANITY_DATASET ?? "production",
    apiVersion: env.SANITY_API_VERSION ?? "2025-02-19",
    token,
    useCdn: false,
  });

  // A slug collision would put two posts on one URL, and the newer one wins the
  // build silently. Checked against published AND draft documents.
  const clash: {_id: string}[] = await client.fetch(
    `*[_type == "post" && slug.current == $slug]{_id}`,
    {slug},
  );
  const docId = clash.length ? clash[0]._id.replace(/^drafts\./, "") : `post-${slug}`;
  if (clash.length) console.log(`\n(updating existing document ${docId})`);

  // `_type` is immutable in Sanity. A stub of the wrong type sitting on this id
  // makes the document permanently unpublishable, so refuse rather than write
  // into it — this is the exact trap the `blogPost` stubs set in August.
  // `_type` is immutable in Sanity, so a stub of the wrong type sitting on this
  // id makes the document permanently unpublishable — the exact trap the
  // `blogPost` stubs set in August. Refuse rather than write into it.
  //
  // `heroImage` is read back for a different reason: this writes with
  // createOrReplace, so any field not named here is destroyed. The hero is
  // sourced by a separate script (backfill-heroes.ts) after the first ingest,
  // and carrying it forward is what makes a re-run promote a draft instead of
  // silently stripping its art.
  const existing: {_type: string; heroImage?: unknown} | null = await client.fetch(
    `*[_id in [$id, "drafts." + $id]][0]{_type, heroImage}`,
    {id: docId},
  );
  if (existing && existing._type !== "post") {
    console.error(
      `\n✗ ${docId} already exists with _type "${existing._type}". _type is immutable in Sanity; ` +
        `delete that document in its own transaction before re-running.`,
    );
    process.exit(1);
  }
  const heroImage = existing?.heroImage;

  const authors = (env0.authors ?? [DEFAULT_AUTHOR]).map((id) => ({
    _type: "reference" as const,
    _ref: id,
    _key: `a-${id}`,
  }));
  const editorId = env0.editor ?? DEFAULT_EDITOR;

  // A byline pointing at a document that does not exist renders as no byline at
  // all, which is worse than a wrong one: the post looks unattributed.
  const found: string[] = await client.fetch(`*[_type == "author" && _id in $ids]._id`, {
    ids: [...authors.map((a) => a._ref), editorId],
  });
  const known = new Set(found);
  for (const id of [...authors.map((a) => a._ref), editorId])
    if (!known.has(id)) {
      console.error(`✗ author document ${id} does not exist — a byline of nobody is a content bug.`);
      process.exit(1);
    }

  // The hero is the LCP element and doubles as the OG image, so publishing
  // without one ships a degraded page and a linkless social card. A first
  // ingest never has one; the sequence is ingest → backfill-heroes → ingest
  // again, and the second run promotes the draft.
  const publish = publishEligible && Boolean(heroImage);
  if (publishEligible && !heroImage)
    console.log(
      "\n⚠ content checks pass but there is no heroImage yet — landing as a DRAFT.\n" +
        "  next: npx sanity exec scripts/backfill-heroes.ts --with-user-token\n" +
        "  then re-run this same command to promote it.",
    );

  const doc = {
    _id: publish ? docId : `drafts.${docId}`,
    _type: "post" as const,
    title,
    slug: {_type: "slug" as const, current: slug},
    category,
    standfirst,
    excerpt,
    keyTakeaways: takeaways,
    ...(faq.length
      ? {
          faq: faq.map((f, n) => ({
            _type: "faqItem" as const,
            _key: `faq-${n}`,
            question: f.question.trim(),
            answer: f.answer.trim(),
          })),
        }
      : {}),
    ...(heroImage ? {heroImage} : {}),
    body,
    tags,
    ...(targetQuery ? {targetQuery} : {}),
    authors,
    editor: {_type: "reference" as const, _ref: editorId},
    publishedAt: env0.publishedAt ?? new Date().toISOString(),
  };

  await client.createOrReplace(doc);

  // Promoting a draft means the published id now carries the content; the draft
  // has to go or Studio shows the post as having unpublished changes forever.
  if (publish && existing) await client.delete(`drafts.${docId}`).catch(() => {});

  console.log(
    `\n✓ ${publish ? "PUBLISHED" : "DRAFT"} ${doc._id}` +
      (publish
        ? `\n  https://andorlabs.ca/blog/${slug}/ (after the next build)`
        : "\n  review in /admin"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
