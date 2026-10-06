// The isometric test bed in the right pane: 81 pillars on a plinth, persisted
// across page navigations. Each page runs a different program on the same
// cells; switching re-forms the bed in a staggered spring wave from the menu
// leader line. Canvas 2D, no dependencies.

import type { Fig } from "../data/site";

export type FigName = Fig;

type Origin = { clientX?: number; clientY?: number };
type Cell = [number, number];
type Program = { run: (i: number, j: number, t: number) => [h: number, lit: number]; read: (t: number, pc: Cell | null) => string };

const N = 9;
const ORDER: FigName[] = ["idle", "scan", "deploy", "trial", "log", "archive", "void"];
const TAU = Math.PI * 2;
const mod = (v: number, m: number) => ((v % m) + m) % m;
const hash = (a: number, b: number) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const pad = (v: number, w: number) => String(v).padStart(w, "0");

const BLIPS = new Set(["1,2", "6,1", "7,5", "2,6", "5,7", "3,3", "6,6"]);
const COLS = [0.7, 0.55, 0.62, 0.3, 0.45, 0.8, 0.25, 0.5, 0.38];
const MARK = [
  "..XXXXX..",
  ".XX...XX.",
  "......XX.",
  ".....XX..",
  "....XX...",
  "....XX...",
  ".........",
  "....XX...",
  "....XX...",
];

const PROGRAMS: Record<FigName, Program> = {
  idle: {
    run: (i, j, t) => [0.12 + 0.08 * Math.sin(i * 0.7 + t * 0.8) * Math.cos(j * 0.6 - t * 0.6), 0],
    read: (_t, pc) => (pc ? `CELL ${pc[0]}·${pc[1]}` : "REST"),
  },
  scan: {
    run: (i, j, t) => {
      const sweep = mod(t * 1.2, TAU);
      const d = mod(sweep - Math.atan2(j - 4, i - 4), TAU);
      if (BLIPS.has(`${i},${j}`)) return [0.62, d < 2.5 ? 1 - d / 2.5 : 0.25];
      const wedge = d < 1.1 ? 1 - d / 1.1 : 0;
      return [Math.hypot(i - 4, j - 4) <= 4.6 ? 0.08 + 0.5 * wedge : 0.08, 0];
    },
    read: t => `SWEEP ${pad(Math.round(mod(t * 1.2, TAU) * 180 / Math.PI), 3)}°`,
  },
  deploy: {
    run: (i, j, t) => {
      const f = mod(t * 1.6, 13);
      const k = (i + j) / 16 * 13;
      if (k < f) return [0.1 + 0.75 * k / 13, Math.abs(k - f) < 0.9 ? 1 : 0];
      return [0.06, 0];
    },
    read: t => `WEEK ${pad(Math.floor(mod(t * 1.6, 13)) + 1, 2)} / 13`,
  },
  trial: {
    run: (i, j, t) => {
      const n = Math.floor(t / 0.7);
      const rx = Math.floor(hash(n, 7) * 81);
      if (i === rx % 9 && j === Math.floor(rx / 9))
        return [0.9 * (1 - mod(t / 0.7, 1)), 1];
      const r1 = hash(i, j);
      const r2 = hash(j, i);
      return [0.1 + 0.35 * (0.5 + 0.5 * Math.sin(t * (1 + 2 * r1) + r2 * 6.283)), 0];
    },
    read: t => `TRIAL ${pad(Math.floor(t * 1.4), 4)}`,
  },
  log: {
    run: (i, j, t) => {
      const c = mod(t * 0.9, 11);
      const row = Math.floor(c);
      const frac = c - row;
      if (j === row && i === Math.floor(frac * 9)) return [0.5, 1];
      const written = j < row || (j === row && i < frac * 9);
      return [written ? (hash(i, j) > 0.25 ? 0.15 + 0.2 * hash(j, i) : 0.04) : 0.04, 0];
    },
    read: t => `LINE ${pad(Math.min(Math.floor(mod(t * 0.9, 11)), 8) + 1, 2)}`,
  },
  archive: {
    run: (i, j, t) => {
      const p = Math.floor(t * 0.5) % 9;
      const bump = j === p;
      return [COLS[i] * (j >= 2 ? 1 : 0.3) + (bump ? 0.2 : 0), bump ? 1 : 0];
    },
    read: t => `FILE ${pad(Math.floor(t * 0.5) % 9 + 1, 2)}`,
  },
  void: {
    // The "?" is mapped onto screen axes (rows ~ i+j, cols ~ i-j) so it reads
    // upright to the viewer rather than skewed along an iso axis.
    run: (i, j, t) => {
      const r = Math.round((i + j) / 2);
      const c = Math.round((i - j + 8) / 2);
      return MARK[r]?.[c] === "X" ? [0.55 + 0.05 * Math.sin(t * 1.5), 1] : [0.04, 0];
    },
    read: () => "NO SIGNAL",
  },
};

