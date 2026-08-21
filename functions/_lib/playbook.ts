/**
 * The rule set the audit scores against.
 *
 * Twenty-six recommendations from sections 1 and 2 of the Science Says SaaS
 * optimisation playbook — brand and messaging, page design, social proof, then
 * pricing plans, free trials and freemium.
 *
 * PROVENANCE. The playbook is a paid product watermarked to a single purchaser
 * on every page, so nothing here reproduces its text. What it does carry is the
 * peer-reviewed paper each recommendation rests on, which the playbook names in
 * full for every rule. Those citations are the provenance this tool publishes:
 * the `rule` strings below are our own restatement, and `citation` is the
 * underlying study, verbatim. If a rule ever needs rewording, reword the rule
 * and leave the citation alone — the paper is the thing that makes the score
 * worth reading, and "23 peer-reviewed studies" is a stronger claim than
 * naming somebody else's PDF.
 *
 * AUDITABILITY. Three of the twenty-six cannot be seen from outside the
 * product. Two are lifecycle behaviours that happen in-app or over email
 * (in-trial engagement, extensions instead of discounts) and one turns on the
 * pacing of a video rather than its presence. They are kept here, with
 * `auditable: false`, because deleting them would quietly rewrite the source;
 * the scorer skips them. That leaves 23.
 */

/** The six subsections, which are also the six findings the report ranks. */
export type SubsectionKey =
  | "messaging"
  | "design"
  | "proof"
  | "plans"
  | "trials"
  | "freemium";

export const SUBSECTIONS: { key: SubsectionKey; label: string; section: 1 | 2 }[] = [
  { key: "messaging", label: "Brand and messaging", section: 1 },
  { key: "design", label: "Page design and visuals", section: 1 },
  { key: "proof", label: "Social proof and reviews", section: 1 },
  { key: "plans", label: "Pricing plans", section: 2 },
  { key: "trials", label: "Free trials", section: 2 },
  { key: "freemium", label: "Freemium", section: 2 },
];

export const subsectionLabel = (key: SubsectionKey): string =>
  SUBSECTIONS.find((s) => s.key === key)?.label ?? key;

/**
 * What the crawl actually managed to see.
 *
 * This is the input to every observability predicate, and it is the reason the
 * denominator is dynamic. `readSite()` already reports `thin`; the other three
 * are cheap reads off the pricing page's text.
 */
export interface CrawlContext {
  /** Homepage rendered to almost nothing — usually a client-side app. */
  thin: boolean;
  /** A pricing or plans page was found and read. */
  hasPricing: boolean;
  /** The pricing page mentions a free trial. */
  hasTrial: boolean;
  /** The pricing page offers a free or freemium tier. */
  hasFreemium: boolean;
}

export interface Rule {
  id: string;
  subsection: SubsectionKey;
  /** What good looks like. Our restatement, not the playbook's wording. */
  rule: string;
  /** The peer-reviewed study behind it, verbatim from the playbook's own citation. */
  citation: string;
  /**
   * Relative importance, 1-3. Not from the source — the playbook ranks nothing
   * — so this is our judgement about impact on an early-stage startup, and it
   * is the one number here anybody should feel free to argue with. Rounded
   * corners and the top-three-benefits rule are not the same size of problem.
   */
  weight: 1 | 2 | 3;
  /** False for the three that cannot be seen from outside the product. */
  auditable: boolean;
  /**
   * Can this rule be scored, given what the crawl saw?
   *
   * Returning false drops the rule from the numerator AND the denominator. It
   * is never scored zero: a company with no public pricing page has not failed
   * the decoy-plan rule, it has simply not exposed the evidence, and scoring
   * that as failure hands a punitive number to exactly the visitor the funnel
   * exists to book.
   */
  observable: (ctx: CrawlContext) => boolean;
}

