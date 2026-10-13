/**
 * The factsheet: turns a Briefing (Exa facts + Jev verdict) into printed
 * lines. Pure, no DOM. Lines carry styled segments (tone + href); wrap()
 * breaks them to the paper width, keeping links intact across wraps and
 * preserving each line's hanging indent. Rows use a fixed label column
 * (10 chars) with secondary figures anchored at col 23 and col 36.
 */
import type { Facts } from "./facts.ts";
import type { Briefing } from "./interpret.ts";

export type Tone = "ink" | "muted" | "accent";
export interface Seg {
  text: string;
  href?: string;
  tone?: Tone;
}
export interface Line {
  segs: Seg[];
  /** Segment rendered flush right on the same row's last fragment. */
  right?: Seg;
  /** Hanging indent (chars) applied to wrapped continuation lines. */
  hang?: number;
}

export interface PrintoutInput {
  brief: Briefing | null;
  when: Date;
  totalMs?: number;
  /** Exa dollars spent; replaced by "from cache" when cached. */
  cost?: number | null;
  cached?: boolean;
}

const MUTED = (text: string): Seg => ({ text, tone: "muted" });
const INK = (text: string): Seg => ({ text });
const ACCENT = (text: string): Seg => ({ text, tone: "accent" });

const p2 = (n: number) => String(n).padStart(2, "0");
export const fmtWhen = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

/* ---------- Run log: the boxed job header printed above the sheet ----------

   ┌ INTELLIGENCE BRIEF ─────────────────────────── 2026-10-13 10:13 ┐
   │ Initiating intelligence brief                                  │
   │ Calling Snitcher       ████████████████████  100%     212 ms   │
   │   Visitor resolved to Descript, San Francisco                  │
   │ Printing factsheet                                             │
   └────────────────────────────────────────────────────────────────┘
   Bars align on one column; labels pad to LOG_LABEL_W.             */

export type BarKind = "ok" | "cached" | "partial" | "skipped" | "failed";

export type LogEntry =
  | { t: "perf" }
  | { t: "top"; when: string }
  | { t: "line"; text: string; indent?: number }
  | { t: "bar"; label: string; kind: BarKind; fill: number; ms: number | null }
  | { t: "close" };

export const LOG_LABEL_W = 24;
const SUB = "▏▎▍▌▋▊▉";
const TAPER = "▓▒░";

/** Bar width + whether the ms column fits at this paper width.
    Row = `│ ` + label col + ` ` + bar + tail(`  ` + pct8 + ms9) + `│`.
    Desktop: 20-cell bar with ms. Narrow: 10 cells, ms drops first. */
export function barLayout(cols: number): { barW: number; showMs: boolean } {
  const room = cols - 28; // everything but the bar and the tail
  if (room >= 20 + 19) return { barW: 20, showMs: true };
  if (room >= 20 + 10) return { barW: 20, showMs: false };
  if (room >= 10 + 10) return { barW: 10, showMs: false };
  return { barW: Math.max(4, room - 10), showMs: false };
}

/** In-flight bar: full cells, ▓▒░ taper behind the edge, a sub-cell edge
    glyph (eighth blocks) and blank space to the end. */
export function liveBar(w: number, f: number): string {
  const pos = Math.max(0, Math.min(1, f)) * w;
  const full = Math.floor(pos);
  const frac = pos - full;
  const taper = Math.min(3, full);
  let s = "█".repeat(full - taper) + TAPER.slice(0, taper);
  if (full < w) {
    if (frac >= 0.12) s += SUB[Math.min(SUB.length - 1, Math.floor(frac * 8))];
    s = s.padEnd(w, " ");
  }
  return s;
}

/** Stopped short: filled to the reached fraction, ░ for the rest. */
export const doneBar = (w: number, f: number) => "█".repeat(Math.round(Math.max(0, Math.min(1, f)) * w)).padEnd(w, "░");
export const fullBar = (w: number) => "█".repeat(w);
export const emptyBar = (w: number) => "░".repeat(w);

/** Final bar cells + pct + ms strings for a finished bar. `cached` lives
    in the ms column; when the column is dropped it moves into pct. */
export function barEnd(kind: BarKind, fill: number, ms: number | null, barW: number, showMs = true) {
  const cells = kind === "ok" || kind === "cached" ? fullBar(barW) : kind === "skipped" ? emptyBar(barW) : doneBar(barW, fill);
  const pct =
    kind === "ok" ? "100%"
    : kind === "cached" ? (showMs ? "100%" : "cached")
    : kind === "partial" ? "no match"
    : kind;
  const msText = kind === "ok" ? `${ms ?? 0} ms` : kind === "cached" ? "cached" : "";
  return { cells, pct, msText };
}

const rowText = (content: string, cols: number) => `│ ${content.padEnd(Math.max(0, cols - 4))} │`;

