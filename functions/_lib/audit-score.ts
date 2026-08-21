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
 * The ladder order, and why.
 *
 * opencode leads for the same reason it leads elsewhere in this codebase, and
 * the two behind it are fallbacks rather than a panel — this is one judgement
 * against a fixed rubric, not three opinions that need to be comparable, so
 * there is no neutrality pin to honour here.
 */
const LADDER = ["opencode", "gemini", "nvidia"] as const;

/**
 * How much of the site to show the model.
 *
 * Raised back to 18k now that the input is context.dev MARKDOWN of the two or
 * three pages these rules actually ask about, rather than flattened text from
 * eight pages including careers and news. Every character now carries structure
 * a rule can be tested against, so the budget buys evidence instead of filler.
 */
const PROMPT_CHARS = 18_000;

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

const SECTION_BRIEF: Record<1 | 2, string> = {
  1: "brand, messaging, page design and social proof, judged from the marketing pages",
  2: "pricing plans, free trials and freemium structure, judged from the pricing page",
};

function buildPrompt(section: 1 | 2, host: string, site: SiteMarkdown, ctx: CrawlContext): string {
  const keys = SUBSECTIONS.filter((s) => s.section === section).map((s) => s.key);
  const rules = keys
    .map((k) => {
      const body = rulesPrompt(k, ctx);
      return body ? `### ${k}\n${body}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  return [
    `You are auditing ${host} against published marketing research.`,
    ``,
    `Score ONLY the rules listed below — ${SECTION_BRIEF[section]}.`,
    `Each rule gets an integer 0-${MAX_PER_RULE}, where 0 means the site does the`,
    `opposite of the rule and ${MAX_PER_RULE} means it follows it well.`,
    ``,
    `Each check below gives the rule, then PASS and FAIL definitions. Apply the`,
    `test. Do not weigh it up — decide which definition the page matches.`,
    ``,
    rules,
    ``,
    `Rules for your answer, which matter as much as the scores:`,
    `- Judge ONLY what is in the pages below. Do not infer, and do not use`,
    `  anything you may know about this company from elsewhere.`,
    `- If the pages do not show you enough to judge a rule, OMIT it entirely`,
    `  rather than guessing. An omitted rule is dropped from the score; a`,
    `  guessed one is a lie with a number attached.`,
    `- Every note is ONE sentence. Not two. Not a sentence with a semicolon`,
    `  doing the work of two. Twenty words at the outside.`,
    `- State the single most important problem with that rule and stop. Do not`,
    `  balance it with what the page does well — this is a list of what to fix.`,
    `- Cite one concrete thing: a count, a price, a quoted phrase, a position.`,
    `  Never adjectives alone, and never more than one piece of evidence.`,
    `- No hedging. No "though", "however", "while", "that said". If the rule is`,
    `  met, score it high and say so in six words.`,
    `- Write to the site's owner, in plain English, second person.`,
    site.thin
      ? `- NOTE: this site rendered almost nothing to a plain fetch. Say so plainly rather than inventing detail.`
      : ``,
    ``,
    `Return JSON: {"scores":[{"id":"<rule id>","score":<0-${MAX_PER_RULE}>,"note":"<=25 words"}],"summary":"<one sentence>"}`,
    ``,
    `--- PAGES (markdown, as published) ---`,
    site.pages.slice(0, PROMPT_CHARS),
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Parse and clamp. A malformed row is dropped, never defaulted to zero. */
function normalize(raw: unknown, valid: Set<string>): SectionVerdict {
  const obj = (raw ?? {}) as { scores?: unknown; summary?: unknown };
  const scores = new Map<string, number>();
  const notes = new Map<string, string>();

  if (Array.isArray(obj.scores)) {
    for (const row of obj.scores) {
      const r = row as { id?: unknown; score?: unknown; note?: unknown };
      const id = typeof r.id === "string" ? r.id.trim() : "";
      // An id we did not ask about is a hallucinated rule. Drop it silently —
      // scoreSubsection only reads ids it knows, but keeping the map clean
      // means the notes cannot surface a rule that does not exist.
      if (!valid.has(id) || scores.has(id)) continue;
      if (typeof r.score !== "number" && typeof r.score !== "string") continue;
      scores.set(id, clampInt(r.score, MAX_PER_RULE));
      notes.set(id, clampText(r.note, 150));
    }
  }

  return { scores, notes, summary: clampText(obj.summary, 200) };
}

async function scoreSection(
  section: 1 | 2,
  host: string,
  site: SiteMarkdown,
  ctx: CrawlContext,
  env: ProviderEnv,
): Promise<SectionVerdict> {
  const keys = SUBSECTIONS.filter((s) => s.section === section).map((s) => s.key);
  const valid = new Set(keys.flatMap((k) => observableRules(k, ctx).map((r) => r.id)));

  // Nothing observable in this whole section — no reason to spend a call.
  if (valid.size === 0) return { scores: new Map(), notes: new Map(), summary: "" };

  const prompt = buildPrompt(section, host, site, ctx);

  let lastErr: unknown;
  for (const provider of LADDER) {
    try {
      const { value } = await askLadder(
        provider,
        env,
        prompt,
        (text) => {
          const parsed = normalize(extractJson(text), valid);
          // A response that scored nothing is a failed rung, not an answer.
          if (parsed.scores.size === 0) throw new Error("no usable scores");
          return parsed;
        },
        // attempts:1, not 2. `attempts` is per RUNG, so with three providers
        // behind it a retry policy of 2 permits six sequential model calls
        // before this gives up — which is how a 40-second job became a
        // four-minute one when the first provider 500'd. The ladder already IS
        // the retry: a dead rung costs one call, not two.
        { temperature: 0.2, schema: RESPONSE_SCHEMA, attempts: 1 },
      );
      return value;
    } catch (err) {
      lastErr = err;
      console.error(`[audit] §${section} ${provider} failed:`, err);
    }
  }
  throw new Error(`§${section}: every provider failed (${String(lastErr)})`);
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

  const [s1, s2] = await Promise.allSettled([
    scoreSection(1, host, site, ctx, env),
    scoreSection(2, host, site, ctx, env),
  ]);

  // One section failing is survivable: its subsections become unscorable and
  // say so, exactly like a missing pricing page. Both failing is a real outage.
  if (s1.status === "rejected" && s2.status === "rejected") {
    throw new Error("scoring failed for both sections");
  }

  const verdicts = new Map<SubsectionKey, SectionVerdict>();
  const merged = new Map<string, number>();
  const allNotes = new Map<string, string>();
  for (const settled of [s1, s2]) {
    if (settled.status !== "fulfilled") continue;
    for (const [k, v] of settled.value.scores) merged.set(k, v);
    for (const [k, v] of settled.value.notes) allNotes.set(k, v);
  }

  const results = SUBSECTIONS.map((s) => scoreSubsection(s.key, ctx, merged));

  return { host, checks: rankChecks(ctx, merged, allNotes), ctx, ...totals(results, ctx) };
}

// Re-exported so audit.ts does not need to import from two places to build a
// response, and so the verdict shape stays owned by the module that makes it.
export { SUBSECTIONS, type CrawlContext, type SubsectionKey };