// Predicates, named so the rule table reads as a table rather than a wall of
// arrow functions. `onPage` covers everything judged from rendered marketing
// copy, which is unreadable when the homepage is a client-side shell.
const onPage = (ctx: CrawlContext) => !ctx.thin;
const onPricing = (ctx: CrawlContext) => ctx.hasPricing;
const onTrial = (ctx: CrawlContext) => ctx.hasPricing && ctx.hasTrial;
const onFreemium = (ctx: CrawlContext) => ctx.hasPricing && ctx.hasFreemium;
const never = () => false;

export const RULES: Rule[] = [
  // ── §1 Brand and messaging ────────────────────────────────────────────────
  {
    id: "productize",
    subsection: "messaging",
    rule: "Frame the software as an end-to-end product with a specific outcome and price, not a generic capability.",
    citation:
      "Wirtz, J., Fritze, M. P., Jaakkola, E., Gelbrich, K., & Hartley, N. Service products and productization. Journal of Business Research (September 2021).",
    weight: 3,
    auditable: true,
    observable: onPage,
  },
  {
    id: "top-three-benefits",
    subsection: "messaging",
    rule: "Lead with three key benefits. A fourth measurably weakens the set rather than adding to it.",
    citation:
      "Shu, S. B., & Carlson, K. A. When three charms but four alarms: Identifying the optimal number of claims in persuasion settings. Journal of Marketing (January 2014).",
    weight: 3,
    auditable: true,
    observable: onPage,
  },

  // ── §1 Page design and visuals ────────────────────────────────────────────
  {
    id: "perceptual-structure",
    subsection: "design",
    rule: "Commit the visual design to one register — effective and reliable, or fun and exciting — and hold it.",
    citation:
      "Affonso, F. M., & Janiszewski, C. Marketing by Design: The Influence of Perceptual Structure on Brand Performance. Journal of Marketing (November 2022).",
    weight: 2,
    auditable: true,
    observable: onPage,
  },
  {
    id: "layout-by-type",
    subsection: "design",
    rule: "Match the page layout to the kind of software being sold rather than to a generic template.",
    citation:
      "Bleier, A., Harmeling, C. M., & Palmatier, R. W. Creating Effective Online Customer Experiences. Journal of Marketing (December 2018).",
    weight: 2,
    auditable: true,
    observable: onPage,
  },
  {
    id: "rounded-cta",
    subsection: "design",
    rule: "Give call-to-action buttons rounded corners.",
    citation:
      "Biswas, D., Abell, A., & Chacko, R. Curvy Digital Marketing Designs: Virtual Elements with Rounded Shapes Enhance Online Click-Through Rates. Journal of Consumer Research (December 2023).",
    weight: 1,
    auditable: true,
    observable: onPage,
  },
  {
    id: "cta-upper-right",
    subsection: "design",
    rule: "Place a call-to-action button in the upper-right quadrant of the page.",
    citation:
      "Hernandez, A., & Resnick, M. L. Placement of Call to Action Buttons for Higher Website Conversion and Acquisition: An Eye Tracking Study. Proceedings Of The Human Factors And Ergonomics Society (September 2013).",
    weight: 2,
    auditable: true,
    observable: onPage,
  },
  {
    id: "before-left-after-right",
    subsection: "design",
    rule: "In any before/after comparison, put the before on the left and the after on the right.",
    citation:
      "Chae, B., & Hoegg, J. The Future Looks “Right”: Effects of the Horizontal Location of Advertising Images on Product Attribute. Journal of Consumer Research (January 2013).",
    weight: 1,
    auditable: true,
    observable: onPage,
  },
  {
    id: "video-for-hedonic",
    subsection: "design",
    rule: "Use video to demonstrate software meant to feel exciting or enjoyable to use.",
    citation:
      "Roggeveen, A. L., Grewal, D., Townsend, C., & Krishnan, R. The impact of dynamic presentation format on consumer preferences for hedonic products and services. Journal of Marketing (November 2015).",
    weight: 2,
    auditable: true,
    observable: onPage,
  },
  {
    id: "video-pacing",
    subsection: "design",
    // Not auditable: distinguishing a slow cut from a fast one means watching
    // the video, which the crawl does not do. Present so the source stays whole.
    rule: "Pace product video to the claim — slower footage reads as quality, faster footage reads as capability.",
    citation:
      "Yoon, S., Bang, H., Choi, D., & Kim, K. Slow versus fast: How speed-induced construal affects perceptions of advertising messages. International Journal of Advertising (May 2020).",
    weight: 1,
    auditable: false,
    observable: never,
  },

  // ── §1 Social proof and reviews ───────────────────────────────────────────
  {
    id: "show-numbers",
    subsection: "proof",
    rule: "Show real counts — users, views, or purchases — rather than unquantified claims of popularity.",
    citation:
      "Das, G., Spence, M. T., & Agarwal, J. Social Selling Cues: The Dynamics of Posting Numbers Viewed and Bought on Customers' Purchase Intentions. International Journal of Research in Marketing (January 2021).",
    weight: 2,
    auditable: true,
    observable: onPage,
  },
  {
    id: "imperfect-rating",
    subsection: "proof",
    rule: "Display a strong but imperfect average rating. A perfect score reads as fabricated and converts worse.",
    citation:
      "Maslowska, E., Malthouse, E. C., & Bernritter, S. F. Too good to be true: the role of online reviews’ features in probability to buy. International Journal of Advertising (June 2016).",
    weight: 2,
    auditable: true,
    observable: onPage,
  },
  {
    id: "first-review",
    subsection: "proof",
    rule: "Curate the first testimonial shown — it disproportionately shapes how every later one is read.",
    citation:
      "Park, S., Shin, W., & Xie, J. The fateful first consumer review. Marketing Science (February 2021).",
    weight: 2,
    auditable: true,
    observable: onPage,
  },

  // ── §2 The plans ──────────────────────────────────────────────────────────
  {
    id: "three-to-five-plans",
    subsection: "plans",
    rule: "Offer between three and five plans.",
    citation:
      "Simonson, I., & Tversky, A. Choice in Context: Tradeoff Contrast and Extremeness Aversion. Journal of Marketing Research (August 1992).",
    weight: 3,
    auditable: true,
    observable: onPricing,
  },
  {
    id: "decoy-plan",
    subsection: "plans",
    rule: "Make one middle plan a decoy that is clearly dominated, so the target plan looks obvious.",
    citation:
      "Cui, Y. G., Kim, S. S., & Kim, J. Impact of preciseness of price presentation on the magnitude of compromise and decoy effects. Journal of Business Research (August 2021).",
    weight: 3,
    auditable: true,
    observable: onPricing,
  },
  {
    id: "price-on-left",
    subsection: "plans",
    rule: "Order plans left to right and place the price on the left of each card.",
    citation:
      "Cai, F., Shen, H., & Hui, M. K. The Effect of Location on Price Estimation: Understanding Number-Location and Number-Order Associations. Journal of Marketing Research (October 2012).",
    weight: 1,
    auditable: true,
    observable: onPricing,
  },
  {
    id: "price-difference-framing",
    subsection: "plans",
    rule: "Frame premium tiers by the difference (“$15 more”) rather than by the full price.",
    citation:
      "Allard, T., Hardisty, D.J. & Griffin, D. When “More” Seems Like Less: Differential Price Framing Increases the Choice Share of Higher-Priced Options. Journal of Marketing Research (July 2019).",
    weight: 2,
    auditable: true,
    observable: onPricing,
  },
  {
    id: "simpler-than-competitors",
    subsection: "plans",
    rule: "Keep the pricing structure simpler than competitors'. Complexity is read as unfairness.",
    citation:
      "Homburg, C., Totzek, D., & Krämer, M. How price complexity takes its toll: The neglected role of a simplicity bias and fairness in price evaluations. Journal of Business Research (June 2013).",
    weight: 3,
    auditable: true,
    observable: onPricing,
  },
  {
    id: "divisible-prices",
    subsection: "plans",
    rule: "Choose prices that are easy to divide and multiply, so buyers can do the per-seat maths in their head.",
    citation:
      "King, D., & Janiszewski, C. The Sources and Consequences of the Fluent Processing of Numbers. Journal of Marketing Research (April 2011).",
    weight: 1,
    auditable: true,
    observable: onPricing,
  },
  {
    id: "metered-hybrid",
    subsection: "plans",
    rule: "Combine a flat fee with usage-based pricing only where usage analytics are good enough to justify it.",
    citation:
      "Schlereth, C., Skiera, B., & Wolk, A. Measuring Consumers’ Preferences for Metered Pricing of Services. Journal of Service Research (December 2011).",
    weight: 1,
    auditable: true,
    observable: onPricing,
  },
  {
    id: "flat-rate-bias",
    subsection: "plans",
    rule: "A straightforward flat rate is a strong default — buyers pay a premium for predictability.",
    citation:
      "Kienzler, M., Kowalkowski, C., & Kindström, D. Purchasing professionals and the flat-rate bias: Effects of price premiums, past usage, and relational ties on price plan choice. Journal of Business Research (April 2021).",
    weight: 2,
    auditable: true,
    observable: onPricing,
  },

  // ── §2 Free trials ────────────────────────────────────────────────────────
  {
    id: "high-quality-trial",
    subsection: "trials",
    rule: "Make the free trial genuinely good. A thin trial suppresses adoption rather than seeding it.",
    citation:
      "Li, H., Jain, S., & Kannan, P. K. Optimal design of free samples for digital products and services. Journal of Marketing Research (April 2019).",
    weight: 3,
    auditable: true,
    observable: onTrial,
  },
  {
    id: "seven-day-trial",
    subsection: "trials",
    rule: "Seven days is the optimal trial length for most products.",
    citation:
      "Yoganarasimhan, H., Barzegary, E., & Pani, A. Design and evaluation of optimal free trials. Management Science (August 2022).",
    weight: 2,
    auditable: true,
    observable: onTrial,
  },
  {
    id: "trial-usage",
    subsection: "trials",
    // Not auditable: what a company does to drive usage inside a trial happens
    // in-product and over email, where a crawler cannot follow.
    rule: "Drive high product usage during the trial window.",
    citation:
      "Foubert, B., & Gijsbrechts, E. Try It, You’ll Like It—Or Will You? The Perils of Early Free-Trial Promotions for High-Tech Service Adoption. Marketing Science (May 2016).",
    weight: 2,
    auditable: false,
    observable: never,
  },
  {
    id: "extensions-not-discounts",
    subsection: "trials",
    // Not auditable: a retention offer is made privately at the end of a trial.
    rule: "Offer trial extensions rather than discounts. A discount reprices the product; time does not.",
    citation:
      "Palmeira, M. M., & Srivastava, J. Free Offer ≠ Cheap Product: A Selective Accessibility Account on the Valuation of Free Offers. Journal of Consumer Research (December 2013).",
    weight: 2,
    auditable: false,
    observable: never,
  },

  // ── §2 Freemium ───────────────────────────────────────────────────────────
  {
    id: "limit-usage-not-features",
    subsection: "freemium",
    rule: "Limit the free tier by usage, not by removing features.",
    citation:
      "Aral, S., & Dhillon, P. S. Digital Paywall Design: Implications for Content Demand & Subscriptions. Management Science (August 2020).",
    weight: 3,
    auditable: true,
    observable: onFreemium,
  },
  {
    id: "freemium-decoy",
    subsection: "freemium",
    rule: "Add a decoy tier above the free plan to give free users a reason to move.",
    citation:
      "Gu, X., Kannan, P. K., & Ma, L. Selling the premium in freemium. Journal of Marketing (October 2018).",
    weight: 2,
    auditable: true,
    observable: onFreemium,
  },
];

