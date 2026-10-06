// The microscope in the right pane, persisted across page navigations.
// Home shows the bench scope; every other name is a slide under the lens.
// Zooming in scales the scope up about the engaged objective and opens an
// iris; switching between lines of work slides one specimen out and the
// next in. Canvas 2D, no dependencies.

import type { Fig } from "../data/site";

export type FigName = Fig;

type Origin = { clientX?: number; clientY?: number };

const ORDER: FigName[] = ["scope", "web", "implant", "fly", "ink", "print", "empty"];
const MAG: Record<FigName, string> = { scope: "—", web: "10X", implant: "40X", fly: "4X", ink: "100X", print: "20X", empty: "40X" };
const TAU = Math.PI * 2;

const mulberry = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  const t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  const r = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (v: number, a: number, b: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;

// Fixed palette tokens (site constants) plus the resolved page accent.
const INK = "#0b1533", BLUE = "#1b4dff", CORAL = "#f0764f", GREEN = "#19b37a";
const LILAC = "#7c5cff", BUTTER = "#f2b705", FAINT = "#8a93ad", SKY = "#eef3ff", PAPER = "#f5f7fa", WHITE = "#ffffff";

const a = (c: string, al: number) => {
  if (c.startsWith("#")) {
    const n = parseInt(c.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${al})`;
  }
  const m = c.match(/[\d.]+/g);
  return m ? `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${al})` : c;
};

export function mountFigure(stage: HTMLElement) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const viz = stage.closest<HTMLElement>(".viz");
  const idEl = stage.parentElement?.querySelector<HTMLElement>(".fig-id");
  const valEl = stage.parentElement?.querySelector<HTMLElement>(".fig-val");
  const tagEl = stage.parentElement?.querySelector<HTMLElement>(".fig-tag");

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100%;height:100%;display:block";
  stage.appendChild(canvas);
  const vctx = canvas.getContext("2d")!;
  // The scene is drawn offscreen in CSS-pixel units, then rendered as ASCII.
  const scene = document.createElement("canvas");
  const ctx = scene.getContext("2d")!;
  const grid = document.createElement("canvas");
  const gctx = grid.getContext("2d")!;
  const canFilter = typeof ctx.filter === "string";

  const probe = document.createElement("span");
  probe.style.display = "none";
  (viz ?? stage).appendChild(probe);

  let base: FigName = "scope";
  let baseColor: string | undefined;
  let baseCt: string | undefined;
  let target: FigName = "scope";   // latest requested view
  let shown: FigName = "scope";   // specimen currently in the circle
  let started = false;

  // Zoom: z 0 = scope, 1 = zoomed. Animated from current value on retarget.
  let z = 0, zFrom = 0, zTo = 0, zT0 = 0, zDur = 1;
  // Slide swap: p 0..1, done at 1.
  let slideFrom: FigName | null = null;
  let slideTo: FigName | null = null;
  let slideP = 1;

  let W = 0, Hh = 0, dpr = 1;
  let cols = 0, rows = 0, cw = 0, ch = 0;
  let sceneScale = 1;            // scene px per CSS px (scene runs at 3x grid)
  let S = 1;                     // scene stroke-width factor for the ASCII pass
  let accent = BLUE, ct = INK;
  let px = 0.5, py = 0.5, lastMove = -10;   // pointer, normalised over .viz
  let panX = 0, panY = 0;                   // eased specimen pan, px

  const resolveColors = () => {
    probe.style.color = "var(--c)";
    accent = getComputedStyle(probe).color;
    probe.style.color = "var(--ct, var(--c))";
    ct = getComputedStyle(probe).color;
    plate = null;
  };

  const paint = (color?: string, ctv?: string) => {
    if (!viz) return;
    if (color) viz.style.setProperty("--c", color);
    else viz.style.removeProperty("--c");
    if (ctv) viz.style.setProperty("--ct", ctv);
    else viz.style.removeProperty("--ct");
    resolveColors();
  };

  const layout = () => {
    const r = stage.getBoundingClientRect();
    W = r.width; Hh = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(Hh * dpr);
    scene.width = Math.round(W);
    scene.height = Math.round(Hh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vctx.imageSmoothingEnabled = false;   // integer-aligned same-size glyph blits
    cols = 0;                    // force a grid rebuild
    scopeScale = (Hh * 0.72) / 137;
    scopeX = W / 2 - 55 * scopeScale;
    scopeY = Hh / 2 - 76 * scopeScale;
    objX = scopeX + 47 * scopeScale;
    objY = scopeY + 83 * scopeScale;
    webCells = null; tissue = null; plate = null; inkArt = null; fibresDirty = true;
  };

  // ---------- scope drawing (authored in a 110 x 146 unit space) ----------

  let scopeScale = 1, scopeX = 0, scopeY = 0, objX = 0, objY = 0;

  const stroke = (lw = 1.25, col = INK) => { ctx.lineWidth = lw * S; ctx.strokeStyle = col; ctx.stroke(); };
  const fillS = (col = WHITE) => { ctx.fillStyle = col; ctx.fill(); };

  const path = (pts: [number, number][], close = true) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close) ctx.closePath();
  };

  const drawScope = (t: number, focus: number) => {
    ctx.save();
    ctx.translate(scopeX, scopeY);
    ctx.scale(scopeScale, scopeScale);
    ctx.lineJoin = "round";

    // Density-field shading: tonal fills instead of outlines. Over the ~55%
    // mid fill, the ink overlay lands ~85% and the white overlay ~25%.
    const MID = a(INK, 0.6), DARK = a(INK, 0.62), HI = a(WHITE, 0.55);
    const SLAB = a(INK, 0.9), PALE = a(INK, 0.16);
    const body = (p: () => void, tone = MID, sh?: [number, number], hi?: [number, number]) => {
      p(); ctx.fillStyle = tone; ctx.fill("evenodd");
      if (!sh && !hi) return;
      ctx.save(); p(); ctx.clip("evenodd");
      if (sh) { ctx.fillStyle = DARK; ctx.fillRect(sh[0], -70, sh[1] - sh[0], 240); }
      if (hi) { ctx.fillStyle = HI; ctx.fillRect(hi[0], -70, hi[1] - hi[0], 240); }
      ctx.restore();
    };

    // Lamp glow: butter, breathing, rising through the gap toward the stage.
    const breathe = 0.45 + 0.15 * Math.sin(t * 0.9);
    let glow = ctx.createRadialGradient(47, 110, 1, 47, 110, 16);
    glow.addColorStop(0, a(BUTTER, breathe));
    glow.addColorStop(1, a(BUTTER, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(47, 110, 16, 0, TAU); ctx.fill();
    glow = ctx.createRadialGradient(47, 98, 0.5, 47, 98, 9);
    glow.addColorStop(0, a(BUTTER, breathe * 0.7));
    glow.addColorStop(1, a(BUTTER, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(47, 98, 9, 0, TAU); ctx.fill();

    // Wide horseshoe base, its front arch cut clean through (even-odd).
    const baseP = () => {
      ctx.beginPath();
      ctx.moveTo(14, 130);
      ctx.lineTo(14, 140);
      ctx.quadraticCurveTo(14, 145, 20, 145);
      ctx.lineTo(92, 145);
      ctx.quadraticCurveTo(98, 145, 98, 140);
      ctx.lineTo(98, 130);
      ctx.quadraticCurveTo(98, 125, 90, 125);
      ctx.lineTo(22, 125);
      ctx.quadraticCurveTo(14, 125, 14, 130);
      ctx.closePath();
      ctx.moveTo(40, 146);
      ctx.lineTo(40, 139);
      ctx.quadraticCurveTo(40, 133, 47, 133);
      ctx.lineTo(57, 133);
      ctx.quadraticCurveTo(64, 133, 64, 139);
      ctx.lineTo(64, 146);
      ctx.closePath();
    };
    body(baseP, MID, [74, 99], [18, 28]);

    // Lamp housing seated on the base top, butter window.
    const lampP = () => path([[41, 125], [41, 117], [43.5, 113], [51.5, 113], [54, 117], [54, 125]]);
    body(lampP, a(INK, 0.72), [49, 54], [42, 45]);
    ctx.fillStyle = a(BUTTER, 0.7 + 0.2 * Math.sin(t * 0.9));
    ctx.beginPath(); ctx.arc(47.5, 118, 2.8, 0, TAU); ctx.fill();

    // Cast arm: a C on the right, rising from the base rear to a head that
    // carries the tube on the left. The gap inside the C is what makes it read.
    const armP = () => {
      ctx.beginPath();
      ctx.moveTo(66, 126);
      ctx.bezierCurveTo(72, 108, 70, 82, 62, 60);
      ctx.lineTo(60, 56);
      ctx.lineTo(44, 56);
      ctx.lineTo(44, 42);
      ctx.lineTo(84, 44);
      ctx.bezierCurveTo(96, 72, 97, 102, 88, 126);
      ctx.closePath();
    };
    body(armP, MID, [82, 100], [46, 52]);

    // Inclination joint where the arm lands on the base.
    ctx.fillStyle = DARK;
    ctx.beginPath(); ctx.arc(76, 124, 4.6, 0, TAU); ctx.fill();
    ctx.fillStyle = a(WHITE, 0.6);
    ctx.beginPath(); ctx.arc(76, 124, 1.6, 0, TAU); ctx.fill();

    // Focus knobs: coaxial discs riding on the arm's outer edge, knurl ticks
    // rotating with pointer x.
    const rot = focus * TAU;
    ctx.fillStyle = SLAB;
    ctx.beginPath(); ctx.arc(97, 66, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = a(WHITE, 0.55); ctx.lineWidth = 1.4;
    for (let i = 0; i < 10; i++) {
      const an = rot + i * TAU / 10;
      ctx.beginPath();
      ctx.moveTo(97 + Math.cos(an) * 5.4, 66 + Math.sin(an) * 5.4);
      ctx.lineTo(97 + Math.cos(an) * 6.9, 66 + Math.sin(an) * 6.9);
      ctx.stroke();
    }
    ctx.fillStyle = MID;
    ctx.beginPath(); ctx.arc(97, 66, 3.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = a(WHITE, 0.5); ctx.lineWidth = 0.9;
    for (let i = 0; i < 8; i++) {
      const an = -rot * 1.6 + i * TAU / 8;
      ctx.beginPath();
      ctx.moveTo(97 + Math.cos(an) * 2.2, 66 + Math.sin(an) * 2.2);
      ctx.lineTo(97 + Math.cos(an) * 3.3, 66 + Math.sin(an) * 3.3);
      ctx.stroke();
    }

    // Rack housing on the head front: the block the tube runs through.
    const rackP = () => path([[46, 44], [60, 44], [60, 58], [46, 58]]);
    body(rackP, a(INK, 0.78), [54, 60], [46, 49]);
    ctx.strokeStyle = a(WHITE, 0.4); ctx.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(47, 47 + i * 1.8); ctx.lineTo(50, 47 + i * 1.8); ctx.stroke();
    }

    // Body tube: inclined ~20 degrees toward the left, ending in an eyepiece
    // cup clearly wider than the tube.
    ctx.save();
    ctx.translate(50, 54);
    ctx.rotate(-0.35);
    const tubeP = () => path([[-4.5, -44], [-4.5, 4], [4.5, 4], [4.5, -44]]);
    body(tubeP, MID, [0.5, 4.8], [-4.8, -2]);
    const collarP = () => path([[-5.6, -10], [-5.6, -4], [5.6, -4], [5.6, -10]]);
    body(collarP, a(INK, 0.78));
    const eyeP = () => path([[-4.5, -44], [-7.4, -54], [7.4, -54], [4.5, -44]]);
    body(eyeP, MID, [3, 7.6], [-7.6, -3.8]);
    ctx.strokeStyle = a(WHITE, 0.5); ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-5 + i * 3.4, -47); ctx.lineTo(-5 + i * 3.4, -51); ctx.stroke();
    }
    ctx.fillStyle = SLAB;
    ctx.fillRect(-8.4, -57, 16.8, 3.2);
    ctx.restore();

    // Revolving nosepiece hanging under the head.
    ctx.save();
    ctx.translate(49, 62);
    const noseP = () => { ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); };
    body(noseP, MID, [1.5, 6], [-6, -2.5]);
    ctx.fillStyle = SLAB;
    ctx.beginPath(); ctx.arc(0, 0, 1.7, 0, TAU); ctx.fill();
    for (const sgn of [1, -1]) {
      ctx.save();
      ctx.rotate(sgn * 0.68);
      path([[-1.9, 4.5], [1.9, 4.5], [1, 13], [-1, 13]]);
      ctx.fillStyle = DARK; ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // Engaged objective, vertical, tip on the slide, solid band blocks.
    path([[44.6, 65], [51.4, 65], [49.6, 82], [46.6, 82]]);
    ctx.fillStyle = MID; ctx.fill();
    ctx.fillStyle = BLUE; ctx.fillRect(45.2, 67.5, 5.6, 1.8);
    ctx.fillStyle = CORAL; ctx.fillRect(45.0, 71.5, 6.0, 1.8);
    ctx.fillStyle = GREEN; ctx.fillRect(44.9, 75.5, 6.2, 1.8);
    // Callout: OBJ 40X with a leader line.
    ctx.strokeStyle = a(INK, 0.7); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(24, 66); ctx.lineTo(42.5, 72); ctx.stroke();
    ctx.beginPath(); ctx.arc(43.4, 72.3, 0.9, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.font = mono(4.4); ctx.fillStyle = INK; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("OBJ 40X", 22.5, 65.5);

    // Stage: a dense dark slab sticking out to the left.
    path([[10, 86], [64, 86], [64, 92], [10, 92]]);
    ctx.fillStyle = SLAB; ctx.fill();
    // Slide: light strip, label zone, AND/OR, two clip marks.
    path([[28, 82], [62, 82], [62, 86], [28, 86]]);
    ctx.fillStyle = PALE; ctx.fill();
    ctx.fillStyle = a(WHITE, 0.5); ctx.fillRect(28, 82, 9, 4);
    ctx.fillStyle = INK;
    ctx.font = mono(3.1);
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("AND/OR", 28.6, 84.2);
    const clip = (x: number) => {
      path([[x, 92], [x + 1.3, 92], [x + 3.4, 83], [x + 2.1, 83]]);
      ctx.fillStyle = DARK; ctx.fill();
    };
    clip(40); clip(56);
    // Mechanical stage X/Y knobs under the platform.
    ctx.fillStyle = SLAB;
    ctx.beginPath(); ctx.arc(58, 98, 3.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(64.5, 98, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = a(WHITE, 0.55);
    ctx.beginPath(); ctx.arc(58, 98, 1.1, 0, TAU); ctx.fill();

    // Condenser under the stage with the iris diaphragm lever.
    const condP = () => path([[43, 92], [52, 92], [50, 100], [45, 100]]);
    body(condP, MID, [48, 52]);
    ctx.strokeStyle = SLAB; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(49.5, 97); ctx.lineTo(56, 102.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(56.4, 102.8, 1.1, 0, TAU); ctx.fillStyle = SLAB; ctx.fill();

    ctx.restore();
  };

  // ---------- shared specimen helpers ----------

  const fibreLayer = (seed: number, r: number, col = FAINT, alpha = 1) => {
    const c = document.createElement("canvas");
    const d = Math.ceil(r * 2 * dpr);
    c.width = c.height = d;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const rng = mulberry(seed);
    g.lineCap = "round";
    for (let i = 0; i < 300; i++) {
      const x = (rng() * 2 - 1) * r * 1.05;
      const y = (rng() * 2 - 1) * r * 1.05;
      const len = (5 + rng() * 16) * (col === FAINT ? 1 : 1.6);
      const ang = rng() * TAU;
      const bow = (rng() - 0.5) * 6;
      g.strokeStyle = a(col, (0.12 + rng() * 0.13) * alpha);
      g.lineWidth = col === FAINT ? 0.5 + rng() * 0.5 : 0.6 + rng() * 0.8;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + Math.cos(ang + 1.57) * bow,
        y + Math.sin(ang) * len * 0.5 + Math.sin(ang + 1.57) * bow,
        x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.stroke();
    }
    return c;
  };
  const fibres = new Map<string, HTMLCanvasElement>();
  let fibresDirty = false;
  const fibre = (key: string, seed: number, r: number, col?: string, alpha?: number) => {
    if (fibresDirty) { fibres.clear(); fibresDirty = false; }
    let c = fibres.get(key);
    if (!c) { c = fibreLayer(seed, r, col, alpha); fibres.set(key, c); }
    return c;
  };

  const mono = (size: number) => `${size}px 'Departure Mono', monospace`;

  // ---------- specimens (drawn centred at 0,0, field radius R) ----------

  const blob = (cx: number, cy: number, r: number, ph: number, t: number, wob: number) => {
    const NPTS = 10;
    ctx.beginPath();
    for (let i = 0; i <= NPTS; i++) {
      const ang = i / NPTS * TAU;
      const rr = r * (1 + wob * Math.sin(ph + ang * 3 + t * 0.5) + wob * 0.6 * Math.cos(ph * 1.7 - ang * 2 + t * 0.35));
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr * 0.94;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const pa = (i - 0.5) / NPTS * TAU;
        const pr = r * (1 + wob * Math.sin(ph + pa * 3 + t * 0.5) + wob * 0.6 * Math.cos(ph * 1.7 - pa * 2 + t * 0.35));
        ctx.quadraticCurveTo(cx + Math.cos(pa) * pr * 1.12, cy + Math.sin(pa) * pr * 1.05, x, y);
      }
    }
    ctx.closePath();
  };

  type WebCell = { x: number; y: number; r: number; ph: number; organ: { dx: number; dy: number; w: number; h: number; rot: number }[]; prem: number };
  let webCells: WebCell[] | null = null;
  let reticlePos: [number, number] = [0, 0];
  // Ad slot organelles in recognisable IAB ratios, scaled to a cell.
  const IAB = [[1.2, 1], [3.4, 0.55], [0.5, 1.3]];
  const webBuild = (R: number) => {
    const rng = mulberry(11);
    const cells: WebCell[] = [];
    const premSet = new Set([2, 6, 10, 13, 16, 19, 21]);
    for (let i = 0; i < 22; i++) {
      const gx = i % 5, gy = Math.floor(i / 5);
      const x = ((gx - 2) / 2 + (rng() - 0.5) * 0.34) * R * 0.74;
      const y = ((gy - 2) / 2.2 + (rng() - 0.5) * 0.3) * R * 0.78;
      if (Math.hypot(x, y) > R * 0.85) continue;
      const cr = R * (0.07 + rng() * 0.04);
      const n = 3 + Math.floor(rng() * 3);
      const organ = Array.from({ length: n }, () => {
        const sh = IAB[Math.floor(rng() * IAB.length)];
        const k = cr * 0.34;
        return {
          dx: (rng() - 0.5) * cr * 0.9, dy: (rng() - 0.5) * cr * 0.9,
          w: sh[0] * k, h: sh[1] * k, rot: (rng() - 0.5) * 0.9,
        };
      });
      cells.push({ x, y, r: cr, ph: rng() * TAU, organ, prem: premSet.has(i) ? [...premSet].indexOf(i) + 1 : 0 });
    }
    webCells = cells;
  };

  const drawWeb = (t: number, dt: number, R: number) => {
    if (!webCells) webBuild(R);
    for (const c of webCells!) {
      const jx = Math.sin(t * 0.24 + c.ph) * 0.8;
      const jy = Math.cos(t * 0.31 + c.ph * 1.3) * 0.8;
      const cx = c.x + jx, cy = c.y + jy;
      if (c.prem) {
        // Premium membrane: thicker accent stroke plus a faint halo.
        blob(cx, cy, c.r + 2.4, c.ph, t, 0.1);
        fillS(a(accent, 0.12));
      }
      blob(cx, cy, c.r, c.ph, t, 0.12);
      fillS(c.prem ? a(accent, 0.14) : a(FAINT, 0.1));
      // Membrane: two cells thick, ~55% darkness.
      ctx.lineWidth = cw * 2;
      ctx.strokeStyle = c.prem ? a(accent, 0.95) : a(c.ph > Math.PI ? LILAC : BLUE, 0.85);
      ctx.stroke();
      // Nucleus: lilac disc.
      ctx.fillStyle = a(LILAC, 0.7);
      ctx.beginPath(); ctx.arc(cx - c.r * 0.18, cy - c.r * 0.12, c.r * 0.3, 0, TAU); ctx.fill();
      // Ad-slot organelles: solid accent blocks in IAB ratios.
      ctx.fillStyle = a(accent, 0.9);
      for (const o of c.organ) {
        ctx.save();
        ctx.translate(cx + o.dx, cy + o.dy);
        ctx.rotate(o.rot);
        ctx.beginPath();
        ctx.roundRect(-o.w / 2, -o.h / 2, o.w, o.h, Math.min(o.w, o.h) * 0.3);
        ctx.fill();
        ctx.restore();
      }
    }
    // Premium account tags, flipped inward near the field edge.
    ctx.font = mono(10);
    ctx.textBaseline = "middle";
    for (const c of webCells!) {
      if (!c.prem) continue;
      const left = c.x > R * 0.35;
      const tx = c.x + (left ? -c.r - 6 : c.r + 6);
      const ty = c.y - c.r - 5;
      ctx.strokeStyle = a(accent, 0.9); ctx.lineWidth = 0.9 * S;
      ctx.beginPath(); ctx.moveTo(c.x + c.r * 0.7 * (left ? -1 : 1), c.y - c.r * 0.7); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.textAlign = left ? "right" : "left";
      ctx.fillText(`acct.0${c.prem}`, tx + (left ? -2 : 2), ty);
    }
    // Survey reticle hopping between premium accounts.
    const hop = Math.floor(t / 2.2) % 7;
    const pc = webCells!.find(c => c.prem === hop + 1);
    if (pc) {
      reticlePos[0] += (pc.x - reticlePos[0]) * Math.min(1, dt * 7);
      reticlePos[1] += (pc.y - reticlePos[1]) * Math.min(1, dt * 7);
      const s = pc.r + 7;
      const x = reticlePos[0], y = reticlePos[1];
      ctx.strokeStyle = a(accent, 0.95); ctx.lineWidth = 1 * S;
      ctx.strokeRect(x - s, y - s, s * 2, s * 2);
      const c = s * 0.42;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(x + sx * s, y + sy * s - sy * c); ctx.lineTo(x + sx * s, y + sy * s);
        ctx.lineTo(x + sx * s - sx * c, y + sy * s);
        ctx.stroke();
      }
    }
  };

  type Tissue = { pts: [number, number][]; cx: number; cy: number; d: number; nx: number; ny: number; nr: number; div: { ax: number; tHit: number } | null };
  let tissue: Tissue[] | null = null;
  const implantBuild = (R: number) => {
    const rng = mulberry(23);
    const cells: Tissue[] = [];
    const rCell = R * 0.26;
    const N = 6;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const cx = (i - (N - 1) / 2) * rCell * 1.34 + (j % 2 ? rCell * 0.67 : 0) + (rng() - 0.5) * rCell * 0.2;
      const cy = (j - (N - 1) / 2) * rCell * 1.16 + (rng() - 0.5) * rCell * 0.2;
      if (Math.hypot(cx, cy) > R * 0.95) continue;
      const nv = 7;
      const pts: [number, number][] = [];
      for (let v = 0; v < nv; v++) {
        const ang = v / nv * TAU + rng() * 0.3;
        const rr = rCell * (1.0 + rng() * 0.16);
        pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
      }
      cells.push({
        pts, cx, cy, d: Math.hypot(cx, cy) / rCell,
        nx: cx + (rng() - 0.5) * rCell * 0.5,
        ny: cy + (rng() - 0.5) * rCell * 0.5,
        nr: cw * (0.8 + rng() * 0.4),
        div: null,
      });
    }
    cells.sort((p, q) => p.d - q.d);
    // Centre cell first, and it never divides; 5 mid-ring cells do.
    for (const k of [4, 7, 10, 13, 16]) {
      if (cells[k]) cells[k].div = { ax: rng() * TAU, tHit: cells[k].d * 0.5 };
    }
    tissue = cells;
  };

  const poly = (pts: [number, number][]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };

  // Polygon scaled about its own centre, optionally stretched along u.
  const polyX = (pts: [number, number][], cx: number, cy: number, s: number, ux = 0, uy = 0, st = 1, ox = 0, oy = 0) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const dx = x - cx, dy = y - cy;
      const along = (dx * ux + dy * uy) * st;
      const px = cx + (dx - along * ux) * s + along * ux + ox;
      const pyy = cy + (dy - along * uy) * s + along * uy + oy;
      if (i === 0) ctx.moveTo(px, pyy); else ctx.lineTo(px, pyy);
    });
    ctx.closePath();
  };

  const drawImplant = (t: number, R: number) => {
    if (!tissue) implantBuild(R);
    const loop = (t % 16) / 16;                    // one 13-week pass
    const ring = loop * 4.4;                        // in cell-radius units: ~60% field coverage at week 13
    const WALL = a(INK, 0.62), WALLW = cw * 2.5;    // ~60% darkness, 2.5 cells
    const INNER = a(INK, 0.13), NUCL = a(INK, 0.9);
    const nucleus = (x: number, y: number, r = 0) => {
      ctx.fillStyle = NUCL;
      ctx.beginPath(); ctx.arc(x, y, r || cw, 0, TAU); ctx.fill();
    };
    const walls = () => { ctx.lineWidth = WALLW; ctx.strokeStyle = WALL; ctx.stroke(); };
    const fillCell = (litT: number) => {
      ctx.fillStyle = INNER; ctx.fill();
      if (litT > 0) { ctx.fillStyle = a(accent, 0.62 * litT); ctx.fill(); }
    };
    for (const c of tissue!) {
      const litT = clamp((ring - c.d) / 1.3, 0, 1);
      const isCentre = c === tissue![0];
      if (c.div) {
        const q = clamp((ring - c.div.tHit) / 0.9, 0, 1);
        if (q <= 0) {
          poly(c.pts);
          fillCell(litT); walls();
          nucleus(c.nx, c.ny, c.nr);
          continue;
        }
        const ux = Math.cos(c.div.ax), uy = Math.sin(c.div.ax);
        if (q < 0.55) {
          // Elongate along the division axis, still one cell.
          polyX(c.pts, c.cx, c.cy, 1, ux, uy, 1 + q * 0.85);
          fillCell(litT); walls();
          nucleus(c.nx, c.ny, c.nr);
        } else {
          // Pinch: wall line across the waist, two daughters, two nuclei.
          const sep = ((q - 0.55) / 0.45) * c.pts.reduce((m, p) => Math.max(m, Math.hypot(p[0] - c.cx, p[1] - c.cy)), 0) * 0.16;
          for (const sgn of [1, -1]) {
            polyX(c.pts, c.cx, c.cy, 0.74, 0, 0, 1, ux * sep * sgn, uy * sep * sgn);
            fillCell(litT); walls();
            nucleus(c.nx + ux * sep * sgn, c.ny + uy * sep * sgn, c.nr * 0.85);
          }
          ctx.strokeStyle = a(INK, 0.7); ctx.lineWidth = cw * 1.4;
          ctx.beginPath();
          ctx.moveTo(c.cx - uy * c.nr * 2, c.cy + ux * c.nr * 2);
          ctx.lineTo(c.cx + uy * c.nr * 2, c.cy - ux * c.nr * 2);
          ctx.stroke();
        }
        continue;
      }
      poly(c.pts);
      if (isCentre) {
        ctx.fillStyle = accent; ctx.fill();
        ctx.lineWidth = WALLW; ctx.strokeStyle = "#b34a28"; ctx.stroke();
        nucleus(c.nx, c.ny, c.nr * 1.15);
      } else {
        fillCell(litT);
        walls();
        nucleus(c.nx, c.ny, c.nr);
      }
    }
  };

  // Fly: Drosophila top view, head up. ~120 flicker neurons.
  const neurons = Array.from({ length: 120 }, (_, i) => {
    const rng = mulberry(100 + i);
    return { x: (rng() - 0.5) * 26, y: -34 + rng() * 30, ph: rng() * TAU };
  });

  const drawFly = (t: number) => {
    ctx.lineJoin = "round";
    // A glyph cell in fly units (the fly is drawn under a R/52 scale).
    const cu = cw * 52 / Math.max(1, Math.min(W, Hh) * 0.46);
    // Wings: ~15% fill with veins at ~50%.
    const twitch = Math.max(0, 1 - Math.abs(((t % 4.1) - 0.1) * 22)) * 0.05;
    for (const sgn of [1, -1]) {
      ctx.save();
      ctx.translate(sgn * 7, -14);
      ctx.rotate(sgn * (0.62 + twitch * Math.sin(t * 60)));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(sgn * 16, -8, sgn * 34, 0, sgn * 42, 16);
      ctx.bezierCurveTo(sgn * 30, 26, sgn * 10, 20, 0, 8);
      ctx.closePath();
      ctx.fillStyle = a(LILAC, 0.3); ctx.fill();
      // Longitudinal veins L1-L5 running to the margin.
      ctx.strokeStyle = a(INK, 0.55); ctx.lineWidth = cu * 0.5;
      const vein = (pts: number[]) => {
        ctx.beginPath(); ctx.moveTo(sgn * pts[0], pts[1]);
        ctx.bezierCurveTo(sgn * pts[2], pts[3], sgn * pts[4], pts[5], sgn * pts[6], pts[7]);
        ctx.stroke();
      };
      vein([1, -1, 14, -6, 30, -1, 40, 11]);   // L1+2 leading edge
      vein([1, 2, 16, 0, 30, 8, 39, 15]);      // L3
      vein([1, 5, 15, 8, 26, 15, 34, 19]);     // L4
      vein([0, 7, 10, 13, 18, 19, 24, 21]);    // L5 trailing
      // Two cross-veins.
      ctx.beginPath(); ctx.moveTo(sgn * 15, 1); ctx.lineTo(sgn * 16, 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sgn * 27, 7); ctx.lineTo(sgn * 28, 14); ctx.stroke();
      ctx.restore();
    }
    // Legs: coxa + femur + tibia + tarsus, angled, ~0.8 cell wide.
    ctx.strokeStyle = a(INK, 0.75); ctx.lineWidth = cu * 0.8; ctx.lineCap = "round";
    const leg = (p: number[], sgn: number) => {
      ctx.beginPath();
      ctx.moveTo(sgn * p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(sgn * p[i], p[i + 1]);
      ctx.stroke();
      // Bristle ticks along the tibia.
      ctx.strokeStyle = a(INK, 0.4); ctx.lineWidth = cu * 0.35;
      const mx = sgn * p[4], my = p[5];
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + sgn * 2, my - 2); ctx.stroke();
      ctx.strokeStyle = a(INK, 0.75); ctx.lineWidth = cu * 0.8;
    };
    for (const sgn of [1, -1]) {
      leg([8, -20, 14, -27, 24, -34, 30, -31, 36, -26], sgn); // front
      leg([11, -8, 18, -9, 27, -4, 32, 0, 38, 1], sgn);      // middle
      leg([9, 3, 15, 8, 25, 16, 30, 22, 35, 27], sgn);       // rear
    }
    // Abdomen: ~50% fill with alternating ~80% bands.
    const abdP = () => {
      ctx.beginPath();
      ctx.moveTo(-11, 2);
      ctx.bezierCurveTo(-13, 18, -8, 34, 0, 40);
      ctx.bezierCurveTo(8, 34, 13, 18, 11, 2);
      ctx.closePath();
    };
    abdP(); ctx.fillStyle = a(INK, 0.55); ctx.fill();
    ctx.save(); abdP(); ctx.clip();
    ctx.fillStyle = a(INK, 0.6);
    for (let i = 0; i < 3; i++) ctx.fillRect(-14, 10 + i * 11, 28, 5.5);
    ctx.restore();
    // Thorax: ~70% solid.
    ctx.beginPath(); ctx.ellipse(0, -12, 14, 16, 0, 0, TAU);
    ctx.fillStyle = a(INK, 0.75); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = a(WHITE, 0.4); ctx.fillRect(-14, -28, 5, 30); // light flank
    ctx.restore();
    // Thorax bristle pairs stay faint ticks.
    ctx.strokeStyle = a(INK, 0.4); ctx.lineWidth = cu * 0.35;
    const rngB = mulberry(5);
    for (let i = 0; i < 7; i++) {
      const bx = -8 + i * 2.7, by = -24 + rngB() * 3;
      for (const sgn of [1, -1]) {
        ctx.beginPath(); ctx.moveTo(bx, by + i * 1.1); ctx.lineTo(bx + sgn * 1.6, by + i * 1.1 - 3.2); ctx.stroke();
      }
    }
    // Head + compound eyes (coral facet dots on a coral field).
    ctx.beginPath(); ctx.arc(0, -32, 10, 0, TAU); ctx.fillStyle = a(INK, 0.6); ctx.fill();
    for (const sgn of [1, -1]) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(sgn * 6.6, -34, 5.6, 7, sgn * 0.25, 0, TAU); ctx.clip();
      ctx.fillStyle = a(CORAL, 0.6); ctx.fill();
      ctx.fillStyle = CORAL;
      for (let dy = -41; dy <= -27; dy += 2.1) for (let dx = -13; dx <= 13; dx += 2.1) {
        const ox = (Math.round((dy + 41) / 2.1) % 2) * 1.05;
        if (Math.hypot(dx + ox - sgn * 6.6, dy + 34) < 5.4) { ctx.beginPath(); ctx.arc(dx + ox, dy, 0.62, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    }
    // Antennae.
    ctx.strokeStyle = a(INK, 0.75); ctx.lineWidth = cu * 0.55;
    ctx.beginPath(); ctx.moveTo(-2, -41); ctx.quadraticCurveTo(-4, -46, -7, -47); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -41); ctx.quadraticCurveTo(4, -46, 7, -47); ctx.stroke();
    // Neurons: green cascade flicker inside head + thorax.
    const wave = (t * 16) % 56 - 40;
    for (const n of neurons) {
      const p = Math.max(0, 1 - Math.abs(n.y - wave) / 7);
      const al = p * (0.25 + 0.75 * Math.max(0, Math.sin(t * 9 + n.ph)));
      if (al < 0.05) continue;
      ctx.fillStyle = a(GREEN, al);
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.0, 0, TAU); ctx.fill();
    }
  };

  // Ink: "notes" in Newsreader italic at 100X — cap height ~45% of the field,
  // so only part of the word is visible as it pans slowly across the paper.
  type InkArt = { sharp: HTMLCanvasElement; feather: HTMLCanvasElement; w: number; h: number; nibY: number[] };
  let inkArt: InkArt | null = null;
  const inkBuild = (R: number) => {
    const fs = R * 1.28;                           // ~45% of field diameter cap height
    const meas = document.createElement("canvas").getContext("2d")!;
    meas.font = `italic 400 ${fs}px Newsreader, serif`;
    const w = Math.ceil(meas.measureText("notes").width * 1.1) + 8;
    const h = Math.ceil(fs * 1.25);
    const mk = (blur: number, col: string, al: number) => {
      const c = document.createElement("canvas");
      c.width = w * dpr; c.height = h * dpr;
      const g = c.getContext("2d")!;
      g.scale(dpr, dpr);
      if (blur && canFilter) g.filter = `blur(${blur}px)`;
      g.fillStyle = col; g.globalAlpha = al;
      g.font = `italic 400 ${fs}px Newsreader, serif`;
      g.textAlign = "left"; g.textBaseline = "alphabetic";
      // Double-stamp: fake-bold so hairline italic survives the glyph downsample.
      g.fillText("notes", 4, h * 0.78);
      g.fillText("notes", 4 + Math.max(1, fs * 0.012), h * 0.78);
      return c;
    };
    // Nib path: median ink y per column, sampled from the sharp mask.
    const src = mk(0, "#000", 1);
    const sd = src.getContext("2d")!.getImageData(0, 0, w * dpr, h * dpr).data;
    const nibY: number[] = new Array(Math.ceil(w / 3));
    for (let i = 0; i < nibY.length; i++) {
      const col = Math.floor(i * 3 * dpr);
      let sum = 0, n = 0;
      for (let y = 0; y < h * dpr; y += 2) {
        if (sd[(y * w * dpr + col) * 4 + 3] > 90) { sum += y / dpr; n++; }
      }
      nibY[i] = n ? sum / n : h * 0.78;
    }
    inkArt = { sharp: mk(0, INK, 0.92), feather: mk(2.6, INK, 0.22), w, h, nibY };
  };

  const drawInk = (t: number, R: number) => {
    // Paper fibres first, faint (10-15% darkness -> "." / "-").
    ctx.drawImage(fibre("ink", 7, R, "#b98a5e", 0.85), -R, -R, R * 2, R * 2);
    if (!inkArt) inkBuild(R);
    const { sharp, feather, w, h, nibY } = inkArt!;
    // Slow pan right-to-left, ~10s each way (ping-pong, eased at the ends).
    const span = Math.max(w / 2 - R * 0.62, R * 0.2) + R * 0.1;
    const ph = (t / 10) % 2;
    const u = ph < 1 ? ph : 2 - ph;
    const movingLeft = ph < 1;
    const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    const xoff = lerp(span, -span, e);
    const ox = xoff - w / 2, oy = -h * 0.78;
    ctx.drawImage(feather, ox, oy, w, h);
    ctx.drawImage(sharp, ox, oy, w, h);
    // Nib sheen follows the trailing edge of the visible word.
    const edgeX = movingLeft ? ox + w : ox;
    const colI = clamp(Math.floor((movingLeft ? w - 4 : 4) / 3), 0, nibY.length - 1);
    const ny = oy + nibY[colI];
    const sheen = ctx.createRadialGradient(edgeX, ny, 0.5, edgeX, ny, R * 0.12);
    sheen.addColorStop(0, a(BUTTER, 0.7)); sheen.addColorStop(1, a(BUTTER, 0));
    ctx.fillStyle = sheen;
    ctx.beginPath(); ctx.arc(edgeX, ny, R * 0.12, 0, TAU); ctx.fill();
    // A few warm fibres crossing in front of the wet ink.
    ctx.globalAlpha = 0.3;
    ctx.drawImage(fibre("ink-top", 13, R * 0.55, "#b98a5e", 0.8), -R * 0.55, -R * 0.55, R * 1.1, R * 1.1);
    ctx.globalAlpha = 1;
  };

  // Print: halftone "&" sampled into full-field screens, two misregistered plates.
  let plate: HTMLCanvasElement | null = null;
  const plateBuild = (R: number) => {
    const px = Math.ceil(R * 2 * dpr);
    // Source mask: big Newsreader "&" filled, then blurred for smooth dot ramps.
    const sharp = document.createElement("canvas");
    sharp.width = sharp.height = px;
    const sg = sharp.getContext("2d")!;
    sg.scale(dpr, dpr);
    sg.fillStyle = "#000";
    sg.font = `${R * 1.45}px Newsreader, serif`;
    sg.textAlign = "center"; sg.textBaseline = "middle";
    sg.fillText("&", R, R * 1.0);
    const src = document.createElement("canvas");
    src.width = src.height = px;
    const bg = src.getContext("2d")!;
    if (canFilter) bg.filter = `blur(${R * 0.035}px)`;
    bg.drawImage(sharp, 0, 0);
    const sd = bg.getImageData(0, 0, px, px).data;

    const c = document.createElement("canvas");
    c.width = c.height = px;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);

    const pitch = R / 42;
    const lum = (x: number, y: number) => {
      const ix = Math.round((x + R) * dpr), iy = Math.round((y + R) * dpr);
      return (ix >= 0 && iy >= 0 && ix < px && iy < px) ? sd[(iy * px + ix) * 4 + 3] / 255 : 0;
    };
    // One plate: screen rotated `ang`, dots over the whole field. Radius is a
    // function of mask luminance: near-zero in paper, merging inside the glyph.
    const dots = (angDeg: number, dx: number, dy: number, col: string, gain: number, base: number) => {
      g.save();
      g.translate(R + dx, R + dy);
      g.fillStyle = col;
      const ang = angDeg * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
      let row = 0;
      for (let gy = -R * 1.2; gy <= R * 1.2; gy += pitch, row++) {
        for (let gx = -R * 1.2 + (row % 2 ? pitch / 2 : 0); gx <= R * 1.2; gx += pitch) {
          const x = gx * ca - gy * sa, y = gx * sa + gy * ca;
          if (Math.hypot(x, y) > R * 1.1) continue;
          const r = pitch * (base + gain * lum(x, y));
          if (r < 0.15) continue;
          g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
      }
      g.restore();
    };
    dots(45, 2, 0, a(accent, 0.7), 0.5, 0);     // colour plate, misregistered 2px
    dots(15, 0, 0, a(INK, 0.85), 0.9, 0.06);    // key plate + base tone
    plate = c;
  };

  const drawPrint = (t: number, R: number) => {
    ctx.drawImage(fibre("print", 3, R), -R, -R, R * 2, R * 2);
    if (!plate) plateBuild(R);
    ctx.save();
    ctx.translate(Math.sin(t * 0.12) * 1.6 - R, Math.cos(t * 0.09) * 1.2 - R);
    ctx.drawImage(plate!, 0, 0, R * 2, R * 2);
    ctx.restore();
    // 85 LPI scale tag.
    ctx.font = mono(7);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = a(ct, 0.85);
    ctx.fillText("85 LPI", -R * 0.86, R * 0.88);
    ctx.strokeStyle = a(ct, 0.7); ctx.lineWidth = 0.8 * S;
    ctx.beginPath(); ctx.moveTo(-R * 0.86, R * 0.9); ctx.lineTo(-R * 0.86 + 26, R * 0.9); ctx.stroke();
  };

  const drawEmpty = (t: number, R: number) => {
    ctx.drawImage(fibre("empty", 9, R), -R, -R, R * 2, R * 2);
    // Dust speck: slow drift, solid enough to register as a glyph cluster.
    const dx = Math.sin(t * 0.21) * R * 0.5 - 12;
    const dy = Math.cos(t * 0.17) * R * 0.4 + 8;
    ctx.fillStyle = a(INK, 0.85);
    ctx.beginPath(); ctx.arc(dx, dy, cw * 0.55, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(dx - cw * 0.8, dy + cw * 0.4, cw * 0.32, 0, TAU); ctx.fillStyle = a(INK, 0.6); ctx.fill();
    // Curling hair fibre drifting through.
    ctx.save();
    ctx.translate(Math.sin(t * 0.11) * R * 0.5, Math.sin(t * 0.07) * R * 0.4);
    ctx.rotate(t * 0.05);
    ctx.strokeStyle = a(INK, 0.65); ctx.lineWidth = cw * 0.45; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-26, -14);
    ctx.bezierCurveTo(-10, -30, 12, -26, 22, -10);
    ctx.bezierCurveTo(28, -1, 24, 12, 14, 16);
    ctx.stroke();
    ctx.restore();
  };

  const drawSpecimen = (name: FigName, t: number, dt: number, R: number, ox: number, oy: number) => {
    ctx.save();
    ctx.translate(ox + panX, oy + panY);
    switch (name) {
      case "web": drawWeb(t, dt, R); break;
      case "implant": drawImplant(t, R); break;
      case "fly": ctx.save(); ctx.scale(R / 52, R / 52); drawFly(t); ctx.restore(); break;
      case "ink": drawInk(t, R); break;
      case "print": drawPrint(t, R); break;
      case "empty": drawEmpty(t, R); break;
      default: break;
    }
    ctx.restore();
  };

  // ---------- ASCII pass ----------
  // The scene above renders to an offscreen canvas in CSS pixels. Here it is
  // downsampled to a glyph grid: darkness picks a RAMP glyph, chroma picks the
  // nearest palette colour.
  const RAMP = " .\u00b7:-=+*#%@";
  const BUTTER_INK = "#8a6500";
  const hueOf = (r: number, g: number, b: number) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d === 0) return 0;
    let h = mx === r ? (g - b) / d % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; return h < 0 ? h + 360 : h;
  };
  // Palette order is the atlas row index; greys resolve to ink or faint.
  const PALC = [INK, FAINT, BLUE, CORAL, GREEN, LILAC, BUTTER_INK];
  const PALH: [number, number][] = [[15.9, 3], [44, 6], [155.6, 4], [226, 2], [253.5, 5]];
  const pickColour = (r: number, g: number, b: number) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    // Chroma first: ink is a navy-grey whose own chroma maxes at 40, so any
    // near-grey sample is ink or faint; only clearly saturated samples are
    // accents. This also keeps dark saturated accents (green on ink) alive.
    if (mx - mn < 42) return (mx + mn) / 510 > 0.55 ? 1 : 0;
    const h = hueOf(r, g, b);
    let best = 360, col = 2;
    for (const [ph, pi] of PALH) {
      const d = Math.min(Math.abs(h - ph), 360 - Math.abs(h - ph));
      if (d < best) { best = d; col = pi; }
    }
    return col;
  };

  // Glyphs are pre-rendered to a sprite atlas; fillText per cell is too slow.
  // Alpha is baked into the sprites at AB quantised levels, so the hot loop
  // never touches globalAlpha: one state-free drawImage per cell.
  const AB = 6;
  let atlas: HTMLCanvasElement | null = null, gw = 0, gh = 0;
  const buildAtlas = () => {
    gw = Math.ceil(cw * 2); gh = Math.ceil(ch * 1.1);
    atlas = document.createElement("canvas");
    atlas.width = gw * dpr * RAMP.length;
    atlas.height = gh * dpr * PALC.length * AB;
    const a2 = atlas.getContext("2d")!;
    a2.scale(dpr, dpr);
    a2.font = `${cw * 1.4}px 'Departure Mono', ui-monospace, monospace`;
    a2.textAlign = "center"; a2.textBaseline = "middle";
    PALC.forEach((col, ci) => {
      a2.fillStyle = col;
      for (let al = 0; al < AB; al++) {
        a2.globalAlpha = 0.4 + (al / (AB - 1)) * 0.6;
        for (let gi = 0; gi < RAMP.length; gi++) {
          a2.fillText(RAMP[gi], gi * gw + gw / 2, (ci * AB + al) * gh + gh / 2);
        }
      }
    });
  };

  // Magnification is density: the cell pitch tweens with the zoom value.
  const updateGrid = () => {
    const wantCols = Math.max(24, Math.round(W / lerp(7, 5, z)));
    if (wantCols !== cols) {
      cols = wantCols; cw = W / cols; ch = cw * 1.8;
      rows = Math.max(1, Math.ceil(Hh / ch));
      grid.width = cols; grid.height = rows;
      gctx.imageSmoothingEnabled = true;
      gctx.imageSmoothingQuality = "high";
      // Scene renders at 3x the grid: enough to average, ~4x cheaper raster.
      sceneScale = (cols * 3) / W;
      scene.width = cols * 3; scene.height = Math.round(Hh * sceneScale);
      ctx.setTransform(sceneScale, 0, 0, sceneScale, 0, 0);
      buildAtlas();
    }
    // S * sceneScale lands ~1 scene px of stroke per 3px cell (~36% coverage).
    S = Math.max(1.5, cw / 2.8);
  };

  const drawAscii = () => {
    gctx.clearRect(0, 0, cols, rows);
    gctx.drawImage(scene, 0, 0, cols, rows);
    const img = gctx.getImageData(0, 0, cols, rows).data;
    vctx.clearRect(0, 0, W, Hh);
    const n = RAMP.length - 1, sw = gw * dpr, sh = gh * dpr;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const p = (j * cols + i) * 4;
      if (img[p + 3] < 16) continue;
      const al = img[p + 3] / 255;
      const r = img[p] * al + 255 * (1 - al);
      const g = img[p + 1] * al + 255 * (1 - al);
      const b = img[p + 2] * al + 255 * (1 - al);
      const dark = 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (dark < 0.06) continue;
      // Boost mid-tones: thin strokes and pale fills must still pick real glyphs.
      const de = Math.pow(dark, 0.45);
      const gi = Math.min(n, 1 + Math.floor(de * (n - 1)));
      const row = pickColour(r, g, b) * AB + Math.round(de * (AB - 1));
      vctx.drawImage(atlas!, gi * sw, row * sh, sw, sh,
        Math.round(i * cw + cw / 2 - gw / 2), Math.round(j * ch + ch / 2 - gh / 2), gw, gh);
    }
  };

  const drawLensChrome = (cx: number, cy: number, R: number) => {
    // One eyepiece ring, ~40% darkness and two cells wide.
    ctx.strokeStyle = a(INK, 0.44); ctx.lineWidth = cw * 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    // Reticle crosshair at ~15%.
    ctx.strokeStyle = a(INK, 0.15); ctx.lineWidth = cw * 0.4;
    ctx.beginPath(); ctx.moveTo(cx - R * 0.96, cy); ctx.lineTo(cx + R * 0.96, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R * 0.96); ctx.lineTo(cx, cy + R * 0.96); ctx.stroke();
  };

  // ---------- frame ----------

  const draw = (t: number, dt: number, now: number) => {
    updateGrid();
    ctx.clearRect(0, 0, W, Hh);
    const R = Math.min(W, Hh) * 0.46;
    const q = smooth(z, 0.45, 1);          // iris progress
    const cx = lerp(objX, W / 2, q);
    const cyy = lerp(objY, Hh / 2, q);
    const r = Math.max(0.001, lerp(2, R, easeOutQuint(q)));

    // Scope: scales up about the objective/slide contact, fading as the iris opens.
    const scopeAlpha = 1 - smooth(z, 0.5, 0.95);
    if (scopeAlpha > 0.001) {
      const s = 1 + z * 6;
      ctx.save();
      ctx.globalAlpha = scopeAlpha;
      ctx.translate(objX, objY);
      ctx.scale(s, s);
      ctx.translate(-objX, -objY);
      drawScope(t, px);
      ctx.restore();
    }

    if (q > 0.001) {
      // Specimen(s) inside the circle, with slide-swap offsets and defocus.
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cyy, r, 0, TAU); ctx.clip();
      const zProg = clamp((now - zT0) / zDur, 0, 1);
      const zoomBlur = zTo === 1 ? 6 * clamp(1 - (zProg - 0.6) / 0.4, 0, 1) : 0;
      const swapBlur = slideP < 1 ? 3 * Math.sin(Math.PI * slideP) : 0;
      const blur = Math.max(zoomBlur, swapBlur);
      const slideW = r * 2.05;
      const drawOne = (name: FigName, off: number) => {
        ctx.save();
        // Defocus in ASCII mode is a lower-contrast pass.
        if (blur > 0.05) ctx.globalAlpha = 0.5;
        drawSpecimen(name, t, dt, R, cx + off, cyy);
        ctx.restore();
      };
      if (slideP < 1 && slideFrom && slideTo) {
        drawOne(slideFrom, -slideP * slideW);
        drawOne(slideTo, (1 - slideP) * slideW);
      } else if (shown !== "scope") {
        drawOne(shown, 0);
      }
      ctx.restore();

      // Lens chrome fades in with the last stretch of iris.
      const chrome = smooth(z, 0.7, 0.98);
      if (chrome > 0.001) {
        ctx.save();
        ctx.globalAlpha = chrome;
        drawLensChrome(cx, cyy, r);
        ctx.restore();
      }
    }

    drawAscii();
  };

  const caption = (t: number, now: number) => {
    switch (target) {
      case "scope": return now - lastMove < 0.9 ? `FOCUS ${px.toFixed(2)}` : "READY";
      case "web": return "ACCOUNTS 07 / 36";
      case "implant": return `WEEK ${String(Math.floor((t % 16) / 16 * 13) + 1).padStart(2, "0")} / 13`;
      case "fly": return "NEURONS 1,045";
      case "ink": return "STROKE 0.4 MM";
      case "print": return "85 LPI";
      case "empty": return "NO SPECIMEN";
    }
  };

  let raf = 0, last = 0, running = false;
  const frame = (nowMs: number) => {
    if (!running) return;
    const now = nowMs / 1000;
    const dt = Math.min((nowMs - last) / 1000, 1 / 30);
    last = nowMs;
    const t = now;

    const zp = clamp((now - zT0) / zDur, 0, 1);
    z = lerp(zFrom, zTo, easeOutQuint(zp));
    if (slideP < 1) {
      slideP = Math.min(1, slideP + dt / 0.45);
      if (slideP >= 1 && slideTo) { shown = slideTo; slideFrom = slideTo = null; }
    }
    // Specimen pan: eased opposite the pointer while zoomed.
    const tx = (0.5 - px) * 24, ty = (0.5 - py) * 24;
    panX += (clamp(tx, -12, 12) - panX) * Math.min(1, dt * 6);
    panY += (clamp(ty, -12, 12) - panY) * Math.min(1, dt * 6);

    draw(t, dt, now);
    if (valEl) valEl.textContent = caption(t, now);
    raf = requestAnimationFrame(frame);
  };

  const start = () => { if (!running && !reduce) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  let onScreen = true;
  const gate = () => { if (onScreen && !document.hidden) start(); else stop(); };
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; gate(); }).observe(stage);
  document.addEventListener("visibilitychange", gate);

  const ro = new ResizeObserver(() => { layout(); if (reduce) redraw(); });
  ro.observe(stage);

  const redraw = () => draw(reduce ? 8 : performance.now() / 1000, 1 / 60, performance.now() / 1000);

  // Pointer over the whole .viz: focus knob on scope, slide pan when zoomed.
  if (viz) {
    viz.addEventListener("pointermove", e => {
      const r = viz.getBoundingClientRect();
      px = clamp((e.clientX - r.left) / r.width, 0, 1);
      py = clamp((e.clientY - r.top) / r.height, 0, 1);
      lastMove = performance.now() / 1000;
      if (reduce) redraw();
    });
    viz.addEventListener("pointerleave", () => {
      px = 0.5; py = 0.5; lastMove = -10;
      if (reduce) redraw();
    });
  }

  function go(name: FigName, _durMs: number, delayMs = 0) {
    if (name === target && (slideP >= 1 || slideTo === name || z < 0.99)) return;
    target = name;
    if (idEl) idEl.textContent = name === "scope" ? "SCOPE" : `SPECIMEN 0${ORDER.indexOf(name)} / ${name.toUpperCase()}`;
    if (tagEl) tagEl.textContent = `BENCH SCOPE / ${MAG[name]}`;

    const now = performance.now() / 1000 + delayMs / 1000;
    if (reduce) {
      z = zFrom = zTo = name === "scope" ? 0 : 1;
      shown = name; slideFrom = slideTo = null; slideP = 1;
      redraw();
      return;
    }

    zFrom = z;
    zTo = name === "scope" ? 0 : 1;
    zT0 = now;
    zDur = zTo === 1 ? 0.75 : 0.6;

    if (name === "scope") {
      // Leave `shown` as-is: the circle closes over the last specimen.
    } else if (z < 0.99) {
      // Mid-zoom or from scope: the iris reveals the latest target directly.
      shown = name;
      slideFrom = slideTo = null;
      slideP = 1;
    } else if (shown !== name && slideTo !== name) {
      // Zoomed swap. Mid-swap: the dominant specimen becomes the outgoing side.
      if (slideP < 1 && slideFrom && slideTo) {
        if (slideP > 0.5) slideFrom = slideTo;
        slideTo = name;
        slideP = slideP > 0.5 ? 1 - slideP : slideP;
      } else {
        slideFrom = shown;
        slideTo = name;
        slideP = 0;
      }
    }
  }

  layout();
  resolveColors();
  if (idEl) idEl.textContent = "SCOPE";
  if (tagEl) tagEl.textContent = "BENCH SCOPE / —";
  if (valEl) valEl.textContent = "READY";
  draw(8, 1 / 60, 0);
  gate();

  return {
    set(name: FigName, _origin?: Origin, color?: string, ctv?: string) {
      base = name; baseColor = color; baseCt = ctv;
      paint(color, ctv);
      const first = !started;
      started = true;
      // First load of an inner page: hold the scope for 200ms, then zoom in.
      go(name, 750, first && name !== "scope" ? 200 : 0);
    },
    preview(name: FigName | null, _origin?: Origin, color?: string, ctv?: string) {
      if (name === null) { paint(baseColor, baseCt); go(base, 600); }
      else { paint(color, ctv); go(name, 750); }
    },
    get current() { return base; },
  };
}
