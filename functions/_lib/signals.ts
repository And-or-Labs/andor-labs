/**
 * Measured signals from rendered HTML.
 *
 * Ported from the saas-grader plugin's scripts/extract-signals.mjs, whose rule
 * is the one that matters here: checks marked `dom` are scored from MEASURED
 * FACTS, not from prose impressions. Feeding a model prose and asking whether a
 * page shows a star rating gets you an opinion; counting the rating tokens gets
 * you an answer.
 *
 * That distinction is why half the checks were coming back unscored. "Is there
 * an average rating", "how long is the trial", "how many plans" and "are prices
 * round numbers" are all COUNTABLE, and markdown had already thrown away the
 * markup they live in. The model kept correctly omitting them.
 *
 * Pure regex over HTML, exactly as the original — no DOM library and no browser,
 * which is what makes it run inside a Worker at all.
 */

export interface Signals {
  title: string;
  metaDescription: string;
  /** Headings in document order, e.g. "h2: Why use Plausible". */
  headings: string[];
  /** Button and CTA-link labels, in order. */
  ctas: string[];
  /** Nav link labels and hrefs. */
  navLinks: { text: string; href: string }[];
  /** Price tokens WITH surrounding context, so a model can tell $9/mo from "$9M raised". */
  prices: string[];
  perUnitPricing: string[];
  socialProofNumbers: string[];
  starRatings: string[];
  starGlyphs: number;
  trialDays: number[];
  freeTrialMentioned: boolean;
  freemiumSignals: string[];
  videoTags: number;
  videoEmbeds: string[];
  gifs: number;
  testimonials: string[];
  /** Border-radius declarations, so "are the CTAs rounded" stops being a guess. */
  borderRadii: string[];
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'");

const clean = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const uniq = <T>(a: T[]) => [...new Set(a)];

/** Text of every instance of a tag, in document order. */
function tagTexts(html: string, tag: string, limit = 60): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  for (const m of html.matchAll(re)) {
    const t = clean(m[1]);
    if (t && t.length < 200) out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/** Matches with a window of surrounding text, so a number keeps its meaning. */
function contexts(text: string, re: RegExp, limit = 30, span = 60): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    out.push(text.slice(Math.max(0, i - span), i + m[0].length + span).replace(/\s+/g, " ").trim());
    if (out.length >= limit) break;
  }
  return uniq(out);
}