/** Turn one run-log entry into a printable line at the given width. */
export function entryLine(e: LogEntry, cols: number): Line {
  switch (e.t) {
    case "perf":
      return { segs: [MUTED("┄".repeat(cols))] };
    case "top": {
      const title = "INTELLIGENCE BRIEF";
      const d = cols - title.length - e.when.length - 6;
      const text = d >= 3 ? `┌ ${title} ${"─".repeat(d)} ${e.when} ┐` : `┌${"─".repeat(Math.max(0, cols - 2))}┐`;
      return { segs: [INK(text)] };
    }
    case "line": {
      const content = "  ".repeat(e.indent ?? 0) + e.text;
      return { segs: [e.indent ? MUTED(rowText(content, cols)) : INK(rowText(content, cols))] };
    }
    case "bar": {
      const { barW, showMs } = barLayout(cols);
      const { cells, pct, msText } = barEnd(e.kind, e.fill, e.ms, barW, showMs);
      const tail = `  ${pct.padEnd(8)}${showMs ? msText.padEnd(9) : ""}`;
      const pre = `│ ${e.label.padEnd(LOG_LABEL_W)} `;
      const pad = Math.max(0, cols - pre.length - barW - tail.length - 1);
      return { segs: [INK(pre), INK(cells), MUTED(tail + " ".repeat(pad)), INK("│")] };
    }
    case "close":
      return { segs: [INK(`└${"─".repeat(Math.max(0, cols - 2))}┘`)] };
  }
}


const fmtScaled = (v: number) =>
  v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, (m) => (v >= 10 ? "" : m));

/** $7.0M / $100M / $11.3B / $40K. */
export const fmtUsd = (v: number) =>
  v >= 1e9 ? `$${fmtScaled(v / 1e9)}B` : v >= 1e6 ? `$${fmtScaled(v / 1e6)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`;

const fmtVisits = (v: number) => `${fmtUsd(v).slice(1)}`; // same ramp, no $
const fmtRoundDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(+d)) return iso;
  return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
};
const signedPct = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(Math.round(n))}%`;
const signedPct1 = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(Math.round(n * 10) / 10)}%`;

/* Fixed-column fact row: label 0-10, first cell flush at col 10, further
   cells anchored at cols 23 and 36. */
const ANCHORS = [10, 23, 36];
function row(label: string, cells: Seg[][]): Line {
  const segs: Seg[] = [{ text: label.padEnd(10) }];
  let cur = 10;
  cells.forEach((cell, i) => {
    const cellLen = cell.reduce((m, s) => m + s.text.length, 0);
    if (!cellLen) return;
    const target = ANCHORS[i] ?? 0;
    const gap = i === 0 ? 0 : Math.max(target - cur, 2);
    if (gap) segs.push({ text: " ".repeat(gap) });
    cur += gap;
    for (const s of cell) segs.push(s);
    cur += cellLen;
  });
  return { segs, hang: 10 };
}

export function printout(input: PrintoutInput): Line[] {
  const { brief } = input;
  const out: Line[] = [];
  const push = (...segs: Seg[]) => out.push({ segs });
  const blank = () => out.push({ segs: [{ text: "" }] });

  if (!brief) return out;
  const f: Facts = brief.facts;
  const name = (brief.subject.name || f.name || brief.subject.domain).toUpperCase();

  out.push({ segs: [INK(name)], right: { text: brief.subject.domain, href: `https://${brief.subject.domain}` } });

  if (f.oneLiner) push(INK(f.oneLiner));

  const meta: string[] = [];
  if (f.city || f.country) meta.push([f.city, f.country].filter(Boolean).join(", "));
  if (f.founded) meta.push(`Founded ${f.founded}`);
  if (f.type) meta.push(f.type);
  if (f.industry) meta.push(f.industry);
  if (meta.length) push(MUTED(meta.join(" · ")));

  const rows: Line[] = [];
  if (f.staff != null) {
    const cells: Seg[][] = [[INK(f.staff.toLocaleString("en-US"))]];
    if (f.hcYoY != null) cells.push([MUTED(`${signedPct1(f.hcYoY)} YoY`)]);
    if (f.sizeBand) cells.push([MUTED(f.sizeBand)]);
    rows.push(row("PEOPLE", cells));
  }
  if (f.revenue != null) {
    const cells: Seg[][] = [[INK(fmtUsd(f.revenue))]];
    if (f.revPerHead != null) cells.push([MUTED(`${fmtUsd(f.revPerHead)} per head`)]);
    rows.push(row("REVENUE", cells));
  }
  if (f.fundingTotal != null) {
    const cells: Seg[][] = [[INK(`${fmtUsd(f.fundingTotal)} total`)]];
    if (f.latestRound) {
      const lr = f.latestRound;
      cells.push([MUTED(`${lr.name}${lr.amount != null ? ` ${fmtUsd(lr.amount)}` : ""}${lr.date ? `, ${fmtRoundDate(lr.date)}` : ""}`)]);
    }
    rows.push(row("FUNDING", cells));
  }
  if (f.visitsMonthly != null) {
    const cells: Seg[][] = [[INK(`${fmtVisits(f.visitsMonthly)}/mo`)]];
    if (f.traffic6mo != null) cells.push([MUTED(`${signedPct(f.traffic6mo)} in 6 mo`)]);
    if (f.spark) cells.push([ACCENT(f.spark)]);
    rows.push(row("TRAFFIC", cells));
  }
  if (f.stackCount != null) {
    const cells: Seg[][] = [[INK(`${f.stackCount} tools`)]];
    if (f.stackTop.length) {
      const more = f.stackCount - f.stackTop.length;
      cells.push([MUTED(`${f.stackTop.join(", ")}${more > 0 ? ` +${more}` : ""}`)]);
    }
    rows.push(row("STACK", cells));
  }
  if (f.offices.length) {
    const cells: Seg[][] = [[INK(f.offices.join(", "))]];
    if (f.countries != null) cells[0].push(MUTED(` · staff in ${f.countries} countries`));
    rows.push(row("OFFICES", cells));
  }
  if (rows.length) {
    blank();
    out.push(...rows);
  }

  if (brief.verdict) {
    blank();
    push(INK("JEV'S READ"));
    const v = brief.verdict;
    out.push({ segs: [INK(v.line)], right: v.p != null ? MUTED(`p ${v.p.toFixed(2)}`) : undefined });
  }

  blank();
  const secs = input.totalMs != null ? `${(input.totalMs / 1000).toFixed(1)} s` : null;
  const money = input.cached ? "from cache" : input.cost != null ? `$${input.cost.toFixed(3)}` : null;
  push(MUTED([fmtWhen(input.when), secs, money].filter(Boolean).join(" · ")));
  return out;
}

