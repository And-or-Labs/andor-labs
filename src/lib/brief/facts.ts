/**
 * The factsheet numbers: a tolerant digest of the Exa company entity
 * (entities[0].properties plus the joined highlights text), the homepage
 * /contents fallback and the Snitcher firmo. Pure: no DOM, no Node APIs,
 * no network; every field optional, never throws. All arithmetic happens
 * here so nothing downstream has to parse or compute.
 */
import type { Firmo } from "./interpret.ts";

export interface Facts {
  name: string | null;
  domain: string;
  oneLiner: string | null;
  city: string | null;
  /** Short form: "United States" -> "US", "Canada" stays. */
  country: string | null;
  founded: number | null;
  /** "Private" | "Public" | null (Partnership/Nonprofit etc. are omitted). */
  type: string | null;
  industry: string | null;
  staff: number | null;
  /** Yearly headcount growth, percent. */
  hcYoY: number | null;
  /** "51-200". */
  sizeBand: string | null;
  revenue: number | null;
  revPerHead: number | null;
  fundingTotal: number | null;
  latestRound: { name: string; date: string; amount: number | null } | null;
  /** Whole months from the latest round's date to `now`. */
  monthsSinceRaise: number | null;
  visitsMonthly: number | null;
  avgVisitSec: number | null;
  /** Monthly visit values in date order (oldest first). */
  trafficHistory: number[];
  /** (last-first)/first*100 over the traffic history. */
  traffic6mo: number | null;
  /** Sparkline, one glyph per month. */
  spark: string | null;
  stackCount: number | null;
  stackTop: string[];
  /** Office cities, HQ first, max 3. */
  offices: string[];
  /** "distributed across N countries". */
  countries: number | null;
}

/* ---------- raw shapes (all optional, nothing trusted) ---------- */

interface RawResult {
  title?: string;
  url?: string;
  highlights?: string[];
  entities?: { properties?: Record<string, unknown> }[];
}
interface RawEntityResponse {
  results?: RawResult[];
}
interface HomePage {
  description: string;
  sourceUrl: string | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);

const COUNTRY_SHORT: Record<string, string> = {
  "united states": "US",
  "united states of america": "US",
  "united kingdom": "UK",
};
const countryShort = (c: string | null) => (c ? (COUNTRY_SHORT[c.toLowerCase()] ?? c) : null);

/* ---------- highlight text parsing ---------- */

/** A "- Key: value" line out of the highlights blob. */
const field = (blob: string, key: string): string | null => {
  const m = blob.match(new RegExp(`-\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*([^\\n]+)`));
  return m ? m[1].trim() : null;
};

const COUNTRIES = new Set(
  `united states,canada,united kingdom,australia,netherlands,india,singapore,germany,israel,ireland,france,spain,belgium,philippines,uruguay,serbia,argentina,colombia,poland,sweden,denmark,brazil,mexico,japan,ukraine,portugal,italy,switzerland,austria,new zealand,south africa,czechia,romania,lithuania,estonia,latvia,norway,finland,greece,croatia,hong kong,south korea,united arab emirates,nigeria,kenya,egypt,turkey,indonesia,vietnam,thailand,malaysia,chile,peru,costa rica,luxembourg,malta,cyprus,iceland`
    .split(","),
);
const isCountry = (tok: string) => {
  const t = tok.trim().toLowerCase().replace(/\s*\([a-z]{2}\)\s*$/, "");
  return /\([a-z]{2}\)\s*$/.test(tok.trim().toLowerCase()) || COUNTRIES.has(t);
};

const titleWord = (w: string) =>
  w
    .split("-")
    .map((p) => (p.length === 1 ? p.toUpperCase() : p ? p[0].toUpperCase() + p.slice(1) : p))
    .join("-");
const titleCase = (s: string) => s.split(/\s+/).map(titleWord).join(" ");

/** Office groups are "city, region, country" runs; the city is the first
    token unless it looks like a street address (contains a digit). */
const officeCities = (line: string, hqCity: string | null): string[] => {
  const toks = line
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const cities: string[] = [];
  let group: string[] = [];
  const closeGroup = () => {
    if (!group.length) return;
    let city = group[0];
    if (/\d/.test(city) && group.length > 1) city = group[1];
    if (city && !isCountry(city)) cities.push(city);
    group = [];
  };
  for (const t of toks) {
    if (isCountry(t)) {
      closeGroup();
      continue;
    }
    group.push(t);
  }
  closeGroup();
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (c: string | null) => {
    if (!c) return;
    const k = c.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(titleCase(c));
  };
  push(hqCity); // HQ first
  for (const c of cities) push(c);
  return out.slice(0, 3);
};

