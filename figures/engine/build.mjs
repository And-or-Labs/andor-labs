// Airliner high-bypass turbofan pod — hero figure for the .viz pane.
// Bare nacelle, floating: no stand, no pylon, no wing. The axis is yawed so the
// intake faces the viewer (fan face reads as a clearly open ellipse) while the
// exhaust runs out screen-left and slightly up. Opening it fades the casings
// to dashed ghost outlines — a phantom-view cutaway, Rolls-Royce poster style.
// npm run build:engine → public/fig/engine.html (committed; ~3 min).
// --preview also writes index.html; --audit runs the geometry audit.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../anatomy/kit/iso-kit.mjs";
import * as G from "../anatomy/kit/lathe.mjs";
import * as T from "../anatomy/kit/tube.mjs";
import * as A from "../anatomy/kit/audit.mjs";
import { glCamera } from "../anatomy/kit/gl.mjs";
import { glScript, kitScript } from "../anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TAU = Math.PI * 2;

const W = 560;
const H = 680;
const THEME = "light";

const BLUE = "#1b4dff";
const CORAL = "#f0764f";
const BUTTER = "#f2b705";

// ── Axis and frame ────────────────────────────────────────────────────────────
// At kit camera azimuth 45 / elevation 30 this axis projects at about 173 deg
// screen (left, slightly up) while the intake face opens at ~0.74 minor/major.
const AXIS = G.unit3([-0.95, 0.02, -0.31]);
const F = G.frameAlong([0, 0, 0], AXIS); // a = flow axis, u lateral, v nacelle-up
const V = [0.6123724357, 0.6123724357, 0.5]; // view direction for face culling
const axAt = (s) => G.add3(F.o, G.mul3(AXIS, s)); // world point on the axis

// s-stations measured along the axis from the intake rim (s=0) to the plug tip.
// The nacelle is ONE continuous smooth profile: rolled lip, max diameter at
// ~30% of its length, then a long gentle taper to the fan nozzle trailing edge.
// Nacelle length ~= 1.5x its max diameter (168 -> 252).
const D_MAX = 168;
const NAC = { s0: 0, s1: 252, rMax: D_MAX / 2 }; // outer skin, one lathe
const BORE = 68; // inner bore at the intake
const FAN = { s: 46, r0: 16, r1: 66.5, n: 18 }; // blade tips within ~2% of bore
const SPIN = { sTip: 10, sBase: 58, rBase: 20 }; // spinner ~0.28 x fan diameter
const OGV = { s: 82, n: 26, r0: 15, r1: 58 };
const CORE = { s0: 208, s1: 340, r0: 47, r1: 34 }; // core cowl, emerges ~0.55x D
const NOZ = { s0: 336, s1: 385, r0: 34, r1: 26 }; // primary nozzle, ~0.38x D
const FCHEV = { s: NAC.s1, r: 70.6, n: 14, amp: 2 }; // subtle rippled fan-nozzle edge
const PLUG = { s0: 352, s1: 458, r0: 27 }; // slender tail plug

// core internals revealed by the phantom cutaway (radii at core-case scale).
const LPC = { s0: 88, s1: 132, rows: [94, 120], rTip: 60 };
const HPC = { s0: 136, s1: 208, rows: [142, 158, 174, 190, 204], rTip0: 58, rTip1: 50 };
const COMB = { s0: 214, s1: 254, r: 52 };
const HPT = { s0: 256, s1: 282, rows: [262, 274], rTip: 52 };
const LPT = { s0: 284, s1: 356, rows: [292, 310, 328, 346], rTip0: 48, rTip1: 58 };
const GEAR = { s0: 96, s1: 142, ang: 4.5 }; // accessory gearbox, fan case underside
const TOP = Math.PI / 2; // nacelle-up angle on the frame (v)

// ── Fit ───────────────────────────────────────────────────────────────────────
const FIT_POINTS = [];
for (let i = 0; i < 8; i++) FIT_POINTS.push(G.pointOf(F, 2, NAC.rMax, (i / 8) * TAU));
for (let i = 0; i < 8; i++) FIT_POINTS.push(G.pointOf(F, NOZ.s1, NOZ.r0, (i / 8) * TAU));
FIT_POINTS.push(axAt(PLUG.s1));
FIT_POINTS.push(G.pointOf(F, 4, NAC.rMax + 8, TOP));
FIT_POINTS.push(G.pointOf(F, 215, NAC.rMax + 24, Math.PI * 1.5));
FIT_POINTS.push(G.pointOf(F, 160, -26, TOP)); // callout row headroom above