/**
 * Break lines to `cols` columns. Word-wraps across segment boundaries;
 * links keep their href on every wrapped piece, continuation lines keep
 * the line's hanging indent (leading whitespace or `hang`), and overlong
 * tokens hard-split. A `right` segment lands flush-right on the last
 * fragment.
 */
export function wrap(lines: Line[], cols: number): Line[] {
  const out: Line[] = [];
  for (const ln of lines) {
    const segs = ln.segs.filter((sg) => sg.text.length > 0);
    const flat = segs.map((sg) => sg.text).join("");
    const emitWithRight = () => {
      // flush-right segment on the last emitted fragment
      if (!ln.right) return;
      const last = out[out.length - 1];
      const lastLen = last.segs.reduce((m, s) => m + s.text.length, 0);
      const pad = cols - lastLen - ln.right.text.length;
      if (pad >= 1) last.segs.push({ text: " ".repeat(pad) }, ln.right);
      else out.push({ segs: [{ text: " " }, ln.right] });
    };
    if (!flat.trim()) {
      out.push({ segs: [{ text: "" }] });
      if (ln.right) emitWithRight();
      continue;
    }
    // char index -> source segment
    const segIdx = new Uint16Array(flat.length);
    let ci = 0;
    segs.forEach((sg, si) => {
      for (let i = 0; i < sg.text.length; i++) segIdx[ci++] = si;
    });
    const indent = ln.hang != null ? " ".repeat(Math.min(ln.hang, cols - 4)) : (flat.match(/^\s*/)?.[0] ?? "");
    const emit = (a: number, b: number, cont: boolean) => {
      // trim trailing whitespace off the emitted range
      while (b > a && /\s/.test(flat[b - 1])) b--;
      const os: Seg[] = cont && indent ? [{ text: indent }] : [];
      let i = a;
      while (i < b) {
        const si = segIdx[i];
        let j = i;
        while (j < b && segIdx[j] === si) j++;
        os.push({ text: flat.slice(i, j), href: segs[si].href, tone: segs[si].tone });
        i = j;
      }
      out.push({ segs: os });
    };

    const words: { a: number; b: number }[] = [];
    const re = /\S+/g;
    let wm: RegExpExecArray | null;
    while ((wm = re.exec(flat))) words.push({ a: wm.index, b: wm.index + wm[0].length });

    let lineStart = 0; // flat index where the current output line began
    let cap = cols; // first line: indent already inside flat
    for (const w of words) {
      if (w.a < lineStart) continue;
      if (w.b - lineStart <= cap) continue; // fits
      // Doesn't fit. If the current line already has a word, break before w.
      const hasContent = words.some((x) => x.a >= lineStart && x.b <= w.a);
      if (hasContent) {
        emit(lineStart, w.a, lineStart > 0);
        lineStart = w.a;
        cap = cols - indent.length;
      }
      // Hard-split a token still longer than the capacity.
      while (w.b - lineStart > cap) {
        emit(lineStart, lineStart + cap, lineStart > 0);
        lineStart += cap;
        cap = cols - indent.length;
      }
    }
    if (lineStart < flat.length) emit(lineStart, flat.length, lineStart > 0);
    if (ln.right) emitWithRight();
  }
  return out;
}
