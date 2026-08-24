/**
 * The free audit runs a SAMPLE, and the sample has to hold two properties that
 * nothing else would catch: it spreads across the research, and it degrades
 * without collapsing on a site where half the checks cannot be observed.
 */
import { describe, expect, it } from "vitest";
import { sampleChecks, remainingChecks, SAMPLE_SIZE, AUDITABLE_TOTAL, codeFor } from "../functions/_lib/playbook";

const ctx = (o: Record<string, unknown> = {}) =>
  ({ hasPricing: true, pricingUnreadable: false, thin: false, hasTrial: true,
     hasFreemium: true, hasVideo: true, signals: {}, ...o }) as never;

describe("the sample", () => {
  it("takes three", () => {
    expect(sampleChecks(ctx())).toHaveLength(SAMPLE_SIZE);
  });

  it("never takes two from the same subsection", () => {
    // This is the property the whole design rests on. A flat list sorted by
    // weight would return three PRICING rules on any site with a pricing page,
    // because that is where the heavy rules cluster — and three pricing
    // findings read as a pricing tool rather than an audit.
    for (const c of [ctx(), ctx({ hasPricing: false }), ctx({ hasTrial: false, hasFreemium: false })]) {
      const subs = sampleChecks(c).map((r) => r.subsection);
      expect(new Set(subs).size).toBe(subs.length);
    }
  });

  it("still finds three when there is no pricing, trial or free tier", () => {
    // The commonest shape of early-stage site: a homepage and not much else.
    // If the sampler needed pricing it would return one check and the report
    // would have nothing to say.
    const thin = sampleChecks(ctx({ hasPricing: false, hasTrial: false, hasFreemium: false }));
    expect(thin).toHaveLength(SAMPLE_SIZE);
    for (const r of thin) expect(r.observable(ctx({ hasPricing: false, hasTrial: false, hasFreemium: false }))).toBe(true);
  });

  it("is stable for the same site", () => {
    // The cache keys on host. A sampler that varied per call would serve a
    // different trio than the one that was cached.
    const a = sampleChecks(ctx()).map((r) => codeFor(r.id));
    const b = sampleChecks(ctx()).map((r) => codeFor(r.id));
    expect(a).toEqual(b);
  });
});

describe("what is held back", () => {
  it("accounts for every auditable rule exactly once", () => {
    const ran = new Set(sampleChecks(ctx()).map((r) => r.id));
    const held = remainingChecks(ran);
    const total = held.reduce((n, h) => n + h.count, 0);
    expect(total).toBe(AUDITABLE_TOTAL - ran.size);
  });

  it("carries no verdict", () => {
    // These were never run. A verdict here would be invented, and a dash would
    // imply an answer is being withheld.
    const held = remainingChecks(new Set(sampleChecks(ctx()).map((r) => r.id)));
    for (const h of held) {
      expect(Object.keys(h).sort()).toEqual(["area", "count"]);
    }
  });
});
