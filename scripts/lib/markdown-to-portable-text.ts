/**
 * Markdown → Portable Text, for the `post.body` field specifically.
 *
 * This exists because the failure that has bitten this dataset repeatedly is a
 * `body` containing exactly one block whose text is raw markdown. Portable Text
 * has no markdown parser: `## heads` and `[links](url)` sitting inside a span
 * render as literal characters on the page. A generator that emits markdown is
 * doing the right thing — markdown is what language models are reliably good
 * at — but something has to translate, and that something has to be code that
 * can be tested rather than a field mapping in a SaaS UI.
 *
 * The dialect accepted here is deliberately NARROWER than markdown:
 *
 *   - `##`, `###`, `####`  → h2 / h3 / h4. `#` is rejected: the post title is
 *                            the H1 and a second one breaks document outline.
 *   - `-` / `*` / `1.`     → bullet and numbered list items
 *   - `>`                  → blockquote
 *   - ` ``` `              → codeBlock (language from the fence info string)
 *   - `---`                → divider
 *   - `:::callout`         → callout, with an optional tone and title
 *   - `:::stat`            → keyStat
 *   - `:::quote`           → pullQuote
 *   - `![alt](url)`        → figure, alt required
 *   - inline `**`, `_`, `` ` ``, `[]()` → marks and link annotations
 *
 * Everything else is a hard error rather than a silent degradation. Tables in
 * particular: `body` has no table block type at all, so a markdown table has no
 * representation and previously landed as literal pipes and dashes in a
 * paragraph. Refusing it forces the generator to emit a qualified list, which
 * is what the schema can actually render.
 *
 * Keys are content-derived (sha1 of type + position + text), not random, so
 * converting the same source twice produces byte-identical output. That is what
 * makes a re-ingest a no-op instead of a spurious diff, and it is why a failed
 * run can simply be repeated.
 */
import crypto from "node:crypto";

/* ------------------------------------------------------------------ types */

export interface Span {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
}

export interface MarkDef {
  _type: "link";
  _key: string;
  href: string;
  newTab?: boolean;
}

export interface TextBlock {
  _type: "block";
  _key: string;
  style: string;
  listItem?: "bullet" | "number";
  level?: number;
  markDefs: MarkDef[];
  children: Span[];
}

export type CustomBlock =
  | {_type: "divider"; _key: string; style: "rule" | "dither" | "asterism"}
  | {_type: "pullQuote"; _key: string; text: string; attribution?: string}
  | {_type: "keyStat"; _key: string; value: string; label: string; source?: string}
  | {_type: "codeBlock"; _key: string; language: string; filename?: string; code: string}
  | {_type: "callout"; _key: string; tone: "note" | "warning" | "key"; title?: string; body: TextBlock[]}
  | {_type: "figure"; _key: string; alt: string; caption?: string; credit?: string; url: string};

export type Block = TextBlock | CustomBlock;

/** A refusal to convert. Carries the source line so the generator can be fixed. */
export class ConversionError extends Error {
  // Written out longhand rather than as constructor parameter properties: Node's
  // strip-only TypeScript mode (`--experimental-strip-types`) rejects those, and
  // this file has to run under plain node as well as under vitest.
  line: number;
  source: string;

  constructor(message: string, line: number, source: string) {
    super(`line ${line}: ${message}\n  > ${source}`);
    this.name = "ConversionError";
    this.line = line;
    this.source = source;
  }
}

/* ------------------------------------------------------------------- keys */

/**
 * Content-derived key.
 *
 * Sanity requires `_key` to be unique within its array and stable across edits;
 * it uses them to diff and to target patches. A random key would make every
 * re-conversion of unchanged prose look like a rewrite of every block, which
 * turns "re-run the ingest" from a safe idempotent action into a destructive
 * one. Position is in the hash because two identical paragraphs in one document
 * are legitimate and must still get distinct keys.
 */
