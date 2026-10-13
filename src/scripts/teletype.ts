/**
 * Factsheet printer: off-white continuous-form paper fills the pane edge
 * to edge; a dot-matrix printer front (platen, guide rail, toothed belt,
 * 9-pin carriage) sits pinned to the bottom. Paper text is DOM —
 * selectable, linkable, announced via role="log". Each run types a boxed
 * job log with live pin-style progress bars, then the factsheet. The
 * carriage nose tracks the column being struck and parks on the right
 * end stop when idle.
 */
import {
  barEnd,
  barLayout,
  emptyBar,
  liveBar,
  LOG_LABEL_W,
  type Line,
  type Seg,
} from "../lib/brief/printout.ts";

export type BarKind = "ok" | "cached" | "partial" | "skipped" | "failed";

export interface BarHandle {
  /** The row element (for ordered DOM inserts). */
  el: HTMLDivElement;
  /** Fraction reached so far, 0..1. */
  readonly fill: number;
  /** Settle the bar: cells snap to their end state, then % and ms print. */
  finish: (kind: BarKind, ms?: number) => Promise<{ fill: number }>;
}

export interface Sheet {
  cols: () => number;
  empty: () => boolean;
  /** Type one line (log rows); `before` inserts it above that row. */
  typeLine: (l: Line, o?: { cps?: number; before?: HTMLElement | null }) => Promise<void>;
  /** Type a live progress-bar row; the fill runs until finish(). */
  bar: (label: string, o?: { tau?: number; since?: number }) => BarHandle;
  print: (lines: Line[], o?: { cps?: number; append?: boolean }) => Promise<{ cancelled: boolean; ms: number }>;
  abortPrint: () => void;
  showInstant: (lines: Line[]) => void;
  tear: () => Promise<void>;
  clear: () => void;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        rej(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });

/** ?slow stretches typing and bar fills so mid-run states can be shot. */
const SLOW = new URLSearchParams(location.search).has("slow") ? 8 : 1;
const BAR_H = 96;
/** Divider between the mechanics band and the switchband. */
const SEP_Y = 73.5;

