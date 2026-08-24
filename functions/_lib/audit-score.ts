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
  isVisual,
  observableRules,
  sampleChecks,
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
 * The same family, with eyes, for the checks that are about where things are.
 *
 * Measured on plausible.io against the three positional rules: the text pass
 * scored "CTA in the upper right" 0/5 — a confident falsehood about a page with
 * "Start free trial" in its upper-right nav — and the vision pass scored it 5/5
 * and said where it was. Rounded corners likewise went from an inference over
 * class attributes to something seen.
 *
 * It costs no wall clock: the visual group runs alongside the five text groups,
 * and at ~7.5s it is not the slowest of them.
 */
const VISION_MODEL = "deepseek-v4-flash-vision-exp";

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
          verdict: { type: "string", enum: ["pass", "fail"] },
          note: { type: "string" },
        },
        required: ["id", "verdict", "note"],
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

function buildPrompt(key: SubsectionKey, host: string, site: SiteMarkdown, ctx: CrawlContext, only?: Set<string>): string {
  return [
    `You are auditing ${host} against published marketing research.`,
    ``,
    `Apply the test in each check below. Decide which definition the page`,
    `matches. DO NOT DELIBERATE — these are stated tests, not open questions.`,
    ``,
    rulesPrompt(key, ctx, only),
    ``,
    `Rules for your answer, which matter as much as the scores:`,
    `- Judge ONLY what is below. Never use anything you may know about this`,
    `  company from elsewhere.`,
    `- The MEASURED block is counted from the rendered page. Prefer it over the`,
    `  markdown for anything countable — ratings, trial lengths, prices, button`,
    `  labels, radii. If it says a thing was not found, it was not there.`,
    `- If the pages do not show you enough to judge a check, OMIT it. An`,
    `  omitted check is dropped; a guessed one is a lie with a number on it.`,
    `- Every note is ONE sentence, twenty-five words at the outside, and it MUST`,
    `  contain a VERBATIM quote from the page in double quotes. Copy the words`,
    `  exactly as they appear above — do not paraphrase inside the quote marks.`,
    `- A note without a quote that is really on the page is DISCARDED, and the`,
    `  check with it. Quote the thing you are describing, not a summary of it.`,
    `- Do not describe structure you cannot see. If the page has one headline,`,
    `  say so and quote it; do not report three benefits because three ideas`,
    `  appear in one sentence.`,
    `- Cite one concrete thing: a count, a price, a quoted phrase, a position.`,
    `- No hedging, no balancing. State the problem and stop.`,
    `- Answer PASS or FAIL. Not a score, not a maybe — the definitions above`,
    `  are exhaustive, so decide which one the page matches.`,
    site.thin ? `- NOTE: this page rendered almost nothing. Say so plainly.` : ``,
    ``,
    `Return JSON: {"scores":[{"id":"<check id>","verdict":"pass"|"fail","note":"<=20 words"}]}`,
    ``,
    site.html ? signalsBlock(extractSignals(site.html)) : "",
    ``,
    `--- PAGES (markdown, as published) ---`,
    pagesFor(key, site),
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * Normalise text for quote checking: one space between words, lowercased, and
 * the typographic characters a crawler and a model disagree about folded to
 * their ASCII forms.
 *
 * Without the folding this rejects true quotes constantly — the page ships a
 * curly apostrophe in "AI That’s Yours" and the model returns a straight
 * one, which is not a fabrication and must not be treated as one.
 */
export const forQuote = (t: string) =>
  t
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

/** Quoted spans in a note, longest first — `"..."` or `'...'`. */
export function quotesIn(note: string): string[] {
  return [...note.matchAll(/["“]([^"”]{2,160})["”]|'([^']{2,160})'/g)]
    .map((m) => (m[1] ?? m[2] ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

/**
 * Parse and clamp. A malformed row is dropped, never defaulted to zero.
 *
 * EVERY NOTE MUST QUOTE THE PAGE, and the quote must actually be on it.
 *
 * This is the gate that stops the tool asserting things the evidence does not
 * support. Chalice's homepage has one hero line — "Chalice is
 * platform-independent advertising AI that drives..." — and the model reported
 * "Hero h4 lists exactly three benefits: platform-independent, real-world
 * outcomes, full transparency." Every word of that vocabulary is on the page,
 * which is what made it convincing; the STRUCTURE was invented. Free prose
 * about a page is unfalsifiable, and this audit's entire claim is that it is
 * checkable.
 *
 * A row whose quote is not found is DROPPED, not scored zero — the same rule
 * that governs a check the crawl could not observe. We would rather show two
 * findings than three, one of which is fiction.
 */
/**
 * Is this note traceable to the page?
 *
 * A note qualifies on either of two shapes, and the second one is not a
 * loophole — it is the commonest true answer this audit gives:
 *
 *   ONE SUBSTANTIAL QUOTE — three words or more, found on the page.
 *   A LIST OF SHORT ONES — two or more quotes, all found. Plan names are one
 *   word each: 'the pricing page shows "Starter", "Growth" and "Business"' is
 *   about as checkable as a note gets, and a two-word minimum threw it away.
 *
 * Both were false negatives in a real run against plausible.io, and a gate that
 * discards true findings is worse than no gate: it costs the reader the finding
 * AND leaves the impression the site passed.
 */
export function groundedNote(note: string, evidence: string): boolean {
  if (!evidence) return true; // no text to check against — the visual group
  const haystack = forQuote(evidence);
  const quotes = quotesIn(note);
  const found = quotes.filter((q) => haystack.includes(forQuote(q)));

  if (found.some((q) => q.split(/\s+/).length >= 3)) return true;
  return found.length >= 2 && found.length === quotes.length;
}

/**
 * AN ANSWER THAT OMITS IS NOT A FAILED CALL.
 *
 * Both group scorers used to throw when a response scored nothing, which was
 * right when a call carried a whole subsection: six rules and zero scores is a
 * model that ignored the task. The wave changed that and the check did not
 * follow it — every call now carries ONE rule, so the two things the prompt
 * explicitly asks for, "if the pages do not show you enough, OMIT it" and a
 * note whose quote is really on the page, both produce an empty result. An
 * honest omission was being raised as an exception, rejected out of
 * Promise.allSettled and dropped on the floor beside a genuine outage.
 *
 * Measured across three sites, two to three of every six sampled checks
 * disappeared this way and the report simply said it had checked fewer things.
 *
 * So the only thing that throws now is a response that is not an answer at
 * all: no JSON, or JSON with no `scores` array. That is a transport or model
 * failure, it is worth a rejection, and — unlike an omission — it is now the
 * ONLY thing a rejection can mean, which is what makes counting them useful.
 */
export function requireScores(text: string): unknown {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { scores?: unknown }).scores)) {
    throw new Error("no scores array in the response");
  }
  return raw;
}

function normalize(raw: unknown, valid: Set<string>, evidence: string): SectionVerdict {
  const obj = (raw ?? {}) as { scores?: unknown };
  const scores = new Map<string, number>();
  const notes = new Map<string, string>();

  if (Array.isArray(obj.scores)) {
    for (const row of obj.scores) {
      const r = row as { id?: unknown; score?: unknown; note?: unknown };
      const id = typeof r.id === "string" ? r.id.trim() : "";
      // An id we did not ask about is a hallucinated check. Drop it.
      if (!valid.has(id) || scores.has(id)) continue;
      // PASS or FAIL, nothing else. Anything unrecognised is an omission, not a
      // guess — the same rule that governs a check the model declined to score.
      const v = String((r as { verdict?: unknown }).verdict ?? "").trim().toLowerCase();
      if (v !== "pass" && v !== "fail") continue;

      // VALIDATE THE RAW NOTE, clamp only for display. Clamping first cut a
      // long quote in half — the h1 of plausible.io is 60 characters and the
      // closing quote fell off the end, so a correct finding was discarded for
      // being unquoted.
      const raw = typeof r.note === "string" ? r.note : "";
      if (!groundedNote(raw, evidence)) {
        console.warn(`[audit] ${id}: note not grounded in the page, dropped — ${raw.slice(0, 90)}`);
        continue;
      }

      scores.set(id, v === "pass" ? 1 : 0);
      notes.set(id, clampText(raw, 180));
    }
  }
  return { scores, notes, summary: "" };
}

/**
 * A group scored from the SCREENSHOT.
 *
 * Same criteria, same output shape — only the evidence differs. The prompt
 * carries no markdown at all: handing a vision model the text as well invites
 * it to answer from the text, which is the failure this pass exists to fix.
 */
async function scoreVisualGroup(
  key: SubsectionKey,
  host: string,
  site: SiteMarkdown,
  ctx: CrawlContext,
  env: ProviderEnv,
  only?: Set<string>,
): Promise<SectionVerdict> {
  const rules = observableRules(key, ctx).filter((r) => !only || only.has(r.id));
  const valid = new Set(rules.map((r) => r.id));
  if (valid.size === 0 || !site.screenshot) {
    return { scores: new Map(), notes: new Map(), summary: "" };
  }

  const prompt = [
    `You are auditing a screenshot of ${host} against published design research.`,
    ``,
    `Apply the test in each check. Decide which definition the page matches.`,
    `DO NOT DELIBERATE — these are stated tests, not open questions.`,
    ``,
    rulesPrompt(key, ctx, only),
    ``,
    `Rules for your answer:`,
    `- Judge ONLY what you can SEE. Do not infer from what a page like this`,
    `  usually does.`,
    `- If the screenshot does not show enough to judge a check, OMIT it.`,
    `- Every note is ONE sentence, twenty words at the outside, citing what is`,
    `  visible and where it sits.`,
    `- Answer PASS or FAIL. Not a score, not a maybe.`,
    ``,
    `Return JSON: {"scores":[{"id":"<check id>","verdict":"pass"|"fail","note":"<=20 words"}]}`,
  ].join("\n");

  const t0 = Date.now();
  const { value } = await askLadder(
    PROVIDER,
    env,
    prompt,
    (text) => {
      // NO QUOTE GATE HERE, and that asymmetry is deliberate. This group scores
      // from a screenshot, so there is no text for a quote to be checked
      // against, and a legitimate note about where a button sits ("upper-right
      // corner") quotes nothing. The gate belongs where the risk is: prose
      // claims about page STRUCTURE, which is the text groups.
      return normalize(requireScores(text), valid, "");
    },
    {
      preferred: VISION_MODEL,
      only: [VISION_MODEL],
      attempts: 1,
      temperature: 0.2,
      schema: RESPONSE_SCHEMA,
      maxTokens: MAX_TOKENS,
      imageUrl: site.screenshot,
    },
  );
  console.log(`[audit] ${key} (visual): ${rules.length} checks, ${Date.now() - t0}ms, ${value.scores.size} scored`);
  return value;
}

/** One group of checks. Small prompt, pinned light model, small ceiling. */
async function scoreGroup(
  key: SubsectionKey,
  host: string,
  site: SiteMarkdown,
  ctx: CrawlContext,
  env: ProviderEnv,
  only?: Set<string>,
): Promise<SectionVerdict> {
  const rules = observableRules(key, ctx).filter((r) => !only || only.has(r.id));
  const valid = new Set(rules.map((r) => r.id));
  if (valid.size === 0) return { scores: new Map(), notes: new Map(), summary: "" };

  const t0 = Date.now();
  const prompt = buildPrompt(key, host, site, ctx, only);
  const { value } = await askLadder(
    PROVIDER,
    env,
    prompt,
    // The prompt IS the evidence: it is the only thing the model saw, so it is
    // exactly the right haystack to check a quote against.
    (text) => normalize(requireScores(text), valid, prompt),
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

export interface AuditResult {
  host: string;
  /** How many of the sample passed. Used for the cache row and for ordering. */
  passed: number;
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

  // THREE CHECKS, NOT TWENTY-THREE.
  //
  // The free audit runs a sample and stops. Scoring the whole rule set took six
  // model calls, a completion round and thirty to forty-five seconds, and then
  // published a pass/fail for every check — the gate withheld the evidence but
  // gave away the verdict, which is most of what a visitor wanted. Three checks
  // from three parts of the research demonstrate the method, cost a fraction,
  // and leave the other twenty genuinely unrun rather than run-and-redacted.
  //
  // No completion round either. With three rules there is nothing to complete:
  // a rule the model declines to answer is one we cannot show, and asking twice
  // for a sample defeats the point of sampling.
  const sample = sampleChecks(ctx);
  if (sample.length === 0) throw new Error("no observable check to sample");

  // One call per sampled rule, in parallel. The sample holds at most one rule
  // per subsection, so this reuses the existing group scorers with their `only`
  // filter rather than growing a second prompt path — and each prompt now
  // carries a single rule, which is why it is fast.
  const settled = await Promise.allSettled(
    sample.map((r) =>
      isVisual(r.subsection)
        ? scoreVisualGroup(r.subsection, host, site, ctx, env, new Set([r.id]))
        : scoreGroup(r.subsection, host, site, ctx, env, new Set([r.id])),
    ),
  );

  const merged = new Map<string, number>();
  const allNotes = new Map<string, string>();
  const failures: string[] = [];
  for (const [i, r] of settled.entries()) {
    if (r.status !== "fulfilled") {
      failures.push(`${sample[i].id}: ${r.reason}`);
      continue;
    }
    for (const [k, v] of r.value.scores) merged.set(k, v);
    for (const [k, v] of r.value.notes) allNotes.set(k, v);
  }

  // THE THREE WAYS A CHECK DISAPPEARS ARE NOW DISTINGUISHABLE, and only one of
  // them is a fault. Declined and ungrounded are the design working; a rejected
  // call is the provider. Logged apart, because "we showed two wins" reads the
  // same in all three cases and only one of them wants looking at.
  const declined = sample.filter((r) => !merged.has(r.id) && !failures.some((f) => f.startsWith(`${r.id}:`)));
  console.log(
    `[audit] wave: ${sample.length} sampled, ${merged.size} scored, ` +
      `${declined.length} declined or ungrounded, ${failures.length} failed` +
      (declined.length ? ` — declined: ${declined.map((r) => r.id).join(", ")}` : "") +
      (failures.length ? ` — failed: ${failures.join(" | ")}` : ""),
  );

  // SCORING NOTHING IS AN OUTAGE, not a result. A page reporting checks it
  // never ran is worse than a page saying it could not run them.
  if (merged.size === 0) throw new Error("no check was scored");

  // AND SO IS MOST OF THE WAVE FAILING. One provider error costs a check and
  // the report is honest about how many it ran; half the wave erroring is an
  // outage wearing a thin report, and a visitor gets a result that looks like
  // their site's rather than ours. Fail instead — audit.ts turns a throw into
  // "we couldn't read that site well enough to score it", which is at least
  // about us.
  if (failures.length > sample.length / 2) {
    throw new Error(`wave mostly failed: ${failures.length}/${sample.length} — ${failures.join(" | ")}`);
  }

  const checks = rankChecks(ctx, merged, allNotes);
  return { host, ctx, checks, passed: checks.filter((c) => c.verdict === "pass").length };
}

// Re-exported so audit.ts does not need to import from two places to build a
// response, and so the verdict shape stays owned by the module that makes it.
export { SUBSECTIONS, type CrawlContext, type SubsectionKey };
