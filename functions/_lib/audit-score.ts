/**
 * Scoring a site against the playbook.
 *
 * This module knows about rules and models. It does not know about HTTP,
 * streaming, or caching — audit.ts owns those, and keeping the split means the
 * scoring can be exercised without opening a socket.
 *
 * TWO ladder calls, not twenty-three. One per section, each judging its own
 * rules against the pages that can evidence them. Prompt length is the latency
 * budget on this platform, and twenty-three round trips would blow it by an
 * order of magnitude for no gain in quality — the rules within a section share
 * context, so judging them together is also the more informed call.
 */
import { askLadder, clampInt, clampText, extractJson, type ProviderEnv } from "./providers";
import type { SiteMarkdown } from "./pages";
import { extractSignals, signalsBlock } from "./signals";
import {
  MAX_PER_RULE,
  SUBSECTIONS,
  observableRules,
  rulesPrompt,
  rankChecks,
  scoreSubsection,
  totals,
  type CheckResult,
  type AuditTotals,
  type CrawlContext,
  type SubsectionKey,
} from "./playbook";

/**
 * The ladder, and the model, and why both are different from the panel's.
 *
 * This is CLASSIFICATION, not deliberation. Each check ships a stated PASS and
 * FAIL definition; the job is to decide which one a page matches and write one
 * sentence. Nothing about that wants a reasoning model, and the default ladder
 * is made of them — providers.ts records glm-5.3 spending 1,666 reasoning
 * tokens on a 369-token prompt, all of it before a character of JSON. A run
 * took four minutes.
 *
 * Measured against Zen on 2026-08-21, same prompt, five checks:
 *
 *   deepseek-v4-flash   18.4s   valid   0 reasoning tokens
 *   qwen3.7-plus        47.8s   valid   2,625 reasoning tokens
 *   glm-5.1             15.9s   TRUNCATED at the ceiling
 *   kimi-k2.6           27.8s   TRUNCATED, 1,199 reasoning tokens
 *   minimax-m2.7        19.2s   TRUNCATED
 *   qwen3.5-plus        timeout
 *
 * So the model is PINNED rather than laddered. A fallback here would be a
 * reasoning model quietly turning a twelve-second audit back into a four-minute
 * one, which is worse than failing.
 */
const PROVIDER = "opencode" as const;
const MODEL = "deepseek-v4-flash";

/**
 * Output ceiling. The panel's is 16000, sized for seats that think out loud.
 * A group of checks returns a handful of short notes; 1600 is generous for
 * that, and headroom is not free — a model reads it as permission.
 */
const MAX_TOKENS = 1600;

/**
 * How much of the site to show ONE group of checks.
 *
 * Down from 18k because the shape changed: six small calls now run in parallel
 * instead of two large ones, and each is handed only the pages its own checks
 * ask about. Pricing rules never see the homepage's feature copy and messaging
 * rules never see the plan table. Less to read is most of why each call
 * returns in seconds.
 */
const PROMPT_CHARS = 6_000;

/** How the model must answer. Ids come straight from the rule table. */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          score: { type: "integer" },
          note: { type: "string" },
        },
        required: ["id", "score", "note"],
      },
    },
    summary: { type: "string" },
  },
  required: ["scores", "summary"],
};

export interface SectionVerdict {
  scores: Map<string, number>;
  /** One short observation per rule, keyed by rule id. Used to write findings. */
  notes: Map<string, string>;
  /** The model's own one-line read on the section. */
  summary: string;
}

/**
 * Read the crawl for the three facts the observability predicates need.
 *
 * Deliberately dumb string matching rather than a model call. These gate
 * whether a rule is scored at all, so they must be cheap, deterministic and
 * explainable — "we did not find the word 'pricing' on your site" is a
 * defensible thing to say, and a model's opinion about whether a pricing page
 * exists is not worth a round trip.
 */
