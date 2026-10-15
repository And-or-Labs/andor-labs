/**
 * Visitor briefing: Snitcher Spotter -> /api/brief (Exa entity + Jev verdict),
 * printed as a factsheet onto the DOM paper by the ribbon printer in
 * teletype.ts. Lives inside the transition:persist .viz aside, so the same
 * DOM node and this module survive ClientRouter navigation. Init runs on
 * astro:page-load; the flow activates only on home and only once per session.
 */
import { trackError, trackOps } from "./analytics.ts";
import { consentState } from "./consent.ts";
import { mount, type BarHandle, type BarKind, type Sheet } from "./teletype.ts";
import { dataPoints } from "../lib/brief/facts.ts";
import type { Briefing } from "../lib/brief/interpret.ts";
import type { BriefEvent } from "../lib/brief/pipeline.ts";
import { entryLine, fmtWhen, printout, wrap, type Line, type LogEntry } from "../lib/brief/printout.ts";

/** Public profile id: it sits in the live HTML via GTM already. */
const SNITCHER_PROFILE = "s1hZTV3y04";
const SELF = { domain: "andorlabs.ca", name: "And/or Labs" } as const;
const SESSION_KEY = "brief:printed";

interface SnitcherRecord {
  name?: string;
  website?: string;
  domain?: string;
  industry?: string;
  size?: string;
  city?: string;
  country?: string;
  type?: string;
  last_seen?: string;
  address?: { city?: string; country?: string };
}
interface SpotterResult {
  success?: boolean;
  type?: string;
  data?: SnitcherRecord;
}
interface SnitcherStub {
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  initialized?: boolean;
  getSpotterIdentification?: () => Promise<SpotterResult | undefined>;
  _loaded?: boolean;
}
declare global {
  interface Window {
    Snitcher?: SnitcherStub;
  }
}

type RunKind = "spotter" | "typed" | "self";

const zleep = (ms: number, s: AbortSignal) =>
  new Promise<void>((res, rej) => {
    if (s.aborted) return rej(new DOMException("aborted", "AbortError"));
    const t = setTimeout(() => res(), ms);
    s.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        rej(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
const host = (u: string) => {
  try {
    return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

interface Refs {
  root: HTMLElement;
  tty: Sheet;
}

let ctl: AbortController | null = null;
let done = false;
let runWhen = new Date();

function refsOf(root: HTMLElement): Refs {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel) as T;
  return {
    root,
    tty: mount(q("[data-tty]")),
  };
}

/* ---------- Bar ---------- */

/* ---------- Session ---------- */

/** The last sheet's logical (unwrapped) factsheet lines; re-wrapped to the
    pane width on restore. The run log persists as entries and is rebuilt
    at the current width. */
let lastLogical: Line[] = [];

function saveSession(rc: RunCtx) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ v: 8, log: rc.log, sheet: lastLogical }));
  } catch {
    // Private mode etc: the session restore is a nicety, not a requirement.
  }
}

function restoreSession(r: Refs): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as { v?: number; log?: LogEntry[]; sheet?: Line[] };
    if (s.v !== 8 || !Array.isArray(s.sheet) || !s.sheet.length) return false;
    const cs = r.tty.cols();
    const ls = (s.log ?? []).map((e) => entryLine(e, cs));
    if (ls.length) ls.push({ segs: [{ text: "" }] });
    ls.push(...s.sheet);
    lastLogical = s.sheet;
    r.tty.showInstant(wrap(ls, cs));
    done = true;
    trackOps("brief_restored", { consent: consentState() });
    return true;
  } catch {
    return false;
  }
}

/* ---------- Run plumbing ---------- */

interface BriefPayload {
  t: "brief";
  brief: Briefing;
  totalMs: number;
  exaCost: number;
  jevTokens: number | null;
  rejectedHost?: string | null;
  cached?: boolean;
}

/** One `brief_run` event per run: how far the pipeline got and why.
    Properties are operational only; no visitor or company identifiers. */
type Tm = Record<string, string | number | boolean | null>;

/** Per-run state: the job-log model (persisted) plus live bar handles. */
type BarEntry = Extract<LogEntry, { t: "bar" }>;
interface RunCtx {
  kind: RunKind;
  domain: string;
  log: LogEntry[];
  boxOpen: boolean;
  torn: boolean;
  cached: boolean;
  postAt: number;
  snBar: BarHandle | null;
  snEntry: BarEntry | null;
  exaBar: BarHandle | null;
  exaEntry: BarEntry | null;
  jevBar: BarHandle | null;
  jevEntry: BarEntry | null;
  jevEl: HTMLElement | null;
  jevDone: BarKind | null;
  /** Bars whose finish() has not run yet — settled "failed" on error. */
  pending: Map<BarHandle, BarEntry>;
  tm: Tm;
}