export function mount(root: HTMLElement): Sheet {
  const paper = root.querySelector<HTMLElement>(".sheet-paper")!;
  const lines = root.querySelector<HTMLElement>(".sheet-lines")!;
  const barEl = root.querySelector<HTMLElement>(".tty-bar")!;
  const front = root.querySelector<SVGElement>("[data-front]")!;
  const msg = root.querySelector<HTMLElement>(".sheet-status")!;

  // Measured cell width of Paper Mono at the paper's font size — the
  // sample must carry the .pl font, not the pane's inherited face.
  const meas = document.createElement("span");
  meas.style.cssText =
    'position:absolute;visibility:hidden;white-space:pre;font:400 12px/17px "Paper Mono", ui-monospace, monospace';
  meas.textContent = "M".repeat(10);
  paper.appendChild(meas);
  const cw = meas.getBoundingClientRect().width / 10 || 8.2;
  meas.remove();

  const padLeft = () => parseFloat(getComputedStyle(paper).paddingLeft) || 0;
  const padRight = () => parseFloat(getComputedStyle(paper).paddingRight) || 0;
  const cols = () => Math.max(24, Math.floor((paper.clientWidth - padLeft() - padRight()) / cw));
  const colX = (c: number) => padLeft() + c * cw + cw * 0.5;

  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- printer front (SVG, rebuilt metrics on resize) ------------------- */

  front.innerHTML = `
    <rect data-panel rx="2" fill="#F6F6F3" stroke="#222222"/>
    <rect data-platen rx="1.75" fill="#EEEEEB" stroke="#222222"/>
    <circle data-pltL fill="#EEEEEB" stroke="#222222"/>
    <circle data-pltR fill="#EEEEEB" stroke="#222222"/>
    <line data-rail stroke="#81ACEC" stroke-width="2"/>
    <rect data-stopL rx="1.5" fill="#F6F6F3" stroke="#222222"/>
    <rect data-stopR rx="1.5" fill="#F6F6F3" stroke="#222222"/>
    <circle data-scrL fill="#222222"/>
    <circle data-scrR fill="#222222"/>
    <path data-belt stroke="#222222" stroke-width="1" opacity=".45" fill="none"/>
    <line data-sep stroke="#81ACEC" stroke-width="1"/>
    <circle data-led r="2.8" fill="none" stroke="#666666"/>
    <text data-online font-family="Paper Mono, ui-monospace, monospace" font-size="10" fill="rgba(34,34,34,.5)">ONLINE</text>
    <rect data-plate rx="1" fill="#EEEEEB" stroke="#222222" stroke-opacity=".45"/>
    <text data-platetxt text-anchor="middle" font-family="Paper Mono, ui-monospace, monospace" font-size="7.5" letter-spacing=".6" fill="rgba(34,34,34,.55)">AND/OR LABS · LQ-24</text>
    <g data-car>
      <rect x="-31" y="28" width="68" height="28" rx="2.5" fill="#81ACEC"/>
      <rect x="-30" y="10" width="60" height="14" rx="2" fill="#EEEEEB" stroke="#222222"/>
      <rect x="-24" y="15" width="48" height="5" fill="#222222" opacity=".8"/>
      <rect x="-8" y="-8" width="16" height="32" rx="1" fill="#F6F6F3" stroke="#222222"/>
      <polygon points="-3.5,-8 3.5,-8 0,-11.5" fill="#222222"/>
      ${Array.from({ length: 9 }, (_, i) => `<circle data-pin cx="0" cy="${(-4 + i * 3).toFixed(1)}" r="1.3" fill="#F6F6F3" stroke="#222222" stroke-width=".6"/>`).join("")}
      <rect x="-34" y="25" width="68" height="28" rx="2.5" fill="#F6F6F3" stroke="#222222"/>
      <line x1="-29" y1="28.5" x2="29" y2="28.5" stroke="#222222" stroke-width=".7" opacity=".5"/>
      <circle cx="-28" cy="31.5" r="1.3" fill="#222222"/>
      <circle cx="28" cy="31.5" r="1.3" fill="#222222"/>
      <path d="M15 35h14 M15 39h14 M15 43h14 M15 47h14" stroke="#222222" stroke-width="1" opacity=".55" fill="none"/>
    </g>
    <rect data-ribbon fill="#222222" opacity=".85"/>
    <line data-ribdash stroke="#FBFBF8" stroke-width="1" opacity=".4" stroke-dasharray="2.5 4.5" fill="none"/>`;

  const q = <T extends SVGElement>(sel: string) => front.querySelector<T>(sel) as T;
  const car = q<SVGGElement>("[data-car]");
  const belt = q<SVGPathElement>("[data-belt]");
  const led = q<SVGCircleElement>("[data-led]");
  const ribdash = q<SVGLineElement>("[data-ribdash]");
  const pins = [...front.querySelectorAll<SVGCircleElement>("[data-pin]")];

  let carX = 0;
  let carTX = 0;
  let jig = 0;
  let parkX = 60;
  let lastT = 0;
  let ribOff = 0;

  const layout = () => {
    const w = barEl.clientWidth;
    front.setAttribute("viewBox", `0 0 ${Math.max(1, w)} ${BAR_H}`);
    const set = (sel: string, attrs: Record<string, string | number>) => {
      const el = q(sel);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    };
    set("[data-panel]", { x: 0.5, y: 0.5, width: Math.max(0, w - 1), height: BAR_H - 1 });
    set("[data-ribbon]", { x: 8, y: 3, width: Math.max(0, w - 16), height: 5 });
    set("[data-ribdash]", { x1: 8, y1: 5.5, x2: w - 8, y2: 5.5 });
    set("[data-platen]", { x: 8, y: 10, width: Math.max(0, w - 16), height: 3.5 });
    set("[data-pltL]", { cx: 8, cy: 11.75, r: 2.4 });
    set("[data-pltR]", { cx: w - 8, cy: 11.75, r: 2.4 });
    set("[data-rail]", { x1: 16, y1: 54, x2: w - 16, y2: 54 });
    set("[data-stopL]", { x: 6, y: 48, width: 8, height: 12 });
    set("[data-stopR]", { x: w - 14, y: 48, width: 8, height: 12 });
    set("[data-scrL]", { cx: 10, cy: 54, r: 1.4 });
    set("[data-scrR]", { cx: w - 10, cy: 54, r: 1.4 });
    let d = "";
    for (let x = 15; x <= w - 15; x += 5) d += `M${x} 56.5v3 `;
    set("[data-belt]", { d });
    set("[data-sep]", { x1: 0, y1: SEP_Y, x2: w, y2: SEP_Y });
    set("[data-led]", { cx: 13, cy: 85 });
    set("[data-online]", { x: 21, y: 88.5 });
    set("[data-plate]", { x: w - 118, y: 79, width: 106, height: 12 });
    set("[data-platetxt]", { x: w - 65, y: 88.5 });
    // Park just left of the right end stop so the whole carriage, offset
    // shadow included, stays inside the panel edge.
    parkX = Math.max(52, w - 56);
    carX = Math.min(Math.max(carX, 30), parkX);
    carTX = Math.min(Math.max(carTX, 30), parkX);
  };
  layout();
  new ResizeObserver(layout).observe(barEl);

  const headTo = (px: number) => {
    carTX = Math.min(Math.max(px, 30), parkX);
  };
  const park = () => headTo(parkX);
  park();

  /** The status line names the row the head is on; Idle when parked. */
  const setHead = (t: string | null) => {
    const s = t ?? "Idle";
    if (msg.textContent !== s) msg.textContent = s;
  };
  const busyNow = () => printing || opsActive > 0 || liveBars.size > 0;
  const idleCheck = () => {
    if (!busyNow()) setHead(null);
  };
  /** Label for the status line from a line's full text (box chars off). */
  const rowLabel = (raw: string): string | null => {
    if (raw.startsWith("┌")) return "Intelligence brief";
    const t = raw.replace(/^[│\s]+/, "").replace(/[│\s]+$/, "").replace(/[─┄]+$/, "").trim();
    return t ? (t.length > 34 ? `${t.slice(0, 33)}…` : t) : null;
  };
  setHead(null);

  /** Pin flash + carriage jiggle + ribbon feed for a character strike. */
  const strike = () => {
    if (reduce()) return;
    jig = (Math.random() - 0.5);
    ribOff -= 3;
    ribdash.setAttribute("stroke-dashoffset", String(ribOff));
    const n = 3 + Math.floor(Math.random() * 3);
    const picked = pins.slice().sort(() => Math.random() - 0.5).slice(0, n);
    for (const p of picked) {
      p.setAttribute("fill", "#222222");
      setTimeout(() => p.setAttribute("fill", "#F6F6F3"), 60);
    }
  };

  /* ---- typing / print queue -------------------------------------------- */

  interface Job {
    seg: Seg;
    el: HTMLElement;
    typed: number;
  }
  interface LiveLine {
    el: HTMLDivElement;
    jobs: Job[];
    ji: number;
    shown: number;
  }

  let queue: Line[] = [];
  let cur: LiveLine | null = null;
  let nextAt = 0;
  let cps = 30;
  let printing = false;
  let printResolve: ((r: { cancelled: boolean; ms: number }) => void) | null = null;
  let printStart = 0;
  let follow = true;
  let sheetStartEl: HTMLElement | null = null;
  let opsActive = 0;

  // Serialized DOM-typing ops for the job log (lines, bar prefixes, bar
  // tails). Generation bumped on abort so queued ops die instantly.
  let chain: Promise<void> = Promise.resolve();
  let gen = 0;
  let opsCtl = new AbortController();

  const makeSeg = (seg: Seg): HTMLElement => {
    const el = seg.href ? document.createElement("a") : document.createElement("span");
    if (seg.href) {
      (el as HTMLAnchorElement).href = seg.href;
      (el as HTMLAnchorElement).target = "_blank";
      (el as HTMLAnchorElement).rel = "noopener";
    } else {
      // Visible text is decorative for AT — the log announces each line
      // once, through the .sr twin appended when the line completes.
      el.setAttribute("aria-hidden", "true");
    }
    if (seg.tone && seg.tone !== "ink") el.classList.add(`s-${seg.tone === "muted" ? "mut" : "acc"}`);
    return el;
  };

  /** Append the screen-reader copy of a finished line (announced once). */
  const announce = (el: HTMLElement, text: string) => {
    const s = document.createElement("span");
    s.className = "sr";
    s.textContent = text;
    el.appendChild(s);
  };

  /** Paper advance: newest line settles just above the platen. */
  const feed = () => {
    if (follow) paper.scrollTo({ top: paper.scrollHeight, behavior: reduce() ? "auto" : "smooth" });
  };

  const beginLine = (): boolean => {
    const ln = queue.shift();
    if (!ln) return false;
    const el = document.createElement("div");
    el.className = "pl";
    lines.appendChild(el);
    if (!sheetStartEl) sheetStartEl = el;
    cur = { el, jobs: ln.segs.filter((s) => s.text).map((s) => ({ seg: s, el: makeSeg(s), typed: 0 })), ji: 0, shown: 0 };
    for (const j of cur.jobs) cur.el.appendChild(j.el);
    nextAt += 60 + Math.random() * 80;
    return true;
  };

  const finishLine = () => {
    if (cur) announce(cur.el, cur.jobs.map((j) => j.seg.text).join(""));
    cur = null;
    headTo(colX(0)); // carriage return
    feed();
  };

  const advance = (n: number) => {
    while (n > 0 && cur) {
      const job = cur.jobs[cur.ji];
      if (!job) {
        finishLine();
        return;
      }
      const take = Math.min(job.seg.text.length - job.typed, n);
      job.typed += take;
      cur.shown += take;
      n -= take;
      job.el.textContent = job.seg.text.slice(0, job.typed);
      strike();
      if (job.typed >= job.seg.text.length) cur.ji++;
      if (cur.ji >= cur.jobs.length) {
        finishLine();
        return;
      }
    }
  };

  const scrollHome = (instant = false) => {
    if (!sheetStartEl) return;
    const r = sheetStartEl.getBoundingClientRect();
    const pr = paper.getBoundingClientRect();
    const target = paper.scrollTop + (r.top - pr.top) - 14;
    if (instant) paper.scrollTop = Math.max(0, target);
    else paper.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    follow = false;
  };

  /* ---- live bars -------------------------------------------------------- */

  interface LiveBar {
    label: string;
    barW: number;
    preLen: number;
    fillEl: HTMLElement;
    restEl: HTMLElement;
    fill: number;
    lastFilled: number;
    tau: number;
    t0: number;
    lastUp: number;
    dead: boolean;
  }
  const liveBars = new Set<LiveBar>();

  const barEdgeX = (b: LiveBar) => {
    const fr = b.fillEl.getBoundingClientRect();
    const pr = paper.getBoundingClientRect();
    return fr.left - pr.left + Math.round(b.fill * b.barW) * cw;
  };

  const updateBar = (b: LiveBar, now: number) => {
    if (b.dead) {
      liveBars.delete(b);
      return;
    }
    b.fill = Math.min(0.92, 1 - Math.exp(-(now - b.t0) / (1000 * b.tau * SLOW)));
    if (now - b.lastUp < 33) return;
    b.lastUp = now;
    const text = liveBar(b.barW, b.fill);
    const filled = text.replace(/ +$/, "");
    b.fillEl.textContent = filled;
    b.restEl.textContent = " ".repeat(b.barW - filled.length);
    if (filled.length !== b.lastFilled) {
      b.lastFilled = filled.length;
      strike(); // a cell of the bar is ink — pins hit the paper
    }
    headTo(barEdgeX(b));
  };

  /** Type a string into a span char by char (the %/ms tail of a bar). */
  const typeInto = async (el: HTMLElement, text: string, sig: AbortSignal, speed = 120) => {
    if (reduce()) {
      el.textContent = text;
      return;
    }
    for (let i = 1; i <= text.length; i++) {
      el.textContent = text.slice(0, i);
      strike();
      await sleep((1000 / speed) * SLOW, sig);
    }
  };

  /* ---- serialized ops ---------------------------------------------------- */

  const enqueue = <T>(job: (sig: AbortSignal) => Promise<T>): Promise<T> => {
    const g = gen;
    const sig = opsCtl.signal;
    const p = chain.then(() => {
      if (g !== gen) return Promise.reject(new DOMException("aborted", "AbortError"));
      return job(sig);
    });
    chain = p.then(
      () => {},
      () => {},
    );
    return p;
  };

  /** Type a full line's segments char by char, tracking the carriage. */
  const typeJobs = async (el: HTMLDivElement, segs: Seg[], speed: number, sig: AbortSignal) => {
    const jobs = segs.filter((s) => s.text).map((s) => ({ seg: s, el: makeSeg(s) }));
    for (const j of jobs) el.appendChild(j.el);
    const full = jobs.map((j) => j.seg.text).join("");
    const lab = rowLabel(full);
    if (lab) setHead(lab);
    if (reduce()) {
      for (const j of jobs) j.el.textContent = j.seg.text;
      if (full.trim()) announce(el, full);
      feed();
      return;
    }
    let col = 0;
    for (const j of jobs) {
      for (let i = 1; i <= j.seg.text.length; i++) {
        const ch = j.seg.text[i - 1];
        j.el.textContent = j.seg.text.slice(0, i);
        col++;
        headTo(colX(col));
        // Spaces don't strike: the head just sweeps over them — this also
        // makes the pad-to-border run read as one glide, not 40 strikes.
        if (ch === " ") continue;
        strike();
        await sleep((1000 / speed) * SLOW, sig);
      }
    }
    if (full.trim()) announce(el, full);
    headTo(colX(0)); // carriage return
    feed();
    await sleep(90 * SLOW, sig); // LF settle
  };

  const typeLine = (ln: Line, o: { cps?: number; before?: HTMLElement | null } = {}) => {
    const el = document.createElement("div");
    el.className = "pl";
    if (o.before) lines.insertBefore(el, o.before);
    else lines.appendChild(el);
    if (!sheetStartEl) sheetStartEl = el;
    return enqueue(async (sig) => {
      opsActive++;
      try {
        await typeJobs(el, ln.segs, o.cps ?? 60, sig);
      } finally {
        opsActive--;
        if (!opsActive && !printing && !liveBars.size) park();
        idleCheck();
      }
    });
  };

  const bar = (label: string, o: { tau?: number; since?: number } = {}): BarHandle => {
    const { barW } = barLayout(cols());
    const el = document.createElement("div");
    el.className = "pl";
    const pre = `│ ${label.padEnd(LOG_LABEL_W)} `;
    const preEl = document.createElement("span");
    const fillEl = document.createElement("span");
    const restEl = makeSeg({ text: "", tone: "muted" });
    const tailEl = makeSeg({ text: "", tone: "muted" });
    const endEl = document.createElement("span");
    // The row's visible text (label, bar cells, %/ms) is decorative for AT;
    // the sr span carries "Querying Exa, done in 461 ms" instead.
    for (const v of [preEl, fillEl, restEl, tailEl, endEl]) v.setAttribute("aria-hidden", "true");
    const srEl = document.createElement("span");
    srEl.className = "sr";
    srEl.textContent = label;
    el.append(preEl, fillEl, restEl, tailEl, endEl, srEl);
    lines.appendChild(el);
    if (!sheetStartEl) sheetStartEl = el;

    const b: LiveBar = {
      label,
      barW,
      preLen: pre.length,
      fillEl,
      restEl,
      fill: 0,
      lastFilled: 0,
      tau: o.tau ?? 0.6,
      t0: o.since ?? performance.now(),
      lastUp: 0,
      dead: false,
    };
    void enqueue(async (sig) => {
      opsActive++;
      try {
        setHead(label);
        if (reduce()) preEl.textContent = pre;
        else
          for (let i = 1; i <= pre.length; i++) {
            preEl.textContent = pre.slice(0, i);
            headTo(colX(i));
            strike();
            await sleep((1000 / 60) * SLOW, sig);
          }
        if (!b.dead && !reduce()) liveBars.add(b);
      } finally {
        opsActive--;
        if (!opsActive && !printing && !liveBars.size) park();
        idleCheck();
      }
    }).catch(() => {});

    const finish = (kind: BarKind, ms?: number) =>
      enqueue(async (sig) => {
        if (b.dead) return { fill: b.fill };
        opsActive++;
        try {
          // ?slow holds the settle so the animated fill is screenshot-able.
          if (SLOW > 1) await sleep(8000, sig);
          // Fill may never have been ticked (settle during prefix): take
          // the honest elapsed fraction so partial/failed bars are real.
          b.fill = Math.max(b.fill, Math.min(0.92, 1 - Math.exp(-(performance.now() - b.t0) / (1000 * b.tau * SLOW))));
          b.dead = true;
          liveBars.delete(b);
          const m = ms ?? Math.max(0, Math.round(performance.now() - b.t0));
          const { showMs } = barLayout(cols());
          const { pct, msText } = barEnd(kind, b.fill, m, barW, showMs);
          if (kind === "ok" || kind === "cached") {
            fillEl.textContent = "█".repeat(barW);
            restEl.textContent = "";
          } else if (kind === "skipped") {
            fillEl.textContent = "";
            restEl.textContent = emptyBar(barW);
          } else {
            const k = Math.round(b.fill * barW);
            fillEl.textContent = "█".repeat(k);
            restEl.textContent = "░".repeat(barW - k);
          }
          const core = `  ${pct.padEnd(8)}${showMs ? msText.padEnd(9) : ""}`;
          const pad = Math.max(0, cols() - pre.length - barW - core.length - 1);
          await typeInto(tailEl, core + " ".repeat(pad), sig);
          endEl.textContent = "│";
          headTo(colX(cols()));
          strike();
          srEl.textContent =
            kind === "ok" ? `${label}, done in ${m} ms`
            : kind === "cached" ? `${label}, cached`
            : `${label}, ${kind === "partial" ? "no match" : kind}`;
          feed();
          return { fill: b.fill };
        } finally {
          opsActive--;
          if (!opsActive && !printing && !liveBars.size) park();
          idleCheck();
        }
      });
    return { el, get fill() { return b.fill; }, finish };
  };

  /* ---- queue print (the factsheet block) -------------------------------- */

  const tick = (now: number) => {
    // carriage + belt + bar fills run even when no chars are moving
    const dt = Math.min(50, now - lastT);
    lastT = now;
    if (reduce()) carX = carTX;
    else carX += (carTX - carX) * Math.min(1, dt / 70);
    jig *= 0.7;
    car.setAttribute("transform", `translate(${carX.toFixed(2)} ${jig.toFixed(2)})`);
    belt.setAttribute("transform", `translate(${(carX % 5).toFixed(2)} 0)`);
    const busy = busyNow();
    led.setAttribute("fill", busy ? "#f0764f" : "none");
    led.setAttribute("stroke", busy ? "#f0764f" : "#666666");
    for (const b of liveBars) updateBar(b, now);

    if (!printing) return;
    if (now < nextAt) return;
    if (!cur && !beginLine()) {
      printing = false;
      const ms = performance.now() - printStart;
      scrollHome(false);
      park();
      idleCheck();
      printResolve?.({ cancelled: false, ms });
      printResolve = null;
      return;
    }
    if (!cur) return;
    const ch = (1000 / cps) * SLOW;
    const k = Math.min(Math.floor((now - nextAt) / ch) + 1, 60);
    nextAt += k * ch;
    if (Math.random() < 0.05) nextAt += (40 + Math.random() * 70) * SLOW;
    advance(k);
    if (cur) headTo(colX(cur.shown));
  };

  let raf = 0;
  const loop = (t: number) => {
    raf = requestAnimationFrame(loop);
    tick(t);
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (e.isIntersecting) wake();
      // Offscreen idles pause painting, but a print in flight keeps
      // ticking — the queue must drain even while the pane is below
      // the fold (stacked mobile layout) so it's done when reached.
      else if (raf && !printing && !opsActive && !liveBars.size) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
  }).observe(root);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else wake();
  });

  // A manual scroll during printing pauses auto-follow until the next run.
  const pauseFollow = () => {
    if (printing || opsActive) follow = false;
  };
  paper.addEventListener("wheel", pauseFollow, { passive: true });
  paper.addEventListener("touchstart", pauseFollow, { passive: true });
  paper.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) pauseFollow();
  });

  /* ---- API ------------------------------------------------------------- */

  const fillInstant = (ls: Line[]) => {
    for (const ln of ls) {
      const el = document.createElement("div");
      el.className = "pl";
      let full = "";
      for (const s of ln.segs) {
        if (!s.text) continue;
        full += s.text;
        const se = makeSeg(s);
        se.textContent = s.text;
        el.appendChild(se);
      }
      if (full.trim()) announce(el, full);
      lines.appendChild(el);
      if (!sheetStartEl) sheetStartEl = el;
    }
  };

  const wipe = () => {
    lines.replaceChildren();
    sheetStartEl = null;
    cur = null;
    queue = [];
    liveBars.clear();
    park();
  };

  return {
    cols,
    empty: () => lines.children.length === 0,
    typeLine,
    bar,
    print(ls, o = {}) {
      abortPrintRun();
      if (!o.append) wipe();
      else queue = [];
      cps = o.cps ?? 30;
      setHead("Printing factsheet");
      if (reduce()) {
        fillInstant(ls);
        feed();
        scrollHome(true);
        park();
        setHead(null);
        return Promise.resolve({ cancelled: false, ms: 0 });
      }
      queue = ls.slice();
      follow = true;
      printing = true;
      printStart = performance.now();
      nextAt = performance.now() + 120;
      wake();
      return new Promise((res) => {
        printResolve = res;
      });
    },
    abortPrint() {
      abortPrintRun();
    },
    showInstant(ls) {
      abortPrintRun();
      wipe();
      fillInstant(ls);
      paper.scrollTop = paper.scrollHeight;
      scrollHome(true);
      park();
    },
    async tear() {
      abortPrintRun();
      const kids = lines.children.length;
      if (!kids || reduce()) {
        wipe();
        return;
      }
      const ghost = lines.cloneNode(true) as HTMLElement;
      ghost.classList.add("sheet-ghost");
      ghost.setAttribute("aria-hidden", "true");
      paper.appendChild(ghost);
      ghost.scrollTop = paper.scrollTop;
      lines.replaceChildren();
      sheetStartEl = null;
      liveBars.clear();
      follow = true;
      requestAnimationFrame(() => ghost.classList.add("gone"));
      try {
        await sleep(680);
      } finally {
        ghost.remove();
      }
    },
    clear() {
      wipe();
      setHead(null);
    },
  };

  function abortPrintRun() {
    gen++;
    opsCtl.abort();
    opsCtl = new AbortController();
    chain = Promise.resolve();
    liveBars.clear();
    if (!printing && !printResolve) {
      park();
      setHead(null);
      return;
    }
    printing = false;
    queue = [];
    cur = null;
    printResolve?.({ cancelled: true, ms: performance.now() - printStart });
    printResolve = null;
    park();
    setHead(null);
  }
}
