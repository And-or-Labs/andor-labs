/**
 * The scoring maths behind the audit.
 *
 * The dynamic denominator is the part worth guarding. Scoring an unobservable
 * rule as zero is not a rounding error — it hands a punitive number to a
 * company that simply sells through sales rather than a pricing page, which is
 * exactly the visitor the funnel exists to book. Every test below that touches
 * `possible` is really testing that.
 */
import { describe, expect, it } from "vitest";
import {
  RULES,
  AUDITABLE_RULES,
  SUBSECTIONS,
  MAX_PER_RULE,
  observableRules,
  rulesFor,
  rulesPrompt,
  scoreSubsection,
  totals,
  gradeFor,
  rawGrade,
  GRADE_CAPS,
  type CrawlContext,
  type SubsectionKey,
} from "../functions/_lib/playbook";

const FULL: CrawlContext = { thin: false, hasPricing: true, hasPlanTable: true, hasTrial: true, hasFreemium: true };
const NO_PRICING: CrawlContext = { thin: false, hasPricing: false, hasPlanTable: false, hasTrial: false, hasFreemium: false };
const THIN: CrawlContext = { thin: true, hasPricing: false, hasPlanTable: false, hasTrial: false, hasFreemium: false };

/** Score every observable rule in a subsection at the same value. */
const flat = (key: SubsectionKey, ctx: CrawlContext, v: number) =>
  new Map(observableRules(key, ctx).map((r) => [r.id, v]));

const allSix = (ctx: CrawlContext, v: number) =>
  SUBSECTIONS.map((s) => scoreSubsection(s.key, ctx, flat(s.key, ctx, v)));