const GENERIC_STACK = new Set(
  `css,html,dom,javascript,typescript,sql,python,react,redux,nodejs,prototype,iam,chrome,github,github actions,kubernetes,pytorch,snappy,google workspace,sentient`.split(","),
);
const STACK_CASE: Record<string, string> = {
  salesforce: "Salesforce",
  hubspot: "HubSpot",
  braze: "Braze",
  dbt: "dbt",
  grpc: "gRPC",
  amplitude: "Amplitude",
  mixpanel: "Mixpanel",
  webflow: "Webflow",
  "google tag manager": "Google Tag Manager",
  "linkedin sales navigator": "LinkedIn Sales Navigator",
  stripe: "Stripe",
  openai: "OpenAI",
  segment: "Segment",
  intercom: "Intercom",
  zendesk: "Zendesk",
  marketo: "Marketo",
  gong: "Gong",
  outreach: "Outreach",
};

const SPARK_CHARS = "▁▂▃▄▅▆▇█";
const sparkOf = (vals: number[]): string | null => {
  if (vals.length < 2) return null;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi === lo) return SPARK_CHARS[3].repeat(vals.length);
  return vals.map((v) => SPARK_CHARS[Math.round(((v - lo) / (hi - lo)) * 7)]).join("");
};

/** First sentence of a longer text. Highlights often repeat the page's
    tagline as a heading then as copy ("X. X. Founded by...") with no
    sentence terminator in between; cut at the repeat when that happens. */
const firstSentence = (s: string): string | null => {
  const t = s.replace(/\s+/g, " ").trim();
  for (let len = 20; len <= 90 && len < t.length; len++) {
    const p = t.slice(0, len);
    for (const sep of [1, 2]) {
      if (/^\s+$/.test(t.slice(len, len + sep)) && t.slice(len + sep, len + sep + len) === p) return p;
    }
  }
  const m = t.match(/^(.{20,}?[.!?])(?:\s|$)/);
  return m ? m[1] : t || null;
};

