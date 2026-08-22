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
 * The prefix a masked check is identified by.
 *
 * A withheld row shows ONLY its code — BRAND-1, PRICING-3 — never its name.
 * That is a deliberately stronger gate than the names were: a name is most of
 * the finding ("no decoy plan" tells you the problem), while a code tells you
 * only that a check exists, where it sits, and that it has not been answered
 * for you yet. It also reads as an index rather than a teaser.
 */
const CODE_PREFIX: Record<SubsectionKey, string> = {
  messaging: "BRAND",
  design: "DESIGN",
  proof: "PROOF",
  plans: "PRICING",
  trials: "TRIAL",
  freemium: "FREEMIUM",
};

/**
 * Stable code per rule, numbered within its subsection in SOURCE order.
 *
 * Computed once from RULES rather than stored on each rule, so the numbering
 * cannot drift out of step with the table it describes — add a rule in the
 * middle and everything after it renumbers, which is correct, because the code
 * names a position in the published sequence.
 */
let CODES: Record<string, string> | null = null;
function codes(): Record<string, string> {
  // Built on first use, not at module load: RULES is declared below this point
  // and an eager table would read it inside its temporal dead zone.
  if (CODES) return CODES;
  const seen: Partial<Record<SubsectionKey, number>> = {};
  const out: Record<string, string> = {};
  for (const r of RULES) {
    const n = (seen[r.subsection] = (seen[r.subsection] ?? 0) + 1);
    out[r.id] = `${CODE_PREFIX[r.subsection]}-${n}`;
  }
  return (CODES = out);
}

export const codeFor = (id: string): string => codes()[id] ?? id;

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
  /** Pricing was located but would not render to text — a widget or slider. */
  pricingUnreadable?: boolean;
  /** The pricing page mentions a free trial. */
  hasTrial: boolean;
  /** The pricing page offers a free or freemium tier. */
  hasFreemium: boolean;
}

