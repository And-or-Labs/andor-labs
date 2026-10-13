// Inference sled live runtime — tour, fans, explode, telemetry panel, WebGL inks.
// Runs after kitScript() + glScript() + model.mjs are inlined.
const D = __DATA__;
const Q = new URLSearchParams(location.search);
const STILL = Q.has("still");
const NOGL = Q.has("nogl");
const SPEED = Math.max(0.01, Number(Q.get("speed")) || 1);
const FORCE = (Q.get("mode") || "").toLowerCase();
const TAU2 = Math.PI * 2;

const FRAG = `
uniform float uPower;
uniform float uHeat;
uniform float uFan;
uniform float uFlow;
uniform float uBeadI;
uniform float uHaze;
uniform vec4 uLift;
uniform vec3 uBeads[10];
uniform vec3 uCable[20];
uniform float uCableN;
uniform vec3 uPipeA[6];
uniform vec3 uPipeB[6];
uniform vec3 uDie;
uniform vec3 uVapC;
uniform vec4 uFinPlan;
uniform vec4 uGaps;
uniform float uFinTop;
float segd(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-6),0.,1.);return length(p-a-ab*t);}
vec3 warm(float t){vec3 a=vec3(.949,.718,.02);vec3 b=vec3(.941,.463,.31);vec3 c=vec3(.72,.22,.14);return t<.5?mix(a,b,t*2.):mix(b,c,t*2.-1.);}

void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 col=vec3(0.);

  // energy in: pulses riding the cable into the socket
  {
    float soft=2.2;
    for(int i=0;i<19;i++){
      if(float(i)+1.5>uCableN)break;
      float d=segd(vb,project(uCable[i]).xy,project(uCable[i+1]).xy);
      col+=vec3(.106,.302,1.)*exp(-pow(d/(soft*3.4),2.))*.09*(0.2+uPower);
    }
    for(int i=0;i<10;i++){
      float w=1.-float(i)/10.;
      float d=length(vb-project(uBeads[i]).xy);
      col+=vec3(.106,.302,1.)*exp(-pow(d/5.5,2.))*uBeadI*w*1.2;
    }
  }

  // heat: die, vapor edge, pipes, fin tops (drawn behind the front svg)
  {
    float hot=uHeat;
    vec3 pd=onFloor(vb,uDie.z);
    col+=warm(hot)*exp(-pow(length(pd.xy-uDie.xy)/13.,2.))*(0.15+0.9*hot);
    vec3 pv=onFloor(vb,uVapC.z);
    vec2 dv=max(abs(pv.xy-uVapC.xy)-vec2(90.,38.),0.);
    col+=warm(hot*.9)*exp(-length(dv)/13.)*.15*hot;
    vec3 pp=onFloor(vb,26.+uLift.y); // pipes ride the vapor assembly
    for(int i=0;i<6;i++){
      vec3 a=uPipeA[i],b=uPipeB[i];
      vec3 ab=b-a;
      float t=clamp(dot(pp-a,ab)/max(dot(ab,ab),1e-6),0.,1.);
      float d=length(pp-a-ab*t);
      col+=warm(hot*(1.-.35*t))*exp(-pow(d/3.4,2.))*.24*hot;
    }
    vec3 pf=onFloor(vb,uFinTop+uLift.z);
    vec2 dfin=max(abs(pf.xy-uFinPlan.zw)-uFinPlan.xy,0.);
    float inGap=(1.-smoothstep(0.,2.5,abs(pf.x-uGaps.x)))+(1.-smoothstep(0.,2.5,abs(pf.x-uGaps.y)));
    col+=warm(hot)*(.1+.3*inGap)*exp(-length(dfin)/40.)*hot;
  }

  // radiant haze above the fin stack
  if(uHaze>.001){
    vec3 Vv=towardViewer();
    vec3 g0=onFloor(vb,0.);
    vec3 e0=g0-Vv*1200.;
    float zTop=uFinTop+uLift.z;
    float rho=0.;
    for(int i=0;i<8;i++){
      float z0=zTop+4.+float(i)*7.;
      vec3 p=e0+Vv*((z0-e0.z)/Vv.z);
      if(p.x>-140.&&p.x<140.&&p.y>-50.&&p.y<50.){
        float n=fbm3(p*.045+vec3(-uTime*.12*uFan,0.,-uTime*.75));
        float edge=(1.-smoothstep(120.,140.,abs(p.x)))*(1.-smoothstep(34.,50.,abs(p.y)));
        rho+=n*(1.-(z0-zTop)/56.)*edge;
      }
    }
    rho=max(rho/8.,0.);
    col+=vec3(.93,.72,.22)*rho*rho*1.15*uHaze+vec3(.94,.46,.3)*rho*.28*uHaze;
  }

  float dens=max(col.r,max(col.g,col.b));
  float a=1.-exp(-dens*2.6);
  gl_FragColor=vec4(dens>1e-5?col/dens*a:vec3(0.),a);
}`;

