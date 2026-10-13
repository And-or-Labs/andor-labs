// GPU inference sled — hero figure for the .viz pane.
// Electricity in (upper left), heat up, binary out (lower right).
// npm run build:fig → public/fig/gpu.html (committed; ~3 min). --preview also writes index.html; --audit runs the geometry audit.

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

// ── Layout (world units, z up) ───────────────────────────────────────────────
const MAT_Z = 0; // floor plane
const CARD = { x0: -140, x1: 140, y0: -55, y1: 55 };
const Z_BACK = 12; // backplate bottom (rests on the stands)
const BACK_T = 3;
const PCB_Z = Z_BACK + BACK_T; // 15
const PCB_T = 1.6;
const COMP_Z = PCB_Z + PCB_T; // 16.6
const DIE_AT = [0, 30];
const DIE_TOP = 19.2;
const VAPOR = { x0: -125, x1: 105, y0: -42, y1: 42, z: DIE_TOP, h: 2.8 }; // 19.2..22
const FINS = { y0: -44, y1: 44, z: 22, h: 12 }; // 22..34
const FIN_BLOCKS = [
  { x0: -130, x1: -54 },
  { x0: -44, x1: 42 },
  { x0: 52, x1: 130 },
];
const GAPS = [-49, 48]; // gap centres between fin blocks
const FIN_TOP = FINS.z + FINS.h; // 34
const SHROUD = { z: 34, h: 5, y0: -50, y1: 50 }; // 34..39
const SHROUD_TOP = SHROUD.z + SHROUD.h; // 39
const FAN_X = [-88, 0, 88];
const FAN_RING_R = 32; // reaches the square opening walls
const FAN_BLADE_R = 24.5;
const BRACKET = { x: 140, t: 4, y0: -52, y1: 52, z: 12, h: 28 };
const SOCK = { x: -135, y: -55, w: 20, d: 9, z: COMP_Z, h: 7 };
const PSU = { x: -212, y: -98, w: 44, d: 36, z: MAT_Z, h: 28 };
const STAND_X = [-100, 100];
const STREAM = { at: [150, 8, MAT_Z + 0.4], dir: [1, 0], len: 65 };

// ── Explode ──────────────────────────────────────────────────────────────────
const PIECES = {
  fans: { name: "Fans", move: [0, 0, 150] },
  shroud: { name: "Shroud", move: [0, 0, 122] },
  fins: { name: "Fin stack", move: [0, 0, 94] },
  vapor: { name: "Vapor chamber and pipes", move: [0, 0, 68] },
  pcb: { name: "Board, die and bracket", move: [0, 0, 40] },
  backplate: { name: "Backplate", move: [0, 0, 12] },
  bench: { name: "Bench", move: [0, 0, 0] },
};
const STAGGER = ["fans", "shroud", "fins", "vapor", "pcb", "backplate"];
const SPRING = { stagger: 0.05, stiffness: 58, damping: 13.5, substeps: 4 };

// ── Projection ───────────────────────────────────────────────────────────────
const FIT_POINTS = [
  [CARD.x0, CARD.y0, 0], [CARD.x1, CARD.y1, 0],
  [PSU.x, PSU.y, PSU.z + PSU.h],
  [STREAM.at[0] + STREAM.dir[0] * STREAM.len, STREAM.at[1] + STREAM.dir[1] * STREAM.len, 0],
];
const P = k.fitProjection(FIT_POINTS, W, H, { pad: 95, headroom: 110, azimuth: 35, elevation: 30 });
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const at2 = (x, y, z) => k.iso([x, y, z], P);
const KS = G.scaleOf(P);

// ── Recorder ─────────────────────────────────────────────────────────────────
const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const { items, nameFor } = R;
const record = R.solid;

const S = (paths, o = {}) => k.solidSvg(paths, { crease: "faint", ...o });
const Ln = (d, o = {}) => k.lineSvg(d, o);
const Dots = (points, o = {}) => k.dotsSvg(points, o);