export interface Rule {
  id: string;
  /**
   * Short display name. Every check is shown by name in the report — the whole
   * claim is "23 peer-reviewed checks", and a claim like that is only worth
   * anything if each one is named, evidenced and sourced individually.
   * Written out rather than derived from the id: display names should not be
   * de-slugified machine strings.
   */
  label: string;
  subsection: SubsectionKey;
  /** What good looks like. Our restatement, not the playbook's wording. */
  rule: string;
  /**
   * The test, stated so it can only be answered one way.
   *
   * Every check ships PASS and FAIL definitions into the prompt. Without them
   * the model was being asked for an opinion and returned one — hedged,
   * balanced, and different on every run. With them it is being asked to apply
   * a test to a page, which is a much smaller and much more repeatable job, and
   * it is the reason a mid-tier model is entirely capable here: the quality
   * comes from the criteria and the context, not from the size of the model.
   *
   * Empty for the three unauditable rules, which never reach a prompt.
   */
  pass: string;
  fail: string;
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
    pass: "The page names a specific outcome and a defined scope — what it does, for whom, ideally with a price.",
    fail: "The page sells a generic capability or category with no bounded outcome, e.g. 'analytics platform'.",
    label: "Productised offer",
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
    pass: "Exactly three headline benefits lead the page.",
    fail: "Four or more competing benefit claims lead the page, or fewer than three.",
    label: "Three key benefits",
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
    pass: "Type, colour and imagery hold ONE register throughout — either capable/reliable or fun/exciting.",
    fail: "The page mixes registers, e.g. playful illustration against enterprise proof copy.",
    label: "One visual register",
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
    pass: "Layout suits what is sold: a visual product shows itself, a technical one leads with specifics.",
    fail: "A generic template that would fit any SaaS with the words swapped.",
    label: "Layout matches the product",
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
    pass: "Primary CTA buttons have rounded corners.",
    fail: "Primary CTA buttons are square-cornered.",
    label: "Rounded CTA buttons",
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
    pass: "A CTA button sits in the upper-right quadrant, typically in the nav.",
    fail: "The upper right holds no CTA — only links, a search box, or nothing.",
    label: "CTA in the upper right",
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
    pass: "Any before/after or old-way/new-way comparison puts before on the LEFT.",
    fail: "A comparison runs the other way, or the page shows none (score 3, not a failure).",
    label: "Before left, after right",
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
    pass: "Product video or motion is present where the product is meant to feel enjoyable.",
    fail: "No video or motion on a product whose appeal is experiential.",
    label: "Video for enjoyable software",
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
    pass: "",
    fail: "",
    label: "Video pacing",
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
    pass: "A real count is shown — users, customers, sites, events, revenue processed.",
    fail: "Popularity is claimed without a number: 'trusted by teams everywhere'.",
    label: "Real counts shown",
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
    pass: "An average rating is shown and is strong but not perfect, e.g. 4.6–4.9.",
    fail: "No rating shown at all, OR a flat 5.0, which reads as fabricated.",
    label: "Strong but imperfect rating",
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
    pass: "The first testimonial names a person and role and makes a specific claim.",
    fail: "The first testimonial is generic, anonymous, or a logo wall with no words.",
    label: "The first testimonial",
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
    pass: "The pricing page shows between three and five plans inclusive.",
    fail: "Fewer than three or more than five plans, counting a free tier.",
    label: "Three to five plans",
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
    pass: "One middle plan is clearly dominated, making the target plan the obvious pick.",
    fail: "Every plan is a reasonable choice on price-to-value, so nothing anchors.",
    label: "A decoy plan",
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
    pass: "Plans read left to right and each price sits at the left or top-left of its card.",
    fail: "Prices sit right-aligned or below the feature list.",
    label: "Price on the left",
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
    pass: "Upgrades are framed by the difference, e.g. 'just $15 more'.",
    fail: "Every tier states only its full price with no comparison.",
    label: "Priced by the difference",
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
    pass: "Pricing is one clear axis — per seat, or per usage — legible in one read.",
    fail: "Multiple stacked axes, add-ons and credits requiring a calculator.",
    label: "Simpler than competitors",
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
    pass: "Prices divide and multiply easily: 10, 12, 20, 25, 50, 100.",
    fail: "Awkward numbers such as 17, 23, 37, 47 that resist mental arithmetic.",
    label: "Prices that divide",
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
    pass: "Flat fee plus usage IS offered, and usage is visibly metered for the buyer.",
    fail: "Usage-based pricing with no visible meter, so the buyer cannot predict a bill.",
    label: "Flat plus usage",
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
    pass: "At least one straightforward flat-rate plan exists.",
    fail: "Every plan is usage-metered with no predictable option.",
    label: "Flat-rate default",
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
    pass: "The trial is full-featured, or the limits are stated plainly.",
    fail: "The trial is crippled or its limits are unstated.",
    label: "Trial quality",
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
    pass: "The trial is about seven days.",
    fail: "Materially longer (14, 30) or shorter, without a stated reason.",
    label: "Seven-day trial",
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
    pass: "",
    fail: "",
    label: "Usage during the trial",
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
    pass: "",
    fail: "",
    label: "Extensions, not discounts",
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
    pass: "The free tier limits VOLUME — rows, events, seats — and keeps the features.",
    fail: "The free tier removes features, so the product cannot be evaluated.",
    label: "Limit usage, not features",
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
    pass: "A cheap paid tier sits directly above free, making the step up small.",
    fail: "The jump from free to the first paid tier is large, so nobody steps.",
    label: "A tier above free",
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
  /** Why it could not be scored. Rendered instead of a grade. */
  reason?: string;
  /** 0-1, for ranking. Unobservable subsections sort last, not worst. */
  ratio: number | null;
  /**
   * Per-finding grade, same ladder as the headline and for the same reason.
   * Null when the subsection could not be scored at all.
   *
   * Ceilings are NOT applied here. A cap is a statement about the site as a
   * whole ("you cannot be an A without a pricing page"); applying it to an
   * individual finding would mark the messaging section down for something
   * that has nothing to do with messaging.
   */
  grade: Grade | null;
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
  if (!ctx.hasPricing) {
    return ctx.pricingUnreadable
      ? "Your pricing is there but renders client-side, so it could not be read."
      : "No public pricing page to read.";
  }
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
    return { key, label, earned: null, possible: 0, ratio: null, grade: null, reason: missingReason(key, ctx) };
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
    return { key, label, earned: null, possible: 0, ratio: null, grade: null, reason: missingReason(key, ctx) };
  }
  const ratio = earned / possible;
  return { key, label, earned, possible, ratio, grade: rawGrade(ratio) };
}

