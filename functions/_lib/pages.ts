/**
 * Reading a site as MARKDOWN, for the audit.
 *
 * Separate from crawl.ts on purpose. That module reads a company — a wide,
 * shallow sweep across about/news/investors/careers, flattened to plain text,
 * built to answer "who are these people". This one reads a *page*, deeply and
 * structurally, to answer "does this page follow rule 14".
 *
 * WHY MARKDOWN AND NOT TEXT. crawl.ts pipes context.dev's markdown through
 * toText(), which strips headings, lists, links and tables down to a flat
 * paragraph. For most of what the ranker asked, that was fine. For this it is
 * fatal: half these rules are about STRUCTURE. "Between three and five plans"
 * is a question about a table. "Lead with three benefits" is a question about a
 * list near the top. "A CTA in the upper-right quadrant" needs the nav to still
 * look like a nav. Flattened, all of that becomes an undifferentiated wall of
 * sentences and the model is left guessing — which is exactly what the guessing
 * looked like in the output.
 *
 * So context.dev is the PRIMARY source here rather than a fallback, and its
 * markdown is preserved rather than parsed away.
 */

/** The pages these rules can actually be answered from. */
const WANTED: { label: string; match: RegExp }[] = [
  { label: "Pricing", match: /\/(pricing|plans|price)\/?$/i },
  { label: "Product", match: /\/(product|platform|features|solutions?|how-it-works)\/?$/i },
];

/** Cap per page. Markdown is denser than the text it replaces, so this buys more. */
const PER_PAGE = 7_000;

export interface PageRead {
  label: string;
  url: string;
  markdown: string;
}

export interface SiteMarkdown {
  /** Every page, headed and concatenated, ready to drop into a prompt. */
  pages: string;
  /** What was actually read, for the progress log and the scan wireframe. */
  read: PageRead[];
  finalUrl: string;
  /** The homepage came back with almost nothing. Usually a client-side shell. */
  thin: boolean;
  /** A pricing page or section was found AND its prices were readable. */
  hasPricing: boolean;
  /**
   * Pricing was located but did not render to markdown — a slider, a widget,
   * a client-side table. Distinct from having no pricing at all, and the report
   * says which, because they are different facts about a company.
   */
  pricingUnreadable: boolean;
}

/**
 * Strip CSS that context.dev's converter sometimes leaves behind as prose.
 *
 * Found live on a Gatsby build: the converter removed the <style> tags but left
 * ten thousand characters of `.styles-module--title{...}` in the body, where it
 * reads as content. Real page prose contains no `{`/`}` blocks at all, so this
 * is a no-op on a normal page.
 */
const stripCss = (md: string): string =>
  md
    .replace(/@import\s+url\([^)]*\)[^;]*;/gi, " ")
    .replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, " ")
    .replace(/[^{}\n]{0,200}\{[^{}]*\}/g, " ");

/**
 * Trim the furniture markdown converters bring with them.
 *
 * Cookie banners, skip links and image-only lines are noise in every page and
 * they eat the character budget the pricing table needs.
 */
const tidy = (md: string): string =>
  md
    .replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, "")
    .replace(/^\s*\[skip to (main )?content\]\([^)]*\)\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