const P = k.fitProjection(FIT_POINTS, W, H, { pad: 26, headroom: 6 });
P.origin[0] -= 10; // leave room for the left-facing exhaust fade
P.origin[1] -= 20;
const at = (p) => k.iso(p, P);

// ── Recorder plumbing ─────────────────────────────────────────────────────────
const PIECES = {
  pod: { name: "Nacelle and core", move: [0, 0, 0] },
};
const STAGGER = ["pod"];
const SPRING = { stagger: 0.09, stiffness: 52, damping: 14, substeps: 4 };

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
let seq = 0;
const nameFor = (name) => `${seq++}:${name}`;
const items = R.items;
const record = (shape) => R.solid(shape);

function put(piece, refPoint, svg, { bias = 0, name, move, ride, shapes, route, chunk, cls, rot, hinge } = {}) {
  const id = nameFor(name ?? `${piece}.item`);
  R.put({ piece, ride: ride ?? piece, at: refPoint, bias, svg, move: move ?? PIECES[piece].move, shapes: shapes ?? [], name: id, route, chunk, cls, rot, hinge });
  return id;
}
function tubeItems(piece, route, r, { name, tone = "hi", bias = 0, maxLength, spacing, closed = false, owner, touch, bundle, limp = false, gaps = [], caps = true, ends = [true, true], rims, free = [false, false], cls } = {}) {
  const id = nameFor(name ?? `${piece}.tube`);
  R.route(id, route, r, { owner: owner ?? id, touch, bundle, limp, gaps, closed, ends, rims, free, piece, move: PIECES[piece].move, ride: piece });
  T.tubePieces(route, r, P, { maxLength, spacing, closed, gaps, caps }).forEach((part, index) =>
    put(piece, part.mid, T.tubeSvg(part, { tone }), { bias, name: `${id}:${index}`, route: id, chunk: index, cls, shapes: [A.tube(part.points, part.radii)] }),
  );
  return id;
}
// Lathe on the engine axis; meridian is [[s, r, soft?], ...] from intake to tail.
function latheA(piece, meridian, style = {}, { bias = 0, name, extra = "", shapes, fill, hole, rims, smooth, bevel, cls, hot, steps } = {}) {
  const id = nameFor(name ?? `${piece}.lathe`);
  const midS = (meridian[0][0] + meridian[meridian.length - 1][0]) / 2;
  const solid = G.lathe(meridian, F, P, { fill, hole, rims, smooth, bevel, ...(steps ? { steps } : {}) });
  const tint = hot ? `<path class="en-heat" fill-rule="evenodd" d="${solid.fill}"/>` : "";
  put(piece, axAt(midS), S(solid, { tone: "hi", ...style }) + tint + extra, {
    bias, name: id, cls,
    shapes: shapes ?? [record(A.lathe(F, meridian, { name: id }))],
  });
  return id;
}
// Sawtooth trailing edge drawn into the surface: the rim ring modulates s as a
// smoothed saw wave around the circumference — rounded tooth tips, one
// continuous edge band, not a separate zigzag sticker.
function chevronRing(piece, s, r, n, amp, { bias = 4, name } = {}) {
  const M = n * 12;
  const wave = (t) => { // triangle wave, tips rounded by pow; tips run aft
    const f = Math.abs(((n * t) / TAU + 0.5) % 1 - 0.5) * 2; // 1 at roots, 0 at tips
    return amp * (1 - Math.pow(f, 1.6));
  };
  const rim = [], edge = [];
  for (let i = 0; i <= M; i++) {
    const t = (i / M) * TAU;
    rim.push(G.pointOf(F, s - 1.5, r - 2.2, t));
    edge.push(G.pointOf(F, s - 1.5 + wave(t), r - 2.2 + wave(t) * 0.12, t));
  }
  const band = [...edge, ...[...rim].reverse()];
  const d = k.pathOf(band.map(at), true);
  const edgeD = k.pathOf(edge.map(at), true);
  put(piece, axAt(s), `<path class="iso-fill" d="${d}" fill="var(--anatomy-shade-1)"/><path class="iso-line" data-tone="hi" d="${edgeD}"/>`, { bias, name: nameFor(name ?? `${piece}.chevron`) });
}
// Fine surface detail: a short arc of a ring at one station.
const seamArc = (piece, s, r, a0, a1, { tone = "mid", cls, bias = 4, name } = {}) => {
  const pts = [];
  const n = 56;
  for (let i = 0; i <= n; i++) pts.push(G.pointOf(F, s, r, a0 + ((a1 - a0) * i) / n));
  put(piece, axAt(s), `<path class="iso-line" data-tone="${tone}" d="${k.pathOf(pts.map(at))}"/>`, { bias, cls, name: nameFor(name ?? `${piece}.seam`) });
};
// Axial seam line along the barrel between two stations at one angle.
const axialLine = (piece, s0, s1, r, ang, { tone = "mid", cls, bias = 4, name } = {}) => {
  const pts = [G.pointOf(F, s0, r, ang), G.pointOf(F, s1, r, ang)];
  put(piece, axAt((s0 + s1) / 2), `<path class="iso-line" data-tone="${tone}" d="${k.pathOf(pts.map(at))}"/>`, { bias, cls, name: nameFor(name ?? `${piece}.line`) });
};
// Small access panel: a rounded-corner loop laid on the barrel surface.
const panelMark = (piece, s, ang, sw, aw, r, { bias = 4 } = {}) => {
  const pts = [];
  const rr = 1.6;
  const cs = [[s + sw / 2 - rr, ang + aw / 2], [s + sw / 2, ang - aw / 2 + rr / r], [s - sw / 2 + rr, ang - aw / 2], [s - sw / 2, ang + aw / 2 - rr / r]];
  for (const [sc, ac] of cs) {
    pts.push(G.pointOf(F, sc - rr, r, ac));
    pts.push(G.pointOf(F, sc, r, ac));
    pts.push(G.pointOf(F, sc + rr, r, ac));
  }
  put(piece, axAt(s), `<path class="iso-line" data-tone="lo" stroke-opacity="0.7" d="${k.pathOf(pts.map(at), true)}"/>`, { bias, name: nameFor(`${piece}.panel`) });
};