/** The 23 that can be judged from a crawl at all, before context narrows them further. */
export const AUDITABLE_RULES = RULES.filter((r) => r.auditable);

export const rulesFor = (key: SubsectionKey): Rule[] =>
  AUDITABLE_RULES.filter((r) => r.subsection === key);

/** Rules that can be scored for THIS site, given what the crawl actually saw. */
export const observableRules = (key: SubsectionKey, ctx: CrawlContext): Rule[] =>
  rulesFor(key).filter((r) => r.observable(ctx));

/** Each rule is judged 0-5 by the model. */
export const MAX_PER_RULE = 5;

export interface RuleScore {
  id: string;
  /** 0-5. */
  score: number;
}

export interface SubsectionResult {
  key: SubsectionKey;
  label: string;
  /** Null when nothing in this subsection was observable. */
  earned: number | null;
  possible: number;
  /** Why it could not be scored. Rendered instead of a number. */
  reason?: string;
  /** 0-1, for ranking. Unobservable subsections sort last, not worst. */
  ratio: number | null;
}

/**
 * Why a subsection could not be scored, in the visitor's terms.
 *
 * Phrased as a fact about the crawl rather than a verdict on the company. "No
 * public pricing page" is information; "failed pricing" would be a lie about a
 * company that simply sells through sales.
 */