export function facts(entityRaw: unknown, home: HomePage | null, firmo: Firmo, now: Date): Facts {
  const res: RawResult | null = (entityRaw as RawEntityResponse | null)?.results?.[0] ?? null;
  const props = obj(res?.entities?.[0]?.properties) ?? {};
  const blob = (res?.highlights ?? []).join("\n");

  // oneLiner: the sentence after "<Name> is a <industry> company." in the
  // first highlight chunk; else first sentence of the entity description,
  // then the homepage description.
  let oneLiner: string | null = null;
  const chunk0 = blob.split(/\n\.{3,}\n|\n\n|\.\.\.\s*\n/)[0] ?? "";
  const intro = chunk0.match(/^.{0,80}?\bis an?\b[^.]*\.\s+/);
  if (intro) {
    const rest = chunk0.slice(intro[0].length);
    oneLiner = firstSentence(rest);
  }
  if (!oneLiner) {
    const d = str(props.description) ?? home?.description ?? null;
    if (d) oneLiner = firstSentence(d);
  }
  if (oneLiner) {
    oneLiner = oneLiner.replace(/[—–]/g, "-").trim();
    // "Descript is an AI video editor..." -> "AI video editor..."
    const name = str(props.name) ?? firmo.name;
    oneLiner = oneLiner.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:is|are|was)\\s+(?:a|an|the)\\s+`, "i"), "");
    oneLiner = oneLiner.charAt(0).toUpperCase() + oneLiner.slice(1);
    if (oneLiner.length > 110) {
      const cut = oneLiner.slice(0, 110);
      const sp = cut.lastIndexOf(" ");
      oneLiner = `${(sp > 0 ? cut.slice(0, sp) : cut).trimEnd()}\u2026`;
    }
  }

  const hq = obj(props.headquarters);
  const fin = obj(props.financials);
  const wf = obj(props.workforce);
  const wt = obj(props.webTraffic);

  // text fallbacks from the highlight blob
  const typeRaw = field(blob, "Type");
  const type = typeRaw ? (/privately held/i.test(typeRaw) ? "Private" : /public/i.test(typeRaw) ? "Public" : null) : null;
  let industry = field(blob, "Industry");
  if (!industry) {
    const m = chunk0.match(/\bis an?\s+([^.,]{2,60}?)\s+company\b/i);
    industry = m ? m[1].trim() : null;
  }
  const sizeM = (field(blob, "Company Size") ?? "").match(/[\d,]+\s*[-–]\s*[\d,]+|\d+\+/);
  const sizeBand = sizeM ? sizeM[0].replace(/\s+/g, "").replace(/–/g, "-") : null;
  let hcYoY = num((field(blob, "Yearly Growth") ?? "").match(/[+-]?[\d.]+/)?.[0]);
  if (hcYoY == null) hcYoY = num(chunk0.match(/\(([+-]?[\d.]+)%\s*YoY/i)?.[1]);

  let staff = num(wf?.total);
  if (staff == null) staff = num(chunk0.match(/employs\s+([\d,]+)\s+people/i)?.[1]);

  let revenue = num(fin?.revenueAnnual);
  if (revenue == null) {
    const m = chunk0.match(/annual revenue of \$([\d.]+)\s*([MB])/i);
    if (m) revenue = parseFloat(m[1]) * (m[2].toUpperCase() === "B" ? 1e9 : 1e6);
  }
  let fundingTotal = num(fin?.fundingTotal);
  if (fundingTotal == null) {
    const m = blob.match(/Total Funding:\s*(?:USD|US\$|\$)?\s*([\d,.]+)\s*([MB])?/i);
    if (m) fundingTotal = parseFloat(m[1].replace(/,/g, "")) * (m[2]?.toUpperCase() === "B" ? 1e9 : m[2]?.toUpperCase() === "M" ? 1e6 : 1);
  }
  const lr = obj(fin?.fundingLatestRound);
  const latestRound = lr
    ? { name: titleCase(str(lr.name) ?? "Round"), date: str(lr.date) ?? "", amount: num(lr.amount) }
    : null;
  let monthsSinceRaise: number | null = null;
  if (latestRound?.date) {
    const d = new Date(latestRound.date);
    if (!isNaN(+d)) monthsSinceRaise = Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
  }
  let founded = num(props.foundedYear);
  if (founded == null) founded = num(chunk0.match(/founded in (\d{4})/i)?.[1]);

  const hist = Array.isArray(wt?.history)
    ? (wt.history as { value?: unknown; dateFrom?: string }[])
        .map((h) => ({ v: num(h.value), d: str(h.dateFrom) ?? "" }))
        .filter((h): h is { v: number; d: string } => h.v != null)
        .sort((a, b) => a.d.localeCompare(b.d))
        .map((h) => h.v)
    : [];
  const traffic6mo = hist.length >= 2 && hist[0] > 0 ? ((hist[hist.length - 1] - hist[0]) / hist[0]) * 100 : null;

  let stackCount: number | null = null;
  let stackTop: string[] = [];
  const stackM = blob.match(/Tech Stack(?:\s*\(showing\s*[\d,]+\s*of\s*([\d,]+)\))?\s*:\s*([^\n]+)/i);
  if (stackM) {
    const list = stackM[2].split(",").map((t) => t.trim()).filter(Boolean);
    stackCount = stackM[1] ? num(stackM[1]) : list.length;
    stackTop = list
      .filter((t) => !GENERIC_STACK.has(t.toLowerCase()))
      .slice(0, 4)
      .map((t) => STACK_CASE[t.toLowerCase()] ?? titleCase(t.toLowerCase()));
  }

  const offLine = field(blob, "Offices");
  const hqCity = str(hq?.city);
  const offices = offLine ? officeCities(offLine, hqCity) : hqCity ? [hqCity] : [];

  const countries = num(blob.match(/distributed across\s+(\d+)\s+countries/i)?.[1]);

  return {
    name: str(props.name) ?? firmo.name ?? null,
    domain: firmo.domain,
    oneLiner,
    city: hqCity,
    country: countryShort(str(hq?.country)),
    founded,
    type,
    industry,
    staff,
    hcYoY,
    sizeBand,
    revenue,
    revPerHead: revenue != null && staff != null && staff > 0 ? Math.round(revenue / staff) : null,
    fundingTotal,
    latestRound,
    monthsSinceRaise,
    visitsMonthly: num(wt?.visitsMonthly),
    avgVisitSec: num(wt?.avgDurationSeconds),
    trafficHistory: hist,
    traffic6mo,
    spark: sparkOf(hist),
    stackCount,
    stackTop,
    offices,
    countries,
  };
}

/** How many of the sheet's printable fields have data — the "N data
    points" line in the run log. monthsSinceRaise is verdict-only, so it
    does not count; name is identity, not a data point. */
export function dataPoints(f: Facts): number {
  let n = 0;
  for (const v of [
    f.oneLiner, f.city, f.country, f.founded, f.type, f.industry,
    f.staff, f.hcYoY, f.sizeBand, f.revenue, f.revPerHead,
    f.fundingTotal, f.latestRound, f.visitsMonthly, f.avgVisitSec,
    f.traffic6mo, f.spark, f.stackCount, f.countries,
  ]) {
    if (v != null) n++;
  }
  if (f.stackTop.length) n++;
  if (f.offices.length) n++;
  return n;
}