export function readContext(site: SiteMarkdown): CrawlContext {
  const text = site.pages.toLowerCase();
  // hasPricing comes from the reader, which knows whether a pricing page was
  // actually FETCHED — far better evidence than the word "pricing" appearing
  // somewhere in a nav.
  const hasPricing = site.hasPricing;
  return {
    thin: site.thin,
    hasPricing,
    pricingUnreadable: site.pricingUnreadable,
    hasTrial: hasPricing && /\bfree trial\b|\btry (it )?free\b|\bstart (your )?trial\b/.test(text),
    hasFreemium: hasPricing && /\bfree (plan|tier|forever)\b|\bfreemium\b|\$0\b/.test(text),
  };
}

/**
 * Which pages a group of checks needs to see.
 *
 * Pricing rules have no use for the homepage's feature copy and messaging
 * rules have no use for the plan table. Handing each group only its own
 * evidence is the other half of why these calls come back in seconds.
 */
const PAGES_FOR: Record<SubsectionKey, RegExp> = {
  messaging: /^Homepage|^Product/i,
  design: /^Homepage|^Product/i,
  proof: /^Homepage|^Product/i,
  plans: /^Pricing|^Homepage/i,
  trials: /^Pricing|^Homepage/i,
  freemium: /^Pricing|^Homepage/i,
};

function pagesFor(key: SubsectionKey, site: SiteMarkdown): string {
  const wanted = site.read.filter((p) => PAGES_FOR[key].test(p.label));
  const use = wanted.length ? wanted : site.read;
  return use
    .map((p) => `## ${p.label} — ${p.url}\n\n${p.markdown}`)
    .join("\n\n---\n\n")
    .slice(0, PROMPT_CHARS);
}

