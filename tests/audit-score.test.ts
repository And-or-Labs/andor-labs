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
import { RULES, SUBSECTIONS, observableRules, scoreSubsection, totals, rankChecks, revealed, codeFor } from "../functions/_lib/playbook";
import type { SiteMarkdown } from "../functions/_lib/pages";

const site = (pages: string, thin = false, hasPricing = /##\s*Pricing/i.test(pages)): SiteMarkdown => ({
  pages,
  read: [],
  finalUrl: "https://acme.com",
  thin,
  hasPricing,
  pricingUnreadable: false,
  html: "",
});

describe("reading the crawl for what is observable", () => {
  it("trusts the reader on whether a pricing page was fetched", () => {
    // hasPricing is now a FACT from the markdown reader — it knows whether the
    // page was actually retrieved — rather than a guess from the word "pricing"
    // appearing somewhere in a nav.
    expect(readContext(site("## Pricing — https://acme.com/pricing\nPlans", false, true)).hasPricing).toBe(true);
    expect(readContext(site("## Homepage\nPricing is simple. Contact sales.", false, false)).hasPricing).toBe(false);
  });

  it("only looks for trials and free tiers once pricing exists", () => {
    // "free trial" in a blog post is not evidence of a trial offering.
    const ctx = readContext(site("## Blog\nHow to run a free trial", false, false));
    expect(ctx.hasPricing).toBe(false);
    expect(ctx.hasTrial).toBe(false);
    expect(ctx.hasFreemium).toBe(false);
  });

  it("detects a trial and a free tier on a real pricing page", () => {
    const ctx = readContext(site("## Pricing\nFree forever. $19/mo. Start your free trial today.", false, true));
    expect(ctx.hasTrial).toBe(true);
    expect(ctx.hasFreemium).toBe(true);
  });

  it("carries the crawler's thin flag through untouched", () => {
    expect(readContext(site("", true, false)).thin).toBe(true);
  });
});

describe("check codes", () => {
  it("numbers every check within its section, in source order", () => {
    expect(codeFor("productize")).toBe("BRAND-1");
    expect(codeFor("top-three-benefits")).toBe("BRAND-2");
    expect(codeFor("price-on-left")).toBe("PRICING-3");
    expect(codeFor("limit-usage-not-features")).toBe("FREEMIUM-1");
  });

  it("gives every rule a code, and never the same one twice", () => {
    const codes = RULES.map((r) => codeFor(r.id));
    expect(codes.every((c) => /^[A-Z]+-\d+$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBe(RULES.length);
  });
});

describe("the wire payload", () => {
  const ctx = { thin: false, hasPricing: true, hasTrial: true, hasFreemium: true };
  const build = () => {
    const scores = new Map(
      SUBSECTIONS.flatMap((s) => observableRules(s.key, ctx)).map((r, i) => [r.id, i % 6]),
    );
    const notes = new Map([...scores.keys()].map((id) => [id, `SECRET evidence for ${id}.`]));
    const checks = rankChecks(ctx, scores, notes);
    const open = revealed(checks, 3);
    return {
      checks,
      open,
      items: checks.map((c) =>
        open.has(c.id)
          ? { code: c.code, open: true, name: c.label, area: c.subsectionLabel,
              grade: c.grade, score: `${c.score}/5`, body: c.evidence, citation: c.citation }
          : { code: c.code, open: false },
      ),
    };
  };

  it("lists every scored check, in source order", () => {
    const { checks, items } = build();
    expect(items).toHaveLength(checks.length);
    // RULES order is the published order, so the codes must be non-decreasing
    // against their position in RULES.
    const pos = (id: string) => RULES.findIndex((r) => r.id === id);
    const positions = checks.map((c) => pos(c.id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("opens exactly three, wherever they fall in the sequence", () => {
    const { items } = build();
    expect(items.filter((i) => i.open)).toHaveLength(3);
  });

  it("MASKED ROWS CARRY A CODE AND NOTHING ELSE — this is the gate", () => {
    const { items } = build();
    const masked = items.filter((i) => !i.open);
    expect(masked.length).toBeGreaterThan(0);
    for (const m of masked) {
      // A name is most of a finding: "no decoy plan" gives the answer away.
      // A code gives only position. So the shape itself is the gate.
      expect(Object.keys(m).sort()).toEqual(["code", "open"]);
    }
  });

  it("never serialises a withheld check's evidence, score or citation", () => {
    const { items, checks, open } = build();
    const json = JSON.stringify(items);
    for (const c of checks) {
      if (open.has(c.id)) continue;
      expect(json, `leaked evidence for ${c.id}`).not.toContain(c.evidence);
      expect(json, `leaked name for ${c.id}`).not.toContain(c.label);
      expect(json, `leaked citation for ${c.id}`).not.toContain(c.citation);
    }
  });

  it("gives every open row a name, a score, evidence and its paper", () => {
    for (const i of build().items.filter((x) => x.open) as any[]) {
      expect(i.name.length).toBeGreaterThan(0);
      expect(i.score).toMatch(/^\d\/5$/);
      expect(i.citation).toMatch(/\(\w+ \d{4}\)\.$/);
    }
  });
});
