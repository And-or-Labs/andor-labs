// Turbofan pod live runtime — fan, phantom cutaway, exhaust shader, throttle messages.
// Runs after kitScript() + glScript() + model.mjs are inlined.
const D = __DATA__;
const Q = new URLSearchParams(location.search);
const STILL = Q.has("still") || matchMedia("(prefers-reduced-motion: reduce)").matches;
const NOGL = Q.has("nogl");
const SPEED = Math.max(0.01, Number(Q.get("speed")) || 1);
const FORCE = (Q.get("mode") || "").toLowerCase();
const TAU2 = Math.PI * 2;

const FRAG = `
uniform float uHeat;
uniform float uN1;
uniform float uOpen;
uniform float uMargin;
uniform vec3 uNoz;
uniform vec3 uDir;
uniform vec3 uComb;
float segd(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-6),0.,1.);return length(p-a-ab*t);}

void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 col=vec3(0.);
  float acc=0.;

  // dead zone: zero exhaust for uMargin vb px from the left edge, then ramp in
  float edge=smoothstep(uMargin,uMargin+30.,vb.x);

  // exhaust: a subsonic airliner plume is nearly invisible — schlieren
  // luminance streaks advected along the jet, no diamonds, no flame
  {
    vec2 p0=project(uNoz);
    vec2 d=normalize(project(uNoz+uDir)-p0);
    vec2 rel=vb-p0;
    vec2 perp=vec2(-d.y,d.x);
    float t=dot(rel,d);
    float r=dot(rel,perp);
    float reach=26.+64.*uHeat;
    float tail=smoothstep(reach,reach*.35,t);        // zero well before the edge
    float w=2.5+3.5*uHeat;
    // at most a faint warm tint right at the core exit, TAKEOFF only
    float core=exp(-pow(r/w,2.))*tail*smoothstep(-4.,2.,t);
    col+=vec3(.95,.68,.3)*core*.15*uHeat*uHeat; acc+=core*.15*uHeat*uHeat;
    float lip=exp(-pow(length(rel)/(6.+4.*uHeat),2.));
    col+=vec3(.98,.5,.2)*lip*.2*uHeat; acc+=lip*.2*uHeat;
    // schlieren streaks: luminance-only modulation, strongest at the core axis
    float streak=fbm2(vec2(t*.05-uTime*(1.5+4.5*uHeat),r*.09))-.5;
    float hz=exp(-pow(r/(w*4.),2.))*smoothstep(2.,30.,t)*tail;
    // schlieren streaks darken toward ink only, never lighten
    col+=vec3(.043,.082,.2)*abs(streak)*hz*(.1+.35*uHeat);
    acc+=abs(streak)*hz*(.06+.15*uHeat);
  }

  // combustor glow, shows with heat and more when the cowls are open
  {
    vec2 pc=project(uComb).xy;
    float cg=exp(-pow(length(vb-pc)/(13.+26.*uOpen),2.))*(.08*uHeat+.5*uHeat*uOpen);
    col+=vec3(.95,.5,.2)*cg; acc+=cg;
  }

  float a=clamp(acc,0.,1.)*edge;
  gl_FragColor=vec4(a>1e-4?col/max(acc,1e-4):vec3(0.),a);
}`;

