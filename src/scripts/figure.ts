// The ASCII figure in the right pane. One canvas, persisted across page navigations.
// Each page names a figure; switching redraws it as a wave that starts where the menu's
// leader line meets the figure: the old drawing thins out, a front passes, the new one builds.

type Field = (u: number, v: number, x: number, y: number, t: number, asp: number) => [number, string?];
export type FigName = "ripple" | "radar" | "growth" | "flask" | "press" | "notes";

const RAMP = " .\u00b7:-=+*#%@";
const C = { blue: "#1b4dff", coral: "#f0764f", green: "#19b37a", lilac: "#7c5cff", butter: "#f2b705", ink: "#0b1533" };
const ACCENT: Record<FigName, string> = { ripple: C.blue, radar: C.blue, growth: C.coral, flask: C.green, press: C.lilac, notes: C.lilac };

const hash = (i: number, j: number) => { const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return s - Math.floor(s); };
const seg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay, k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - k * dx, py - ay - k * dy);
};

let probe: [number, number] | null = null;

const FIELDS: Record<FigName, Field> = {
  ripple(_u, _v, x, y, t, asp) {
    const src: [number, number][] = asp > 1.3
      ? [[.28, .5 + .06 * Math.sin(t * .3)], [.72, .5 - .06 * Math.cos(t * .25)]]
      : [[.35 + .05 * Math.sin(t * .3), .32], [.65, .68 + .05 * Math.cos(t * .25)]];
    if (probe) src.push(probe);
    let s = 0;
    for (const [sx, sy] of src) { const d = Math.hypot((x - sx) * asp, y - sy); s += Math.sin(d * 19 - t * 2) / (1 + d * 1.5); }
    s /= src.length * .62;
    return [Math.min(1, Math.abs(s)), s > .7 ? C.coral : s > 0 ? C.blue : s < -.7 ? C.green : C.lilac];
  },

  radar(u, v, _x, _y, t) {
    const r = Math.hypot(u, v);
    if (r > .97) return [0];
    const sw = (t * 1.2) % (Math.PI * 2), ang = Math.atan2(v, u);
    const blips = [[.42, -.3], [-.52, .22], [.14, .62], [-.22, -.66], [.64, .34], [-.7, -.18], [.3, .18]];
    for (const [bx, by] of blips) if (Math.hypot(u - bx, v - by) < .065) {
      const d = (sw - Math.atan2(by, bx) + Math.PI * 4) % (Math.PI * 2);
      return [d < 2.8 ? 1 - d / 2.8 * .75 : .25, C.coral];
    }
    const d = (sw - ang + Math.PI * 4) % (Math.PI * 2), wedge = d < 1.2 ? 1 - d / 1.2 : 0;
    const ring = Math.abs(Math.sin(r * Math.PI * 4)) < .09 || r > .92 ? .4 : 0;
    const cross = Math.abs(u) < .016 || Math.abs(v) < .016 ? .28 : 0;
    return [Math.max(wedge * .95, ring, cross), wedge > .25 ? C.blue : C.lilac];
  },

  growth(u, v, _x, _y, t) {
    if (seg(u, v, -.82, .48, .62, -.62) < .032) return [1, C.blue];
    if (seg(u, v, .62, -.62, .42, -.6) < .032 || seg(u, v, .62, -.62, .6, -.42) < .032) return [1, C.blue];
    if (Math.abs(v - .8) < .018 && Math.abs(u) < .9) return [.55, C.lilac];
    if (Math.abs(u + .9) < .016 && v > -.85 && v < .8) return [.4, C.lilac];
    const k = Math.floor((u + .85) / .34), off = (u + .85) % .34;
    if (k >= 0 && k < 5 && off < .24) {
      const h = (.24 + k * .27) * (.92 + .08 * Math.sin(t * 2 - k * .7)), top = .8 - h;
      if (v > top && v < .8) return [v < top + .05 ? 1 : .45, C.coral];
    }
    return [0];
  },

  flask(u, v, _x, _y, t) {
    const neckTop = -.86, shoulder = -.34, base = .78, neckW = .13, baseW = .64;
    const halfW = v < shoulder ? neckW : neckW + (baseW - neckW) * (v - shoulder) / (base - shoulder);
    const inside = v > neckTop && v < base && Math.abs(u) < halfW;
    const wall = v > neckTop && v < base + .03 && Math.abs(Math.abs(u) - halfW) < .035;
    if (Math.abs(v - base) < .025 && Math.abs(u) < baseW + .03) return [.9, C.ink];
    if (Math.abs(v - neckTop) < .022 && Math.abs(u) < neckW + .08) return [.9, C.ink];
    if (wall) return [.85, C.ink];
    const level = .18 + .025 * Math.sin(u * 9 + t * 2.1);
    for (let i = 0; i < 8; i++) {
      const p = (t * .22 + i / 8) % 1, by = base - .08 - p * (base - .08 - level), w = neckW + (baseW - neckW) * (by - shoulder) / (base - shoulder);
      const bx = Math.sin(i * 2.3 + p * 3) * w * .6;
      if (Math.hypot(u - bx, v - by) < .04 + .02 * p) return [1, i % 3 ? C.green : C.blue];
    }
    if (inside && v > level) return [Math.abs(v - level) < .03 ? .9 : .35, C.green];
    for (let i = 0; i < 3; i++) {
      const p = (t * .3 + i / 3) % 1, fy = neckTop - .04 - p * .2, fx = Math.sin(p * 6 + i) * .06;
      if (Math.hypot(u - fx, v - fy) < .03 * (1 - p)) return [.6 * (1 - p), C.green];
    }
    return [0];
  },

  press(u, v, _x, _y, t) {
    const L = .6, T = -.86, R = .6, B = .86;
    if ((Math.abs(u - L) < .02 || Math.abs(u - R) < .02) && v > T && v < B) return [.6, C.lilac];
    if ((Math.abs(v - T) < .02 || Math.abs(v - B) < .02) && u > -L && u < R) return [.6, C.lilac];
    if (v > -.74 && v < -.58 && Math.abs(u) < .48) return [.9, C.ink];
    if (Math.abs(v + .5) < .012 && Math.abs(u) < .48) return [.35, C.lilac];
    const lineH = .085, first = -.4, count = 14, total = count * 2;
    const li = Math.round((v - first) / lineH);
    if (li < 0 || li >= count || Math.abs(v - (first + li * lineH)) > .02) return [0];
    const col = u < -.03 ? 0 : u > .03 ? 1 : -1;
    if (col < 0) return [0];
    const x0 = col ? .06 : -.48, idx = col * count + li;
    const len = (li === count - 1 ? .2 : .32 + hash(idx, 7) * .1);
    const step = (t * 5) % (total + 10), done = idx < Math.floor(step), cur = idx === Math.floor(step);
    const fill = cur ? step % 1 : done ? 1 : 0;
    const end = x0 + len * fill;
    if (u < x0 || u > x0 + len) return [0];
    if (cur && Math.abs(u - end) < .03) return [1, C.coral];
    return u <= end ? [.55, C.ink] : [0];
  },

  notes(u, v, _x, _y, t) {
    if (Math.abs(u + .62) < .012 && v > -.8 && v < .8) return [.5, C.coral];
    const gap = .2, rows = 7, first = -.6;
    const r = Math.round((v - first) / gap), ry = first + r * gap;
    if (r >= 0 && r < rows && Math.abs(v - ry) < .01 && Math.abs(u) < .8) return [.25, C.blue];
    const lines = 5, cycle = (t * .28) % (lines + 1.5), curLine = Math.floor(cycle), prog = cycle % 1;
    for (let k = 0; k < lines; k++) {
      const base = first + k * gap - .05;
      if (k > curLine) break;
      const x0 = -.55, x1 = .74, end = k < curLine ? x1 : x0 + (x1 - x0) * prog;
      if (u < x0 || u > end) continue;
      const wy = base - .035 * Math.sin(u * 23 + k * 3) - .018 * Math.sin(u * 53 + k);
      if (Math.abs(v - wy) < .022) return [k === curLine && Math.abs(u - end) < .04 ? 1 : .75, k === curLine && Math.abs(u - end) < .04 ? C.lilac : C.ink];
    }
    return [0];
  },
};