const mkBar = (r: Refs, rc: RunCtx, label: string, tau: number, since: number) => {
  const h = r.tty.bar(label, { tau, since });
  const entry: BarEntry = { t: "bar", label, kind: "ok", fill: 0, ms: null };
  rc.log.push(entry);
  rc.pending.set(h, entry);
  return { h, entry };
};

const settle = async (rc: RunCtx, h: BarHandle, entry: BarEntry, kind: BarKind, ms?: number) => {
  rc.pending.delete(h);
  const { fill } = await h.finish(kind, ms);
  entry.kind = kind;
  entry.fill = fill;
  entry.ms = ms ?? null;
};

async function logLine(r: Refs, rc: RunCtx, text: string, indent = 0) {
  const e: LogEntry = { t: "line", text, indent };
  rc.log.push(e);
  await r.tty.typeLine(entryLine(e, r.tty.cols()), { cps: 60 });
}

async function openBox(r: Refs, rc: RunCtx) {
  if (rc.boxOpen) return;
  rc.boxOpen = true;
  if (rc.torn) {
    const e: LogEntry = { t: "perf" };
    rc.log.push(e);
    await r.tty.typeLine(entryLine(e, r.tty.cols()), { cps: 160 });
  }
  const top: LogEntry = { t: "top", when: fmtWhen(runWhen) };
  rc.log.push(top);
  await r.tty.typeLine(entryLine(top, r.tty.cols()), { cps: 60 });
  await logLine(r, rc, "Initiating intelligence brief");
}

async function closeBox(r: Refs, rc: RunCtx) {
  if (!rc.boxOpen) return;
  const e: LogEntry = { t: "close" };
  rc.log.push(e);
  await r.tty.typeLine(entryLine(e, r.tty.cols()), { cps: 120 });
}

async function finishBrief(r: Refs, s: AbortSignal, rc: RunCtx, pl: BriefPayload) {
  if (s.aborted) return;
  const b = pl.brief;

  // The Exa result line belongs under the Exa bar, which means it has to
  // be inserted above the Jev row — the fact count only exists now.
  const n = dataPoints(b.facts);
  Object.assign(rc.tm, {
    printed: true,
    stage: "printed",
    cached: !!pl.cached,
    server_ms: pl.totalMs,
    data_points: n,
    record_rejected: !!pl.rejectedHost,
    jev: rc.jevDone ?? "none",
    verdict: b.verdict?.p != null,
  });
  const exaEntry: LogEntry = {
    t: "line",
    text: pl.rejectedHost
      ? "Company record not found. Read the homepage instead."
      : `${n} data point${n === 1 ? "" : "s"} on ${b.subject.name}`,
    indent: 1,
  };
  const jevIdx = rc.jevEntry ? rc.log.indexOf(rc.jevEntry) : -1;
  rc.log.splice(jevIdx < 0 ? rc.log.length : jevIdx, 0, exaEntry);
  await r.tty.typeLine(entryLine(exaEntry, r.tty.cols()), { cps: 60, before: rc.jevEl });

  const vp = b.verdict?.p;
  await logLine(
    r,
    rc,
    rc.jevDone === "skipped" || rc.jevDone === "failed"
      ? "Not enough data for a verdict."
      : vp != null
        ? `Verdict in, confidence ${vp.toFixed(2)}`
        : "Verdict in.",
    1,
  );
  await logLine(r, rc, "Printing factsheet");
  await closeBox(r, rc);
  const logical = printout({ brief: b, when: runWhen, totalMs: pl.totalMs, cost: pl.exaCost, cached: pl.cached });
  lastLogical = logical;
  await r.tty.print([{ segs: [{ text: "" }] }, ...wrap(logical, r.tty.cols())], { cps: 40, append: true });
  saveSession(rc);
}