function keyFor(kind: string, index: number, text: string): string {
  return crypto
    .createHash("sha1")
    .update(`${kind}:${index}:${text}`)
    .digest("hex")
    .slice(0, 12);
}

/* -------------------------------------------------------- inline parsing */

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/;
const STRONG = /\*\*([^*]+)\*\*/;
const CODE = /`([^`]+)`/;
const EM = /(?<![A-Za-z0-9*_])_([^_]+)_(?![A-Za-z0-9])/;

/**
 * Flatten one line of markdown into spans plus the link annotations they point
 * at.
 *
 * A flat left-to-right scanner rather than a nested parser. The generator is
 * instructed to use links, bold, italics and code sequentially and never nested,
 * and a recursive parser here would be speculative machinery guarding a case the
 * contract forbids. Where nesting does appear the inner marker survives as
 * visible text — a loud, obvious wrongness in the rendered page rather than a
 * silently mangled sentence.
 *
 * Carried over from scripts/import-newsletter-issue.ts, which has run this logic
 * in production, with inline `code` added.
 */
export function parseInline(
  input: string,
  blockIndex: number,
): {children: Span[]; markDefs: MarkDef[]} {
  const children: Span[] = [];
  const markDefs: MarkDef[] = [];
  let rest = input;
  let n = 0;

  const push = (text: string, marks: string[]) => {
    if (!text) return;
    children.push({
      _type: "span",
      _key: keyFor("s", blockIndex, `${n++}:${text}`),
      text,
      marks,
    });
  };

  // An empty line still needs one empty span. A block with no children cannot be
  // focused in Studio — the cursor has nowhere to land — so an editor would be
  // unable to type into the very paragraph that needs their attention.
  if (input.length === 0) {
    return {
      children: [{_type: "span", _key: keyFor("s", blockIndex, "empty"), text: "", marks: []}],
      markDefs: [],
    };
  }

  while (rest.length > 0) {
    const candidates = (
      [
        {m: LINK.exec(rest), kind: "link" as const},
        {m: STRONG.exec(rest), kind: "strong" as const},
        {m: CODE.exec(rest), kind: "code" as const},
        {m: EM.exec(rest), kind: "em" as const},
      ] as const
    ).filter(
      (c): c is {m: RegExpExecArray; kind: "link" | "strong" | "code" | "em"} => c.m !== null,
    );

    if (candidates.length === 0) {
      push(rest, []);
      break;
    }

    const winner = candidates.reduce((a, b) => (a.m.index <= b.m.index ? a : b));
    push(rest.slice(0, winner.m.index), []);

    if (winner.kind === "link") {
      const key = keyFor("l", blockIndex, `${n}:${winner.m[2]}`);
      markDefs.push({
        _type: "link",
        _key: key,
        href: winner.m[2],
        // Every link in these posts is a citation to somewhere else. Keeping the
        // article open behind it is the behaviour a reader checking a source
        // wants.
        newTab: true,
      });
      push(winner.m[1], [key]);
    } else {
      push(winner.m[1], [winner.kind]);
    }

    rest = rest.slice(winner.m.index + winner.m[0].length);
  }

  return {children, markDefs};
}

function textBlock(
  line: string,
  index: number,
  style = "normal",
  listItem?: "bullet" | "number",
): TextBlock {
  const {children, markDefs} = parseInline(line, index);
  return {
    _type: "block",
    _key: keyFor("b", index, line),
    style,
    ...(listItem ? {listItem, level: 1} : {}),
    markDefs,
    children,
  };
}

/** Plain text of a markdown line — markers stripped, link text kept. */
export function plain(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(?<![A-Za-z0-9*_])_([^_]+)_(?![A-Za-z0-9])/g, "$1")
    .trim();
}

/* -------------------------------------------------------- block matchers */

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const FENCE = /^```\s*([A-Za-z0-9+#-]*)\s*(?:\|\s*(.+?)\s*)?$/;
const RULE = /^(?:---|\*\*\*|___)\s*$/;
const DIRECTIVE = /^:::([a-z]+)\s*(.*)$/;
const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*(?:"(.*)")?\s*$/;
const TABLE_ROW = /^\|.*\|\s*$/;

const CODE_LANGS = new Set(["text", "bash", "js", "ts", "json", "python", "html", "css", "sql"]);
const CALLOUT_TONES = new Set(["note", "warning", "key"]);

/** Map common fence aliases onto the nine languages the schema actually offers. */
const LANG_ALIAS: Record<string, string> = {
  "": "text",
  plaintext: "text",
  txt: "text",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  javascript: "js",
  jsx: "js",
  typescript: "ts",
  tsx: "ts",
  py: "python",
  yaml: "text",
  yml: "text",
  groq: "text",
  markdown: "text",
  md: "text",
};

/* ------------------------------------------------------------ conversion */

export interface ConvertOptions {
  /**
   * Resolve an image URL to a Sanity asset reference. Figures are skipped
   * entirely when this is absent, because a `figure` pointing at a hotlinked
   * external URL is a broken image waiting for the other site to reorganise.
   */
  resolveImage?: (url: string, alt: string) => {_type: "reference"; _ref: string} | null;
}

/**
 * Convert the constrained markdown dialect into Portable Text blocks.
 *
 * Throws ConversionError on anything the schema cannot represent. That is the
 * point: the alternative — degrading quietly to a paragraph — is exactly how a
 * body full of literal `##` reached production twice.
 */
export function markdownToPortableText(markdown: string, opts: ConvertOptions = {}): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let idx = 0;

  const at = (n: number) => lines[n] ?? "";

  while (i < lines.length) {
    const raw = at(i);
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    /* ---- refusals, checked before anything can swallow them ------------- */

    if (TABLE_ROW.test(trimmed)) {
      throw new ConversionError(
        "markdown tables have no Portable Text equivalent — `body` defines no table block. " +
          "Rewrite as a qualified list or a :::callout.",
        i + 1,
        trimmed,
      );
    }

    const heading = HEADING.exec(trimmed);
    if (heading && heading[1].length === 1) {
      throw new ConversionError(
        "`# ` is not allowed in the body — the post title is the only H1 on the page. Start at `## `.",
        i + 1,
        trimmed,
      );
    }
    if (heading && heading[1].length > 4) {
      throw new ConversionError(
        `heading level ${heading[1].length} is not in the schema — body styles stop at h4.`,
        i + 1,
        trimmed,
      );
    }

    /* ---- directives: :::callout / :::stat / :::quote --------------------- */

    const directive = DIRECTIVE.exec(trimmed);
    if (directive) {
      const [, kind, argstr] = directive;
      const close = findClose(lines, i + 1);
      if (close === -1) {
        throw new ConversionError(`\`:::${kind}\` is never closed with \`:::\``, i + 1, trimmed);
      }
      const inner = lines.slice(i + 1, close);

      if (kind === "callout") {
        const [toneRaw, ...titleParts] = argstr.split(/\s+/);
        const tone = CALLOUT_TONES.has(toneRaw) ? toneRaw : "note";
        const title = (CALLOUT_TONES.has(toneRaw) ? titleParts.join(" ") : argstr).trim();
        const body: TextBlock[] = [];
        for (const l of inner) {
          const t = l.trim();
          if (t === "") continue;
          const b = BULLET.exec(t);
          const nlist = NUMBERED.exec(t);
          if (b) body.push(textBlock(b[1], idx++, "normal", "bullet"));
          else if (nlist) body.push(textBlock(nlist[1], idx++, "normal", "number"));
          else body.push(textBlock(t, idx++, "normal"));
        }
        if (body.length === 0) {
          throw new ConversionError("`:::callout` is empty", i + 1, trimmed);
        }
        blocks.push({
          _type: "callout",
          _key: keyFor("callout", idx++, title + body.length),
          tone: tone as "note" | "warning" | "key",
          ...(title ? {title} : {}),
          body,
        });
      } else if (kind === "stat") {
        // `:::stat` body is `value | label | source?`, one line. The source is
        // strongly encouraged and checked by the ingest validator, not here —
        // this layer converts, it does not adjudicate provenance.
        const parts = inner.join(" ").split("|").map((s) => s.trim());
        if (parts.length < 2 || !parts[0] || !parts[1]) {
          throw new ConversionError(
            "`:::stat` needs `value | label` and optionally `| source`",
            i + 1,
            inner.join(" "),
          );
        }
        blocks.push({
          _type: "keyStat",
          _key: keyFor("stat", idx++, parts.join("|")),
          value: parts[0],
          label: parts[1],
          ...(parts[2] ? {source: parts[2]} : {}),
        });
      } else if (kind === "quote") {
        const parts = inner.join("\n").split("\n—").map((s) => s.trim());
        const text = plain(parts[0]);
        if (!text) throw new ConversionError("`:::quote` is empty", i + 1, trimmed);
        blocks.push({
          _type: "pullQuote",
          _key: keyFor("quote", idx++, text),
          text,
          ...(parts[1] ? {attribution: parts[1]} : {}),
        });
      } else {
        throw new ConversionError(
          `unknown directive \`:::${kind}\` — only callout, stat and quote exist`,
          i + 1,
          trimmed,
        );
      }
      i = close + 1;
      continue;
    }

    /* ---- fenced code ----------------------------------------------------- */

    const fence = FENCE.exec(trimmed);
    if (fence) {
      const infoRaw = (fence[1] || "").toLowerCase();
      const filename = fence[2];
      const language = CODE_LANGS.has(infoRaw) ? infoRaw : (LANG_ALIAS[infoRaw] ?? "text");
      let j = i + 1;
      const buf: string[] = [];
      while (j < lines.length && !/^```\s*$/.test(at(j).trim())) {
        buf.push(at(j));
        j++;
      }
      if (j >= lines.length) {
        throw new ConversionError("code fence is never closed", i + 1, trimmed);
      }
      blocks.push({
        _type: "codeBlock",
        _key: keyFor("code", idx++, buf.join("\n")),
        language,
        ...(filename ? {filename} : {}),
        code: buf.join("\n"),
      });
      i = j + 1;
      continue;
    }

    /* ---- images ---------------------------------------------------------- */

    const image = IMAGE.exec(trimmed);
    if (image) {
      const [, alt, url, caption] = image;
      if (!alt.trim()) {
        throw new ConversionError(
          "image has no alt text — `figure` requires it, which is the point of having no bare image type",
          i + 1,
          trimmed,
        );
      }
      const ref = opts.resolveImage?.(url, alt) ?? null;
      if (!ref) {
        throw new ConversionError(
          `image \`${url}\` could not be uploaded to Sanity — a figure may not hotlink an external URL`,
          i + 1,
          trimmed,
        );
      }
      blocks.push({
        _type: "figure",
        _key: keyFor("fig", idx++, url),
        alt: alt.trim(),
        ...(caption ? {caption} : {}),
        url,
      } as CustomBlock);
      i++;
      continue;
    }

    /* ---- thematic break -------------------------------------------------- */

    if (RULE.test(trimmed)) {
      blocks.push({_type: "divider", _key: keyFor("hr", idx++, "rule"), style: "rule"});
      i++;
      continue;
    }

    /* ---- headings -------------------------------------------------------- */

    if (heading) {
      blocks.push(textBlock(heading[2].trim(), idx++, `h${heading[1].length}`));
      i++;
      continue;
    }

    /* ---- blockquote ------------------------------------------------------ */

    const quote = QUOTE.exec(trimmed);
    if (quote) {
      const buf: string[] = [];
      let j = i;
      while (j < lines.length) {
        const q = QUOTE.exec(at(j).trim());
        if (!q) break;
        buf.push(q[1]);
        j++;
      }
      blocks.push(textBlock(buf.join(" ").trim(), idx++, "blockquote"));
      i = j;
      continue;
    }

    /* ---- lists ----------------------------------------------------------- */

    const bullet = BULLET.exec(trimmed);
    const numbered = NUMBERED.exec(trimmed);
    if (bullet || numbered) {
      const kind: "bullet" | "number" = bullet ? "bullet" : "number";
      let j = i;
      while (j < lines.length) {
        const t = at(j).trim();
        const b = BULLET.exec(t);
        const n2 = NUMBERED.exec(t);
        const item = kind === "bullet" ? b : n2;
        if (!item) break;
        blocks.push(textBlock(item[1], idx++, "normal", kind));
        j++;
      }
      i = j;
      continue;
    }

    /* ---- paragraph ------------------------------------------------------- */
    // Soft-wrapped lines belong to one paragraph. Joining until a blank line is
    // what makes hand-wrapped generator output render as prose rather than as a
    // stack of one-line paragraphs.

    const buf: string[] = [];
    let j = i;
    while (j < lines.length) {
      const t = at(j).trim();
      if (
        t === "" ||
        HEADING.test(t) ||
        BULLET.test(t) ||
        NUMBERED.test(t) ||
        QUOTE.test(t) ||
        FENCE.test(t) ||
        RULE.test(t) ||
        DIRECTIVE.test(t) ||
        IMAGE.test(t) ||
        TABLE_ROW.test(t)
      ) {
        break;
      }
      buf.push(t);
      j++;
    }
    blocks.push(textBlock(buf.join(" "), idx++, "normal"));
    i = j;
  }

  return blocks;
}