function put(piece, ref, svg, { bias = 0, shapes = [], name, route, chunk } = {}) {
  R.put({ piece, ride: piece, at: ref, bias, svg, move: PIECES[piece].move, shapes, name: name ?? nameFor(`${piece}.item`), route, chunk });
}
function tubeItems(piece, route, r, { name, tone = "hi", bias = 0, maxLength, spacing, closed = false, owner, touch, bundle, limp = false, gaps = [], caps = true, ends = [true, true], rims, free = [false, false] } = {}) {
  const id = nameFor(name ?? `${piece}.tube`);
  R.route(id, route, r, { owner: owner ?? id, touch, bundle, limp, gaps, closed, ends, rims, free, piece, move: PIECES[piece].move, ride: piece });
  T.tubePieces(route, r, P, { maxLength, spacing, closed, gaps, caps }).forEach((part, index) =>
    put(piece, part.mid, T.tubeSvg(part, { tone }), { bias, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
  );
  return id;
}
function box(piece, x0, y0, z0, x1, y1, z1, style = {}, { extra = "", bias = 0, name, owner, bevel = 0.4, steps = 3 } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: Math.min(2, (x1 - x0) / 4, (y1 - y0) / 4) };
  const id = nameFor(name ?? `${piece}.box`);
  const shape = record(A.box([x0, y0, z0], [x1, y1, z1], { name: id, owner }));
  put(piece, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "hi", ...style }) + extra, { bias, name: id, shapes: [shape] });
  return shape;
}
function cyl(piece, cx, cy, r, z0, h, style = {}, { bias = 0, name, owner, steps = 24, bevel = 0.3 } = {}) {
  const id = nameFor(name ?? `${piece}.cyl`);
  put(piece, [cx, cy, z0 + h / 2], S(k.cylinder(cx, cy, r, z0, h, P, steps, bevel), { tone: "hi", ...style }), { bias, name: id, shapes: [record(A.cylinder(cx, cy, r, z0, h, { name: id, owner }))] });
  return id;
}

// ── Bench (static): halo + two low stands, no bench mat ─────────────────────
put("bench", [0, 0, 0.5],
  `<path class="iso-halo" d="${k.haloOf({ x: CARD.x0 - 8, y: CARD.y0 - 8, w: CARD.x1 - CARD.x0 + 16, d: CARD.y1 - CARD.y0 + 16, r: 14 }, 0, 1, P)}"/>`,
  { bias: -210, name: "bench.halo" });
for (const [i, sx] of STAND_X.entries()) {
  put("bench", [sx, 0, MAT_Z + 1.5], S(k.cylinder(sx, 0, 15, MAT_Z, 3, P, 28, 0.4), { tone: "mid" }), { bias: -180, name: `bench.foot${i}`, shapes: [record(A.cylinder(sx, 0, 15, MAT_Z, 3, { name: `bench.foot${i}` }))] });
  box("bench", sx - 8, -16, MAT_Z + 3, sx + 8, 16, Z_BACK, { tone: "mid" }, { bias: -170, name: `bench.post${i}` });
}
{
  box("bench", PSU.x, PSU.y, PSU.z, PSU.x + PSU.w, PSU.y + PSU.d, PSU.z + PSU.h, { tone: "mid" }, {
    bias: -160, name: "bench.psu",
    extra: Ln([8, 14, 20].map((dy) => k.segment([PSU.x + PSU.w - 0.2, PSU.y + dy, PSU.z + 8], [PSU.x + PSU.w - 0.2, PSU.y + dy, PSU.z + 20], P)).join(""), { tone: "lo" }),
  });
  box("bench", PSU.x + PSU.w - 2, PSU.y + 12, PSU.z + 8, PSU.x + PSU.w + 3, PSU.y + 24, PSU.z + 16, { tone: "hi" }, { bias: -155, name: "bench.psu-port" });
}

