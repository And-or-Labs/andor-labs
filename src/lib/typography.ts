/**
 * Typographic normalisation for quoted evidence.
 *
 * Every finding in the audit report is the model's sentence with the page's own
 * words quoted inside it, and which mark it reaches for is a coin toss. Two
 * cards side by side read “The page leads with one h1, “…”” and "The page
 * claims "…"" — adjacent cards in two different quoting conventions look like
 * two different tools.
 *
 * THIS IS A DISPLAY TRANSFORM AND NOTHING MORE. The grounding gate in
 * audit-score.ts has already run against the raw note, and forQuote() folds
 * both forms to the same thing before comparing, so nothing here can change
 * whether a finding was allowed through. It runs on its way to textContent.
 */

/** A straight double quote, alternating open and close across the string. */
function doubles(text: string): string {
  let open = true;
  return text.replace(/"/g, () => ((open = !open) ? "”" : "“"));
}

/**
 * Single quotes, ONLY where they are unambiguously a pair.
 *
 * Alternating is safe for doubles and catastrophic for singles: an apostrophe
 * is the same character, so "that's" opens a quotation that never closes and
 * every mark after it in the string comes out inverted. The opening mark has to
 * be preceded by a boundary and the closing one followed by one, which is what
 * an apostrophe inside a word can never satisfy.
 *
 * Anything that does not match that shape is left exactly as it arrived. A
 * missed pair is invisible; a mangled apostrophe is not.
 */
function singles(text: string): string {
  return text.replace(/(^|[\s(\[—-])'([^'\n]{1,120})'(?=$|[\s,.;:!?)\]—-])/g, "$1‘$2’");
}

export const curlyQuotes = (text: string): string => singles(doubles(text));