describe("the rule set", () => {
  it("carries all 26 source recommendations, 23 of them auditable", () => {
    expect(RULES).toHaveLength(26);
    expect(AUDITABLE_RULES).toHaveLength(23);
  });

  it("gives every rule a real peer-reviewed citation", () => {
    for (const r of RULES) {
      // A journal name and a year is the shape of every citation in the source.
      expect(r.citation, r.id).toMatch(/\((January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\)\.$/);
      expect(r.citation.length, r.id).toBeGreaterThan(60);
    }
  });

  it("uses no two ids twice", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  it("places every rule in one of the six subsections", () => {
    const keys = new Set(SUBSECTIONS.map((s) => s.key));
    for (const r of RULES) expect(keys.has(r.subsection), r.id).toBe(true);
  });

  it("leaves no subsection empty, so the report always has six findings to rank", () => {
    for (const s of SUBSECTIONS) expect(rulesFor(s.key).length, s.key).toBeGreaterThan(0);
  });
});

describe("observability", () => {
  it("scores every auditable rule when the crawl saw everything", () => {
    const seen = SUBSECTIONS.flatMap((s) => observableRules(s.key, FULL));
    expect(seen).toHaveLength(23);
  });

  it("drops the pricing-dependent rules when there is no pricing page", () => {
    for (const key of ["plans", "trials", "freemium"] as SubsectionKey[]) {
      expect(observableRules(key, NO_PRICING), key).toHaveLength(0);
    }
    // §1 is unaffected — the homepage was still readable.
    expect(observableRules("messaging", NO_PRICING).length).toBeGreaterThan(0);
  });

  it("drops trial rules when pricing exists but no trial does", () => {
    const ctx = { ...FULL, hasTrial: false };
    expect(observableRules("trials", ctx)).toHaveLength(0);
    expect(observableRules("plans", ctx).length).toBeGreaterThan(0);
  });

  it("drops freemium rules when pricing exists but no free tier does", () => {
    const ctx = { ...FULL, hasFreemium: false };
    expect(observableRules("freemium", ctx)).toHaveLength(0);
  });

  it("observes nothing at all on a client-rendered shell", () => {
    const seen = SUBSECTIONS.flatMap((s) => observableRules(s.key, THIN));
    expect(seen).toHaveLength(0);
  });
});

describe("the dynamic denominator", () => {
  it("shrinks the denominator rather than scoring the unobservable as zero", () => {
    // The denominator still shrinks — an unseen rule is not a failed rule, and
    // the internal ratio stays clean so subsection ranking means something.
    // What stops a pricing-less site being called flawless is the CEILING, not
    // arithmetic. Two separate mechanisms, deliberately.
    const without = totals(allSix(NO_PRICING, MAX_PER_RULE), NO_PRICING);

    expect(without.score).toBe(100);
    expect(without.subsections.find((s) => s.key === "plans")?.possible).toBe(0);
  });

  it("still refuses to call that site an A — the ceiling does what the maths must not", () => {
    const withPricing = totals(allSix(FULL, MAX_PER_RULE), FULL);
    const without = totals(allSix(NO_PRICING, MAX_PER_RULE), NO_PRICING);

    expect(withPricing.verdict.grade).toBe("A");
    expect(without.verdict.grade).toBe("C");
    expect(without.verdict.caps).not.toHaveLength(0);
  });

  it("prices the gap as a ceiling, not as 54 points of punishment", () => {
    // The rejected alternative: count every unobservable rule as a zero. That
    // takes a flawless-but-pricing-less site to 46/100 — a number nobody can
    // interpret, and a punishment for behaving normally. The ceiling says one
    // legible thing instead.
    const results = allSix(NO_PRICING, MAX_PER_RULE);
    const naiveEarned = results.reduce((n, r) => n + (r.earned ?? 0), 0);
    const naivePossible = AUDITABLE_RULES.reduce((n, r) => n + MAX_PER_RULE * r.weight, 0);
    const naive = Math.round((naiveEarned / naivePossible) * 100);

    expect(naive).toBeLessThan(60);
    expect(totals(results, NO_PRICING).verdict.grade).toBe("C");
  });

  it("reports a reason rather than a number for an unscorable subsection", () => {
    const plans = scoreSubsection("plans", NO_PRICING, new Map());
    expect(plans.earned).toBeNull();
    expect(plans.ratio).toBeNull();
    expect(plans.reason).toBe("No public pricing page to read.");
  });

  it("says pricing was unreadable rather than absent, when that is the truth", () => {
    // A slider or a client-side table is a different fact about a company than
    // having no public pricing, and the report should not confuse the two.
    const unreadable = { ...NO_PRICING, pricingUnreadable: true };
    expect(scoreSubsection("plans", unreadable, new Map()).reason)
      .toBe("Your pricing is there but renders client-side, so it could not be read.");
    expect(scoreSubsection("plans", NO_PRICING, new Map()).reason)
      .toBe("No public pricing page to read.");
  });

  it("distinguishes no-trial from no-pricing in the reason it gives", () => {
    expect(scoreSubsection("trials", { ...FULL, hasTrial: false }, new Map()).reason)
      .toBe("No free trial offered.");
    expect(scoreSubsection("freemium", { ...FULL, hasFreemium: false }, new Map()).reason)
      .toBe("No free tier offered.");
    expect(scoreSubsection("messaging", THIN, new Map()).reason)
      .toBe("The page renders client-side, so there was nothing to read.");
  });

  it("drops a rule the model declined to score rather than counting it zero", () => {
    const rules = observableRules("plans", FULL);
    const partial = new Map([[rules[0].id, MAX_PER_RULE]]);
    const res = scoreSubsection("plans", FULL, partial);
    expect(res.possible).toBe(MAX_PER_RULE * rules[0].weight);
    expect(res.ratio).toBe(1);
  });

  it("weights heavier rules more", () => {
    const heavy = RULES.find((r) => r.id === "three-to-five-plans")!;
    const light = RULES.find((r) => r.id === "price-on-left")!;
    expect(heavy.weight).toBeGreaterThan(light.weight);

    const onlyHeavy = scoreSubsection("plans", FULL, new Map([[heavy.id, MAX_PER_RULE]]));
    const onlyLight = scoreSubsection("plans", FULL, new Map([[light.id, MAX_PER_RULE]]));
    expect(onlyHeavy.possible).toBeGreaterThan(onlyLight.possible);
  });
});

describe("the gate", () => {
  it("always opens exactly three and locks exactly three", () => {
    const t = totals(allSix(FULL, 3), FULL);
    expect(t.open).toHaveLength(3);
    expect(t.locked).toHaveLength(3);
    expect(t.open.length + t.locked.length).toBe(SUBSECTIONS.length);
  });

  it("ranks the subsections that failed most", () => {
    const ctx = FULL;
    // messaging and proof fail everything; the rest pass everything.
    const results = SUBSECTIONS.map((s) =>
      scoreSubsection(
        s.key,
        ctx,
        flat(s.key, ctx, s.key === "messaging" || s.key === "proof" ? 0 : MAX_PER_RULE),
      ),
    );
    const t = totals(results, ctx);
    expect(t.open.map((r) => r.key)).toEqual(expect.arrayContaining(["messaging", "proof"]));
  });

  it("sorts unscorable subsections last, not worst", () => {
    // No pricing page: three subsections are unscorable. They must NOT fill the
    // open slots — a report of three "could not read this" is worthless.
    const t = totals(allSix(NO_PRICING, 1), NO_PRICING);
    expect(t.open.every((r) => r.ratio !== null)).toBe(true);
    expect(t.locked.every((r) => r.ratio === null)).toBe(true);
  });

  it("never puts a finding body in the locked half — the gate is names only", () => {
    const t = totals(allSix(FULL, 2), FULL);
    // What ships for a locked item is its label. Anything carrying the score or
    // the reason would defeat the redaction bars it renders as.
    const serialised = JSON.stringify(t.locked.map((r) => r.label));
    for (const r of t.locked) {
      expect(serialised).toContain(r.label);
      expect(serialised).not.toContain(String(r.earned));
    }
  });
});

describe("the grade", () => {
  it("spans the whole range instead of collapsing to one letter", () => {
    const grades = [0, 0.2, 0.45, 0.6, 0.75, 0.9, 1].map(rawGrade);
    expect(new Set(grades).size).toBeGreaterThan(3);
  });

  it("does not hand a broken site the top grade", () => {
    // The bug this guards: functions/_lib/bands.ts is calibrated out of 30, so
    // bandFor(anything >= 24) returns its top band — which is every percentage
    // above 24, including a site that scored 25/100.
    expect(rawGrade(0.25)).not.toBe(rawGrade(0.95));
    expect(rawGrade(0)).toBe("E");
    expect(rawGrade(1)).toBe("A");
  });
});

describe("grade ceilings", () => {
  it("refuses an A to a site with no public pricing page", () => {
    // The point of the ceiling. A flawless §1 must not buy a top grade while
    // the single most important commercial page is missing.
    const v = gradeFor(1, NO_PRICING);
    expect(v.uncapped).toBe("A");
    expect(v.grade).toBe("C");
    expect(v.caps).toContain("No public pricing page we could read — capped at C until there is one.");
  });

  it("leaves a site with pricing ungoverned by that ceiling", () => {
    const v = gradeFor(1, FULL);
    expect(v.grade).toBe("A");
    expect(v.caps).toHaveLength(0);
  });

  it("never RAISES a grade — a ceiling can only lower one", () => {
    // A site already at E must not be lifted to C by tripping the pricing cap.
    const v = gradeFor(0, NO_PRICING);
    expect(v.grade).toBe("E");
  });

  it("stays quiet about a ceiling that changed nothing", () => {
    // The E site above trips the no-pricing condition, but telling somebody at
    // E that they are "capped at C" is nonsense and makes the scorer look broken.
    expect(gradeFor(0, NO_PRICING).caps).toHaveLength(0);
  });

  it("applies the strictest ceiling when several bite at once", () => {
    // Unreadable AND no pricing: C and D both apply, D is stricter.
    const v = gradeFor(1, THIN);
    expect(v.grade).toBe("D");
    expect(v.caps).toHaveLength(2);
  });

  it("explains every ceiling it applies, so a cap is never mysterious", () => {
    for (const cap of GRADE_CAPS) {
      expect(cap.reason.length, cap.id).toBeGreaterThan(20);
    }
    const v = gradeFor(1, NO_PRICING);
    expect(v.caps.length).toBe(v.caps.filter((c) => c.length > 20).length);
  });

  it("keeps ceilings off individual findings — a cap is about the whole site", () => {
    // Marking the messaging finding down for a missing pricing page would be
    // incoherent; the ceiling belongs to the headline only.
    const messaging = scoreSubsection("messaging", NO_PRICING, flat("messaging", NO_PRICING, MAX_PER_RULE));
    expect(messaging.grade).toBe("A");
  });
});

describe("the scoring prompt", () => {
  it("lists only rules the model can actually check", () => {
    const prompt = rulesPrompt("plans", NO_PRICING);
    expect(prompt).toBe("");
  });

  it("names each rule by the id the scorer must return", () => {
    const prompt = rulesPrompt("freemium", FULL);
    for (const r of observableRules("freemium", FULL)) {
      expect(prompt).toContain(`### ${r.id}`);
    }
  });

  it("ships PASS and FAIL definitions for every check it asks about", () => {
    // Criteria are why a mid-tier model is enough here: applying a stated test
    // to a page is a far smaller job than forming an opinion about it, and it
    // is the difference between a repeatable answer and a different one each run.
    for (const s of SUBSECTIONS) {
      const prompt = rulesPrompt(s.key, FULL);
      for (const r of observableRules(s.key, FULL)) {
        expect(prompt, `${r.id} has no PASS`).toContain(`PASS: ${r.pass}`);
        expect(prompt, `${r.id} has no FAIL`).toContain(`FAIL: ${r.fail}`);
        expect(r.pass.length, `${r.id} PASS too vague`).toBeGreaterThan(25);
        expect(r.fail.length, `${r.id} FAIL too vague`).toBeGreaterThan(25);
      }
    }
  });

  it("leaves the unauditable rules without criteria, since they never run", () => {
    for (const r of RULES.filter((x) => !x.auditable)) {
      expect(r.pass).toBe("");
      expect(r.fail).toBe("");
    }
  });

  it("never leaks an unauditable rule into the prompt", () => {
    for (const s of SUBSECTIONS) {
      const prompt = rulesPrompt(s.key, FULL);
      for (const r of RULES.filter((x) => !x.auditable)) {
        expect(prompt, `${s.key} leaked ${r.id}`).not.toContain(r.id);
      }
    }
  });
});