// ── SVG fragments ─────────────────────────────────────────────────────────────
const S = (solid, { tone = "hi", cls = "" } = {}) =>
  `<path class="iso-fill${cls ? ` ${cls}` : ""}" d="${solid.fill}" fill="var(--anatomy-shade-${({ lo: 2, mid: 1, hi: 0 })[tone]})"/>` +
  `<path class="iso-line" data-tone="hi" d="${solid.outline}"/>` +
  (solid.lines ? `<path class="iso-line" data-tone="${tone}" d="${solid.lines}"/>` : "");
const Ln = (d, { tone = "hi", cls = "" } = {}) => `<path class="iso-line${cls ? ` ${cls}` : ""}" data-tone="${tone}" d="${d}"/>`;
const Dots = (pts, { size = 0.8, tone = "hi" } = {}) => `<path class="iso-dot iso-line" data-tone="${tone}" d="${pts.map((p) => `M${p[0].toFixed(1)} ${p[1].toFixed(1)}h0`).join(" ")}" stroke-width="${size}"/>`;

// ── Soft shadow: the pod floats ───────────────────────────────────────────────
{
  const under = axAt(215);
  const bottom = at(G.pointOf(F, 215, NAC.rMax, Math.PI * 1.5));
  const cx = at(axAt(200))[0], cy = bottom[1] + 18;
  const rx = Math.abs(at(axAt(20))[0] - at(axAt(420))[0]) * 0.5;
  put("pod", [under[0], under[1], under[2] - 200],
    `<ellipse class="en-shadow" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 0.13).toFixed(1)}"/>`,
    { bias: -400, name: "pod.shadow" });
}

// ── Nacelle: one continuous lathe, lip to fan-nozzle trailing edge ────────────
// Bore stays open through hole [0, BORE]; the fan fills it.
{
  const meridian = [
    [0, 66], [2, 74], [6, 81, 1], [12, 83.5, 1], [22, 84], [36, 84, 1],
    [52, 83.8], [76, 83.4, 1], [104, 81.4, 1], [134, 78.6, 1], [164, 75.8, 1],
    [194, 73.6, 1], [224, 72, 1], [244, 71], [252, 70.4],
  ];
  latheA("pod", meridian, { tone: "hi" }, {
    name: "pod.nacelle", cls: "en-case", steps: 160,
    hole: [0, BORE],
    shapes: [record(A.lathe(F, meridian, { name: "pod.nacelle" }))],
  });
  // rolled lip highlight + a couple of restrained seam lines
  seamArc("pod", 9, 82.6, 0, TAU, { tone: "mid", name: "pod.lip-line", cls: "en-case" });
  seamArc("pod", 128, 79.4, 0, TAU, { tone: "lo", name: "pod.seam-a", cls: "en-case" });
  seamArc("pod", 208, 73.4, 0, TAU, { tone: "lo", name: "pod.seam-b", cls: "en-case" });
  axialLine("pod", 60, 240, 80, 3.7, { tone: "lo", name: "pod.seam-long", cls: "en-case" });
  panelMark("pod", 96, 0.55, 15, 0.1, 81.4);
  panelMark("pod", 170, 0.5, 12, 0.09, 77.6);
}

