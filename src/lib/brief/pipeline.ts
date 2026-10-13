/**
 * The briefing pipeline: Exa entity (+ homepage fallback), then one Jev
 * judgement over the factsheet metrics. Shared by the Pages Function, the
 * fixture capture script and (types only) the client. Web platform APIs
 * only — fetch, AbortSignal, Date — so it runs unchanged in Workers and
 * Node.
 */
import { TypeSafeClient, type EntryType } from "@typesafe-ai/sdk";

import { facts } from "./facts.ts";
import {
  entityAccepted,
  interpret,
  resultHost,
  shapeHome,
  type Briefing,
  type Firmo,
  type JevOutput,
} from "./interpret.ts";
import { questionsFor } from "./questions.ts";

export type BriefEvent =
  | { t: "stage"; id: "exa.entity" | "jev"; ms: number; ok: boolean; cost?: number; tokens?: number }
  | { t: "notice"; code: "exa_down" | "exa_budget" | "jev_down" };

export interface RunResult {
  brief: Briefing;
  /** The resolved firmo (name may come from the Exa entity on typed lookups). */
  firmo: Firmo;
  exaCost: number;
  jevTokens: number | null;
  totalMs: number;
  notices: string[];
  /** Hostname of a rejected entity best-match, when the entity was dropped. */
  rejectedHost: string | null;
  raw: { entity: unknown; jev: unknown; home: unknown };
}

export interface RunOpts {
  domain: string;
  /** Known company name (Spotter or fixture); undefined for typed lookups. */
  name?: string;
  firmo?: Partial<Firmo>;
  exaKey?: string;
  jevKey?: string;
  /** Monthly budget already spent; skips Exa with an exa_budget notice. */
  exaBudget?: boolean;
  emit: (e: BriefEvent) => void;
}

interface ExaResult {
  results?: {
    title?: string;
    url?: string;
    highlights?: string[];
    entities?: { properties?: Record<string, unknown> }[];
  }[];
  costDollars?: { total?: number };
}