async function scrape(url: string, key: string, timeoutMs = 20_000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://api.context.dev/v1/web/scrape/markdown?url=${encodeURIComponent(url)}`,
      { signal: controller.signal, headers: { authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; markdown?: string };
    if (!body.success || !body.markdown) return null;
    const md = tidy(stripCss(body.markdown));
    return md ? md.slice(0, PER_PAGE) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Absolute, same-host links from the homepage markdown.
 *
 * FRAGMENTS ARE KEPT. They used to be stripped, and that quietly halved the
 * audit for a whole class of site: plenty of early-stage startups put their
 * plans on the homepage under /#pricing rather than on a page of their own —
 * plausible.io does, and plausible.io/pricing is a 404. Dropping the fragment
 * turned that link into "/" and the pricing page was declared missing, which
 * took thirteen of the twenty-three checks out of the run without a word.
 */
function linksFrom(markdown: string, origin: string): string[] {
  const out = new Set<string>();
  for (const m of markdown.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    try {
      const u = new URL(href, origin);
      if (u.origin === origin) out.add(u.href);
    } catch {
      /* a relative oddity or a mailto — not a page */
    }
  }
  return [...out];
}

/**
 * Actual price evidence — a currency and a number, or an explicit free tier.
 *
 * Finding a link called "Pricing" is NOT the same as being able to read the
 * plans, and conflating the two is expensive: plausible.io renders its plans
 * from a slider, so the anchor is there and the markdown has no prices in it.
 * Scored on the anchor alone, every pricing check failed for want of evidence
 * and a well-priced product was graded E. A check we cannot see must leave the
 * run, not score zero.
 */
const PRICE_EVIDENCE =
  /(\$|€|£)\s?\d|\d+\s?(usd|eur|gbp)\b|\bper (month|year|seat|user)\b|\bfree (forever|plan|tier)\b/i;

/** Pricing on the homepage: an anchor to it, or a heading for it. */
const PRICING_ANCHOR = /#(pricing|plans|price)$/i;
const PRICING_HEADING = /^#{1,4}\s.*\b(pricing|plans|choose your plan)\b/im;

function pricingOnHomepage(home: string, links: string[]): boolean {
  return links.some((l) => PRICING_ANCHOR.test(l)) || PRICING_HEADING.test(home);
}

/**
 * Read a site as markdown: homepage first, then the pages these rules need.
 *
 * The homepage is fetched first and alone, because its links are how the
 * pricing page is found. Everything after it goes in parallel — they are
 * independent GETs against a host we are already talking to.
 */
export async function readSiteMarkdown(host: string, key?: string): Promise<SiteMarkdown> {
  const origin = `https://${host}`;
  const empty: SiteMarkdown = {
    pages: "",
    read: [],
    finalUrl: origin,
    thin: true,
    hasPricing: false,
    pricingUnreadable: false,
  };
  if (!key) return empty;

  const home = await scrape(origin, key);
  // Under ~400 characters of markdown is a shell, not a homepage.
  if (!home || home.length < 400) return { ...empty, thin: !home || home.length < 400 };

  const read: PageRead[] = [{ label: "Homepage", url: origin, markdown: home }];

  const links = linksFrom(home, origin);
  const targets: { label: string; url: string }[] = [];
  for (const want of WANTED) {
    const hit = links.find((l) => want.match.test(new URL(l).pathname));
    if (hit) targets.push({ label: want.label, url: hit });
  }

  // Pricing may already be ON the homepage, under an anchor. In that case the
  // markdown we have is the pricing evidence and there is nothing more to
  // fetch — worth checking BEFORE spending a credit on a guessed /pricing that
  // is very likely a 404.
  const inlinePricing = !targets.some((t) => t.label === "Pricing") && pricingOnHomepage(home, links);
  if (!targets.some((t) => t.label === "Pricing") && !inlinePricing) {
    targets.push({ label: "Pricing", url: `${origin}/pricing` });
  }

  const fetched = await Promise.all(
    targets.slice(0, 3).map(async (t) => ({ ...t, markdown: await scrape(t.url, key) })),
  );
  for (const f of fetched) {
    if (f.markdown) read.push({ label: f.label, url: f.url, markdown: f.markdown });
  }

  const pages = read.map((p) => `## ${p.label} — ${p.url}\n\n${p.markdown}`).join("\n\n---\n\n");
  // Somewhere to look for pricing...
  const pricingFound = inlinePricing || read.some((p) => p.label === "Pricing");
  // ...AND something readable when we looked.
  const hasPricing = pricingFound && PRICE_EVIDENCE.test(pages);

  return {
    pages,
    read,
    finalUrl: origin,
    thin: false,
    hasPricing,
    /** Pricing exists but did not render to markdown — usually a JS widget. */
    pricingUnreadable: pricingFound && !hasPricing,
  };
}