export function extractSignals(html: string): Signals {
  // Script and template content is not page copy and is full of false prices.
  const noScript = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template\b[\s\S]*?<\/template>/gi, " ");
  const visible = noScript.replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  const text = clean(visible);

  const headings: string[] = [];
  for (const m of noScript.matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = clean(m[2]);
    if (t) headings.push(`${m[1].toLowerCase()}: ${t}`);
    if (headings.length >= 40) break;
  }

  // CTAs by TEXT, not by class name.
  //
  // The class-name test (btn|button|cta) finds nothing on a Tailwind site,
  // which is most modern SaaS: plausible.io has two <button> tags, both menu
  // toggles, and every real CTA is an <a> carrying utility classes. That
  // returned "no CTA labels found" and the model correctly scored the
  // upper-right-CTA check 0 — a measured falsehood, which is worse than not
  // measuring. Matching the words a CTA actually uses is framework-agnostic.
  const CTA_TEXT =
    /^(start|try|get started|get a|sign up|signup|book|request|buy|subscribe|join|create|contact sales|talk to|see it|watch|demo|free trial)/i;
  const ctas = tagTexts(noScript, "button", 30).filter((t) => t.length < 40);
  for (const m of noScript.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const t = clean(m[1]);
    if (t && t.length < 40 && CTA_TEXT.test(t) && ctas.length < 40) ctas.push(t);
  }

  const navLinks: { text: string; href: string }[] = [];
  const nav = /<nav\b[\s\S]*?<\/nav>|<header\b[\s\S]*?<\/header>/gi;
  for (const block of noScript.match(nav) ?? []) {
    for (const m of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const t = clean(m[2]);
      if (t && navLinks.length < 30) navLinks.push({ text: t, href: m[1] });
    }
  }

  // border-radius on anything, so "are the CTA buttons rounded" is measurable
  // rather than imagined. Inline styles and <style> blocks both count.
  // Rounding, declared OR utility-classed.
  //
  // A Tailwind page has no border-radius declaration anywhere in its HTML — the
  // rounding lives in `rounded-md` on a class attribute and the actual
  // declaration is in an external stylesheet nobody fetched. Reading only the
  // declaration reported "no rounding" on a page full of rounded buttons.
  const declared = [...html.matchAll(/border-radius\s*:\s*([^;"'}]+)/gi)].map((m) => m[1].trim());
  const utility = [...html.matchAll(/\bclass=["'][^"']*\b(rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?)\b/gi)].map(
    (m) => `class:${m[1]}`,
  );
  const borderRadii = uniq([...declared, ...utility]).slice(0, 20);

  return {
    title: clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [, ""])[1]!),
    metaDescription: decode(
      (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ?? [, ""])[1]!,
    ),
    headings,
    ctas: uniq(ctas),
    navLinks,
    prices: contexts(text, /(?:\$|€|£)\s?\d[\d,]*(?:\.\d+)?/g, 40),
    perUnitPricing: contexts(
      text,
      /(?:per\s+(?:seat|user|month|year|GB|credit)|\/\s?(?:mo|month|yr|year|seat|user))/gi,
      20,
    ),
    socialProofNumbers: contexts(
      text,
      /\b\d[\d,]*(?:\.\d+)?\s?(?:k|m|b|million|billion|\+)?\s+(?:customers?|users?|teams?|companies|sites?|websites?|developers?|businesses)/gi,
      20,
    ),
    starRatings: contexts(text, /\b([0-5](?:\.\d)?)\s*(?:\/\s*5|stars?|★)/gi, 15),
    starGlyphs: (text.match(/★/g) ?? []).length,
    trialDays: uniq(
      [...text.matchAll(/\b(\d+)[-\s]?days?\s+(?:free\s+)?trial\b/gi)].map((m) => Number(m[1])),
    ),
    freeTrialMentioned: /\bfree trial\b/i.test(text),
    freemiumSignals: contexts(text, /\$0\b|\bfree plan\b|\bfree forever\b|\bfree tier\b/gi, 10),
    videoTags: (noScript.match(/<video\b/gi) ?? []).length,
    videoEmbeds: uniq(
      [...noScript.matchAll(/<iframe\b[^>]*src=["']([^"']*(?:youtube|vimeo|wistia|loom)[^"']*)["']/gi)].map(
        (m) => m[1],
      ),
    ).slice(0, 5),
    gifs: (html.match(/\.gif\b/gi) ?? []).length,
    testimonials: tagTexts(noScript, "blockquote", 8),
    borderRadii,
  };
}

/**
 * The signals, formatted for a prompt.
 *
 * Presented as MEASURED FACTS and labelled as such, so the model treats them as
 * evidence to reason from rather than as more prose to summarise.
 */
export function signalsBlock(s: Signals): string {
  const list = (label: string, xs: (string | number)[], max = 8) =>
    xs.length ? `${label}: ${xs.slice(0, max).map(String).join(" | ")}` : `${label}: none found`;

  return [
    `--- MEASURED FROM THE RENDERED PAGE (counts and quotes, not impressions) ---`,
    `title: ${s.title || "none"}`,
    list("headings in order", s.headings, 14),
    list("CTA labels", s.ctas, 10),
    list("nav links", s.navLinks.map((l) => `${l.text} -> ${l.href}`), 10),
    list("price tokens in context", s.prices, 10),
    list("per-unit pricing", s.perUnitPricing, 5),
    list("numeric social proof", s.socialProofNumbers, 6),
    list("star ratings", s.starRatings, 5),
    `star glyph count: ${s.starGlyphs}`,
    list("trial lengths in days", s.trialDays, 5),
    `"free trial" appears: ${s.freeTrialMentioned}`,
    list("freemium signals", s.freemiumSignals, 5),
    `video tags: ${s.videoTags} · embeds: ${s.videoEmbeds.length} · gifs: ${s.gifs}`,
    list("testimonial blockquotes", s.testimonials, 4),
    list("border-radius declarations", s.borderRadii, 10),
  ].join("\n");
}