const exa = async (exaKey: string, body: Record<string, unknown>, endpoint = "https://api.exa.ai/search"): Promise<ExaResult & { ms: number }> => {
  const t = Date.now();
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "x-api-key": exaKey, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as ExaResult & { error?: string };
  if (!r.ok) throw new Error(`Exa ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return { ...j, ms: Date.now() - t };
};

/** Second-level label in title case: "foo-bar.example.com" -> "Foo Bar". */
const domainLabel = (d: string): string => {
  const parts = d.split(".");
  const l = (parts.length > 1 ? parts[parts.length - 2] : parts[0]) || d;
  return l
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
};

export async function runBrief(opts: RunOpts): Promise<RunResult> {
  const { domain, exaKey, jevKey, emit } = opts;
  const t0 = Date.now();
  const now = new Date();
  const firmo: Firmo = {
    name: opts.name ?? domain,
    domain,
    industry: null,
    size: null,
    founded: null,
    city: null,
    country: null,
    source: "typed",
    ...opts.firmo,
  };
  // firmo.name is a domain placeholder unless a real name was provided, so
  // the label fallback applies whenever opts.name is absent.
  let name = opts.name ?? (opts.firmo?.name && opts.firmo.name !== domain ? opts.firmo.name : domainLabel(domain));

  const notices: string[] = [];
  const notice = (code: "exa_down" | "exa_budget" | "jev_down") => {
    if (!notices.includes(code)) {
      notices.push(code);
      emit({ t: "notice", code });
    }
  };

  let entityRaw: (ExaResult & { ms?: number }) | null = null;
  let homeRaw: (ExaResult & { ms?: number }) | null = null;
  let jevRaw: JevOutput | null = null;
  let rejectedHost: string | null = null;
  let exaCost = 0;
  let jevTokens: number | null = null;

  const runEntity = async (): Promise<(ExaResult & { ms: number }) | null> => {
    const t = Date.now();
    try {
      const r = await exa(exaKey as string, {
        query: `${name} (${domain})`,
        type: "fast",
        category: "company",
        numResults: 1,
        contents: { highlights: true },
      });
      let cost = r.costDollars?.total ?? 0;
      // The best match must actually BE the domain; when it is not (or there
      // is no entity), describe the company from its own homepage instead.
      if (!entityAccepted(domain, r)) {
        rejectedHost = resultHost(r);
        try {
          homeRaw = await exa(exaKey as string, { urls: [`https://${domain}`], highlights: { query: "what this company does", maxCharacters: 300, numSentences: 2 } }, "https://api.exa.ai/contents");
          cost += homeRaw.costDollars?.total ?? 0;
        } catch {
          homeRaw = null;
        }
      }
      emit({ t: "stage", id: "exa.entity", ms: Date.now() - t, ok: true, cost });
      return r;
    } catch {
      emit({ t: "stage", id: "exa.entity", ms: 0, ok: false });
      notice("exa_down");
      return null;
    }
  };

  if (opts.exaBudget) {
    notice("exa_budget");
    emit({ t: "stage", id: "exa.entity", ms: 0, ok: false });
  } else if (!exaKey) {
    notice("exa_down");
    emit({ t: "stage", id: "exa.entity", ms: 0, ok: false });
  } else {
    entityRaw = await runEntity();
    if (firmo.source !== "spotter" && entityAccepted(domain, entityRaw)) {
      // Typed/self lookup: the accepted entity's name wins; otherwise the
      // request name, then the domain label.
      const p = entityRaw?.results?.[0]?.entities?.[0]?.properties;
      name = (p?.name as string | undefined) ?? entityRaw?.results?.[0]?.title ?? name;
    }
  }
  firmo.name = name;
  exaCost = (entityRaw?.costDollars?.total ?? 0) + (homeRaw?.costDollars?.total ?? 0);

  const accepted = entityAccepted(domain, entityRaw);
  const home = accepted ? null : shapeHome(homeRaw);
  const f = facts(accepted ? entityRaw : null, home, firmo, now);

  // No point paying for Jev when the lookup produced nothing to read.
  const skipJev = !accepted && !home;
  if (!jevKey || skipJev) {
    notice("jev_down");
    emit({ t: "stage", id: "jev", ms: 0, ok: false });
  } else {
    const state = {
      company: {
        name,
        domain,
        industry: f.industry ?? firmo.industry,
        type: f.type,
        founded: f.founded ?? firmo.founded,
      },
      metrics: {
        staff: f.staff,
        headcount_yoy_pct: f.hcYoY != null ? Math.round(f.hcYoY * 10) / 10 : null,
        revenue_usd: f.revenue,
        revenue_per_head_usd: f.revPerHead,
        funding_total_usd: f.fundingTotal,
        months_since_last_raise: f.monthsSinceRaise,
        visits_monthly: f.visitsMonthly,
        traffic_change_6mo_pct: f.traffic6mo != null ? Math.round(f.traffic6mo) : null,
        stack_tools: f.stackCount,
        offices: f.offices.length,
        countries: f.countries,
      },
    };
    const { q } = questionsFor(name);
    const t = Date.now();
    try {
      const result = await new TypeSafeClient({ apiKey: jevKey }).systemOne(
        { model: "jev-latest", state: state as unknown as EntryType, questions: q },
        { signal: AbortSignal.timeout(8000) },
      );
      jevRaw = result as JevOutput;
      jevTokens = result.usage?.input_tokens ?? null;
      emit({ t: "stage", id: "jev", ms: Date.now() - t, ok: true, tokens: jevTokens ?? undefined });
    } catch {
      emit({ t: "stage", id: "jev", ms: Date.now() - t, ok: false });
      notice("jev_down");
    }
  }

  const brief = interpret({ firmo, entityRaw: accepted ? entityRaw : null, home, jev: jevRaw, now });
  return {
    brief,
    firmo,
    exaCost,
    jevTokens,
    totalMs: Date.now() - t0,
    notices,
    rejectedHost,
    raw: { entity: entityRaw, jev: jevRaw, home: homeRaw },
  };
}