type Morph = { from: FigName; to: FigName; t0: number; ox: number; oy: number; spread: number };

export function mountFigure(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return { set(_name: FigName, _origin?: { clientX?: number; clientY?: number }) {}, preview(_name: FigName | null, _origin?: { clientX?: number; clientY?: number }) {}, get current(): FigName { return "ripple"; } };
  const ctx: CanvasRenderingContext2D = context;
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = motionPreference.matches;
  let W = 0, H = 0, cols = 0, rows = 0, cw = 0, ch = 0, raf = 0;
  let activeUntil = 0, lastDraw = 0;
  let base: FigName = "ripple", shown: FigName = "ripple";
  let morph: Morph | null = null;

  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1), r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = canvas.width = Math.round(r.width * dpr); H = canvas.height = Math.round(r.height * dpr);
    cols = Math.max(24, Math.floor(r.width / 9)); cw = W / cols; ch = cw * 1.8; rows = Math.ceil(H / ch);
    ctx.font = `${cw * 1.4}px "Departure Mono", ui-monospace, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    draw(performance.now());
  }

  function draw(now: number) {
    const t = now / 1000, asp = W / H, m = Math.min(W, H) / 2 * .94;
    ctx.clearRect(0, 0, W, H);
    const mo = morph, maxD = Math.hypot(W, H);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const px = (i + .5) * cw, py = (j + .5) * ch, x = px / W, y = py / H, u = (px - W / 2) / m, v = (py - H / 2) / m;
      let a = 0, c: string | undefined, glyph: string | undefined;
      if (mo) {
        const dur = .36, k = ((now - mo.t0) / 1000 - Math.hypot(px - mo.ox, py - mo.oy) / maxD * mo.spread - hash(i, j) * .06) / dur;
        if (k <= 0) [a, c] = FIELDS[mo.from](u, v, x, y, t, asp);
        else if (k >= 1) [a, c] = FIELDS[mo.to](u, v, x, y, t, asp);
        else if (k < .5) { const [oa, oc] = FIELDS[mo.from](u, v, x, y, t, asp); a = oa * (1 - k * 2); c = oc; }
        else { const [na, nc] = FIELDS[mo.to](u, v, x, y, t, asp); a = na * (k * 2 - 1); c = nc; }
        if (k > .38 && k < .62 && a < .3) { a = .55; c = ACCENT[mo.to]; glyph = k < .5 ? "\u00b7" : ":"; }
      } else [a, c] = FIELDS[shown](u, v, x, y, t, asp);
      if (a < .12) continue;
      ctx.fillStyle = c === C.ink ? C.ink : ACCENT[mo?.to ?? shown];
      ctx.globalAlpha = .28 + a * .72;
      ctx.fillText(glyph || RAMP[Math.min(RAMP.length - 1, Math.floor(a * (RAMP.length - 1)))], px, py);
    }
    ctx.globalAlpha = 1;
    if (mo && (now - mo.t0) / 1000 > mo.spread + .5) morph = null;
  }

  function loop(now: number) {
    if (now - lastDraw >= 32 || now >= activeUntil) { draw(now); lastDraw = now; }
    raf = now < activeUntil && !document.hidden ? requestAnimationFrame(loop) : 0;
  }

  function wake(duration = 1800) {
    if (reduce || document.hidden) { draw(performance.now()); return; }
    activeUntil = Math.max(activeUntil, performance.now() + duration);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function go(to: FigName, origin?: { clientX?: number; clientY?: number }, spread = .9) {
    if (to === shown && !morph) return;
    const r = canvas.getBoundingClientRect(), sx = W / (r.width || 1);
    const ox = origin?.clientX !== undefined ? (origin.clientX - r.left) * sx : origin?.clientY !== undefined ? 0 : W / 2;
    const oy = origin?.clientY !== undefined ? Math.max(0, Math.min(H, (origin.clientY - r.top) * sx)) : H / 2;
    morph = { from: shown, to, t0: performance.now(), ox, oy, spread: reduce ? 0 : spread };
    shown = to;
    if (reduce) { morph = null; draw(performance.now()); }
    else wake();
  }

  new ResizeObserver(size).observe(canvas);
  canvas.parentElement?.addEventListener("pointermove", e => {
    if (shown !== "ripple") return;
    const r = canvas.getBoundingClientRect(); probe = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    wake(700);
  });
  canvas.parentElement?.addEventListener("pointerleave", () => { probe = null; wake(500); });
  document.addEventListener("visibilitychange", () => {
    if (reduce) return;
    cancelAnimationFrame(raf);
    raf = 0;
    if (!document.hidden) wake(500);
  });
  motionPreference.addEventListener("change", event => {
    reduce = event.matches;
    cancelAnimationFrame(raf); raf = 0; morph = null;
    wake();
  });

  size();
  document.fonts.ready.then(size);
  wake();

  return {
    set(name: FigName, origin?: { clientX?: number; clientY?: number }) { base = name; go(name, origin); },
    preview(name: FigName | null, origin?: { clientX?: number; clientY?: number }) { go(name ?? base, origin, .4); },
    get current() { return base; },
  };
}