const K = 170;
const DAMP = 2 * 0.82 * Math.sqrt(K);

export function mountFigure(stage: HTMLElement) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const viz = stage.closest<HTMLElement>(".viz");
  const idEl = stage.parentElement?.querySelector<HTMLElement>(".fig-id");
  const valEl = stage.parentElement?.querySelector<HTMLElement>(".fig-val");

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100%;height:100%;display:block";
  stage.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  const probe = document.createElement("span");
  probe.style.display = "none";
  (viz ?? stage).appendChild(probe);

  let base: FigName = "idle";
  let baseColor: string | undefined;
  let baseCt: string | undefined;
  let requested: FigName = "idle";
  let started = false;
  let morphActive = false;

  // Pillar state: spring height, spring velocity, lit level, pending program switch.
  const h = new Float64Array(N * N);
  const v = new Float64Array(N * N);
  const lit = new Float64Array(N * N);
  const prog = new Int8Array(N * N).fill(0); // ORDER index per cell
  const pend = new Int8Array(N * N).fill(-1);
  const pendAt = new Float64Array(N * N);

  // Draw order: back to front by (i + j), then i.
  const cells: Cell[] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) cells.push([i, j]);
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);

  let W = 0, Hh = 0, dpr = 1, s = 0, cx = 0, cy = 0, hw = 0, hh = 0;
  let ink = "#0b1533", white = "#fff", faint = "#c9cfdd", accent = "#1b4dff";

  const resolveColors = () => {
    const cs = getComputedStyle(viz ?? stage);
    ink = cs.getPropertyValue("--ink").trim() || ink;
    white = cs.getPropertyValue("--white").trim() || white;
    faint = cs.getPropertyValue("--faint").trim() || faint;
    probe.style.color = "var(--c)";
    accent = getComputedStyle(probe).color;
  };

  const accentA = (a: number) => {
    const m = accent.match(/[\d.]+/g);
    return m ? `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${a})` : accent;
  };

  const layout = () => {
    const r = stage.getBoundingClientRect();
    W = r.width; Hh = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(Hh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The bed spans 18.8·s·0.866 wide and 11.25·s tall (plinth + tallest pillar).
    s = Math.min(W * 0.9 / (18.8 * 0.866), Hh * 0.9 / 11.25);
    cx = W / 2;
    cy = Hh / 2 - 3.425 * s;
    hw = s * 0.866 * 0.68; // pillar footprint, inset 16% each side
    hh = s * 0.5 * 0.68;
  };

  const groundX = (i: number, j: number) => cx + (i - j) * s * 0.866;
  const groundY = (i: number, j: number) => cy + (i + j) * s * 0.5;
  const topY = (i: number, j: number) => groundY(i, j) - h[j * N + i] * 2.2 * s;

  const targets = (idx: number, i: number, j: number, t: number): [number, number] => {
    const [th, tl] = PROGRAMS[ORDER[prog[idx]]].run(i, j, t);
    if (!pc) return [th, tl];
    const d = Math.hypot(i - pc[0], j - pc[1]);
    const idleP = ORDER[prog[idx]] === "idle";
    const rad = idleP ? 2.4 : 1.8;
    const amp = idleP ? 0.55 : 0.35;
    return [th + amp * Math.max(0, 1 - d / rad) ** 2, tl];
  };

  let pc: Cell | null = null; // pointer cell
  let pcDist = Infinity;

  const paint = (color?: string, ct?: string) => {
    if (!viz) return;
    if (color) viz.style.setProperty("--c", color);
    else viz.style.removeProperty("--c");
    if (ct) viz.style.setProperty("--ct", ct);
    else viz.style.removeProperty("--ct");
    resolveColors();
  };

  const plinth = () => {
    const pw = 9.4 * s * 0.866;
    const ph = 9.4 * s * 0.5;
    const my = cy + 4 * s;
    const t = 0.35 * s;
    ctx.fillStyle = white;
    ctx.strokeStyle = "#c9cfdd";
    ctx.lineWidth = 1;
    ctx.beginPath(); // left face
    ctx.moveTo(cx - pw, my); ctx.lineTo(cx, my + ph); ctx.lineTo(cx, my + ph + t); ctx.lineTo(cx - pw, my + t);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); // right face
    ctx.moveTo(cx + pw, my); ctx.lineTo(cx, my + ph); ctx.lineTo(cx, my + ph + t); ctx.lineTo(cx + pw, my + t);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); // top face
    ctx.moveTo(cx, my - ph); ctx.lineTo(cx + pw, my); ctx.lineTo(cx, my + ph); ctx.lineTo(cx - pw, my);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  };

  const pillar = (i: number, j: number, idx: number) => {
    const tx = groundX(i, j);
    const yb = groundY(i, j);
    const ty = yb - h[idx] * 2.2 * s;
    const li = lit[idx];
    // Face fills, back faces first.
    ctx.fillStyle = white;
    ctx.beginPath(); // left
    ctx.moveTo(tx - hw, ty); ctx.lineTo(tx, ty + hh); ctx.lineTo(tx, yb + hh); ctx.lineTo(tx - hw, yb);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); // right
    ctx.moveTo(tx + hw, ty); ctx.lineTo(tx, ty + hh); ctx.lineTo(tx, yb + hh); ctx.lineTo(tx + hw, yb);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); // top
    ctx.moveTo(tx, ty - hh); ctx.lineTo(tx + hw, ty); ctx.lineTo(tx, ty + hh); ctx.lineTo(tx - hw, ty);
    ctx.closePath(); ctx.fill();
    if (li > 0) {
      ctx.fillStyle = accentA(li * 0.22);
      ctx.beginPath();
      ctx.moveTo(tx, ty - hh); ctx.lineTo(tx + hw, ty); ctx.lineTo(tx, ty + hh); ctx.lineTo(tx - hw, ty);
      ctx.closePath(); ctx.fill();
    }
    // Silhouette: outer hexagon in ink.
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx, ty - hh); ctx.lineTo(tx + hw, ty); ctx.lineTo(tx + hw, yb);
    ctx.lineTo(tx, yb + hh); ctx.lineTo(tx - hw, yb); ctx.lineTo(tx - hw, ty);
    ctx.closePath(); ctx.stroke();
    // Inner seams in faint.
    ctx.strokeStyle = faint;
    ctx.beginPath();
    ctx.moveTo(tx + hw, ty); ctx.lineTo(tx, ty + hh); ctx.lineTo(tx - hw, ty);
    ctx.moveTo(tx, ty + hh); ctx.lineTo(tx, yb + hh);
    ctx.stroke();
    if (li > 0.5) {
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.moveTo(tx, ty - hh); ctx.lineTo(tx + hw, ty); ctx.lineTo(tx, ty + hh); ctx.lineTo(tx - hw, ty);
      ctx.closePath(); ctx.stroke();
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, Hh);
    plinth();
    for (const [i, j] of cells) pillar(i, j, j * N + i);
  };

  const snap = (t: number) => {
    for (const [i, j] of cells) {
      const idx = j * N + i;
      const [th, tl] = targets(idx, i, j, t);
      h[idx] = th; v[idx] = 0; lit[idx] = tl;
    }
    draw();
    if (valEl) valEl.textContent = PROGRAMS[requested].read(t, pc && pcDist < 1.5 * s ? pc : null);
  };

  let raf = 0;
  let last = 0;
  let running = false;

  const frame = (nowMs: number) => {
    if (!running) return;
    const now = nowMs / 1000;
    const dt = Math.min((nowMs - last) / 1000, 1 / 30);
    last = nowMs;
    const t = now;

    let pending = false;
    for (const [i, j] of cells) {
      const idx = j * N + i;
      if (pend[idx] >= 0 && now >= pendAt[idx]) { prog[idx] = pend[idx]; pend[idx] = -1; }
      if (pend[idx] >= 0) pending = true;
      const [th, tl] = targets(idx, i, j, t);
      const acc = (th - h[idx]) * K - v[idx] * DAMP;
      v[idx] += acc * dt;
      h[idx] += v[idx] * dt;
      const dl = tl - lit[idx];
      lit[idx] += Math.max(-6 * dt, Math.min(6 * dt, dl));
    }
    morphActive = pending;
    draw();
    if (valEl) valEl.textContent = PROGRAMS[requested].read(t, pc && pcDist < 1.5 * s ? pc : null);
    raf = requestAnimationFrame(frame);
  };

  const start = () => { if (!running && !reduce) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  let onScreen = true;
  const gate = () => { if (onScreen && !document.hidden) start(); else stop(); };
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; gate(); }).observe(stage);
  document.addEventListener("visibilitychange", gate);

  const ro = new ResizeObserver(() => {
    layout();
    if (reduce) snap(2);
    else draw();
  });
  ro.observe(stage);

  // Pointer: track over the whole .viz pane; bump the nearest pillar's neighbourhood.
  const findCell = (x: number, y: number) => {
    let best: Cell | null = null;
    let bd = Infinity;
    for (const [i, j] of cells) {
      const idx = j * N + i;
      const d = Math.hypot(groundX(i, j) - x, topY(i, j) - y);
      if (d < bd) { bd = d; best = [i, j]; }
    }
    pcDist = bd;
    pc = best;
  };
  const toStage = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  let touchTimer = 0;
  if (viz && !reduce) {
    viz.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const [x, y] = toStage(e);
      findCell(x, y);
    });
    viz.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse") return;
      clearTimeout(touchTimer);
      const [x, y] = toStage(e);
      findCell(x, y);
    });
    const clear = () => { pc = null; pcDist = Infinity; };
    viz.addEventListener("pointerleave", clear);
    viz.addEventListener("pointerup", e => {
      if (e.pointerType === "mouse") return;
      clearTimeout(touchTimer);
      touchTimer = window.setTimeout(clear, 1400);
    });
    viz.addEventListener("pointercancel", clear);
  } else if (viz) {
    // Reduced motion: still respond, but only with an immediate redraw.
    viz.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const [x, y] = toStage(e);
      findCell(x, y);
      snap(2);
    });
    viz.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse") return;
      const [x, y] = toStage(e);
      findCell(x, y);
      snap(2);
    });
    viz.addEventListener("pointerleave", () => { pc = null; pcDist = Infinity; snap(2); });
    viz.addEventListener("pointerup", () => { pc = null; pcDist = Infinity; snap(2); });
  }

  function go(name: FigName, origin: Origin | undefined, spreadMs: number) {
    if (started && requested === name && !morphActive) return;
    started = true;
    requested = name;
    const now = performance.now() / 1000;
    if (idEl) idEl.textContent = `RUN.0${ORDER.indexOf(name) + 1} / ${name.toUpperCase()}`;

    if (reduce) {
      for (const [i, j] of cells) pend[j * N + i] = -1;
      for (const [i, j] of cells) prog[j * N + i] = ORDER.indexOf(name);
      morphActive = false;
      snap(2);
      return;
    }

    const r = stage.getBoundingClientRect();
    const oy = origin?.clientY !== undefined ? Math.max(0, Math.min(r.height, origin.clientY - r.top)) : r.height / 2;
    const ox = origin?.clientX !== undefined ? origin.clientX - r.left : origin?.clientY !== undefined ? 0 : r.width / 2;
    const spread = spreadMs / 1000;

    let maxd = 0;
    const dist = new Float64Array(N * N);
    for (const [i, j] of cells) {
      const idx = j * N + i;
      dist[idx] = Math.hypot(groundX(i, j) - ox, topY(i, j) - oy);
      if (dist[idx] > maxd) maxd = dist[idx];
    }
    const want = ORDER.indexOf(name);
    for (const [i, j] of cells) {
      const idx = j * N + i;
      if (prog[idx] === want && pend[idx] < 0) continue;
      pend[idx] = want;
      pendAt[idx] = now + (maxd ? dist[idx] / maxd : 0) * spread;
    }
    morphActive = true;
  }

  layout();
  resolveColors();
  snap(2);
  gate();

  return {
    set(name: FigName, origin?: Origin, color?: string, ct?: string) {
      base = name; baseColor = color; baseCt = ct;
      paint(color, ct);
      go(name, origin, 560);
    },
    preview(name: FigName | null, origin?: Origin, color?: string, ct?: string) {
      if (name === null) { paint(baseColor, baseCt); go(base, origin, 320); }
      else { paint(color, ct); go(name, origin, 320); }
    },
    get current() { return base; },
  };
}
