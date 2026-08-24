/**
 * The free audit runs a SAMPLE, and the sample has to hold two properties that
 * nothing else would catch: it spreads across the research, and it degrades
 * without collapsing on a site where half the checks cannot be observed.
 */
import { describe, expect, it } from "vitest";
import { sampleChecks, remainingChecks, wins, WAVE_SIZE, WINS, AUDITABLE_TOTAL, codeFor } from "../functions/_lib/playbook";

/** Every rule the sampler could have drawn for this site, across subsections. */
const observableRules2 = (c: never) => sampleChecks(c, Number.MAX_SAFE_INTEGER);

const ctx = (o: Record<string, unknown> = {}) =>
  ({ hasPricing: true, pricingUnreadable: false, thin: false, hasTrial: true,
     hasFreemium: true, hasVideo: true, signals: {}, ...o }) as never;

describe("the sample", () => {
  it("takes a full wave", () => {
    expect(sampleChecks(ctx())).toHaveLength(WAVE_SIZE);
  });

  it("spreads across the research rather than draining one subsection", () => {
    // The property the whole design rests on. Eight of the twenty-three rules
    // are pricing rules, so any order that is not round-robin returns a pricing
    // tool.
    //
    // The rule is ROUND-ROBIN FAIRNESS, not a fixed cap: a subsection only gets
    // an extra check once every other subsection with checks left has had one.
    // So two subsections may differ by more than one ONLY when the smaller was
    // exhausted — which is the honest statement of what the sampler does, and
    // survives a change of WAVE_SIZE. A flat "no more than two" happened to be
    // equivalent at a wave of six and stopped being true at nine.
    //
    // The floor is three distinct subsections, not six, and that is a fact
    // about the rule set rather than a weak test — a site with no readable
    // pricing loses the plans, trials AND freemium rules at once, which leaves
    // messaging, proof and design as the only places to draw from.
    for (const c of [ctx(), ctx({ hasPlanTable: false }), ctx({ hasTrial: false, hasFreemium: false })]) {
      const picked = sampleChecks(c);
      const subs = picked.map((r) => r.subsection);
      expect(new Set(subs).size).toBeGreaterThanOrEqual(3);

      // How many that subsection could have supplied at all, so "exhausted" is
      // measurable rather than assumed.
      const available = new Map<string, number>();
      for (const r of observableRules2(c)) available.set(r.subsection, (available.get(r.subsection) ?? 0) + 1);

      const took = new Map<string, number>();
      for (const s of subs) took.set(s, (took.get(s) ?? 0) + 1);

      for (const [a, na] of took) {
        for (const [b, nb] of took) {
          if (na - nb <= 1) continue;
          // b has fewer — that is only allowed if b had nothing left to give.
          expect(nb, `${a} took ${na} while ${b} took ${nb} with more available`).toBe(available.get(b));
        }
      }
    }
  });

  it("still fills the wave when there is no pricing, trial or free tier", () => {
    // The commonest shape of early-stage site: a homepage and not much else.
    // If the sampler needed pricing it would return one check and the report
    // would have nothing to say.
    const thin = sampleChecks(ctx({ hasPricing: false, hasTrial: false, hasFreemium: false }));
    expect(thin).toHaveLength(WAVE_SIZE);
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

describe("the wins", () => {
  const check = (id: string, verdict: "pass" | "fail", weight: number) =>
    ({ id, verdict, weight }) as never;

  it("takes the heaviest failures, worst first", () => {
    const got = wins([check("a", "fail", 1), check("b", "fail", 3), check("c", "fail", 2)]);
    expect(got.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("never pads with passes", () => {
    // A site that fails one check gets ONE win. Promoting something it passed
    // to fill the third slot would be inventing a problem, which is the one
    // thing a page selling an evidence-based audit cannot do.
    const got = wins([check("a", "fail", 3), check("b", "pass", 3), check("c", "pass", 2)]);
    expect(got.map((c) => c.id)).toEqual(["a"]);
  });

  it("shows at most three even when everything fails", () => {
    const all = ["a", "b", "c", "d", "e"].map((id, i) => check(id, "fail", ((i % 3) + 1) as never));
    expect(wins(all)).toHaveLength(WINS);
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
      // area + short (the name for a heading and the name for a sentence) and a
      // count. Notably NOT a verdict.
      expect(Object.keys(h).sort()).toEqual(["area", "count", "short"]);
    }
  });
});