// ── Bore: recessed annulus behind the fan for depth ──────────────────────────
{
  // recessed annulus in the fan plane: concentric with the blades
  put("pod", axAt(FAN.s), `<path class="en-recess" fill="var(--anatomy-hi)" fill-opacity="0.3" fill-rule="evenodd" d="${G.circleOf(F, FAN.s, BORE - 0.5, P, 96)}${G.circleOf(F, FAN.s, 14, P, 40)}"/>` + Ln(G.circleOf(F, FAN.s, BORE - 0.5, P, 96), { tone: "mid" }), { name: "pod.bore-wall" });
  put("pod", axAt(FAN.s), `<g class="en-blades" data-fan="0"></g>`, { bias: 8, name: "pod.blades" });
}
{
  // spinner cone, 0.28x fan diameter, painted swirl drawn by live.js
  latheA("pod", [[SPIN.sTip, 0.4], [SPIN.sTip + 4, 6], [SPIN.sTip + 16, 15, 1], [SPIN.sBase - 8, 19.6], [SPIN.sBase + 4, 20.2, 1], [SPIN.sBase + 8, 0.5]], { tone: "mid" }, {
    name: "pod.spinner", steps: 160,
    shapes: [record(A.lathe(F, [[SPIN.sTip, 0.4], [SPIN.sTip + 16, 15], [SPIN.sBase + 4, 20.2], [SPIN.sBase + 8, 0.5]], { name: "pod.spinner" }))],
  });
  seamArc("pod", SPIN.sBase - 2, 19.8, 0, TAU, { tone: "mid", name: "pod.spin-rim" });
  put("pod", axAt(SPIN.sBase - 16), `<path class="en-swirl" data-swirl/>`, { bias: 10, name: "pod.swirl" });
}
{
  // outlet guide vanes behind the fan, static spokes
  const vanes = [];
  for (let i = 0; i < OGV.n; i++) {
    const t = (i / OGV.n) * TAU + 0.1;
    const quad = [
      [OGV.r0, OGV.s - 3, t - 0.05], [OGV.r0, OGV.s - 3, t + 0.05],
      [OGV.r1, OGV.s + 3, t + 0.16], [OGV.r1, OGV.s + 3, t + 0.06],
    ];
    vanes.push(`M${quad.map(([r, s, a]) => { const q = at(G.pointOf(F, s, r, a)); return `${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }).join("L")}Z`);
  }
  put("pod", axAt(OGV.s), `<g class="en-ogv">${vanes.map((d) => `<path d="${d}"/>`).join("")}</g>`,
    { name: "pod.ogv", bias: 1 });
}

// ── Core cowl, primary nozzle, tail plug, chevron edges ──────────────────────
{
  const coreMer = [
    [CORE.s0, 40], [CORE.s0 + 14, 45, 1], [CORE.s0 + 40, 47, 1], [CORE.s0 + 76, 46, 1],
    [CORE.s0 + 108, 42, 1], [CORE.s1 - 6, 36], [CORE.s1, CORE.r1],
  ];
  latheA("pod", coreMer, { tone: "hi" }, { name: "pod.corecowl", cls: "en-case", steps: 160,
    shapes: [record(A.lathe(F, coreMer, { name: "pod.corecowl" }))] });
  // the bypass exit: dark annulus between nacelle inner wall and core cowl
  put("pod", axAt(NAC.s1 - 4), `<path class="en-recess" fill="var(--anatomy-shade-0)" d="${G.circleOf(F, NAC.s1 - 4, 68.5, P, 96)}"/>` + Ln(G.circleOf(F, NAC.s1 - 4, 68.5, P, 96), { tone: "mid" }), { name: "pod.bypass" });
}
{
  const nozMer = [[NOZ.s0, NOZ.r0], [NOZ.s0 + 10, 32, 1], [NOZ.s1 - 8, 28, 1], [NOZ.s1, NOZ.r1]];
  latheA("pod", nozMer, { tone: "hi" }, { name: "pod.nozzle", cls: "en-case", steps: 160,
    shapes: [record(A.lathe(F, nozMer, { name: "pod.nozzle" }))] });
  const plugMer = [[PLUG.s0, PLUG.r0], [PLUG.s0 + 20, 20, 1], [PLUG.s0 + 46, 11, 1], [PLUG.s0 + 74, 4], [PLUG.s1, 0.6]];
  latheA("pod", plugMer, { tone: "mid" }, { name: "pod.plug", steps: 160,
    shapes: [record(A.lathe(F, plugMer, { name: "pod.plug" }))] });
  // faint warm glow right at the core exit, scales with heat
  put("pod", axAt(NOZ.s1 - 3), `<path class="en-burn" d="${G.circleOf(F, NOZ.s1 - 3, NOZ.r1 - 1, P, 40)}"/>`, { bias: 6, name: "pod.exitglow" });
}
chevronRing("pod", FCHEV.s, FCHEV.r, FCHEV.n, FCHEV.amp, { name: "pod.chev" });
put("pod", axAt(NOZ.s1 - 1), `<path class="en-recess" d="${G.circleOf(F, NOZ.s1 - 1, NOZ.r1 - 1, P, 44)}"/>` + Ln(G.circleOf(F, NOZ.s1 - 1, NOZ.r1 - 1, P, 44), { tone: "mid" }), { bias: 5, name: "pod.nozrecess" });

// ── Core internals: crisp in the phantom cutaway (class en-int) ──────────────
// Shafts: LP runs fan to LPT exit, HP sleeve over the hot section.
{
  const inner = [];
  inner.push(S(G.lathe([[52, 7], [358, 7]], F, P), { tone: "mid" })); // LP shaft
  inner.push(S(G.lathe([[134, 11], [282, 11]], F, P), { tone: "mid" })); // HP shaft
  // compressor + turbine drums the blade rings sit on
  inner.push(S(G.lathe([[LPC.s0, 26], [LPC.s1, 30]], F, P), { tone: "mid" }));
  inner.push(S(G.lathe([[HPC.s0, 42], [HPC.s0 + 30, 40, 1], [HPC.s1, 32]], F, P), { tone: "mid" }));
  inner.push(S(G.lathe([[HPT.s0, 34], [LPT.s1 - 4, 30]], F, P), { tone: "mid" }));
  // combustor: annular case, injector boss ring, warm interior glow
  inner.push(S(G.lathe([[COMB.s0, 44], [COMB.s0 + 6, 52, 1], [COMB.s1 - 6, 52, 1], [COMB.s1, 44]], F, P), { tone: "mid" }));
  inner.push(Ln(G.circleOf(F, COMB.s0 + 10, 53, P, 52), { tone: "mid" }));
  inner.push(`<path class="en-burn" fill-rule="evenodd" d="${G.lathe([[COMB.s0 + 8, 40], [COMB.s1 - 8, 40]], F, P).fill}"/>`);
  // nozzle guide vanes between HPC exit and HPT: static curved vanes
  const ngv = [];
  for (let i = 0; i < 14; i++) {
    const t = (i / 14) * TAU + 0.05;
    const quad = [[20, 254, t - 0.07], [20, 254, t + 0.07], [50, 258, t + 0.22], [50, 258, t + 0.1]];
    ngv.push(`M${quad.map(([r, s, a]) => { const q = at(G.pointOf(F, s, r, a)); return `${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }).join("L")}Z`);
  }
  inner.push(`<g class="en-ogv">${ngv.map((d) => `<path d="${d}"/>`).join("")}</g>`);
  put("pod", axAt(215), `<g class="en-int">${inner.join("")}</g>`, { bias: 2, name: "pod.core" });
}
// Rotor blade rings: rebuilt per frame by live.js so they spin with N1/N2.
const ROTOR_ROWS = [];
{
  let idx = 0;
  const addRows = (rows, rTipAt, rHub, n, c0, w) => {
    for (const s of rows) {
      const rTip = typeof rTipAt === "function" ? rTipAt(s) : rTipAt;
      ROTOR_ROWS.push({ s, r0: rHub, r1: rTip, n, c0, c1: c0 * 0.55, w });
      // drafting style: a thin disc-rim ellipse behind the blade strokes
      const rim = Ln(G.circleOf(F, s, rTip - 1, P, 48), { tone: "mid" });
      put("pod", axAt(s), `<g class="en-int" data-rotor="${idx++}">${rim}</g>`, { bias: 4, name: nameFor("pod.rotor") });
    }
  };
  addRows(LPC.rows, LPC.rTip, 27, 16, 0.14, 1);            // LPC spins with fan (N1)
  addRows(HPC.rows, (s) => HPC.rTip0 + ((s - HPC.rows[0]) / (HPC.rows[HPC.rows.length - 1] - HPC.rows[0])) * (HPC.rTip1 - HPC.rTip0), 38, 22, 0.09, 1.7); // N2
  addRows(HPT.rows, HPT.rTip, 32, 14, 0.13, 1.7);
  addRows(LPT.rows, (s) => LPT.rTip0 + ((s - LPT.rows[0]) / (LPT.rows[LPT.rows.length - 1] - LPT.rows[0])) * (LPT.rTip1 - LPT.rTip0), 29, 12, 0.16, 1);
}
{
  // accessory gearbox on the fan case underside — stays solid when open
  const gc = G.pointOf(F, (GEAR.s0 + GEAR.s1) / 2, 78, GEAR.ang);
  const n = G.radialOf(F, GEAR.ang);
  const u = AXIS, v = G.unit3(G.cross3(AXIS, n));
  const gs = [];
  const o = G.sub3(gc, G.add3(G.mul3(u, 23), G.mul3(v, 7)));
  gs.push(S(G.prismOf(G.frameOf(o, n, u, v), [[0, 0], [46, 0], [46, 15], [0, 15]], 0, 10, P), { tone: "mid" }));
  gs.push(Dots([10, 23, 36].map((d) => at(G.add3(o, G.add3(G.mul3(u, d), G.add3(G.mul3(v, 7.5), G.mul3(n, 10.2)))))), { size: 1.2, tone: "hi" }));
  put("pod", gc, gs.join(""), { bias: 5, name: "pod.gearbox" });
  // fuel manifold ring + feed lines up from the gearbox to the combustor
  const ringPts = [];
  for (let i = 0; i <= 40; i++) ringPts.push(G.pointOf(F, COMB.s0 + 4, 56, (i / 40) * TAU));
  tubeItems("pod", ringPts, 1.3, { name: "pod.manifold", tone: "hi", closed: true, maxLength: 22, spacing: 1.4, cls: "en-int" });
  const feed = G.fillet([
    G.pointOf(F, GEAR.s1, 80, GEAR.ang), G.pointOf(F, 180, 66, GEAR.ang - 0.5), G.pointOf(F, COMB.s0 + 4, 58, GEAR.ang - 0.9),
  ], 6, 8, { P, tube: 1.4 });
  tubeItems("pod", feed, 1.4, { name: "pod.feedline", tone: "mid", maxLength: 14, spacing: 1.2, cls: "en-int" });
  const loom = G.fillet([
    G.pointOf(F, 88, 78.5, TOP - 0.1), G.pointOf(F, 150, 78, TOP - 0.18), G.pointOf(F, 226, 74, TOP - 0.24),
  ], 8, 10, { P, tube: 1.1 });
  tubeItems("pod", loom, 1.1, { name: "pod.loom", tone: "mid", maxLength: 16, spacing: 1.2, cls: "en-int" });
}

// ── AO-1 nameplate on the fan cowl, facing the viewer ────────────────────────
let clipN = 0;
function facePlate(piece, org, n3, u3, v3, w, h, { text = "", cls = "en-load", size = 5.4, bias = 6, attr = "", name } = {}) {
  const id = name ?? nameFor(`${piece}.plate`);
  const bezel = G.prismOf(G.frameOf(org, n3, u3, v3), [[-2.4, -1], [w + 2.4, -1], [w + 2.4, h + 1.4], [-2.4, h + 1.4]], 0, 1.6, P);
  const face = G.add3(org, G.mul3(n3, 1.6));
  const win = [face, G.add3(face, G.mul3(u3, w)), G.add3(G.add3(face, G.mul3(u3, w)), G.mul3(v3, h)), G.add3(face, G.mul3(v3, h))];
  const inner = win.map((p) => G.add3(p, G.add3(G.mul3(u3, 1.4), G.mul3(v3, 1))));
  const d3 = G.mul3(v3, -1);
  const o = at(inner[0]), pu = at(G.add3(inner[0], u3)), pv = at(G.add3(inner[0], d3));
  const mtx = `matrix(${(pu[0] - o[0]).toFixed(3)} ${(pu[1] - o[1]).toFixed(3)} ${(pv[0] - o[0]).toFixed(3)} ${(pv[1] - o[1]).toFixed(3)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`;
  const clipId = `en-clip-${clipN++}`;
  const centre = G.add3(face, G.add3(G.mul3(u3, w / 2), G.mul3(v3, h / 2)));
  put(piece, centre,
    S(bezel, { tone: "mid" }) +
    `<path d="${k.pathOf(win.map(at), true)}" fill="var(--anatomy-shade-0)"/>` +
    `<defs><clipPath id="${clipId}"><path d="${k.pathOf(inner.map(at), true)}"/></clipPath></defs>` +
    `<g clip-path="url(#${clipId})"><text class="${cls}" ${attr} x="1" y="${(h * 0.78).toFixed(1)}" font-size="${size}" transform="${mtx}">${text}</text></g>`,
    { bias, name: id, shapes: [record(A.orientedBox(G.add3(org, G.mul3(n3, 0.8)), [u3, v3, n3], [(w + 2.4) / 2, (h + 1.4) / 2 + 0.4, 0.85], { name: id }))] });
}
{
  // nameplate on the forward flank of the nacelle, beside the intake
  const ang = 2.85;
  const n = G.radialOf(F, ang);
  const u = G.unit3(G.mul3(AXIS, -1));
  const v = G.unit3(G.cross3(AXIS, n));
  const c = G.pointOf(F, 34, 84.6, ang);
  const org = G.sub3(G.sub3(c, G.mul3(u, 7)), G.mul3(v, 3.4));
  facePlate("pod", org, n, u, v, 14, 6.8, { text: "AO-1", attr: "", name: "pod.nameplate", bias: 7, size: 4.8, cls: "en-plate-txt" });
}

// ── Callouts: a row above the engine, leaders dropping to anchors ─────────────
// Labels are sorted by their anchors' screen x so the leaders can never cross;
// adjacent labels that would crowd move up to a second tier.
const CALL_ANCHORS = {
  fan: () => G.pointOf(F, FAN.s, 68, 2.2),
  lpc: () => G.pointOf(F, 104, 62, TOP + 0.5),
  hpc: () => G.pointOf(F, 172, 56, TOP + 0.45),
  combustor: () => G.pointOf(F, 234, 54, TOP + 0.35),
  hpt: () => G.pointOf(F, 268, 54, TOP + 0.3),
  lpt: () => G.pointOf(F, 322, 58, TOP + 0.25),
  gearbox: () => G.pointOf(F, 122, 84, GEAR.ang + 0.3),
};
{
  const entries = Object.entries(CALL_ANCHORS).map(([piece, fn]) => {
    const [ax, ay] = at(fn());
    return { piece, ax, ay };
  }).sort((a, b) => a.ax - b.ax);
  // two tiers, tracked independently: a label that would land within MIN_GAP
  // of the previous label on its tier drops to the other tier. Leaders are
  // vertical drops (single elbow if a label is nudged), so sorting by anchor
  // x guarantees they never cross.
  const TIER_A = 30, TIER_B = 52, MIN_GAP = 58;
  let lastA = -1e9, lastB = -1e9;
  entries.forEach(({ piece, ax, ay }) => {
    let ly = TIER_B;
    if (ax - lastB < MIN_GAP) ly = ax - lastA < MIN_GAP ? (lastB = Math.max(lastB, ax), TIER_B) : TIER_A;
    if (ly === TIER_B) lastB = Math.max(lastB, ax); else lastA = Math.max(lastA, ax);
    const cx = Math.max(40, Math.min(W - 46, ax));
    const svg = `<g class="en-callout"><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="1.2"/><path d="M${ax.toFixed(1)} ${ay.toFixed(1)} V${ly.toFixed(1)}${Math.abs(cx - ax) > 2 ? ` H${cx.toFixed(1)}` : ""}"/><text x="${cx.toFixed(1)}" y="${(ly - 4).toFixed(1)}" text-anchor="middle">${piece.toUpperCase()}</text></g>`;
    R.put({ piece: "pod", ride: "pod", at: CALL_ANCHORS[piece](), bias: 60, svg, move: [0, 0, 0], shapes: [], name: nameFor(`${piece}.callout`) });
  });
}

// ── Sort, groups, data ────────────────────────────────────────────────────────
const KS = 1;
const groups = items.map((item, index) => {
  const m = item.move, mx = m[0], my = m[1], mz = m[2];
  const cls = item.cls ? ` ${item.cls}` : "";
  return `<g class="it${cls}" data-piece="${item.piece}" data-ride="${item.ride}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const LABEL = "A bare high-bypass turbofan nacelle, floating: a rolled intake lip opens onto eighteen swept composite fan blades behind a conical spinner with a painted swirl. The nacelle runs one smooth line from lip to chevron fan nozzle; behind it the core cowl tapers to the chevroned primary nozzle and a slender tail plug. Hover or press Enter for the phantom cutaway: ghost casings reveal the shafts, compressor and turbine blade rows, combustor and gearbox.";

const nozExit = axAt(NOZ.s1);
const combW = axAt(232);
const combAt = at(combW);
const backSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg en-back" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="en-fallback"><ellipse cx="${combAt[0]}" cy="${combAt[1]}" rx="56" ry="22" fill="${BUTTER}" opacity="0.07"/></g></svg>`;
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg en-front" viewBox="0 0 ${W} ${H}" role="img" aria-label="${LABEL}"><g class="en-engine">${groups.join("")}</g></svg>`;
const frontSvgPhone = frontSvg.replaceAll("en-clip-", "en-clip-p");

const unit = (v) => { const o = at([0, 0, 0]); const p = at(v); return [p[0] - o[0], p[1] - o[1]]; };
const DATA = {
  W, H, V,
  EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]),
  proj: P,
  camera: glCamera(P),
  k: KS,
  nozzle: { exit: nozExit, dir: AXIS },
  comb: combW,
  frame: { o: F.o, a: F.a, u: F.u, v: F.v },
  fan: { s: FAN.s, r0: FAN.r0, r1: FAN.r1, n: FAN.n },
  spinner: { sBase: SPIN.sBase + 2, sTip: SPIN.sTip + 3, rBase: SPIN.rBase, turns: 1.5 },
  rotors: ROTOR_ROWS,
  moves: Object.fromEntries(Object.entries(PIECES).map(([id, p]) => [id, p.move])),
  stagger: STAGGER,
  spring: SPRING,
};

const titleBlock = `<div class="en-title" aria-hidden="true">
  <div class="en-trow"><span class="en-c">FIG</span><b>[0]</b><b class="en-n">HIGH-BYPASS TURBOFAN</b></div>
  <div class="en-trow en-half"><span class="en-cell"><span class="en-c">SHEET</span><b>1 OF 1</b></span><span class="en-cell"><span class="en-c">DRAWN</span><b>VJ</b></span></div>
  <div class="en-trow en-hint" data-f="hint">Hover to open it up</div>
</div>`;
const readout = `<div class="en-state" aria-hidden="true"><span class="en-c">STATE</span><b data-f="read">IDLE · N1 22% · 20 kN</b></div>`;
const stage = `<div class="en-stage" tabindex="0" role="button" aria-label="${LABEL} Press Enter to open it up." aria-pressed="false">${backSvg}<canvas class="en-gl" aria-hidden="true"></canvas>${frontSvg}</div>`;
const stagePhone = `<div class="en-stage" tabindex="0" role="button" aria-label="${LABEL} Press Enter to open it up." aria-pressed="false">${backSvg}<canvas class="en-gl" aria-hidden="true"></canvas>${frontSvgPhone}</div>`;
const body = `<figure class="en"><div class="en-plate">${stage}${titleBlock}${readout}</div><figcaption class="en-cap">A bare high-bypass turbofan, floating. Air in the front, thrust out the left. Hover opens the cowls.</figcaption></figure>`;

const CSS = readFileSync(join(HERE, "engine.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const FONT = readFileSync(join(HERE, "..", "..", "public", "fonts", "paper-mono", "PaperMono.woff2")).toString("base64");
const FONT_CSS = `@font-face{font-family:"Paper Mono";src:url(data:font/woff2;base64,${FONT}) format("woff2");font-weight:100 800;font-display:block}`;

const page = k.pageHtml({
  title: "High-bypass turbofan — engine figure",
  theme: THEME,
  body: `<style>${FONT_CSS}${CSS}</style>${body}<section class="en-strip"><h2>Phone strip · 390 × 220</h2><div class="en-phone"><div class="en-plate en-plate-phone">${stagePhone}${titleBlock}${readout}</div></div></section>`,
  script: kitScript() + glScript() + MODEL + LIVE,
  width: 620,
});
if (process.argv.includes("--preview")) writeFileSync(join(HERE, "index.html"), page);

// Site embed: the plate alone, scaled to fit the side pane; compact strip on phones hides the chrome.
const EMBED_CSS = `html{color-scheme:light}html,body{margin:0;height:100%;background:transparent;overflow:hidden}
.en-fit{position:absolute;inset:0}
.en-fit .en-plate{position:absolute;left:50%;top:50%;background:none;box-shadow:none;transform-origin:center}
.en-fit.compact .en-title{display:none}`;
const FIT = `(()=>{const f=document.querySelector(".en-fit"),p=f.querySelector(".en-plate");const fit=()=>{const w=innerWidth,h=innerHeight,c=h<400;f.classList.toggle("compact",c);const s=Math.min(w/620,h/720)*(c?1.2:1);const dy=c?-Math.max(0,(720*s-h)/2):0;p.style.transform="translate(-50%,calc(-50% + "+dy+"px)) scale("+s+")";};addEventListener("resize",fit);fit();})();`;
const embed = k.pageHtml({
  title: "Turbofan",
  theme: THEME,
  body: `<style>${FONT_CSS}${CSS}${EMBED_CSS}</style><div class="en-fit"><div class="en-plate">${stage}${titleBlock}${readout}</div></div>`,
  script: FIT + kitScript() + glScript() + MODEL + LIVE,
  width: 560,
});
const OUT = join(HERE, "..", "..", "public", "fig");
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "engine.html"), embed);
console.log(`wrote public/fig/engine.html ${(embed.length / 1024).toFixed(0)} KB · ${items.length} items · ${R.solids.length} solids · ${R.tubes.length} routes`);

if (process.argv.includes("--audit")) A.auditOrExit(R, P);