function missingReason(key: SubsectionKey, ctx: CrawlContext): string {
  if (ctx.thin) return "The page renders client-side, so there was nothing to read.";
  if (!ctx.hasPricing) return "No public pricing page to read.";
  if (key === "trials") return "No free trial offered.";
  if (key === "freemium") return "No free tier offered.";
  return "Not enough on the page to judge.";
}

/** Score one subsection against only the rules that were observable. */
export function scoreSubsection(
  key: SubsectionKey,
  ctx: CrawlContext,
  scores: Map<string, number>,
): SubsectionResult {
  const rules = observableRules(key, ctx);
  const label = subsectionLabel(key);

  if (rules.length === 0) {
    return { key, label, earned: null, possible: 0, ratio: null, reason: missingReason(key, ctx) };
  }

  let earned = 0;
  let possible = 0;
  for (const r of rules) {
    const raw = scores.get(r.id);
    // A rule the model declined to score is dropped rather than counted zero —
    // same principle as an unobservable rule, one level down.
    if (typeof raw !== "number") continue;
    earned += Math.max(0, Math.min(MAX_PER_RULE, raw)) * r.weight;
    possible += MAX_PER_RULE * r.weight;
  }

  if (possible === 0) {
    return { key, label, earned: null, possible: 0, ratio: null, reason: missingReason(key, ctx) };
  }
  return { key, label, earned, possible, ratio: earned / possible };
}