async function consume(r: Refs, s: AbortSignal, resp: Response, rc: RunCtx) {
  const reader = resp.body?.getReader();
  if (!reader) return;
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    if (s.aborted) {
      void reader.cancel();
      return;
    }
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let ev: { t?: string; code?: string };
      try {
        ev = JSON.parse(line) as typeof ev;
      } catch {
        continue;
      }
      if (ev.t === "start") {
        rc.cached = !!(ev as { cached?: boolean }).cached;
        rc.tm.stage = "desk";
        if (!rc.boxOpen) {
          // Typed lookup: the box opens once the desk accepts the domain.
          await openBox(r, rc);
          if (rc.kind === "typed") await logLine(r, rc, `Target set to ${rc.domain}`);
          if (!rc.exaBar) {
            const b = mkBar(r, rc, "Querying Exa", 0.6, rc.postAt);
            rc.exaBar = b.h;
            rc.exaEntry = b.entry;
          }
        }
      } else if (ev.t === "stage") {
        const e = ev as unknown as Extract<BriefEvent, { t: "stage" }>;
        if (e.id === "exa.entity") {
          rc.tm.stage = "jev";
          rc.tm.exa = rc.cached ? "cached" : e.ok ? "ok" : "failed";
          rc.tm.exa_ms = e.ms ?? null;
          if (rc.exaBar && rc.exaEntry)
            await settle(rc, rc.exaBar, rc.exaEntry, rc.cached ? "cached" : e.ok ? "ok" : "failed", e.ms);
          const j = mkBar(r, rc, "Asking Jev for a verdict", 0.3, performance.now());
          rc.jevBar = j.h;
          rc.jevEntry = j.entry;
          rc.jevEl = j.h.el;
        } else if (e.id === "jev") {
          if (rc.jevBar && rc.jevEntry) {
            const kind = rc.cached ? "cached" : e.ok ? "ok" : "skipped";
            await settle(rc, rc.jevBar, rc.jevEntry, kind, e.ms);
            rc.jevDone = kind;
          }
        }
      } else if (ev.t === "brief") {
        await finishBrief(r, s, rc, ev as unknown as BriefPayload);
      } else if (ev.t === "error") {
        rc.tm.desk_error = ev.code ?? "unknown";
        void reader.cancel();
        throw new Error(`desk error: ${ev.code ?? "unknown"}`);
      }
    }
  }
}

/** The /api endpoint itself failed — the function never ran, so nothing
    reached Exa or Jev. */
class DeskError extends Error {
  constructor(public why: string) {
    super(why);
  }
}

async function postBrief(r: Refs, s: AbortSignal, rc: RunCtx, payload: { domain: string; source: "spotter" | "typed"; name?: string; snitcher?: Record<string, unknown> }) {
  rc.domain = payload.domain;
  rc.tm.stage = "request";
  rc.tm.subject = payload.domain === SELF.domain ? "self" : "visitor";
  let resp: Response;
  try {
    resp = await fetch("/api/brief", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: s,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new DeskError("no connection");
  }
  rc.tm.http = resp.status;
  if (!resp.ok) throw new DeskError(`HTTP ${resp.status}`);
  await consume(r, s, resp, rc);
}

/** The Exa bar row goes on the paper the moment the POST leaves. */
async function postWithBar(r: Refs, s: AbortSignal, rc: RunCtx, payload: Parameters<typeof postBrief>[3]) {
  rc.postAt = performance.now();
  const b = mkBar(r, rc, "Querying Exa", 0.6, rc.postAt);
  rc.exaBar = b.h;
  rc.exaEntry = b.entry;
  await postBrief(r, s, rc, payload);
}

/**
 * One run at a time: a new run aborts the in-flight one. `fn` receives the
 * run's AbortSignal; every await between DOM writes is abort-aware.
 */
async function runExclusive(r: Refs, kind: RunKind, fn: (s: AbortSignal, rc: RunCtx) => Promise<void>) {
  ctl?.abort();
  const c = new AbortController();
  ctl = c;
  c.signal.addEventListener("abort", () => r.tty.abortPrint(), { once: true });
  done = false;
  runWhen = new Date();

  const rc: RunCtx = {
    kind,
    domain: "",
    log: [],
    boxOpen: false,
    torn: false,
    cached: false,
    postAt: 0,
    snBar: null,
    snEntry: null,
    exaBar: null,
    exaEntry: null,
    jevBar: null,
    jevEntry: null,
    jevEl: null,
    jevDone: null,
    pending: new Map(),
    tm: { kind, trigger: "initial", consent: consentState(), viewport: innerWidth >= 1280 ? "wide" : "desktop" },
  };
  const t0 = performance.now();

  try {
    if (!r.tty.empty()) {
      rc.torn = true;
      await r.tty.tear();
    }
    await fn(c.signal, rc);
    rc.tm.outcome = c.signal.aborted ? "superseded" : rc.tm.printed ? "printed" : "empty";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      // Superseded: the new run owns the paper.
      rc.tm.outcome = "superseded";
    } else {
      console.warn("[briefing] run failed:", e);
      rc.tm.outcome = "failed";
      rc.tm.error = e instanceof Error ? e.message.slice(0, 80) : "unknown";
      trackError(e, { feature: "briefing", kind: rc.kind, stage: String(rc.tm.stage ?? "unknown") });
      try {
        // Whatever was in flight ends "failed"; close the box, keep the paper.
        for (const [h, ent] of rc.pending) await settle(rc, h, ent, "failed");
        await closeBox(r, rc);
      } catch {
        // Best effort — a dead paper is still paper.
      }
    }
  } finally {
    if (ctl === c) {
      done = true;
    }
    rc.tm.total_ms = Math.round(performance.now() - t0);
    trackOps("brief_run", rc.tm);
  }
}

