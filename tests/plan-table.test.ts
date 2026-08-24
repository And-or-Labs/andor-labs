/**
 * "Does this company publish prices" and "can we count the plans" are two
 * different questions, and the audit was asking the first to decide the second.
 *
 * `hasPricing` is satisfied by the phrase "free forever" appearing anywhere on
 * the crawl. Every rule in the `plans` subsection is a variation on "how many
 * plans are there and what do they cost", and gating them on that meant
 * sampling questions the crawl could not evidence: measured over ten live runs,
 * `three-to-five-plans` declined in 100% of the runs it was sampled in. One of
 * six slots, burned every time, on a page that promises three quick wins.
 */
import { describe, expect, it } from "vitest";
import { planTableIn } from "../functions/_lib/pages";

describe("whether the plans can be counted", () => {
  it("counts two distinct amounts as a table", () => {
    expect(planTableIn("Starter $12/mo · Growth $49/mo · Business $99/mo")).toBe(true);
  });

  it("counts one amount beside a free tier", () => {
    // The commonest two-tier shape, and it has only one number in it.
    expect(planTableIn("Free forever for hobby projects. Pro is $20 per month.")).toBe(true);
  });

  it("rejects the same price quoted twice", () => {
    // A comparison column repeats the figure down every row. One plan, written
    // out more than once, is still one plan.
    expect(planTableIn("$29 per month. Billed annually at $29 per month.")).toBe(false);
  });

  it("rejects the exact string that caused this", () => {
    // PRICE_EVIDENCE matches this and calls it pricing. It is a claim about
    // billing, and there is nothing here to count.
    expect(planTableIn("Free forever. No credit card required. Pricing that scales with you.")).toBe(false);
  });

  it("rejects a pricing page that rendered to nothing", () => {
    // A slider or a client-side table. Distinct from having no pricing at all,
    // and the report already says which.
    expect(planTableIn("## Pricing\n\nChoose the plan that fits your team.")).toBe(false);
  });

  it("reads € and £ as well as $", () => {
    expect(planTableIn("Basis €9 · Standaard €29")).toBe(true);
    expect(planTableIn("Solo £15 a month, Team £45 a month")).toBe(true);
  });
});
