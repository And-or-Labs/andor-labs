/**
 * The converter is the piece that stands between a generated draft and the
 * content lake, so its failure modes are the ones that reach readers. Every
 * case here is a defect that has actually happened to this dataset — a body
 * that was one raw-markdown block, links that rendered as literal `[text](url)`,
 * a markdown table with nowhere to go, a duplicated H1 — plus the structural
 * invariants Sanity itself will not enforce.
 */
import {describe, expect, it} from "vitest";

import {
  ConversionError,
  auditBody,
  markdownToPortableText,
  parseInline,
  plain,
  type TextBlock,
} from "../scripts/lib/markdown-to-portable-text";

const text = (b: unknown) =>
  (b as TextBlock).children.map((c) => c.text).join("");

describe("the failure that keeps happening", () => {
  it("does not leave a whole document as one raw-markdown block", () => {
    const md = [
      "## First section",
      "",
      "Some prose with a [citation](https://example.com/report) in it.",
      "",
      "## Second section",
      "",
      "- one",
      "- two",
    ].join("\n");

    const blocks = markdownToPortableText(md);

    // The historical bug produced exactly 1 block. The shape matters more than
    // the count, but the count is the tell.
    expect(blocks.length).toBeGreaterThan(4);
    expect(blocks.filter((b) => (b as TextBlock).style === "h2")).toHaveLength(2);
    expect(auditBody(blocks)).toEqual([]);
  });

  it("turns a markdown link into a real annotation, not literal text", () => {
    const blocks = markdownToPortableText("See the [Edelman report](https://example.com/x).");
    const b = blocks[0] as TextBlock;

    expect(b.markDefs).toHaveLength(1);
    expect(b.markDefs[0].href).toBe("https://example.com/x");
    // The span carrying the link text must reference the markDef by key,
    // otherwise Studio renders unlinked text and the annotation is dead weight.
    const linked = b.children.find((c) => c.marks.length > 0);
    expect(linked?.text).toBe("Edelman report");
    expect(linked?.marks).toEqual([b.markDefs[0]._key]);
    expect(text(b)).not.toContain("](");
  });

  it("refuses a markdown table rather than flattening it into a paragraph", () => {
    const md = ["| Tool | Price |", "| --- | --- |", "| A | $10 |"].join("\n");
    expect(() => markdownToPortableText(md)).toThrow(ConversionError);
    expect(() => markdownToPortableText(md)).toThrow(/no Portable Text equivalent/);
  });

  it("refuses an H1 in the body, because the title is the only H1", () => {
    expect(() => markdownToPortableText("# Duplicated title")).toThrow(/only H1/);
  });

  it("refuses a heading deeper than the schema allows", () => {
    expect(() => markdownToPortableText("##### too deep")).toThrow(/body styles stop at h4/);
  });
});

describe("block conversion", () => {
  it("joins soft-wrapped lines into one paragraph", () => {
    const blocks = markdownToPortableText("A sentence that was\nwrapped by the generator.");
    expect(blocks).toHaveLength(1);
    expect(text(blocks[0])).toBe("A sentence that was wrapped by the generator.");
  });

  it("separates paragraphs on a blank line", () => {
    const blocks = markdownToPortableText("First.\n\nSecond.");
    expect(blocks).toHaveLength(2);
  });

  it("maps heading levels to h2/h3/h4", () => {
    const blocks = markdownToPortableText("## Two\n\n### Three\n\n#### Four");
    expect(blocks.map((b) => (b as TextBlock).style)).toEqual(["h2", "h3", "h4"]);
  });

  it("emits list items with the right listItem type", () => {
    const blocks = markdownToPortableText("- a\n- b\n\n1. x\n2. y");
    const items = blocks as TextBlock[];
    expect(items.map((b) => b.listItem)).toEqual(["bullet", "bullet", "number", "number"]);
  });

  it("collapses a multi-line blockquote into one block", () => {
    const blocks = markdownToPortableText("> first line\n> second line");
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as TextBlock).style).toBe("blockquote");
    expect(text(blocks[0])).toBe("first line second line");
  });

  it("converts a fence into a codeBlock with a schema-valid language", () => {
    const blocks = markdownToPortableText("```typescript\nconst a = 1;\n```");
    expect(blocks[0]).toMatchObject({_type: "codeBlock", language: "ts", code: "const a = 1;"});
  });

  it("falls back to text for a language the schema does not offer", () => {
    const blocks = markdownToPortableText("```rust\nfn main() {}\n```");
    expect(blocks[0]).toMatchObject({_type: "codeBlock", language: "text"});
  });

  it("refuses an unclosed fence instead of swallowing the rest of the post", () => {
    expect(() => markdownToPortableText("```js\nconst a = 1;")).toThrow(/never closed/);
  });

  it("converts --- into a divider", () => {
    const blocks = markdownToPortableText("a\n\n---\n\nb");
    expect(blocks[1]).toMatchObject({_type: "divider", style: "rule"});
  });
});

