/**
 * A citation on a card is title and year. The full APA string is right for a
 * footnote and wrong for a finding — at 150-200 characters it was the longest
 * thing on the card.
 */
import { describe, expect, it } from "vitest";
import { RULES, shortCitation } from "../functions/_lib/playbook";

describe("shortCitation", () => {
  it("takes the title before the journal, not the longest fragment", () => {
    // The first attempt picked the longest segment, and a five-author list is
    // longer than a short title: this one came out as
    // "P., Jaakkola, E., Gelbrich, K., & Hartley, N (2021)".
    expect(
      shortCitation(
        "Wirtz, J., Fritze, M. P., Jaakkola, E., Gelbrich, K., & Hartley, N. Service products and productization. Journal of Business Research (September 2021).",
      ),
    ).toBe("Service products and productization (2021)");
  });

  it("strips the initial the author split leaves behind, and the subtitle", () => {
    expect(
      shortCitation(
        "Shu, S. B., & Carlson, K. A. When three charms but four alarms: Identifying the optimal number of claims in persuasion settings. Journal of Marketing (January 2014).",
      ),
    ).toBe("When three charms but four alarms (2014)");
  });

  it("never leaks an author list into any real citation", () => {
    // The whole rule set, because a wrong short form is worse than a long right
    // one on a page that sells itself on its sources.
    for (const r of RULES.filter((r) => r.citation)) {
      const s = shortCitation(r.citation);
      expect(s, r.id).toMatch(/\(\d{4}\)$/);
      expect(s, r.id).not.toMatch(/^[A-Z][a-z]+,\s+[A-Z]\./);
      expect(s.length, r.id).toBeLessThan(r.citation.length);
    }
  });

  it("falls back to the full citation rather than guessing", () => {
    expect(shortCitation("Not a citation at all")).toBe("Not a citation at all");
  });
});
