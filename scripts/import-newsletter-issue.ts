/**
 * Turn a weekly newsletter markdown draft into a Sanity `post` DRAFT.
 *
 * The AI newsletter arrives as a markdown file with a fixed shape — H1 issue
 * title, then `## Headline`, `## Excerpt`, `## Editor's Note`, `## In This
 * Issue`, then one `## Name — Beat` section per columnist. That shape maps
 * one-to-one onto fields the schema already has, so this reads the file and
 * fills them rather than dumping the markdown into a single body block:
 *
 *   H1              -> title (+ slug)
 *   ## Headline     -> standfirst (the deck under the H1)
 *   ## Excerpt      -> the opening body paragraph; `excerpt` (SEO, 160 max) is
 *                      passed separately because the field is capped and this
 *                      paragraph is not
 *   ## Editor's Note-> a `callout` left empty for the human editor to fill
 *   ## In This Issue-> keyTakeaways, the three-line "gist" box
 *   ## Name — Beat  -> h2 + body, with `**Quick hits**` promoted to an h3
 *
 * Inline `[text](url)` becomes a real `link` annotation with a markDef, not
 * literal markdown — the failure mode that has bitten this dataset before is a
 * body full of `[text](url)` rendering as plain text on the page.
 *
 * Byline resolution is by NAME against existing `author` documents. A columnist
 * with no author document is a hard error rather than a silent drop: the
 * newsletter's premise is that the agents are named, and a missing byline is a
 * content bug worth stopping for.
 *
 * It writes `drafts.<id>`, never the published document. The issue is meant to
 * land in Studio's Drafts pane for review; publishing is a human action.
 *
 * Run with:
 *   npx sanity exec scripts/import-newsletter-issue.ts --with-user-token -- \
 *     --file "<path to markdown>" [--dry-run] [--hero <path to png>]
 */
import fs from "node:fs";
import path from "node:path";
import { getCliClient } from "sanity/cli";

const client = getCliClient({ apiVersion: "2026-07-01" });

/* ------------------------------------------------------------------ types */

interface Span {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
}

interface MarkDef {
  _type: "link";
  _key: string;
  href: string;
  newTab: boolean;
}

interface TextBlock {
  _type: "block";
  _key: string;
  style: string;
  listItem?: "bullet" | "number";
  level?: number;
  markDefs: MarkDef[];
  children: Span[];
}

type Block = TextBlock | Record<string, unknown>;

/* ----------------------------------------------------------------- keys */

/**
 * Deterministic keys, derived from position rather than random.
 *
 * A re-run of this script on the same file has to produce the same document,
 * otherwise every re-import shows as a full-body change in Studio's history and
 * a reviewer cannot see what actually moved between drafts.
 */
let keySeq = 0;
const nextKey = (prefix: string) => `${prefix}${(keySeq++).toString(36)}`;
const resetKeys = () => {
  keySeq = 0;
};

/* -------------------------------------------------------- inline parsing */

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/;
const STRONG = /\*\*([^*]+)\*\*/;
const EM = /(?<![A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])/;

/**
 * Flatten one line of markdown into spans + markDefs.
 *
 * Deliberately a flat scanner, not a nested parser: the drafts use links, bold
 * and italics sequentially and never inside one another, and a recursive parser
 * here would be speculative machinery guarding a case the format does not have.
 * If a future issue nests them, this drops the inner marker visibly rather than
 * silently mangling the text — a loud failure is the right one to have.
 */
