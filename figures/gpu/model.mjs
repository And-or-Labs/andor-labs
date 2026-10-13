// Pure GPU telemetry model — no DOM, no kit imports.
// Imported by build.mjs and inlined into the page (strip `export `).
// One steady base load; the site menu switches the card into a workload per line of work.

export const MODES = {
  steady: { state: "IDLE", lcd: "IDLE", tone: "#0b1533", power: 140, clock: 1890, temp: 54, vram: 6.2, out: 24 },
  radar: { state: "BUSY", lcd: "BUSY", tone: "#1b4dff", power: 360, clock: 2520, temp: 66, vram: 14.8, out: 96 },
  growth: { state: "FLAT OUT", lcd: "MAX", tone: "#dc6bad", power: 420, clock: 2520, temp: 70, vram: 17.2, out: 64 },
  flask: { state: "BUSY", lcd: "BUSY", tone: "#1b4dff", power: 300, clock: 2430, temp: 64, vram: 11.6, out: 140 },
  press: { state: "WARM", lcd: "WARM", tone: "#dc6bad", power: 260, clock: 2310, temp: 61, vram: 9.4, out: 112 },
};

// Fans stay stopped below 50 C, then ease 900 -> 1800 rpm with temp.
export const fanTarget = (temp) => {
  if (temp <= 50) return 0;
  const k = Math.min(1, Math.max(0, (temp - 50) / 18));
  return 900 + k * k * (3 - 2 * k) * 900;
};

// One channel that settles toward a target with a time constant.
const chan = (tau, v) => ({ v, tau });

export const makeSim = () => {
  const m = MODES.steady;
  return {
    t: 0,
    mode: "steady",
    power: chan(0.45, m.power),
    clock: chan(0.5, m.clock),
    temp: chan(2.4, m.temp),
    vram: chan(0.8, m.vram),
    out: chan(0.35, m.out),
    rpm: chan(1.4, fanTarget(m.temp)),
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
  for (const key of ["power", "clock", "temp", "vram", "out"]) S[key].v = calm ? p[key] : ease(S[key], p[key], dt);
  // Small eased jitter on output so the reading lives without stepping.
  const jit = (Math.sin(S.t * 7.3) * 0.03 + Math.sin(S.t * 2.1) * 0.02) * p.out;
  S.jitter += (jit - S.jitter) * (1 - Math.exp(-dt / 0.3));
  const rpmT = fanTarget(S.temp.v);
  S.rpm.v = calm ? rpmT : ease(S.rpm, rpmT, dt);
  return {
    state: p.state,
    lcd: p.lcd,
    tone: p.tone,
    power: S.power.v,
    clock: S.clock.v,
    temp: S.temp.v,
    vram: S.vram.v,
    out: S.out.v + S.jitter,
    rpm: S.rpm.v,
  };
};
