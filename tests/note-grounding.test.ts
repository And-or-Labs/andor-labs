/**
 * Every finding must quote the page, and the quote must actually be on it.
 *
 * This exists because of a real failure, and the shape of it matters: the tool
 * was not inventing vocabulary. Asked whether chalice.ai leads with three
 * benefits, it answered "Hero h4 lists exactly three benefits:
 * platform-independent, real-world outcomes, full transparency." Every one of
 * those phrases IS on that page — which is exactly what made it convincing —
 * but the page has ONE hero line, and the structure was invented around real
 * words.
 *
 * Free prose about a page is unfalsifiable. This audit's entire claim is that
 * it is checkable, so a note that cannot be traced to the page is discarded and
 * the check with it.
 */
import { describe, expect, it } from "vitest";
import { groundedNote, quotesIn, forQuote } from "../functions/_lib/audit-score";

const PAGE = `
# AI That’s Yours
Chalice is platform-independent advertising AI that drives real-world outcomes
with full transparency.
Trusted by Leading Brands and Agencies
`;

describe("a note has to quote the page", () => {
  it("keeps a note whose quote is really there", () => {
    expect(groundedNote('The page claims "Trusted by Leading Brands and Agencies" without a count.', PAGE)).toBe(true);
  });

  it("drops the failure this was written for", () => {
    // The words are all on the page; the sentence is not. Nothing here is
    // quoted, so there is nothing to check, so it goes.
    const invented = "Hero h4 lists exactly three benefits: platform-independent, real-world outcomes, full transparency.";
    expect(groundedNote(invented, PAGE)).toBe(false);
  });

  it("drops a quote that was paraphrased inside the quote marks", () => {
    // The subtler version: it looks quoted and reads as evidence, but those
    // exact words are not on the page.
    expect(groundedNote('The hero promises "three transparent outcomes for any platform".', PAGE)).toBe(false);
  });

  it("accepts a straight apostrophe against the page's curly one", () => {
    // Crawlers and models disagree about typography constantly. Rejecting this
    // would fail true quotes, and a gate that cries wolf gets switched off.
    expect(groundedNote(`The page leads with "AI That's Yours" and one subheadline.`, PAGE)).toBe(true);
  });

  it("is not fooled by a one-word quote", () => {
    // "AI" appears everywhere. A quote has to carry enough to identify a claim.
    expect(quotesIn('It says "AI" a lot.')).toEqual([]);
  });

  it("does not gate when there is no text to gate against", () => {
    // The visual group scores from a screenshot: a note about where a button
    // sits quotes nothing, and must not be discarded for it.
    expect(groundedNote("The CTA sits in the upper-right corner.", "")).toBe(true);
  });
});

describe("quote normalisation", () => {
  it("folds typography and whitespace, not content", () => {
    expect(forQuote("AI  That’s   Yours")).toBe("ai that's yours");
    expect(forQuote("a — b")).toBe("a - b");
  });
});