export interface AuditTotals {
  /** The reported verdict. */
  verdict: GradeVerdict;
  /**
   * 0-100 across what was observable. INTERNAL. Used for ordering, caching and
   * regression tests; never presented, because it moves whenever the rule set
   * grows and would make a visitor think their site changed when it did not.
   */
  score: number;
  subsections: SubsectionResult[];
  /** Worst three scorable subsections, in order. These are shown. */
  open: SubsectionResult[];
  /** The rest, by name only. These are redacted. */
  locked: SubsectionResult[];
}

/**
 * Roll the six subsections into a grade and split them into shown and withheld.
 *
 * Unobservable subsections sort LAST rather than worst. Ranking them as
 * failures would fill all three open slots with "we could not read this",
 * which is the least useful report we could hand somebody — the ceiling is
 * where a structural absence gets priced, not the ranking.
 */
export function totals(results: SubsectionResult[], ctx: CrawlContext): AuditTotals {
  const earned = results.reduce((n, r) => n + (r.earned ?? 0), 0);
  const possible = results.reduce((n, r) => n + r.possible, 0);
  const ratio = possible === 0 ? 0 : earned / possible;

  const ranked = [...results].sort((a, b) => {
    if (a.ratio === null && b.ratio === null) return 0;
    if (a.ratio === null) return 1;
    if (b.ratio === null) return -1;
    return a.ratio - b.ratio;
  });

  return {
    verdict: gradeFor(ratio, ctx),
    score: Math.round(ratio * 100),
    subsections: results,
    open: ranked.slice(0, 3),
    locked: ranked.slice(3),
  };
}

/**
 * ── GRADES ────────────────────────────────────────────────────────────────
 *
 * The audit reports a GRADE, not a score. The percentage still exists inside
 * this module — ranking subsections needs an ordering — but it is never the
 * thing shown, and that is a deliberate structural choice rather than a
 * presentational one.
 *
 * A percentage is unstable under a growing rule set. This battery is expected
 * to grow: as checks are added, the denominator moves, and a site that changed
 * nothing slides from 72 to 68. Anyone comparing their score across two months
 * would be reading noise created by us. A grade absorbs that — the bands keep
 * meaning the same thing while what feeds them changes underneath.
 *
 * NOT functions/_lib/bands.ts. That ladder is calibrated out of 30 — its top
 * band starts at 24 — so handing it a percentage returns "Rare air" for every
 * site above 24/100, including a broken one. Its labels are also Rank My
 * AdTech's voice, which is a leaderboard's rather than an audit's.
 */
export type Grade = "A" | "B" | "C" | "D" | "E";

export const GRADES: { grade: Grade; min: number; label: string }[] = [
  { grade: "A", min: 85, label: "sharp" },
  { grade: "B", min: 70, label: "solid, with gaps" },
  { grade: "C", min: 55, label: "leaking" },
  { grade: "D", min: 40, label: "needs work" },
  { grade: "E", min: 0, label: "start here" },
];

const RANK: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

export const gradeLabel = (g: Grade): string =>
  GRADES.find((x) => x.grade === g)?.label ?? "";

/** The grade a ratio earns before any ceiling is applied. */
export const rawGrade = (ratio: number): Grade =>
  (GRADES.find((g) => ratio * 100 >= g.min) ?? GRADES[GRADES.length - 1]).grade;

/**
 * Ceilings — the highest grade attainable while some condition holds.
 *
 * A ceiling is how a structural absence is priced, and it is a better
 * instrument than arithmetic for the job. Scoring twelve unobservable pricing
 * rules as zero costs a site fifty-four points, which is a punishment nobody
 * can interpret; capping it at C says one legible thing instead — you cannot be
 * graded top without this — and the card prints the reason next to the grade.
 *
 * A public pricing page is not a nice-to-have for an early-stage technology
 * startup. It is most of how a buyer self-qualifies, it is the precondition for
 * half of this rule set being answerable at all, and its absence is a finding
 * rather than an unknown. Nobody should be graded A without one.
 *
 * ADDING YOUR OWN: append an entry. Ceilings compose — the strictest wins — so
 * a new one cannot silently loosen an existing one, and none of the scoring
 * maths needs to change to accommodate it.
 */
export interface GradeCap {
  id: string;
  /** Best grade still reachable while `when` is true. */
  ceiling: Grade;
  when: (ctx: CrawlContext) => boolean;
  /** Printed beside the grade. Never leave a cap unexplained. */
  reason: string;
}

