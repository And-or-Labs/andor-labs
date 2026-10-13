// Turbofan throttle model — no DOM, no kit imports.
// Imported by build.mjs and inlined into the page (strip `export `).
// One idle base setting; the site menu advances the throttle per line of work.

export const MODES = {
  steady: { state: "IDLE", n1: 22, egt: 450, kn: 20, heat: 0.15, tone: "#0b1533" },
  radar: { state: "CLIMB", n1: 94, egt: 840, kn: 190, heat: 0.7, tone: "#1b4dff" },
  growth: { state: "TAKEOFF", n1: 100, egt: 950, kn: 420, heat: 1, tone: "#dc6bad" },
  flask: { state: "CLIMB", n1: 92, egt: 820, kn: 180, heat: 0.65, tone: "#1b4dff" },
  press: { state: "CRUISE", n1: 82, egt: 700, kn: 60, heat: 0.45, tone: "#dc6bad" },
};

// Fan speed follows N1: idle turns slowly, takeoff spins up hard.
export const fanTarget = (n1) => 260 + n1 * 26;

// One channel that settles toward a target with a time constant.
const chan = (tau, v) => ({ v, tau });

export const makeSim = () => {
  const m = MODES.steady;
  return {
    t: 0,
    mode: "steady",
    n1: chan(0.8, m.n1),
    egt: chan(1.8, m.egt),
    kn: chan(0.5, m.kn),
    heat: chan(1.0, m.heat),
    rpm: chan(1.4, fanTarget(m.n1)),
    jitter: 0,
  };
};

// Exponential follow.
const ease = (c, target, dt) => {
  c.v += (target - c.v) * (1 - Math.exp(-dt / c.tau));
  return c.v;
};

// Advance toward the current mode. calm = settle every channel to target this frame.
export const stepSim = (S, dt, calm = false) => {
  S.t += dt;
  const p = MODES[S.mode] || MODES.steady;
  for (const key of ["n1", "egt", "kn", "heat"]) S[key].v = calm ? p[key] : ease(S[key], p[key], dt);
  // Small eased jitter on thrust so the reading lives without stepping.
  const jit = (Math.sin(S.t * 6.9) * 0.025 + Math.sin(S.t * 1.9) * 0.02) * p.kn;
  S.jitter += (jit - S.jitter) * (1 - Math.exp(-dt / 0.3));
  const rpmT = fanTarget(S.n1.v);
  S.rpm.v = calm ? rpmT : ease(S.rpm, rpmT, dt);
  return {
    state: p.state,
    tone: p.tone,
    n1: S.n1.v,
    egt: S.egt.v,
    kn: Math.max(0, S.kn.v + S.jitter),
    heat: S.heat.v,
    rpm: S.rpm.v,
  };
};
