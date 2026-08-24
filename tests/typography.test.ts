/**
 * The report quotes the page, and it should quote it in one voice.
 *
 * These are the cases that decide whether the transform is safe to run on text
 * we did not write: the model's note is free prose containing arbitrary
 * punctuation, and it goes straight to the reader.
 */
import { describe, expect, it } from "vitest";
import { curlyQuotes } from "../src/lib/typography";

describe("curly quotes", () => {
  it("pairs double quotes", () => {
    expect(curlyQuotes('The page claims "Big numbers." but shows no counts.')).toBe(
      "The page claims “Big numbers.” but shows no counts.",
    );
  });

  it("pairs several quotations in one sentence", () => {
    expect(curlyQuotes('Plans are "Starter", "Growth" and "Business".')).toBe(
      "Plans are “Starter”, “Growth” and “Business”.",
    );
  });

  it("NEVER touches an apostrophe", () => {
    // The reason singles are matched by shape rather than alternated. Get this
    // wrong and "that's" opens a quotation that never closes, and every mark
    // after it in the string comes out inverted.
    expect(curlyQuotes("that's rock-solid and easy to use")).toBe("that's rock-solid and easy to use");
    expect(curlyQuotes("the buyers' journey isn't obvious")).toBe("the buyers' journey isn't obvious");
  });

  it("pairs a single-quoted phrase when it stands alone", () => {
    expect(curlyQuotes("page sells generic 'AI workspace' with no price")).toBe(
      "page sells generic ‘AI workspace’ with no price",
    );
  });

  it("leaves an odd double quote alone rather than inverting the rest", () => {
    // Unbalanced input is the model's, not ours. One opening mark is a smaller
    // fault than every later quotation coming out backwards.
    expect(curlyQuotes('He said "hello')).toBe("He said “hello");
  });

  it("passes text with no quotes through untouched", () => {
    expect(curlyQuotes("No rating is shown on the page.")).toBe("No rating is shown on the page.");
  });

  it("leaves curly marks the page already had", () => {
    expect(curlyQuotes("“The AI workspace that works for you.”")).toBe(
      "“The AI workspace that works for you.”",
    );
  });
});