describe("directives map onto the custom blocks", () => {
  it("builds a callout with tone, title and body", () => {
    const md = [":::callout warning Read this first", "Body copy.", "- a point", ":::"].join("\n");
    const [block] = markdownToPortableText(md) as any[];
    expect(block._type).toBe("callout");
    expect(block.tone).toBe("warning");
    expect(block.title).toBe("Read this first");
    expect(block.body).toHaveLength(2);
    expect(block.body[1].listItem).toBe("bullet");
  });

  it("defaults an unrecognised tone to note and keeps the words as the title", () => {
    const [block] = markdownToPortableText(":::callout Something else\ntext\n:::") as any[];
    expect(block.tone).toBe("note");
    expect(block.title).toBe("Something else");
  });

  it("builds a keyStat from value | label | source", () => {
    const [block] = markdownToPortableText(":::stat\n75% | of buyers say it | Edelman 2026\n:::") as any[];
    expect(block).toMatchObject({
      _type: "keyStat",
      value: "75%",
      label: "of buyers say it",
      source: "Edelman 2026",
    });
  });

  it("refuses a keyStat missing its label", () => {
    expect(() => markdownToPortableText(":::stat\n75%\n:::")).toThrow(/value \| label/);
  });

  it("builds a pullQuote with attribution", () => {
    const [block] = markdownToPortableText(':::quote\nThe thing itself.\n—Someone\n:::') as any[];
    expect(block).toMatchObject({_type: "pullQuote", text: "The thing itself.", attribution: "Someone"});
  });

  it("refuses an unclosed directive", () => {
    expect(() => markdownToPortableText(":::callout note x\nbody")).toThrow(/never closed/);
  });

  it("refuses an unknown directive rather than dropping the content", () => {
    expect(() => markdownToPortableText(":::sidebar\nx\n:::")).toThrow(/unknown directive/);
  });
});

describe("images", () => {
  it("refuses an image with no alt text", () => {
    expect(() => markdownToPortableText("![](https://example.com/a.png)")).toThrow(/no alt text/);
  });

  it("refuses to hotlink when no uploader is supplied", () => {
    expect(() => markdownToPortableText("![a cat](https://example.com/a.png)")).toThrow(
      /may not hotlink/,
    );
  });

  it("emits a figure when the image resolves to an asset", () => {
    const blocks = markdownToPortableText("![a cat](https://example.com/a.png)", {
      resolveImage: () => ({_type: "reference", _ref: "image-abc"}),
    });
    expect(blocks[0]).toMatchObject({_type: "figure", alt: "a cat"});
  });
});

describe("inline marks", () => {
  it("handles bold, italic and code", () => {
    const {children} = parseInline("a **b** and _c_ and `d`", 0);
    const marked = Object.fromEntries(
      children.filter((c) => c.marks.length).map((c) => [c.text, c.marks[0]]),
    );
    expect(marked).toEqual({b: "strong", c: "em", d: "code"});
  });

  it("does not treat snake_case as italics", () => {
    const {children} = parseInline("the field_name_here value", 0);
    expect(children.every((c) => c.marks.length === 0)).toBe(true);
  });

  it("gives an empty line a focusable empty span", () => {
    const {children} = parseInline("", 0);
    expect(children).toHaveLength(1);
    expect(children[0].text).toBe("");
  });

  it("strips markers for plain text but keeps link text", () => {
    expect(plain("see **the** [report](https://x.com) now")).toBe("see the report now");
  });
});

describe("keys are content-derived", () => {
  it("produces byte-identical output for the same source", () => {
    const md = "## A\n\nSome [link](https://x.com) text.\n\n- one\n- two";
    expect(JSON.stringify(markdownToPortableText(md))).toBe(
      JSON.stringify(markdownToPortableText(md)),
    );
  });

  it("gives two identical paragraphs distinct keys", () => {
    const blocks = markdownToPortableText("Same line.\n\nSame line.");
    expect(blocks[0]._key).not.toBe(blocks[1]._key);
  });
});

describe("auditBody catches what conversion cannot", () => {
  it("passes a clean body", () => {
    expect(auditBody(markdownToPortableText("## A\n\ntext with [a link](https://x.com)"))).toEqual([]);
  });

  it("flags an orphaned link annotation", () => {
    const blocks = markdownToPortableText("[a](https://x.com)") as TextBlock[];
    blocks[0].children = [{_type: "span", _key: "s1", text: "a", marks: []}];
    expect(auditBody(blocks)).toContain("orphaned link annotation → https://x.com");
  });

  it("flags a mark pointing at nothing", () => {
    const blocks = markdownToPortableText("plain") as TextBlock[];
    blocks[0].children[0].marks = ["ghost"];
    expect(auditBody(blocks)).toContain('undefined mark "ghost"');
  });

  it("flags literal markdown that survived", () => {
    const blocks = markdownToPortableText("plain") as TextBlock[];
    blocks[0].children[0].text = "see [x](https://y.com)";
    expect(auditBody(blocks)).toContain("literal markdown link survived conversion");
  });
});