function parseInline(input: string): { children: Span[]; markDefs: MarkDef[] } {
  const children: Span[] = [];
  const markDefs: MarkDef[] = [];
  let rest = input;

  const push = (text: string, marks: string[]) => {
    if (!text) return;
    children.push({ _type: "span", _key: nextKey("s"), text, marks });
  };

  // An empty line still needs one empty span. A block with no children is not
  // editable in Studio — the cursor has nowhere to land — which would make the
  // reserved editor's note the one thing the editor cannot type into.
  if (input.length === 0) {
    return {
      children: [{ _type: "span", _key: nextKey("s"), text: "", marks: [] }],
      markDefs: [],
    };
  }

  while (rest.length > 0) {
    const link = LINK.exec(rest);
    const strong = STRONG.exec(rest);
    const em = EM.exec(rest);

    const candidates = [
      { m: link, kind: "link" as const },
      { m: strong, kind: "strong" as const },
      { m: em, kind: "em" as const },
    ].filter((c): c is { m: RegExpExecArray; kind: "link" | "strong" | "em" } => c.m !== null);

    if (candidates.length === 0) {
      push(rest, []);
      break;
    }

    const winner = candidates.reduce((a, b) => (a.m.index <= b.m.index ? a : b));
    push(rest.slice(0, winner.m.index), []);

    if (winner.kind === "link") {
      const key = nextKey("l");
      markDefs.push({
        _type: "link",
        _key: key,
        href: winner.m[2],
        // External sources, opened away from the issue the reader is mid-way
        // through. Every link in this newsletter is a citation.
        newTab: true,
      });
      push(winner.m[1], [key]);
    } else {
      push(winner.m[1], [winner.kind]);
    }

    rest = rest.slice(winner.m.index + winner.m[0].length);
  }

  return { children, markDefs };
}

function textBlock(line: string, style = "normal", listItem?: "bullet"): TextBlock {
  const key = nextKey("b");
  const { children, markDefs } = parseInline(line);
  return {
    _type: "block",
    _key: key,
    style,
    ...(listItem ? { listItem, level: 1 } : {}),
    markDefs,
    children,
  };
}

/** Plain text of a markdown line — markers stripped, link text kept. */
function plain(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<![A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])/g, "$1")
    .trim();
}

/* --------------------------------------------------------- file sections */

interface Section {
  heading: string;
  lines: string[];
}

interface Issue {
  title: string;
  sections: Section[];
}

function readIssue(file: string): Issue {
  const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");

  let title = "";
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      current = { heading: line.slice(3).trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (!title) throw new Error("No H1 issue title found in the draft.");
  return { title, sections };
}

const find = (issue: Issue, heading: string) =>
  issue.sections.find((s) => s.heading.toLowerCase() === heading.toLowerCase());

/** Paragraphs of a section: blank-line separated, horizontal rules dropped. */
function paragraphs(section: Section | undefined): string[] {
  if (!section) return [];
  return section.lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== "---");
}

/* ----------------------------------------------------------- body build */

/** A columnist section: `## Vex Halloran — Frontier Labs & Big Tech`. */
const COLUMN_HEADING = /^(.+?)\s+[—-]\s+(.+)$/;

const RESERVED = ["headline", "excerpt", "editor's note", "in this issue"];

interface Column {
  name: string;
  beat: string;
  blocks: Block[];
}

function buildColumns(issue: Issue): Column[] {
  const columns: Column[] = [];

  for (const section of issue.sections) {
    if (RESERVED.includes(section.heading.toLowerCase())) continue;
    const match = COLUMN_HEADING.exec(section.heading);
    if (!match) {
      throw new Error(
        `Section "${section.heading}" is neither a reserved field nor a "Name — Beat" column.`,
      );
    }

    const blocks: Block[] = [
      textBlock(section.heading, "h2"),
    ];

    for (const line of paragraphs(section)) {
      // `**Quick hits**` on its own line is a subhead, not a bold paragraph.
      if (/^\*\*Quick hits\*\*$/i.test(line)) {
        blocks.push(textBlock("Quick hits", "h3"));
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        blocks.push(textBlock(line.replace(/^[-*]\s+/, ""), "normal", "bullet"));
        continue;
      }
      blocks.push(textBlock(line));
    }

    columns.push({ name: match[1].trim(), beat: match[2].trim(), blocks });
  }

  return columns;
}

/* ------------------------------------------------------------- document */