function findClose(lines: string[], from: number): number {
  for (let j = from; j < lines.length; j++) {
    if ((lines[j] ?? "").trim() === ":::") return j;
  }
  return -1;
}

/* ------------------------------------------------------------ assertions */

/**
 * Structural checks that a converted body must pass before it is written.
 *
 * Separate from conversion so the ingest script can report every problem in one
 * run instead of failing on the first. Returns human-readable problems; empty
 * means clean.
 */
export function auditBody(blocks: Block[]): string[] {
  const problems: string[] = [];

  const keys = blocks.map((b) => b._key);
  const dupes = keys.filter((k, n) => keys.indexOf(k) !== n);
  if (dupes.length) problems.push(`duplicate block keys: ${[...new Set(dupes)].join(", ")}`);

  for (const b of blocks) {
    if (b._type !== "block") continue;
    if (b.style === "h1") problems.push("body contains an h1");
    // An orphaned markDef is a link annotation nothing points at; Studio shows
    // the text unlinked and the reference silently rots.
    const referenced = new Set(b.children.flatMap((c) => c.marks));
    for (const d of b.markDefs) {
      if (!referenced.has(d._key)) problems.push(`orphaned link annotation → ${d.href}`);
    }
    // A mark that is neither a decorator nor a defined annotation renders as
    // nothing at all.
    const defined = new Set(b.markDefs.map((d) => d._key));
    const decorators = new Set(["strong", "em", "code", "underline", "strike-through"]);
    for (const c of b.children) {
      for (const m of c.marks) {
        if (!decorators.has(m) && !defined.has(m)) problems.push(`undefined mark "${m}"`);
      }
    }
    if (b.children.length === 0) problems.push("block with no children (uneditable in Studio)");
  }

  const text = blocks
    .filter((b): b is TextBlock => b._type === "block")
    .flatMap((b) => b.children.map((c) => c.text))
    .join(" ");
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) problems.push("literal markdown link survived conversion");
  if (/^#{1,6}\s/m.test(text)) problems.push("literal markdown heading survived conversion");
  if (/\*\*[^*]+\*\*/.test(text)) problems.push("literal markdown bold survived conversion");

  return problems;
}