export interface AuditTotals {
  /** 0-100, out of what was observable. */
  score: number;
  subsections: SubsectionResult[];
  /** Worst three scorable subsections, in order. These are shown. */
  open: SubsectionResult[];
  /** The rest, by name only. These are redacted. */
  locked: SubsectionResult[];
}

/**
 * Roll the six subsections into a headline score and split them into shown and
 * withheld.
 *
 * Unobservable subsections sort LAST rather than worst. Ranking them as
 * failures would fill all three open slots with "we could not read this",
 * which is the least useful report we could hand somebody.
 */
export function totals(results: SubsectionResult[]): AuditTotals {
  const earned = results.reduce((n, r) => n + (r.earned ?? 0), 0);
  const possible = results.reduce((n, r) => n + r.possible, 0);
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  const ranked = [...results].sort((a, b) => {
    if (a.ratio === null && b.ratio === null) return 0;
    if (a.ratio === null) return 1;
    if (b.ratio === null) return -1;
    return a.ratio - b.ratio;
  });

  return { score, subsections: results, open: ranked.slice(0, 3), locked: ranked.slice(3) };
}

/**
 * The rules, serialised for the scoring prompt.
 *
 * Only observable rules go in. A model shown a rule it cannot check will find a
 * way to check it, and the answer will be invented.
 */
export function rulesPrompt(key: SubsectionKey, ctx: CrawlContext): string {
  return observableRules(key, ctx)
    .map((r) => `- ${r.id}: ${r.rule}`)
    .join("\n");
}