/* ---------- Snitcher ---------- */

const SNITCHER_SNIPPET = (id: string) =>
  `!function(e){"use strict";var t=e&&e.namespace;if(t&&e.profileId&&e.cdn){var i=window[t];if(i&&Array.isArray(i)||(i=window[t]=[]),!i.initialized&&!i._loaded)if(i._loaded)console&&console.warn("[Radar] Duplicate initialization attempted");else{i._loaded=!0;["track","page","identify","company","group","alias","ready","debug","on","off","once","trackClick","trackSubmit","trackLink","trackForm","pageview","screen","reset","register","setAnonymousId","addSourceMiddleware","addIntegrationMiddleware","addDestinationMiddleware","giveCookieConsent","denyCookieConsent"].forEach((function(e){var a;i[e]=(a=e,function(){var e=window[t];if(e.initialized)return e[a].apply(e,arguments);var i=[].slice.call(arguments);return i.unshift(a),e.push(i),e})})),i.bootstrap=function(){var t,i=document.createElement("script");i.async=!0,i.type="text/javascript",i.id="__radar__",i.setAttribute("data-settings",JSON.stringify(e)),i.src="https://"+e.cdn+"/releases/latest/radar.min.js";var a=document.scripts[0];a.parentNode.insertBefore(i,a)},i.bootstrap()}}else"undefined"!=typeof console&&console.error("[Radar] Configuration incomplete")}({apiEndpoint:"radar.snitcher.com",cdn:"cdn.snitcher.com",namespace:"Snitcher",profileId:"${id}"});`;

function injectSnitcher() {
  if (document.getElementById("__radar__") || window.Snitcher?._loaded) return;
  const el = document.createElement("script");
  el.textContent = SNITCHER_SNIPPET(SNITCHER_PROFILE);
  document.head.appendChild(el);
}

/** Wait briefly for GTM, then load Snitcher directly if needed.
    Visitor identification starts independently of CookieYes initialization. */
async function ensureTracker(s: AbortSignal): Promise<"gtm" | "injected"> {
  const deadline = Date.now() + 4000;
  while (!window.Snitcher && Date.now() < deadline) await zleep(100, s);
  if (window.Snitcher) return "gtm";
  injectSnitcher();
  return "injected";
}

/** getSpotterIdentification with a 5s cap; a resolved undefined counts as
    "not identified". */
async function spotterIdentify(s: AbortSignal): Promise<SpotterResult | null> {
  const sn = window.Snitcher;
  if (!sn) return null;
  return await new Promise<SpotterResult | null>((resolve) => {
    let settled = false;
    const fin = (v: SpotterResult | null) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        clearInterval(poll);
        resolve(v);
      }
    };
    const call = async () => {
      try {
        fin((await sn.getSpotterIdentification?.()) ?? null);
      } catch {
        fin(null);
      }
    };
    const poll = setInterval(() => {
      if (sn.initialized) {
        clearInterval(poll);
        void call();
      }
    }, 150);
    try {
      if (sn.initialized) void call();
      else sn.on?.("initialized", () => void call());
    } catch {
      fin(null);
    }
    const timer = setTimeout(() => fin(null), 5000);
    s.addEventListener("abort", () => fin(null), { once: true });
  });
}