export const GRADE_CAPS: GradeCap[] = [
  {
    id: "no-pricing",
    ceiling: "C",
    when: (ctx) => !ctx.hasPricing,
    reason: "No public pricing page we could read — capped at C until there is one.",
  },
  {
    id: "unreadable",
    ceiling: "D",
    when: (ctx) => ctx.thin,
    reason: "The page renders client-side, so most of it could not be read or credited.",
  },
];

export interface GradeVerdict {
  grade: Grade;
  label: string;
  /** What the ratio alone would have earned, before ceilings. */
  uncapped: Grade;
  /**
   * Reasons for the ceilings that actually BIT — not every ceiling whose
   * condition happened to hold.
   *
   * A site graded E on its own merits trips the no-pricing ceiling too, but
   * telling that visitor they are "capped at C" is nonsense: they are nowhere
   * near C. Reporting a cap that changed nothing makes the scorer look broken
   * and buries the caps that did change something.
   */
  caps: string[];
}

/** Apply every ceiling that holds. The strictest wins; a ceiling can only lower. */
export function gradeFor(ratio: number, ctx: CrawlContext): GradeVerdict {
  const uncapped = rawGrade(ratio);
  let grade = uncapped;
  const caps: string[] = [];

  for (const cap of GRADE_CAPS) {
    if (!cap.when(ctx)) continue;
    // Binding only if this ceiling is stricter than what was already earned.
    if (RANK[cap.ceiling] <= RANK[uncapped]) continue;
    caps.push(cap.reason);
    if (RANK[cap.ceiling] > RANK[grade]) grade = cap.ceiling;
  }

  return { grade, label: gradeLabel(grade), uncapped, caps };
}

/**
 * The rules, serialised for the scoring prompt.
 *
 * Only observable rules go in. A model shown a rule it cannot check will find a
 * way to check it, and the answer will be invented.
 */
export function rulesPrompt(key: SubsectionKey, ctx: CrawlContext): string {
  return observableRules(key, ctx)
    .map(
      (r) =>
        `### ${r.id}\n${r.rule}\nPASS: ${r.pass}\nFAIL: ${r.fail}`,
    )
    .join("\n\n");
}

/**
 * Every observable check for this site, worst first.
 *
 * The report shows CHECKS, not subsection summaries. Rolling twenty-three
 * distinct findings into six paragraphs threw away the thing that makes the
 * claim worth anything — each check has a name, a test, a piece of evidence and
 * a peer-reviewed paper behind it, and a summary keeps none of those.
 */
export interface CheckResult {
  id: string;
  /** Public identifier for a masked row, e.g. BRAND-1 or PRICING-3. */
  code: string;
  label: string;
  subsection: SubsectionKey;
  subsectionLabel: string;
  /** 0-5 as scored. */
  score: number;
  grade: Grade;
  weight: 1 | 2 | 3;
  /** The model's evidence for this check, quoting the page. */
  evidence: string;
  citation: string;
}

export function rankChecks(
  ctx: CrawlContext,
  scores: Map<string, number>,
  notes: Map<string, string>,
): CheckResult[] {
  const out: CheckResult[] = [];
  // SOURCE ORDER — the published sequence of the research, not worst-first.
  // The report is a list of the checks that were run, and its order is a fact
  // about the playbook rather than about this site. RULES is already in that
  // order, so walking it directly is the whole implementation.
  for (const r of RULES) {
    if (!r.auditable || !r.observable(ctx)) continue;
    const score = scores.get(r.id);
    if (typeof score !== "number") continue;
    out.push({
      id: r.id,
      code: codeFor(r.id),
      label: r.label,
      subsection: r.subsection,
      subsectionLabel: subsectionLabel(r.subsection),
      score,
      grade: rawGrade(score / MAX_PER_RULE),
      weight: r.weight,
      evidence: notes.get(r.id) ?? "",
      citation: r.citation,
    });
  }
  return out;
}

/**
 * Which checks to reveal: the worst, by score then weight.
 *
 * Ranked separately from the ORDER they are shown in. The three worth opening
 * are the three most worth acting on, but they are then displayed where they
 * actually fall in the sequence — so the reader sees the shape of the whole
 * audit with three windows cut into it, rather than a top-three chart that
 * hides how much else was measured.
 */
export function revealed(checks: CheckResult[], n: number): Set<string> {
  return new Set(
    [...checks]
      .sort((a, b) => a.score - b.score || b.weight - a.weight)
      .slice(0, n)
      .map((c) => c.id),
  );
}


