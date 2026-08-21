/**
 * Reading the crawl, and the gate.
 *
 * The gate test is the important one in this file. `lockedItems` shipping
 * names only is what makes the redaction bars a gate instead of a blur — a
 * blurred payload is still in the DOM and loses to View Source. If that ever
 * regresses, the tool silently starts giving away the half it charges for.
 */
import { describe, expect, it } from "vitest";
import { readContext } from "../functions/_lib/audit-score";
import { SUBSECTIONS, observableRules, scoreSubsection, totals, subsectionLabel } from "../functions/_lib/playbook";
import type { SiteRead } from "../functions/_lib/crawl";

const site = (pages: string, thin = false): SiteRead => ({
  pages,
  html: "",
  finalUrl: "https://acme.com",
  titles: [],
  sitemapUrlCount: null,
  thin,
});

describe("reading the crawl for what is observable", () => {
  it("finds a pricing page from the crawler's own section heading", () => {
    const ctx = readContext(site("## Homepage (https://acme.com)\nhi\n## Pricing (https://acme.com/pricing)\nPlans"));
    expect(ctx.hasPricing).toBe(true);
  });

  it("finds pricing from prices on the page when there is no pricing section", () => {
    expect(readContext(site("## Homepage\n$29 per user per month")).hasPricing).toBe(true);
  });

  it("does not invent pricing on a page that never mentions it", () => {
    expect(readContext(site("## Homepage\nWe make software for teams. Contact sales.")).hasPricing).toBe(false);
  });

  it("only looks for trials and free tiers once pricing exists", () => {
    // "free trial" in a blog post is not evidence of a trial offering.
    const ctx = readContext(site("## Blog\nHow to run a free trial"));
    expect(ctx.hasPricing).toBe(false);
    expect(ctx.hasTrial).toBe(false);
    expect(ctx.hasFreemium).toBe(false);
  });

  it("detects a trial and a free tier on a real pricing page", () => {
    const ctx = readContext(site("## Pricing\nFree forever. $19/mo. Start your free trial today."));
    expect(ctx.hasTrial).toBe(true);
    expect(ctx.hasFreemium).toBe(true);
  });

  it("carries the crawler's thin flag through untouched", () => {
    expect(readContext(site("", true)).thin).toBe(true);
  });
});

describe("the wire payload", () => {
  // Mirrors gate() in functions/api/audit.ts. Kept in step deliberately: this
  // test exists to prove the SHAPE never carries withheld content.
  const build = () => {
    const ctx = { thin: false, hasPricing: true, hasTrial: true, hasFreemium: true };
    const results = SUBSECTIONS.map((s) =>
      scoreSubsection(s.key, ctx, new Map(observableRules(s.key, ctx).map((r, i) => [r.id, i % 5]))),
    );
    const t = totals(results, ctx);
    const notes = new Map(SUBSECTIONS.map((s) => [s.key, `Secret finding for ${s.label}.`]));
    return {
      host: "acme.com",
      grade: t.verdict.grade,
      gradeLabel: t.verdict.label,
      caps: t.verdict.caps,
      findings: t.open.map((s) => ({
        name: s.label,
        grade: s.grade,
        body: s.reason ?? notes.get(s.key) ?? "",
      })),
      lockedItems: t.locked.map((s) => subsectionLabel(s.key)),
      _locked: t.locked,
      _notes: notes,
    };
  };

  it("ships exactly three findings and three locked names", () => {
    const p = build();
    expect(p.findings).toHaveLength(3);
    expect(p.lockedItems).toHaveLength(3);
  });

  it("NEVER serialises a withheld finding's body — this is the gate", () => {
    const { _locked, _notes, ...wire } = build();
    const json = JSON.stringify(wire);
    for (const s of _locked) {
      const secret = _notes.get(s.key)!;
      expect(json, `leaked body for ${s.key}`).not.toContain(secret);
    }
  });

  it("never serialises a withheld finding's grade either", () => {
    const { _locked, ...wire } = build();
    // lockedItems must be bare labels. If a withheld grade appeared anywhere,
    // the redaction bar would be decorative rather than a gate.
    expect(wire.lockedItems.every((i) => typeof i === "string")).toBe(true);
    for (const s of _locked) {
      const entry = wire.lockedItems.find((i) => i === s.label);
      expect(entry, `missing label for ${s.key}`).toBeDefined();
      expect(JSON.stringify(entry)).not.toContain(String(s.grade));
    }
  });

  it("ships locked items as bare strings, so there is no object to inspect", () => {
    const p = build();
    for (const item of p.lockedItems) expect(typeof item).toBe("string");
  });

  it("gives every shown finding a name, a grade and a body", () => {
    for (const f of build().findings) {
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.grade === null || /^[A-E]$/.test(f.grade)).toBe(true);
      expect(typeof f.body).toBe("string");
    }
  });

  it("ships no percentage at all — the number never crosses the wire", () => {
    const { _locked, _notes, ...wire } = build();
    const json = JSON.stringify(wire);
    // A growing rule set moves any percentage, so a returning visitor would
    // read a changed number as a changed site. Grades absorb that; numbers do not.
    expect(json).not.toMatch(/\/ 100/);
    expect(wire).not.toHaveProperty("score");
    expect(wire).not.toHaveProperty("outOf");
  });
});