/** Post the self-brief inside the open box, Exa bar first. */
async function selfBrief(r: Refs, s: AbortSignal, rc: RunCtx) {
  await postWithBar(r, s, rc, { domain: SELF.domain, name: SELF.name, source: "typed" });
}

async function flowSpotter(r: Refs, s: AbortSignal, rc: RunCtx) {
  await openBox(r, rc);

  rc.tm.stage = "snitcher";
  rc.tm.tracker = await ensureTracker(s);
  const b = mkBar(r, rc, "Calling Snitcher", 1.2, performance.now());
  rc.snBar = b.h;
  rc.snEntry = b.entry;
  const sn0 = performance.now();
  const id = await spotterIdentify(s);
  if (s.aborted) return;
  const d = id?.data;
  rc.tm.snitcher_ms = Math.round(performance.now() - sn0);
  rc.tm.snitcher = !id ? "no_answer" : id.type === "isp" ? "isp" : id.success && d?.name ? "identified" : "no_match";

  if (!id?.success || !d?.name || id.type === "isp") {
    await settle(rc, b.h, b.entry, "partial");
    await logLine(r, rc, `No company match. Briefing ${SELF.domain} instead.`, 1);
    await selfBrief(r, s, rc);
    return;
  }

  await settle(rc, b.h, b.entry, "ok");
  const city = d.city ?? d.address?.city;
  await logLine(r, rc, `Visitor resolved to ${d.name}${city ? `, ${city}` : ""}`, 1);

  const domain = host(d.website ?? d.domain ?? "") || String(d.website ?? d.domain ?? "");
  if (!domain) {
    rc.tm.snitcher = "no_domain";
    await selfBrief(r, s, rc);
    return;
  }
  try {
    await postWithBar(r, s, rc, {
      domain,
      source: "spotter",
      snitcher: {
        name: d.name,
        industry: d.industry,
        size: d.size,
        city: d.city ?? d.address?.city,
        country: d.country ?? d.address?.country,
        type: id.type ?? d.type,
      },
    });
  } catch (e) {
    if (s.aborted) throw e;
    // Whatever went wrong with their brief, print ours instead.
    rc.tm.visitor_error = e instanceof Error ? e.message.slice(0, 80) : "unknown";
    rc.tm.fell_back = true;
    if (rc.exaBar && rc.exaEntry) await settle(rc, rc.exaBar, rc.exaEntry, "failed");
    await selfBrief(r, s, rc);
  }
}

/** ?domain=<domain> hook: no Snitcher row; the box opens on `start`. */
async function flowTyped(r: Refs, s: AbortSignal, rc: RunCtx, domain: string) {
  rc.postAt = performance.now();
  rc.domain = domain;
  await postBrief(r, s, rc, { domain, source: "typed" });
}

async function activate(r: Refs) {
  if (done || ctl) return;

  // Dev/staging test hook: ?domain=<domain> runs a typed lookup.
  const testDomain = new URLSearchParams(location.search).get("domain");
  if (testDomain && (import.meta.env.DEV || import.meta.env.PUBLIC_STAGE === "staging")) {
    void runExclusive(r, "typed", (s, rc) => flowTyped(r, s, rc, testDomain));
    return;
  }

  if (restoreSession(r)) return;

  void runExclusive(r, "spotter", (s, rc) => flowSpotter(r, s, rc));
}

function wire(root: HTMLElement) {
  const r = refsOf(root);
  (root as unknown as { _briefRefs?: Refs })._briefRefs = r;
}

// The sheet only exists beside the menu; stacked under it on phones it is
// dead weight, so narrow viewports skip the pipeline until they widen.
const wide = matchMedia("(min-width: 861px)");
let wideWatched = false;

function onPageLoad() {
  const root = document.querySelector<HTMLElement>("[data-briefing]");
  if (!root) return;
  if (!(root as unknown as { _briefRefs?: Refs })._briefRefs) wire(root);
  if (!document.documentElement.hasAttribute("data-home")) return;
  if (!wide.matches) {
    if (!wideWatched) {
      wideWatched = true;
      wide.addEventListener("change", () => { if (wide.matches) onPageLoad(); });
    }
    return;
  }
  const r = (root as unknown as { _briefRefs: Refs })._briefRefs;
  void activate(r);
}

document.addEventListener("astro:page-load", onPageLoad);
// Late-loading modules can miss the initial astro:page-load dispatch.
if (document.readyState !== "loading") onPageLoad();