interface BuildOptions {
  file: string;
  /** Slug override; otherwise derived from the issue title. */
  slug?: string;
  /** SEO meta description, capped at 160 by the schema. */
  excerpt: string;
  publishedAt: string;
  tags: string[];
  hero?: { assetId: string; alt: string; caption?: string; credit?: string };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

async function resolveAuthors(names: string[]): Promise<string[]> {
  const docs: { _id: string; name: string }[] = await client.fetch(
    `*[_type == "author" && name in $names]{_id, name}`,
    { names },
  );
  return names.map((name) => {
    const doc = docs.find((d) => d.name === name);
    if (!doc) throw new Error(`No author document named "${name}". Create it before importing.`);
    return doc._id;
  });
}

async function build(opts: BuildOptions) {
  resetKeys();
  const issue = readIssue(opts.file);

  const headline = paragraphs(find(issue, "Headline")).join(" ");
  const excerptPara = paragraphs(find(issue, "Excerpt")).join(" ");
  const inThisIssue = paragraphs(find(issue, "In This Issue"))
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => plain(l.replace(/^[-*]\s+/, "")));

  if (!headline) throw new Error("No `## Headline` section — that is the standfirst.");
  if (inThisIssue.length === 0) throw new Error("No `## In This Issue` bullets — those are the gist.");

  const columns = buildColumns(issue);
  const authorIds = await resolveAuthors(columns.map((c) => c.name));
  // The human-in-the-loop named in the category blurb. Emitted as schema.org
  // editor, never as author — that separation is the whole point of the field.
  const editor: { _id: string } | null = await client.fetch(
    `*[_type == "author" && kind == "person"] | order(_createdAt asc)[0]{_id}`,
  );

  const body: Block[] = [
    // Left deliberately empty. The draft reserves this for the human editor,
    // and a machine-written placeholder in an editor's note would be the one
    // paragraph on the page that lies about who wrote it.
    {
      _type: "callout",
      _key: nextKey("c"),
      tone: "note",
      title: "Editor's note",
      body: [textBlock("")],
    },
    ...(excerptPara ? [textBlock(excerptPara)] : []),
    { _type: "divider", _key: nextKey("d"), style: "dither" },
  ];

  columns.forEach((column, i) => {
    body.push(...column.blocks);
    if (i < columns.length - 1) {
      body.push({ _type: "divider", _key: nextKey("d"), style: "rule" });
    }
  });

  const slug = opts.slug ?? slugify(issue.title);

  return {
    _id: `drafts.post-${slug}`,
    _type: "post",
    title: issue.title,
    slug: { _type: "slug", current: slug },
    category: "ai-newsletter",
    authors: authorIds.map((id) => ({ _type: "reference", _key: nextKey("a"), _ref: id })),
    ...(editor ? { editor: { _type: "reference", _ref: editor._id } } : {}),
    standfirst: headline,
    excerpt: opts.excerpt,
    keyTakeaways: inThisIssue,
    ...(opts.hero
      ? {
          heroImage: {
            _type: "image",
            asset: { _type: "reference", _ref: opts.hero.assetId },
            alt: opts.hero.alt,
            ...(opts.hero.caption ? { caption: opts.hero.caption } : {}),
            ...(opts.hero.credit ? { credit: opts.hero.credit } : {}),
          },
        }
      : {}),
    body,
    publishedAt: opts.publishedAt,
    tags: opts.tags,
  };
}

/* ----------------------------------------------------------------- main */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const file = arg("file");
  if (!file) throw new Error("Pass --file <path to the markdown draft>.");

  const heroPath = arg("hero");
  let hero: BuildOptions["hero"];

  if (heroPath) {
    const asset = await client.assets.upload("image", fs.createReadStream(heroPath), {
      filename: path.basename(heroPath),
    });
    hero = {
      assetId: asset._id,
      alt: arg("hero-alt") ?? "",
      caption: arg("hero-caption"),
    };
    console.log(`✓ uploaded hero ${asset._id}`);
  }

  const doc = await build({
    file,
    slug: arg("slug"),
    excerpt: arg("excerpt") ?? "",
    publishedAt: arg("published-at") ?? new Date().toISOString(),
    tags: (arg("tags") ?? "AI").split(",").map((t) => t.trim()).filter(Boolean),
    hero,
  });

  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify(doc, null, 2));
    return;
  }

  await client.createOrReplace(doc);
  console.log(`✓ ${doc._id}`);
  console.log(`  ${doc.title}`);
  console.log(`  ${doc.body.length} blocks · byline ${doc.authors.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
