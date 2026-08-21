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
import { SUBSECTIONS, observableRules, scoreSubsection, totals, auditBand, subsectionLabel } from "../functions/_lib/playbook";
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
    const t = totals(results);
    const notes = new Map(SUBSECTIONS.map((s) => [s.key, `Secret finding for ${s.label}.`]));
    return {
      host: "acme.com",
      score: t.score,
      outOf: 100,
      grade: auditBand(t.score),
      findings: t.open.map((s) => ({
        name: s.label,
        score: s.earned === null ? "n/a" : `${Math.round((s.ratio ?? 0) * 100)} / 100`,
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

  it("never serialises a withheld finding's score either", () => {
    const { _locked, _notes, ...wire } = build();
    const json = JSON.stringify(wire);
    for (const s of _locked) {
      if (s.ratio === null) continue;
      const pct = `${Math.round(s.ratio * 100)} / 100`;
      expect(json, `leaked score for ${s.key}`).not.toContain(pct);
    }
  });

  it("ships locked items as bare strings, so there is no object to inspect", () => {
    const p = build();
    for (const item of p.lockedItems) expect(typeof item).toBe("string");
  });

  it("gives every shown finding a name, a score and a body", () => {
    for (const f of build().findings) {
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.score).toMatch(/^(n\/a|\d+ \/ 100)$/);
      expect(typeof f.body).toBe("string");
    }
  });
});