const boot = (stage) => {
  const engine = stage.querySelector(".gp-engine");
  const canvas = stage.querySelector(".gp-gl");
  const plate = stage.closest(".gp-plate");
  const F = {};
  plate.querySelectorAll("[data-f]").forEach((el) => (F[el.dataset.f] = el));
  const lcd = stage.querySelector("[data-lcd]");
  const nodes = [...engine.querySelectorAll(".it")].map((el) => ({
    el, piece: el.dataset.piece, ride: el.dataset.ride || el.dataset.piece,
    key: Number(el.dataset.k), m: el.dataset.m.split(",").map(Number), shown: "",
  }));
  for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
  let order = nodes.map((_, i) => i);

  const IDS = Object.keys(D.moves);
  const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
  const S = makeSim();
  const sim = { ...MODES.steady, rpm: fanTarget(MODES.steady.temp) };
  let apart = false, inside = false, leaveTimer = 0, visible = false, frame = 0, last = 0, clock = 0;
  let fanAngle = 0, flow = 0;

  // preset for ?mode=
  if (MODES[FORCE]) S.mode = FORCE;
  if (Q.has("apart")) { apart = true; for (const id of IDS) piece[id].target = piece[id].x = 1; }

  // fans: blade paths rebuilt per frame
  const bladeGroups = [...stage.querySelectorAll(".gp-blades")].map((g, i) => {
    const blades = [];
    for (let b = 0; b < D.fans[i].blades; b++) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("class", "gp-blade");
      g.appendChild(p);
      blades.push(p);
    }
    const blur = document.createElementNS("http://www.w3.org/2000/svg", "path");
    blur.setAttribute("class", "gp-blur");
    g.appendChild(blur);
    return { blades, blur, fan: D.fans[i], phase: i * 0.9 };
  });
  const petal = (fan, base, i) => {
    const b = base + (i / fan.blades) * TAU2;
    const pts = [
      [6.5, b], [15, b + 0.11], [25.4, b + 0.32], [25.4, b + 0.44], [14, b + 0.26], [6.5, b + 0.19],
    ].map(([r, a]) => iso([fan.cx + r * Math.cos(a), fan.cy + r * Math.sin(a), fan.bladeAt], D.proj));
    return `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}Z`;
  };
  const discAt = (fan, r, z) => `M${circleRing(fan.cx, fan.cy, r, 44).map((p) => { const q = iso([p[0], p[1], z], D.proj); return `${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }).join("L")}Z`;
  const spinFans = (dt) => {
    const vis = Math.min(sim.rpm, 1800) / 1800;
    fanAngle += dt * vis * 8.5;
    const blurA = Math.max(0, Math.min(0.3, (sim.rpm - 500) / 1600 * 0.36));
    for (const g of bladeGroups) {
      g.fan.bladesPath = "";
      g.blades.forEach((p, i) => p.setAttribute("d", petal(g.fan, fanAngle + g.phase, i)));
      g.blur.setAttribute("d", discAt(g.fan, g.fan.r, g.fan.bladeAt + 0.2));
      g.blur.style.opacity = blurA;
    }
  };

  if (F.hint) F.hint.textContent = matchMedia("(hover: none)").matches ? "Tap to open it up" : "Hover to open it up";
  const fmt = (v) => Math.round(v).toLocaleString("en-US");
  let toneShown = "";
  const updatePanel = () => {
    if (F.read) {
      F.read.textContent = `${sim.state} · ${fmt(sim.power)} W · ${fmt(Math.max(0, sim.out))} tok/s`;
      if (toneShown !== sim.tone) { toneShown = sim.tone; F.read.style.color = toneShown; }
    }
    if (lcd && lcd.textContent !== sim.lcd) lcd.textContent = sim.lcd;
  };

  // explode
  const setApart = (on) => {
    if (apart === on) return;
    apart = on;
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
      const text = share === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
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

  // ── WebGL layer ──
  let layer = null;
  if (!NOGL) {
    layer = glLayer({
      canvas, fragment: FRAG, view: [D.W, D.H], camera: D.camera,
      uniforms: ["uPower", "uHeat", "uFan", "uFlow", "uBeadI", "uHaze", "uLift", "uBeads", "uCable", "uCableN", "uPipeA", "uPipeB", "uDie", "uVapC", "uFinPlan", "uGaps", "uFinTop"],
      fixed: {
        uCable: D.cableFlat, uCableN: D.cableFlat.length / 3,
        uPipeA: D.pipeA, uPipeB: D.pipeB,
        uFinPlan: D.finPlan, uGaps: D.gaps, uFinTop: D.finTop,
      },
    });
    if (layer) stage.setAttribute("data-gl", "");
  }

  // intelligence out: Canvas2D glyph stream on the floor plane (drawn under the front svg)
  const fxc = stage.querySelector(".gp-fx");
  const fctx = fxc ? fxc.getContext("2d") : null;
  const h01 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const drawBits = () => {
    if (!fctx) return;
    const box = fxc.getBoundingClientRect();
    const ratio = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(box.width * ratio)), h = Math.max(1, Math.round(box.height * ratio));
    if (fxc.width !== w || fxc.height !== h) { fxc.width = w; fxc.height = h; }
    const sc = w / D.W;
    fctx.setTransform(sc, 0, 0, sc, 0, 0);
    fctx.clearRect(0, 0, D.W, D.H);
    const tok = Math.max(0, Math.min(1, sim.out / 120));
    if (tok < 0.02) return;
    fctx.font = "12px 'Paper Mono', ui-monospace, monospace";
    fctx.textAlign = "center";
    fctx.textBaseline = "middle";
    fctx.fillStyle = "#1b4dff";
    const sp = 10;
    const n = Math.ceil(D.streamLen / sp) + 1;
    for (const L of [-14, -7, 0, 7, 14]) {
      for (let i = -1; i <= n; i++) {
        const u = i * sp + sp - (flow % sp);
        if (u < -2 || u > D.streamLen + 4) continue;
        const wx = D.streamO[0] + D.streamD[0] * u + D.streamL[0] * L;
        const wy = D.streamO[1] + D.streamD[1] * u + D.streamL[1] * L;
        const [px, py] = iso([wx, wy, D.streamO[2]], D.proj);
        const env = Math.min(1, (u + 2) / 12) * Math.max(0, 1 - Math.max(0, u - (D.streamLen - 14)) / 14);
        if (h01(i * 7.13 + L * 3.71) > tok) continue;
        fctx.globalAlpha = env * 0.92;
        fctx.fillText(h01(i * 3.17 + L * 5.13) > 0.5 ? "1" : "0", px, py);
      }
    }
    fctx.globalAlpha = 1;
  };
  const cableLen = [];
  { let acc = 0; for (let i = 0; i + 1 < D.cable.length; i++) { acc += Math.hypot(D.cable[i + 1][0] - D.cable[i][0], D.cable[i + 1][1] - D.cable[i][1], D.cable[i + 1][2] - D.cable[i][2]); cableLen.push(acc); } }
  const cableTotal = cableLen[cableLen.length - 1] || 1;
  const cableAt = (s) => {
    s = ((s % cableTotal) + cableTotal) % cableTotal;
    let i = 0;
    while (i < cableLen.length && cableLen[i] < s) i++;
    const a = D.cable[i], b = D.cable[Math.min(i + 1, D.cable.length - 1)];
    const prev = i === 0 ? 0 : cableLen[i - 1];
    const t = (s - prev) / Math.max(cableLen[i] - prev, 1e-6);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };

  const paint = () => {
    if (!layer) return;
    const beads = [];
    const head = clock * (10 + 60 * (sim.power / 450));
    for (let i = 0; i < 10; i++) beads.push(...cableAt(head - i * 9));
    layer.draw({
      uPower: sim.power / 450,
      uHeat: Math.max(0, Math.min(1, (sim.temp - 34) / 38)),
      uFan: sim.rpm / 1800,
      uFlow: flow,
      uBeadI: 0.12 + 0.88 * (sim.power / 450),
      uHaze: (sim.power / 450) * (0.3 + 0.7 * (sim.rpm / 1800)),
      uLift: [piece.pcb.x * D.moves.pcb[2], piece.vapor.x * D.moves.vapor[2], piece.fins.x * D.moves.fins[2], piece.shroud.x * D.moves.shroud[2]],
      uBeads: beads,
      uDie: [D.die.c[0], D.die.c[1], D.die.z1 + piece.pcb.x * D.moves.pcb[2] + 0.5],
      uVapC: [D.vaporC[0], D.vaporC[1], D.vaporC[2] + piece.vapor.x * D.moves.vapor[2]],
    }, clock);
  };

  const tick = (now) => {
    frame = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    clock += dt;
    const calm = STILL;
    Object.assign(sim, stepSim(S, dt * SPEED, calm));
    sim.rpm = Math.max(0, sim.rpm);
    flow += dt * (4 + 30 * (sim.out / 120)) * SPEED;
    spinFans(calm ? 0 : dt);
    let moving = false;
    for (const id of IDS) if (steer(piece[id], dt, calm)) moving = true;
    place();
    paint();
    drawBits();
    updatePanel();
    frame = visible && !STILL ? requestAnimationFrame(tick) : 0;
  };
  const run = () => {
    if (!frame && visible && !STILL) { last = 0; frame = requestAnimationFrame(tick); }
  };

  visible = true;
  if (STILL) tick(16); else run();

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
  window.addEventListener("resize", run);
  // The site menu drives the workload: { gpu: "radar" | "growth" | "flask" | "press" | null }.
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || !("gpu" in e.data)) return;
    const m = MODES[e.data.gpu] ? e.data.gpu : "steady";
    S.mode = m;
    if (!inside) setApart(m !== "steady");
    if (STILL) tick(16);
  });

  spinFans(0);
  place();
  updatePanel();
  if (STILL) tick(16);
};
const STAGGER0 = D.stagger;
const SPRING0 = D.spring;
document.querySelectorAll(".gp-stage").forEach(boot);