function buildPrompt(key: SubsectionKey, host: string, site: SiteMarkdown, ctx: CrawlContext): string {
  return [
    `You are auditing ${host} against published marketing research.`,
    ``,
    `Apply the test in each check below. Decide which definition the page`,
    `matches. DO NOT DELIBERATE — these are stated tests, not open questions.`,
    ``,
    rulesPrompt(key, ctx),
    ``,
    `Rules for your answer, which matter as much as the scores:`,
    `- Judge ONLY what is below. Never use anything you may know about this`,
    `  company from elsewhere.`,
    `- The MEASURED block is counted from the rendered page. Prefer it over the`,
    `  markdown for anything countable — ratings, trial lengths, prices, button`,
    `  labels, radii. If it says a thing was not found, it was not there.`,
    `- If the pages do not show you enough to judge a check, OMIT it. An`,
    `  omitted check is dropped; a guessed one is a lie with a number on it.`,
    `- Every note is ONE sentence, twenty words at the outside.`,
    `- Cite one concrete thing: a count, a price, a quoted phrase, a position.`,
    `- No hedging, no balancing. State the problem and stop.`,
    `- Score 0-5. 0 means the page does the opposite of the rule, 5 means it`,
    `  follows it well.`,
    site.thin ? `- NOTE: this page rendered almost nothing. Say so plainly.` : ``,
    ``,
    `Return JSON: {"scores":[{"id":"<check id>","score":<0-5>,"note":"<=20 words"}]}`,
    ``,
    site.html ? signalsBlock(extractSignals(site.html)) : "",
    ``,
    `--- PAGES (markdown, as published) ---`,
    pagesFor(key, site),
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Parse and clamp. A malformed row is dropped, never defaulted to zero. */
function normalize(raw: unknown, valid: Set<string>): SectionVerdict {
  const obj = (raw ?? {}) as { scores?: unknown };
  const scores = new Map<string, number>();
  const notes = new Map<string, string>();

  if (Array.isArray(obj.scores)) {
    for (const row of obj.scores) {
      const r = row as { id?: unknown; score?: unknown; note?: unknown };
      const id = typeof r.id === "string" ? r.id.trim() : "";
      // An id we did not ask about is a hallucinated check. Drop it.
      if (!valid.has(id) || scores.has(id)) continue;
      if (typeof r.score !== "number" && typeof r.score !== "string") continue;
      scores.set(id, clampInt(r.score, MAX_PER_RULE));
      notes.set(id, clampText(r.note, 150));
    }
  }
  return { scores, notes, summary: "" };
}

/** One group of checks. Small prompt, pinned light model, small ceiling. */
async function scoreGroup(
  key: SubsectionKey,
  host: string,
  site: SiteMarkdown,
  ctx: CrawlContext,
  env: ProviderEnv,
): Promise<SectionVerdict> {
  const rules = observableRules(key, ctx);
  const valid = new Set(rules.map((r) => r.id));
  if (valid.size === 0) return { scores: new Map(), notes: new Map(), summary: "" };

  const t0 = Date.now();
  const { value } = await askLadder(
    PROVIDER,
    env,
    buildPrompt(key, host, site, ctx),
    (text) => {
      const parsed = normalize(extractJson(text), valid);
      // A response that scored nothing is a failed call, not an answer.
      if (parsed.scores.size === 0) throw new Error("no usable scores");
      return parsed;
    },
    {
      temperature: 0.2,
      schema: RESPONSE_SCHEMA,
      // Pinned, not laddered. A fallback here is a reasoning model quietly
      // turning a twelve-second audit back into a four-minute one.
      //
      // `preferred` as well as `only` is REQUIRED, not belt-and-braces: the
      // `only` filter intersects with the provider's catalogue, and this model
      // is not in OPENCODE_JUROR_MODELS — that list is the panel's. Without
      // `preferred` the intersection is empty and every call fails instantly,
      // which is exactly what happened: a run "finished" in one second with
      // zero checks and a grade of E. askLadder's own comment names this as
      // the intended escape hatch — a preferred model is tried even when the
      // catalogue does not list it.
      preferred: MODEL,
      only: [MODEL],
      // One attempt. The retry doubled worst-case wall clock and this model
      // has not once returned an unusable body in testing.
      attempts: 1,
      maxTokens: MAX_TOKENS,
    },
  );
  // Per-group timing, because "the audit is slow" is not actionable and
  // "freemium took 41s while messaging took 4s" is.
  console.log(`[audit] ${key}: ${rules.length} checks, ${Date.now() - t0}ms, ${value.scores.size} scored`);
  return value;
}

export interface AuditResult extends AuditTotals {
  host: string;
  /** What the crawl saw, so the caller can explain a ceiling. */
  ctx: CrawlContext;
  /** Every observable check, worst first. This is what the report renders. */
  checks: CheckResult[];
}

/**
 * Score a crawled site. Both sections run concurrently — they read different
 * pages and neither needs the other's answer.
 */
export async function scoreSite(
  host: string,
  site: SiteMarkdown,
  env: ProviderEnv,
): Promise<AuditResult> {
  const ctx = readContext(site);

  // SIX SMALL CALLS IN PARALLEL, not two large ones. Wall clock becomes the
  // slowest single group rather than the sum, and every group is small because
  // it carries only its own checks and only the pages those checks need.
  // Measured: 10.3s wall against 16.7s of summed work, on a run that used to
  // take four minutes.
  const settled = await Promise.allSettled(
    SUBSECTIONS.map((s) => scoreGroup(s.key, host, site, ctx, env)),
  );

  // A group failing is survivable — its checks simply do not appear, exactly
  // like a check the model declined to score.
  if (settled.every((r) => r.status === "rejected")) {
    throw new Error("scoring failed for every group");
  }

  const merged = new Map<string, number>();
  const allNotes = new Map<string, string>();
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const [k, v] of r.value.scores) merged.set(k, v);
    for (const [k, v] of r.value.notes) allNotes.set(k, v);
  }

  // SCORING NOTHING IS AN OUTAGE, not a grade of E.
  //
  // Groups with no observable rules resolve empty, so "not every group
  // rejected" is not the same as "something was scored". When the model layer
  // was broken, three groups resolved empty and three rejected, and the run
  // returned a confident E with zero checks behind it. A page that says E when
  // nothing was measured is worse than a page that says it failed.
  if (merged.size === 0) {
    throw new Error("no check was scored");
  }

  const results = SUBSECTIONS.map((s) => scoreSubsection(s.key, ctx, merged));

  return { host, checks: rankChecks(ctx, merged, allNotes), ctx, ...totals(results, ctx) };
}

// Re-exported so audit.ts does not need to import from two places to build a
// response, and so the verdict shape stays owned by the module that makes it.
export { SUBSECTIONS, type CrawlContext, type SubsectionKey };
