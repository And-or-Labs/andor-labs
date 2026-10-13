/**
 * Turn the raw pipeline results (Snitcher firmographics + Exa entity/home +
 * Jev's verdict) into the Briefing object the client prints. Pure: no DOM,
 * no Node APIs, no network.
 */
import { facts, type Facts } from "./facts.ts";
import { verdictLine, NETWORK_LINE, type VerdictKey } from "./verdict.ts";

export interface Firmo {
  name: string;
  domain: string;
  industry: string | null;
  size: string | null;
  founded: number | string | null;
  city: string | null;
  country: string | null;
  source: "spotter" | "typed";
}

/** Loose view over systemOne answers. */
export interface JevOutput {
  model?: string;
  answers: Record<string, { noul?: number; choice?: string; confidence?: number }>;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface Briefing {
  subject: { name: string; domain: string };
  facts: Facts;
  /** Jev's read; null when Jev never ran. */
  verdict: { key: VerdictKey | "network" | "too_early"; line: string; p: number | null } | null;
}

interface RawExaResult {
  results?: {
    title?: string;
    url?: string;
    highlights?: string[];
    entities?: { properties?: Record<string, unknown> }[];
  }[];
}

const host = (u: string) => {
  try {
    return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Hostname (minus www.) of an Exa search response's first result. */
export const resultHost = (raw: unknown): string | null => {
  const u = (raw as RawExaResult | null)?.results?.[0]?.url;
  const h = u ? host(u) : "";
  return h || null;
};

/** An Exa company entity only counts when its URL's host IS the looked-up
    domain (or a sub-domain of it). */
export const entityAccepted = (domain: string, raw: unknown): boolean => {
  const h = resultHost(raw);
  return !!h && (h === domain || h.endsWith(`.${domain}`));
};

/** Drop a leading "<page title> | " segment when the following text then
    repeats itself (highlights echo the <title> before the real copy). */
const stripTitlePrefix = (t: string): string => {
  const m = t.match(/^[^|]{2,80}\|\s*(.+)$/s);
  if (!m) return t;
  const rest = m[1];
  const head = rest.slice(0, 20);
  return head.length === 20 && rest.indexOf(head, 20) > -1 ? rest : t;
};

/** Shape a raw Exa /contents homepage response into {description, sourceUrl}. */
export const shapeHome = (raw: unknown): { description: string; sourceUrl: string | null } | null => {
  const res = (raw as RawExaResult | null)?.results?.[0];
  const text = (res?.highlights ?? [])
    .map((h) => h.replace(/(^|\n)\s*#{1,6}\s+/g, "$1"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? { description: stripTitlePrefix(text), sourceUrl: res?.url ?? null } : null;
};

export function interpret(opts: {
  firmo: Firmo;
  /** Raw Exa entity response; already host-checked by the caller. */
  entityRaw: unknown;
  /** Homepage /contents fallback used when the entity was rejected/absent. */
  home?: { description: string; sourceUrl: string | null } | null;
  jev: JevOutput | null;
  now?: Date;
}): Briefing {
  const { firmo, jev } = opts;
  const f = facts(opts.entityRaw, opts.home ?? null, firmo, opts.now ?? new Date());

  let verdict: Briefing["verdict"] = null;
  if (jev) {
    const networkP = jev.answers.is_network_operator?.noul ?? 0;
    if (networkP >= 0.5) {
      verdict = { key: "network", line: NETWORK_LINE, p: null };
    } else {
      const key = (jev.answers.verdict?.choice ?? "too_early") as VerdictKey;
      const p = jev.answers.verdict?.confidence ?? null;
      verdict = { key, line: verdictLine(key, f), p };
    }
  } else {
    verdict = { key: "too_early", line: verdictLine("too_early", f), p: null };
  }

  return {
    subject: { name: firmo.name, domain: firmo.domain },
    facts: f,
    verdict,
  };
}