// ── Card, bottom up ──────────────────────────────────────────────────────────
{
  const slots = [0, 1, 2, 3, 4].map((i) => Ln(k.planOutline({ x: 62 + i * 13, y: -38, w: 8, d: 30, r: 4 }, Z_BACK + BACK_T, P, 6), { tone: "lo" })).join("");
  const screws = Dots([[-132, -47, Z_BACK + BACK_T], [132, -47, Z_BACK + BACK_T], [-132, 47, Z_BACK + BACK_T], [132, 47, Z_BACK + BACK_T]].map((p) => at(p)), { size: 0.8, tone: "mid" });
  const plan = { x: CARD.x0, y: CARD.y0, w: CARD.x1 - CARD.x0, d: CARD.y1 - CARD.y0, r: 3 };
  put("backplate", [0, 0, Z_BACK + BACK_T / 2], S(k.slabOf(plan, Z_BACK, BACK_T, P, 8, 0.5), { tone: "mid" }) + slots + screws, { name: "backplate.plate", shapes: [record(A.slab(plan, Z_BACK, BACK_T, { name: "backplate.plate" }))] });
}
{
  const plan = { x: CARD.x0, y: CARD.y0, w: CARD.x1 - CARD.x0, d: CARD.y1 - CARD.y0, r: 3 };
  put("pcb", [0, 0, PCB_Z + PCB_T / 2], S(k.slabOf(plan, PCB_Z, PCB_T, P, 8, 0.4), { tone: "hi" }), { name: "pcb.board", shapes: [record(A.slab(plan, PCB_Z, PCB_T, { name: "pcb.board" }))] });
}
{
  const tongue = { x: -46, y: CARD.y1, w: 92, d: 23, r: 1.5 };
  const ribs = [];
  for (let x = -42; x <= 42; x += 3.4) ribs.push(k.segment([x, CARD.y1 + 9, COMP_Z + 0.15], [x, CARD.y1 + 21, COMP_Z + 0.15], P));
  const notch = Ln(k.planOutline({ x: -46, y: CARD.y1 + 12, w: 8, d: 11, r: 1 }, COMP_Z + 0.1, P, 4), { tone: "lo" });
  put("pcb", [0, CARD.y1 + 11.5, PCB_Z + PCB_T / 2], S(k.slabOf(tongue, PCB_Z, PCB_T * 0.9, P, 4, 0.3), { tone: "mid" }) + Ln(ribs.join(""), { tone: "lo" }) + notch, { name: "pcb.pcie", shapes: [record(A.slab(tongue, PCB_Z, PCB_T * 0.9, { name: "pcb.pcie" }))] });
}
box("pcb", DIE_AT[0] - 15, DIE_AT[1] - 15, COMP_Z, DIE_AT[0] + 15, DIE_AT[1] + 15, COMP_Z + 1.6, { tone: "mid" }, { name: "pcb.substrate" });
{
  const dieSvg = `<g class="gp-die">${S(k.slabOf({ x: DIE_AT[0] - 8.5, y: DIE_AT[1] - 8.5, w: 17, d: 17, r: 1 }, COMP_Z + 1.6, DIE_TOP - COMP_Z - 1.6, P, 4, 0.3))}</g>`;
  put("pcb", [DIE_AT[0], DIE_AT[1], COMP_Z + 2.4], dieSvg, { name: "pcb.die", bias: 1, shapes: [record(A.box([DIE_AT[0] - 8.5, DIE_AT[1] - 8.5, COMP_Z + 1.6], [DIE_AT[0] + 8.5, DIE_AT[1] + 8.5, DIE_TOP], { name: "pcb.die", owner: "pcb.substrate" }))] });
}
const VRAM = [];
{
  const spots = [];
  for (const dx of [-20, -9, 2, 13]) spots.push([DIE_AT[0] + dx, DIE_AT[1] - 23]);
  for (const dx of [-24, -13, 14, 25]) spots.push([DIE_AT[0] + dx, DIE_AT[1] + 21]);
  for (const dy of [-11, 0, 11]) spots.push([DIE_AT[0] - 24, DIE_AT[1] + dy]);
  spots.push([DIE_AT[0] + 24, DIE_AT[1] - 11]);
  spots.slice(0, 12).forEach(([x, y], i) => {
    box("pcb", x - 4.5, y - 3.5, COMP_Z, x + 4.5, y + 3.5, COMP_Z + 1.7, { tone: "mid" }, { name: `pcb.vram${i}` });
    VRAM.push([x, y]);
  });
}
for (let i = 0; i < 8; i++) {
  const x = -112 + i * 9;
  box("pcb", x - 3.2, 44, COMP_Z, x + 3.2, 52, COMP_Z + 3.4, { tone: "lo" }, { name: `pcb.choke${i}` });
}
for (let i = 0; i < 6; i++) cyl("pcb", -36 + i * 7.5, 48, 2.3, COMP_Z, 4.2, { tone: "mid" }, { name: `pcb.cap${i}` });
for (let i = 0; i < 6; i++) box("pcb", 12 + i * 7.5, 46, COMP_Z, 18 + i * 7.5, 51, COMP_Z + 1.2, { tone: "mid" }, { name: `pcb.mlcc${i}`, bevel: 0.2 });
for (let i = 0; i < 3; i++) box("pcb", 66 + i * 9, 44, COMP_Z, 72 + i * 9, 51, COMP_Z + 1.5, { tone: "lo" }, { name: `pcb.drv${i}` });
{
  const socketShape = box("pcb", SOCK.x, SOCK.y, SOCK.z, SOCK.x + SOCK.w, SOCK.y + SOCK.d, SOCK.z + SOCK.h, { tone: "mid" }, { name: "pcb.socket", extra: Ln(k.lineOnTop([SOCK.x + 2, SOCK.y + 2], [SOCK.x + SOCK.w - 2, SOCK.y + 2], SOCK.z + SOCK.h, P), { tone: "faint" }) });
  const pmouth = [SOCK.x + SOCK.w / 2, SOCK.y - 1.4, SOCK.z + SOCK.h / 2];
  const shell = G.disc(-2.6, 2.6, 3.4, G.frameOf(pmouth, [0, -1, 0], [1, 0, 0], [0, 0, 1]), P, { bevel: 0.3 });
  put("pcb", pmouth, S(shell, { tone: "mid" }), { name: "pcb.plug-shell", bias: 3, shapes: [record(A.disc(G.frameOf(pmouth, [0, -1, 0], [1, 0, 0], [0, 0, 1]), -2.6, 2.6, 3.4, { name: "pcb.plug-shell", seated: true, cut: [socketShape] }))] });
}
{
  const B = BRACKET;
  const BF = G.frameOf([B.x, B.y0, B.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const plate = G.prismOf(BF, [[0, 0], [B.y1 - B.y0, 0], [B.y1 - B.y0, B.h], [0, B.h]], 0, B.t, P);
  const ports = [
    { y0: -44, y1: -30, z0: 18, z1: 26 },
    { y0: -24, y1: -10, z0: 18, z1: 26 },
    { y0: -4, y1: 10, z0: 18, z1: 26 },
    { y0: 16, y1: 34, z0: 17, z1: 27 },
  ];
  let portArt = "";
  for (const pr of ports) {
    portArt += Ln(k.pathOf([[B.x + B.t, pr.y0, pr.z0], [B.x + B.t, pr.y1, pr.z0], [B.x + B.t, pr.y1, pr.z1], [B.x + B.t, pr.y0, pr.z1], [B.x + B.t, pr.y0, pr.z0]].map(at)), { tone: "lo" });
    portArt += Ln(k.pathOf([[B.x + B.t - 0.4, pr.y0 + 1.6, pr.z0 + 1.2], [B.x + B.t - 0.4, pr.y1 - 1.6, pr.z0 + 1.2], [B.x + B.t - 0.4, pr.y1 - 1.6, pr.z1 - 1.2], [B.x + B.t - 0.4, pr.y0 + 1.6, pr.z1 - 1.2], [B.x + B.t - 0.4, pr.y0 + 1.6, pr.z0 + 1.2]].map(at)), { tone: "faint" });
    portArt += `<path d="${k.pathOf([[B.x + B.t, (pr.y0 + pr.y1) / 2 - 3, pr.z0 + 2.4], [B.x + B.t, (pr.y0 + pr.y1) / 2 + 3, pr.z0 + 2.4], [B.x + B.t, (pr.y0 + pr.y1) / 2 + 3, pr.z1 - 2.4], [B.x + B.t, (pr.y0 + pr.y1) / 2 - 3, pr.z1 - 2.4], [B.x + B.t, (pr.y0 + pr.y1) / 2 - 3, pr.z0 + 2.4]].map(at))}" fill="var(--anatomy-shade-0)"/>`;
  }
  const vents = [0, 1, 2].map((i) => {
    const y = -34 + i * 14;
    return Ln(k.pathOf([[B.x + B.t, y, 29], [B.x + B.t, y + 8, 29], [B.x + B.t, y + 8, 36], [B.x + B.t, y, 36], [B.x + B.t, y, 29]].map(at)), { tone: "lo" });
  }).join("");
  const screws = Dots([at([B.x + B.t, -42, 33]), at([B.x + B.t, 42, 33])], { size: 0.7, tone: "mid" });
  put("pcb", [B.x + B.t / 2, 0, B.z + B.h / 2], S(plate, { tone: "mid" }) + portArt + vents + screws, { name: "pcb.bracket", bias: 4, shapes: [record(A.box([B.x, B.y0, B.z], [B.x + B.t, B.y1, B.z + B.h], { name: "pcb.bracket" }))] });
  const tab = S(G.prismOf(G.frameOf([B.x + B.t - 1, -18, B.z - 6], [1, 0, 0], [0, 1, 0], [0, 0, 1]), [[-8, 0], [8, 0], [8, 6], [-8, 6]], 0, 5, P), { tone: "mid" });
  put("pcb", [B.x + B.t + 1.5, -18, B.z - 3], tab + Dots([at([B.x + B.t + 4, -18, B.z - 3])], { size: 0.8, tone: "mid" }), { name: "pcb.tab", bias: 3, shapes: [record(A.box([B.x + B.t - 1, -26, B.z - 6], [B.x + B.t + 4, -10, B.z], { name: "pcb.tab" }))] });
}

// ── Cooler ───────────────────────────────────────────────────────────────────
box("vapor", VAPOR.x0, VAPOR.y0, VAPOR.z, VAPOR.x1, VAPOR.y1, VAPOR.z + VAPOR.h, { tone: "mid" }, { name: "vapor.plate" });
for (const [sx, sy] of [[-110, -30], [90, -30], [-110, 30], [90, 30]]) cyl("vapor", sx, sy, 1.2, COMP_Z, VAPOR.z - COMP_Z, { tone: "mid" }, { name: `vapor.post${sx}${sy}`, steps: 12 });
const PIPE_DATA = [];
{
  // 4 pipes bridging the gaps between fin blocks, staggered height and turn depth
  const runs = [
    { x: -51.5, into: -54, z: 24, yTurn: 38 },
    { x: -46.5, into: -44, z: 28, yTurn: 34 },
    { x: 45.5, into: 42, z: 30, yTurn: 32 },
    { x: 49.5, into: 52, z: 26, yTurn: 36 },
  ];
  let index = 0;
  for (const r of runs) {
    const endX = r.into + Math.sign(r.into - r.x) * 2.8;
    const line = G.fillet([
      [r.x, 8, VAPOR.z + 1.2],
      [r.x, 12, r.z],
      [r.x, r.yTurn, r.z],
      [endX, r.yTurn + 2, r.z],
    ], 2.2, 10, { P, tube: 1.6 });
    PIPE_DATA.push({ line });
    tubeItems("vapor", line, 1.6, { name: `vapor.pipe${index}`, tone: "hi", maxLength: 24, spacing: 1.1, free: [false, true] });
    index++;
  }
  // 2 U-bends poking out of the middle block's front face
  for (const [xa, xb] of [[-24, -10], [10, 24]]) {
    const line = G.fillet([
      [xa, FINS.y1 - 3, 24],
      [xa, FINS.y1 + 3.4, 26.5],
      [xb, FINS.y1 + 3.4, 26.5],
      [xb, FINS.y1 - 3, 24],
    ], 3.4, 10, { P, tube: 1.6 });
    PIPE_DATA.push({ line });
    tubeItems("vapor", line, 1.6, { name: `vapor.pipe${index}`, tone: "hi", maxLength: 24, spacing: 1.1, free: [true, true] });
    index++;
  }
}
for (const [i, b] of FIN_BLOCKS.entries()) {
  const fins = [];
  for (let x = b.x0 + 2.4; x < b.x1 - 1.6; x += 3.6) fins.push(k.segment([x, FINS.y1, FINS.z + 0.4], [x, FINS.y1, FIN_TOP - 0.4], P));
  put("fins", [(b.x0 + b.x1) / 2, 0, FINS.z + FINS.h / 2],
    S(k.slabOf({ x: b.x0, y: FINS.y0, w: b.x1 - b.x0, d: FINS.y1 - FINS.y0, r: 1.5 }, FINS.z, FINS.h, P, 6, 0.4), { tone: "mid" })
      + Ln(fins.join(""), { tone: "lo" }),
    { name: `fins.block${i}`, bias: 2, shapes: [record(A.box([b.x0, FINS.y0, FINS.z], [b.x1, FINS.y1, FIN_TOP], { name: `fins.block${i}` }))] });
}
{
  const seg = [];
  const xs = [-135, ...FAN_X.flatMap((cx) => [cx - 32, cx + 32]), 135];
  for (let i = 0; i < xs.length; i += 2) seg.push({ x0: xs[i], x1: xs[i + 1], y0: SHROUD.y0, y1: SHROUD.y1 });
  for (const cx of FAN_X) {
    seg.push({ x0: cx - 32, x1: cx + 32, y0: SHROUD.y0, y1: -32 });
    seg.push({ x0: cx - 32, x1: cx + 32, y0: 32, y1: SHROUD.y1 });
  }
  const screws = Dots(FAN_X.flatMap((cx) => [[cx - 31, -44, SHROUD_TOP], [cx + 31, 44, SHROUD_TOP]]).map((p) => at(p)), { size: 0.8, tone: "mid" });
  for (const [i, s] of seg.entries()) {
    box("shroud", s.x0, s.y0, SHROUD.z, s.x1, s.y1, SHROUD_TOP, { tone: "mid" }, { name: `shroud.seg${i}`, bias: 3, bevel: 0.3, extra: i === 0 ? screws : "" });
  }
  const hollow = (svg) => svg.replace('class="iso-fill"', 'class="iso-fill" fill-rule="evenodd"');
  for (const cx of FAN_X) {
    const F = G.frameOf([cx, 0, SHROUD_TOP], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    put("shroud", [cx, 0, SHROUD_TOP + 0.8],
      hollow(S(G.ringBand(0, 1.6, 27, 33.8, F, P, { hole: [1.6, 27] }), { tone: "hi" })) +
      Ln(G.circleOf(F, 1.6, 33.8, P, 40), { tone: "lo" }),
      { name: `shroud.lip${FAN_X.indexOf(cx)}`, bias: 4, shapes: [record(A.ring(F, 0, 1.6, 27, 33.8, { name: `shroud.lip${FAN_X.indexOf(cx)}` }))] });
  }
}
{
  // LCD strip on the shroud top, tilted up toward the viewer
  const TILT = 30 * (Math.PI / 180);
  const u3 = [1, 0, 0];
  const n3 = G.unit3([0, Math.sin(TILT), Math.cos(TILT)]); // face normal: +y and up
  const v3 = G.unit3([0, -Math.cos(TILT), Math.sin(TILT)]); // up along the face
  const d3 = G.mul3(v3, -1); // down along the face (svg y)
  const LW = 40, LH = 9;
  const org = [58, -46, SHROUD_TOP + 0.4]; // lower-left corner of the bezel
  const bezel = G.prismOf(G.frameOf(org, n3, u3, v3), [[-3, -1], [LW + 3, -1], [LW + 3, LH + 1.5], [-3, LH + 1.5]], 0, 1.7, P);
  const face = G.add3(org, G.mul3(n3, 1.7)); // outer face: the screen sits flush on it
  const win = [face, G.add3(face, G.mul3(u3, LW)), G.add3(G.add3(face, G.mul3(u3, LW)), G.mul3(v3, LH)), G.add3(face, G.mul3(v3, LH))];
  const inner = win.map((p) => G.add3(p, G.add3(G.mul3(u3, 1.2), G.mul3(v3, 1))));
  const o = at(inner[0]), pu = at(G.add3(inner[0], u3)), pv = at(G.add3(inner[0], d3));
  const mtx = `matrix(${(pu[0] - o[0]).toFixed(3)} ${(pu[1] - o[1]).toFixed(3)} ${(pv[0] - o[0]).toFixed(3)} ${(pv[1] - o[1]).toFixed(3)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`;
  const clipId = "gp-lcd-clip";
  const text = `<defs><clipPath id="${clipId}"><path d="${k.pathOf(inner.map(at), true)}"/></clipPath></defs>`
    + `<g clip-path="url(#${clipId})"><text class="gp-lcd" data-lcd x="1" y="6.8" font-size="6.4" transform="${mtx}">IDLE</text></g>`;
  put("shroud", [58, -46, SHROUD_TOP + 3],
    S(bezel, { tone: "mid" }) +
    `<path d="${k.pathOf(win.map(at), true)}" fill="var(--anatomy-shade-0)"/>` + text,
    { name: "shroud.lcd", bias: 6, shapes: [record(A.orientedBox(G.add3(org, G.mul3(n3, 0.85)), [u3, v3, n3], [LW / 2 + 3, LH / 2 + 0.75, 0.9], { name: "shroud.lcd" }))] });
}
const FANS = [];
for (const [i, cx] of FAN_X.entries()) {
  const ringF = G.frameOf([cx, 0, SHROUD.z + 1], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  put("fans", [cx, 0, SHROUD.z + 2.3],
    S(G.ringBand(0, 2.6, 26.5, FAN_RING_R, ringF, P, { hole: [2.6, 26.5] }), { tone: "mid" }).replace('class="iso-fill"', 'class="iso-fill" fill-rule="evenodd"'),
    { name: `fans.ring${i}`, bias: 4, shapes: [record(A.ring(ringF, 0, 2.6, 26.5, FAN_RING_R, { name: `fans.ring${i}` }))] });
  const bladeAt = SHROUD.z + 3.4;
  const recessF = G.frameOf([cx, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  put("fans", [cx, 0, bladeAt],
    `<path class="gp-recess" d="${G.circleOf(recessF, bladeAt - 0.9, 26.4, P, 48)}"/>` +
    `<g class="gp-blades" data-fan="${i}"></g>`,
    { name: `fans.blades${i}`, bias: 4.5, shapes: [record(A.disc(G.frameOf([cx, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), bladeAt - 0.4, bladeAt + 0.4, FAN_BLADE_R, { name: `fans.blades${i}` }))] });
  const hubF = G.frameOf([cx, 0, bladeAt - 0.2], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  put("fans", [cx, 0, bladeAt + 2],
    S(G.disc(0, 4, 6.4, hubF, P, { bevel: 0.4 }), { tone: "mid" }) +
    Ln(G.circleOf(G.frameOf([cx, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), bladeAt + 3.6, 3.4, P, 20), { tone: "lo" }),
    { name: `fans.hub${i}`, bias: 5, shapes: [record(A.disc(G.frameOf([cx, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), bladeAt - 0.2, bladeAt + 3.8, 6.4, { name: `fans.hub${i}` }))] });
  FANS.push({ cx, cy: 0, r: FAN_BLADE_R, bladeAt, blades: 10 });
}

// ── Power cable: PSU → plug, arcs over open space into the top-edge socket ──
const CABLE = G.fillet([
  [PSU.x + PSU.w + 2.5, PSU.y + 18, PSU.z + 13],
  [-158, -84, 24],
  [-146, -72, 26],
  [-134, -62, 21],
  [-128, -57, 17.5],
], 5, 12, { P, tube: 3.2 });
tubeItems("bench", CABLE, 3.2, { name: "bench.cable", tone: "hi", limp: true, maxLength: 18, spacing: 1.2, free: [false, true], rims: [3.4, 3.4] });

// ── Settle, sort, emit ───────────────────────────────────────────────────────
A.settle(R, P);
items.sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const LABEL = "A consumer graphics card lying fans-up on two low stands. A sleeved cable carries power from a supply block at upper left into the card's edge socket. Three fans sit in the shroud; below them are the fin stack, the vapor chamber with heat pipes, and the board carrying the lit die, memory chips and the output bracket. A stream of binary glyphs leaves the bracket and warm haze rises from the heatsink. Hover or press Enter to take the card apart.";

const streamEnd = [STREAM.at[0] + STREAM.dir[0] * STREAM.len, STREAM.at[1] + STREAM.dir[1] * STREAM.len];
const heatC = at2(DIE_AT[0], DIE_AT[1], FIN_TOP + 2);
const bitsAt = at2(STREAM.at[0] + 20, STREAM.at[1] + 10, MAT_Z + 1);
const backSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg gp-back" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="gp-fallback"><ellipse cx="${heatC[0]}" cy="${heatC[1]}" rx="95" ry="34" fill="${BUTTER}" opacity="0.10"/><ellipse cx="${heatC[0]}" cy="${heatC[1] - 18}" rx="72" ry="48" fill="${CORAL}" opacity="0.05"/><text class="gp-bits" x="0" y="0" transform="translate(${bitsAt[0].toFixed(1)} ${bitsAt[1].toFixed(1)}) skewX(-24) scale(1 .6)" font-size="10" fill="${BLUE}" opacity="0.55">0 1 1 0 1 0 0 1 0 1</text></g></svg>`;
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg gp-front" viewBox="0 0 ${W} ${H}" role="img" aria-label="${LABEL}"><g class="gp-engine">${groups.join("")}</g></svg>`;
const frontSvgPhone = frontSvg.replaceAll("gp-lcd-clip", "gp-lcd-clip-2");

const unit = (v) => { const o = at([0, 0, 0]); const p = at(v); return [p[0] - o[0], p[1] - o[1]]; };
const decimate = (pts, n) => {
  const out = [pts[0]];
  const step = (pts.length - 1) / (n - 1);
  for (let i = 1; i < n - 1; i++) out.push(pts[Math.round(i * step)]);
  out.push(pts[pts.length - 1]);
  return out;
};
const cablePts = decimate(CABLE, 20);
const lat = G.unit3([-STREAM.dir[1], STREAM.dir[0], 0]);
const DATA = {
  W, H, V,
  EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]),
  proj: P,
  camera: glCamera(P),
  k: KS,
  matZ: MAT_Z,
  die: { c: DIE_AT, z0: COMP_Z + 1.6, z1: DIE_TOP },
  vaporC: [(VAPOR.x0 + VAPOR.x1) / 2, 0, VAPOR.z + VAPOR.h],
  finPlan: [(FINS.y1 - FINS.y0) / 2 * 0 + 128, 44, 0, 0],
  gaps: [GAPS[0], GAPS[1], 0, 0],
  finTop: FIN_TOP,
  fans: FANS,
  cable: CABLE,
  cableFlat: cablePts.flat(),
  pipeA: PIPE_DATA.map((p) => p.line[0]).flat(),
  pipeB: PIPE_DATA.map((p) => p.line[p.line.length - 1]).flat(),
  streamO: STREAM.at,
  streamD: [STREAM.dir[0], STREAM.dir[1], 0],
  streamL: lat,
  streamLen: STREAM.len + 35,
  moves: Object.fromEntries(Object.entries(PIECES).map(([id, p]) => [id, p.move])),
  stagger: STAGGER,
  spring: SPRING,
};

const titleBlock = `<div class="gp-title" aria-hidden="true">
  <div class="gp-trow"><span class="gp-c">FIG</span><b>[0]</b><b class="gp-n">INFERENCE</b></div>
  <div class="gp-trow gp-half"><span class="gp-cell"><span class="gp-c">SHEET</span><b>1 OF 1</b></span><span class="gp-cell"><span class="gp-c">DRAWN</span><b>VJ</b></span></div>
  <div class="gp-trow gp-hint" data-f="hint">Hover to open it up</div>
</div>`;
const readout = `<div class="gp-state" aria-hidden="true"><span class="gp-c">STATE</span><b data-f="read">IDLE · 140 W · 24 tok/s</b></div>`;
const stage = `<div class="gp-stage" tabindex="0" role="button" aria-label="${LABEL} Press Enter to take the card apart." aria-pressed="false">${backSvg}<canvas class="gp-gl" aria-hidden="true"></canvas><canvas class="gp-fx" aria-hidden="true"></canvas>${frontSvg}</div>`;
const stagePhone = `<div class="gp-stage" tabindex="0" role="button" aria-label="${LABEL} Press Enter to take the card apart." aria-pressed="false">${backSvg}<canvas class="gp-gl" aria-hidden="true"></canvas><canvas class="gp-fx" aria-hidden="true"></canvas>${frontSvgPhone}</div>`;
const body = `<figure class="gp"><div class="gp-plate">${stage}${titleBlock}${readout}</div><figcaption class="gp-cap">A graphics card as a small machine: power in on the left, heat off the top, tokens out the right. Hover takes it apart into six assemblies.</figcaption></figure>`;

const CSS = readFileSync(join(HERE, "gpu.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const FONT = readFileSync(join(HERE, "..", "..", "public", "fonts", "paper-mono", "PaperMono.woff2")).toString("base64");
const FONT_CSS = `@font-face{font-family:"Paper Mono";src:url(data:font/woff2;base64,${FONT}) format("woff2");font-weight:100 800;font-display:block}`;

const page = k.pageHtml({
  title: "Inference sled — GPU figure",
  theme: THEME,
  body: `<style>${FONT_CSS}${CSS}</style>${body}<section class="gp-strip"><h2>Phone strip · 390 × 220</h2><div class="gp-phone"><div class="gp-plate gp-plate-phone">${stagePhone}${titleBlock}${readout}</div></div></section>`,
  script: kitScript() + glScript() + MODEL + LIVE,
  width: 620,
});
if (process.argv.includes("--preview")) writeFileSync(join(HERE, "index.html"), page);

// Site embed: the plate alone, scaled to fit the side pane; compact strip on phones hides the chrome.
const EMBED_CSS = `html{color-scheme:light}html,body{margin:0;height:100%;background:transparent;overflow:hidden}
.gp-fit{position:absolute;inset:0}
.gp-fit .gp-plate{position:absolute;left:50%;top:50%;background:none;box-shadow:none;transform-origin:center}
.gp-fit.compact .gp-title{display:none}`;
const FIT = `(()=>{const f=document.querySelector(".gp-fit"),p=f.querySelector(".gp-plate");const fit=()=>{const w=innerWidth,h=innerHeight,c=h<400;f.classList.toggle("compact",c);p.style.transform="translate(-46%,-50%) scale("+Math.min(w/620,h/720)*(c?1.2:1)+")";};addEventListener("resize",fit);fit();})();`;
const embed = k.pageHtml({
  title: "Inference",
  theme: THEME,
  body: `<style>${FONT_CSS}${CSS}${EMBED_CSS}</style><div class="gp-fit"><div class="gp-plate">${stage}${titleBlock}${readout}</div></div>`,
  script: FIT + kitScript() + glScript() + MODEL + LIVE,
  width: 560,
});
const OUT = join(HERE, "..", "..", "public", "fig");
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "gpu.html"), embed);
console.log(`wrote public/fig/gpu.html ${(embed.length / 1024).toFixed(0)} KB · ${items.length} items · ${R.solids.length} solids · ${R.tubes.length} routes`);

if (process.argv.includes("--audit")) A.auditOrExit(R, P);