const boot = (stage) => {
  const engine = stage.querySelector(".en-engine");
  const canvas = stage.querySelector(".en-gl");
  const plate = stage.closest(".en-plate");
  const F = {};
  plate.querySelectorAll("[data-f]").forEach((el) => (F[el.dataset.f] = el));
  const load = stage.querySelector("[data-load]");
  const swirlEl = stage.querySelector("[data-swirl]");
  const nodes = [...engine.querySelectorAll(".it")].map((el) => ({
    el, piece: el.dataset.piece, ride: el.dataset.ride || el.dataset.piece,
    key: Number(el.dataset.k), m: el.dataset.m.split(",").map(Number), shown: "",
  }));
  for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
  let order = nodes.map((_, i) => i);

  const IDS = Object.keys(D.moves);
  const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
  const S = makeSim();
  const sim = { ...MODES.steady, rpm: fanTarget(MODES.steady.n1) };
  let apart = false, inside = false, leaveTimer = 0, visible = false, frame = 0, last = 0, clock = 0;
  let fanAngle = 0;

  // preset for ?mode=
  if (MODES[FORCE]) S.mode = FORCE;
  if (Q.has("apart")) { apart = true; for (const id of IDS) piece[id].target = piece[id].x = 1; stage.setAttribute("data-apart", ""); stage.setAttribute("aria-pressed", "true"); }

  // frame point: axis station s, radius r, angle t about the pod axis
  const FR = D.frame;
  const pt = (s, r, t) => {
    const c = Math.cos(t), n = Math.sin(t);
    return iso([
      FR.o[0] + FR.a[0] * s + r * (c * FR.u[0] + n * FR.v[0]),
      FR.o[1] + FR.a[1] * s + r * (c * FR.u[1] + n * FR.v[1]),
      FR.o[2] + FR.a[2] * s + r * (c * FR.u[2] + n * FR.v[2]),
    ], D.proj);
  };

  // fan blades: 18 wide-chord swept scimitars, rebuilt per frame.
  // The leading edge curves forward toward a swept tip; chord spans ~1.6x the
  // blade pitch so neighbours overlap like a real composite fan.
  const bladeBox = stage.querySelector(".en-blades");
  const blades = [], les = [];
  for (let b = 0; b < D.fan.n; b++) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("class", "en-blade");
    bladeBox.appendChild(p);
    blades.push(p);
    const le = document.createElementNS("http://www.w3.org/2000/svg", "path");
    le.setAttribute("class", "en-blade-le");
    bladeBox.appendChild(le);
    les.push(le);
  }
  const blur = document.createElementNS("http://www.w3.org/2000/svg", "path");
  blur.setAttribute("class", "en-blur");
  bladeBox.appendChild(blur);
  // smooth closed path through points (quadratic through edge midpoints)
  const smoothZ = (pts) => {
    const n = pts.length;
    let d = `M${((pts[0][0] + pts[n - 1][0]) / 2).toFixed(1)} ${((pts[0][1] + pts[n - 1][1]) / 2).toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
    }
    return d + "Z";
  };
  const bladeAt = (a) => {
    const f = D.fan;
    // scimitar: leading edge sweeps forward toward the tip, trailing edge
    // bows back; dense polar samples -> smooth Bezier outline
    const le = (t) => a + 0.05 + 0.27 * t * t;                     // LE offset
    const te = (t) => a - 0.30 + 0.20 * t + 0.14 * t * t;          // TE offset
    const r = (t) => f.r0 + (f.r1 - f.r0) * t;
    const K = 9;
    const out = [];
    for (let i = 0; i <= K; i++) { const t = i / K; out.push(pt(f.s, r(t), le(t))); }
    for (let i = K; i >= 0; i--) { const t = i / K; out.push(pt(f.s, r(t), te(t))); }
    const hi = [];
    for (let i = 0; i <= K; i++) { const t = i / K; hi.push(pt(f.s - 0.6, r(t), le(t) + 0.008)); }
    return [smoothZ(out), `M${hi.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}`];
  };
  const discAt = (r, s) => `M${Array.from({ length: 48 }, (_, i) => { const q = pt(s, r, (i / 48) * TAU2); return `${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }).join("L")}Z`;
  // painted swirl on the spinner face: an Archimedean spiral drawn in screen
  // space on the cone's projected ellipse — one clean continuous mark
  const swirlAt = (rot) => {
    const sp = D.spinner;
    const sMid = sp.sTip + (sp.sBase - sp.sTip) * 0.55;
    const c = pt(sMid, 0, 0);
    const rMax = sp.rBase * 0.82;
    const pu = pt(sMid, rMax, 0), pv = pt(sMid, rMax, Math.PI / 2);
    const eu = [pu[0] - c[0], pu[1] - c[1]], ev = [pv[0] - c[0], pv[1] - c[1]];
    const N = 44;
    let d = "";
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = rot + t * sp.turns * TAU2;
      const x = c[0] + t * (Math.cos(a) * eu[0] + Math.sin(a) * ev[0]);
      const y = c[1] + t * (Math.cos(a) * eu[1] + Math.sin(a) * ev[1]);
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };
  const spinFan = (dt) => {
    const vis = Math.min(sim.rpm, 2800) / 2800;
    fanAngle += dt * vis * 11;
    const blurA = Math.max(0, Math.min(0.32, ((sim.n1 - 42) / 58) * 0.4));
    blades.forEach((p, i) => {
      const [fill, le] = bladeAt(fanAngle + (i / D.fan.n) * TAU2);
      p.setAttribute("d", fill);
      les[i].setAttribute("d", le);
    });
    blur.setAttribute("d", discAt(D.fan.r1, D.fan.s + 0.2));
    blur.style.opacity = blurA;
    if (swirlEl) swirlEl.setAttribute("d", swirlAt(fanAngle * 0.9));
  };

  // exploded internals: rotor blade rings, rebuilt per frame so they spin with N1
  const ROTS = D.rotors || [];
  const rotors = [...stage.querySelectorAll("[data-rotor]")].map((el) => {
    const cfg = ROTS[Number(el.dataset.rotor)];
    const paths = [];
    for (let i = 0; i < cfg.n; i++) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("class", "en-rblade");
      el.appendChild(p);
      paths.push(p);
    }
    return { cfg, paths };
  });
  // rotor blade ring: short thin radial strokes, slightly swept at the tip
  const rotorBlade = (cfg, a) => {
    const { s, r0, r1, c0 } = cfg;
    const p0 = pt(s, r0 + 1.5, a);
    const pm = pt(s, r0 + (r1 - r0) * 0.55, a + c0 * 0.5);
    const p1 = pt(s, r1 - 0.5, a + c0);
    return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}Q${pm[0].toFixed(1)} ${pm[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  };
  const spinRotors = () => {
    for (const { cfg, paths } of rotors) {
      const a0 = fanAngle * cfg.w;
      paths.forEach((p, i) => p.setAttribute("d", rotorBlade(cfg, a0 + (i / cfg.n) * TAU2)));
    }
  };

  const fmt = (v) => Math.round(v).toLocaleString("en-US");
  if (F.hint) F.hint.textContent = matchMedia("(hover: none)").matches ? "Tap to open it up" : "Hover to open it up";
  let toneShown = "";
  const updatePanel = () => {
    if (F.read) {
      F.read.textContent = `${sim.state} · N1 ${fmt(sim.n1)}% · ${fmt(sim.kn)} kN`;
      if (toneShown !== sim.tone) { toneShown = sim.tone; F.read.style.color = toneShown; }
    }
    if (load) load.textContent = fmt(sim.kn);
  };

  // explode
  const setApart = (on) => {
    if (apart === on) return;
    apart = on;
    stage.toggleAttribute("data-apart", on);
    const goal = on ? 1 : 0;
    let i = 0;
    for (const id of on ? STAGGER0 : [...STAGGER0].reverse()) {
      if (piece[id].target === goal) piece[id].pending = null;
      else piece[id].pending = { value: goal, at: clock + (STILL ? 0 : i++ * SPRING0.stagger) };
    }
    stage.setAttribute("aria-pressed", String(on));
    run();
  };
  const steer = (st, dt, calm) => {
    if (st.pending && clock >= st.pending.at) { st.target = st.pending.value; st.pending = null; }
    if (calm) { st.x = st.target; st.v = 0; return false; }
    for (let i = 0; i < SPRING0.substeps; i++) {
      const h = dt / SPRING0.substeps;
      st.v += ((st.target - st.x) * SPRING0.stiffness - st.v * SPRING0.damping) * h;
      st.x += st.v * h;
    }
    if (Math.abs(st.target - st.x) < 2e-4 && Math.abs(st.v) < 2e-4) { st.x = st.target; st.v = 0; return st.pending !== null; }
    return true;
  };
  const place = () => {
    for (const node of nodes) {
      const share = piece[node.ride].x;
      const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
      const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
      let text = "";
      if (share !== 0 && (tx || ty)) text = `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
      if (text !== node.shown) {
        node.shown = text;
        if (text) node.el.setAttribute("transform", text);
        else node.el.removeAttribute("transform");
      }
    }
    const next = nodes.map((_, i) => i).sort((a, b) => nodes[a].key + nodes[a].lift * piece[nodes[a].ride].x - (nodes[b].key + nodes[b].lift * piece[nodes[b].ride].x));
    if (next.some((idx, at) => idx !== order[at])) {
      const frag = document.createDocumentFragment();
      for (const idx of next) frag.appendChild(nodes[idx].el);
      engine.appendChild(frag);
      order = next;
    }
  };

  // ── WebGL exhaust layer ──
  let layer = null;
  if (!NOGL) {
    layer = glLayer({
      canvas, fragment: FRAG, view: [D.W, D.H], camera: D.camera,
      uniforms: ["uHeat", "uN1", "uOpen", "uMargin", "uNoz", "uDir", "uComb"],
      fixed: { uNoz: D.nozzle.exit, uDir: D.nozzle.dir },
    });
    if (layer) stage.setAttribute("data-gl", "");
  }

  const paint = () => {
    if (!layer) return;
    const rect = canvas.getBoundingClientRect();
    // dead zone ends 24 css px inside the iframe's left edge, in viewBox units
    const margin = rect.width ? (rect.left + 24) * (D.W / rect.width) : 0;
    layer.draw({
      uHeat: sim.heat,
      uN1: sim.n1 / 100,
      uOpen: piece.pod.x,
      uMargin: Math.max(0, margin),
      uComb: D.comb,
    }, clock);
  };

  // heat handoff to the parent page: nozzle exit + exhaust direction + heat
  let lastPosted = -1, lastPost = 0;
  const postState = (force = false) => {
    if (parent === window) return;
    const now = performance.now();
    if (!force && (Math.abs(sim.heat - lastPosted) < 0.02 || now - lastPost < 100)) return;
    const svg = stage.querySelector(".en-front");
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const p = iso(D.nozzle.exit, D.proj);
    const q = iso([D.nozzle.exit[0] + D.nozzle.dir[0], D.nozzle.exit[1] + D.nozzle.dir[1], D.nozzle.exit[2] + D.nozzle.dir[2]], D.proj);
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    lastPosted = sim.heat;
    lastPost = now;
    parent.postMessage({
      engine: {
        nozzle: [r.left + (p[0] / D.W) * r.width, r.top + (p[1] / D.H) * r.height],
        dir: [dx / len, dy / len],
        heat: sim.heat,
      },
    }, location.origin);
  };

  const tick = (now) => {
    frame = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    clock += dt;
    const calm = STILL;
    Object.assign(sim, stepSim(S, dt * SPEED, calm));
    sim.rpm = Math.max(0, sim.rpm);
    spinFan(calm ? 0 : dt);
    for (const id of IDS) steer(piece[id], dt, calm);
    place();
    if (stage.hasAttribute("data-apart")) spinRotors();
    stage.style.setProperty("--en-heat", sim.heat.toFixed(3));
    paint();
    updatePanel();
    postState();
    frame = visible && !STILL ? requestAnimationFrame(tick) : 0;
  };
  const run = () => {
    if (!frame && visible && !STILL) { last = 0; frame = requestAnimationFrame(tick); }
  };

  visible = true;
  if (STILL) tick(16); else run();
  postState(true);

  const quietLeave = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => { if (!inside) setApart(false); }, 280);
  };
  stage.addEventListener("pointerenter", (e) => { if (e.pointerType === "touch") return; inside = true; clearTimeout(leaveTimer); setApart(true); });
  stage.addEventListener("pointerleave", () => { inside = false; quietLeave(); });
  stage.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") return; setApart(!apart); });
  stage.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setApart(!apart); }
    else if (e.key === "Escape") { e.preventDefault(); setApart(false); }
  });
  stage.addEventListener("focus", () => setApart(true));
  stage.addEventListener("blur", () => setApart(false));
  window.addEventListener("resize", () => { run(); postState(true); });
  // The site menu drives the throttle: { throttle: "radar" | "growth" | "flask" | "press" | null }.
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || !("throttle" in e.data)) return;
    const m = MODES[e.data.throttle] ? e.data.throttle : "steady";
    S.mode = m;
    if (!inside) setApart(m !== "steady");
    if (STILL) tick(16);
  });

  spinFan(0);
  spinRotors();
  place();
  updatePanel();
  stage.style.setProperty("--en-heat", sim.heat.toFixed(3));
  if (STILL) tick(16);
};
const STAGGER0 = D.stagger;
const SPRING0 = D.spring;
document.querySelectorAll(".en-stage").forEach(boot);
