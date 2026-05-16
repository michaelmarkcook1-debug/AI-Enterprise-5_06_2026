// Macro-coupled forward growth models for private + IPO-stage AI companies.
// ─────────────────────────────────────────────────────────────────────────
// Faithful TypeScript ports of two operator-specified models:
//
//   Model I  — MC-SSDF (Macro-Coupled State Space Differential Framework)
//              Continuous 4-state ODE system. Used for the SHORT-TERM
//              horizon (1–3 years) in the investment simulator.
//
//   Model II — SRS-MJN (Stochastic Regime-Switching Markov Jump Network)
//              Continuous-time Markov regime chain + jump-diffusion.
//              Used for the LONGER-TERM horizon (4 years+).
//
// Both are gated in the simulator to the private + IPO universe only —
// they are NOT applied to public-direct equities, which use the
// existing scenario engine.
//
// The Python reference used scipy solve_ivp (RK45 adaptive) + numpy RNG.
// This port uses a fixed-step RK4 integrator (ample accuracy at 200
// steps / 10y) and a seeded RNG so simulator runs are reproducible
// and unit-testable.

// ──────────────── Seeded RNG (reproducible) ────────────────

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box-Muller, drawing from a uniform RNG. */
function normal(rng: () => number, mean = 0, sd = 1): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Poisson sample via Knuth's algorithm — fine for the small λ here. */
function poisson(rng: () => number, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > L);
  return k - 1;
}

// ════════════════════════════════════════════════════════════════════
// MODEL I — MC-SSDF (Macro-Coupled State Space Differential Framework)
// ════════════════════════════════════════════════════════════════════

export interface MCSSDFParams {
  cyclical: {
    omegaC: number;        // cyclical amplitude
    phi: number;           // cyclical frequency
    gammaC: number;        // interest-rate drag coefficient
    interestRate: number;  // prevailing rate (e.g. 0.045 = 4.5%)
  };
  political: {
    lambdaP: number;            // regulatory friction drag
    regulatoryFriction: number; // 0–1
    sigmaP: number;             // geo-fragmentation drag
    geoFrag: number;            // 0–1
  };
  worldEvent: {
    deltaW: number;        // continuous supply-chain decay rate
  };
  social: {
    kS: number;            // logistic adoption rate
  };
  growth: {
    g0: number;            // base growth at t=0
    alpha: number;         // decay-core rate
    beta: number;          // exogenous-impact coupling
  };
  /** Optional discrete supply-chain shock — at `atYear` multiply W by `factor`. */
  shock?: { atYear: number; factor: number };
}

export interface MCSSDFResult {
  /** Year grid. */
  t: number[];
  /** State trajectories. */
  C: number[];
  P: number[];
  W: number[];
  S: number[];
  /** Forward growth trajectory (1.0 = +100%). */
  growth: number[];
  /** Convenience read-outs. */
  initialGrowth: number;
  terminalGrowth: number;
}

/** The 4-state ODE right-hand side.
 *   y[0]=C compute & liquidity · y[1]=P geopolitical openness
 *   y[2]=W supply-chain continuity · y[3]=S social adoption */
function mcSsdfSystem(t: number, y: number[], p: MCSSDFParams): number[] {
  const [C, , W, S] = y;
  const { omegaC, phi, gammaC, interestRate } = p.cyclical;
  const { lambdaP, regulatoryFriction, sigmaP, geoFrag } = p.political;
  const { deltaW } = p.worldEvent;
  const { kS } = p.social;

  // dC/dt: cyclical oscillation dampened by the prevailing rate environment.
  const dC = omegaC * Math.cos(phi * t) - gammaC * interestRate;
  // dP/dt: regulatory friction + global fragmentation drag openness down.
  const dP = -lambdaP * regulatoryFriction - sigmaP * geoFrag;
  // dW/dt: continuous supply-chain decay (discrete shocks applied separately).
  const dW = -deltaW * W;
  // dS/dt: logistic social adoption, scaled by log of compute availability.
  const computeFactor = Math.log(Math.max(C, 1e-5));
  const dS = kS * S * (1 - S) * computeFactor;

  return [dC, dP, dW, dS];
}

/** Fixed-step RK4 — deterministic substitute for scipy RK45. */
function rk4Step(t: number, y: number[], h: number, p: MCSSDFParams): number[] {
  const add = (a: number[], b: number[], s: number) => a.map((ai, i) => ai + s * b[i]);
  const k1 = mcSsdfSystem(t, y, p);
  const k2 = mcSsdfSystem(t + h / 2, add(y, k1, h / 2), p);
  const k3 = mcSsdfSystem(t + h / 2, add(y, k2, h / 2), p);
  const k4 = mcSsdfSystem(t + h, add(y, k3, h), p);
  return y.map((yi, i) => yi + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/**
 * Run Model I over `horizonYears`. `initialStates` is
 * [C, P, W, S]; sensible default is [1.2, 0.9, 1.0, 0.15].
 */
export function runModelI(
  params: MCSSDFParams,
  initialStates: [number, number, number, number] = [1.2, 0.9, 1.0, 0.15],
  horizonYears = 3,
  steps = 200,
): MCSSDFResult {
  const h = horizonYears / steps;
  const t: number[] = [];
  const C: number[] = [], P: number[] = [], W: number[] = [], S: number[] = [];

  let y = [...initialStates];
  let shockApplied = false;
  for (let i = 0; i <= steps; i++) {
    const time = i * h;
    // Apply the discrete supply-chain shock once, the first step at/after atYear.
    if (params.shock && !shockApplied && time >= params.shock.atYear) {
      y[2] *= params.shock.factor;
      shockApplied = true;
    }
    t.push(time);
    C.push(y[0]); P.push(y[1]); W.push(y[2]); S.push(y[3]);
    if (i < steps) y = rk4Step(time, y, h, params);
  }

  // Forward growth trajectory:
  //   growth(t) = g0·exp(-alpha·t) + beta·(C·P·W·S)
  const { g0, alpha, beta } = params.growth;
  const growth = t.map((time, i) =>
    g0 * Math.exp(-alpha * time) + beta * (C[i] * P[i] * W[i] * S[i]),
  );

  return {
    t, C, P, W, S, growth,
    initialGrowth: growth[0],
    terminalGrowth: growth[growth.length - 1],
  };
}

// ════════════════════════════════════════════════════════════════════
// MODEL II — SRS-MJN (Stochastic Regime-Switching Markov Jump Network)
// ════════════════════════════════════════════════════════════════════

export interface Regime {
  name: string;
  drift: number;            // μ
  volatility: number;       // σ
  jumpIntensity: number;    // Poisson λ
  averageJumpSize: number;  // mean jump magnitude
}

export interface ModelIIResult {
  t: number[];
  /** Valuation path (USD millions). */
  valuation: number[];
  /** Forward annualised realised growth at each step. */
  growth: number[];
  /** Regime index active at each step. */
  regimeHistory: number[];
  /** Regime names for display. */
  regimes: Regime[];
  startValuation: number;
  endValuation: number;
  peakGrowth: number;
  finalRegime: string;
}

/** Default 4-regime structural environment (operator spec). */
export const DEFAULT_REGIMES: Regime[] = [
  { name: "Hyper-Growth Expansion", drift: 1.80, volatility: 0.25, jumpIntensity: 0.1, averageJumpSize: 0.4 },
  { name: "Regulatory Containment", drift: 0.35, volatility: 0.15, jumpIntensity: 0.5, averageJumpSize: -0.2 },
  { name: "Geopolitical Mercantilism", drift: 0.10, volatility: 0.40, jumpIntensity: 0.8, averageJumpSize: -0.3 },
  { name: "Systemic Capital Starvation", drift: -0.40, volatility: 0.30, jumpIntensity: 0.2, averageJumpSize: -0.1 },
];

/** Continuous-time generator matrix Q — each row sums to 0 (operator spec). */
export const DEFAULT_Q: number[][] = [
  [-0.25, 0.15, 0.08, 0.02],
  [0.10, -0.40, 0.20, 0.10],
  [0.05, 0.25, -0.50, 0.20],
  [0.02, 0.08, 0.10, -0.20],
];

/** P(dt) ≈ I + Q·dt, clipped to [0,1] and row-normalised. */
function transitionProbabilities(Q: number[][], dt: number): number[][] {
  const n = Q.length;
  const P: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) {
      const v = (r === c ? 1 : 0) + Q[r][c] * dt;
      row.push(Math.max(0, Math.min(1, v)));
    }
    const sum = row.reduce((a, b) => a + b, 0) || 1;
    P.push(row.map((v) => v / sum));
  }
  return P;
}

function sampleCategorical(probs: number[], rng: () => number): number {
  const r = rng();
  let cum = 0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (r < cum) return i;
  }
  return probs.length - 1;
}

/**
 * Run Model II — jump-diffusion valuation path under a Markov regime
 * chain. `seed` makes the path reproducible (Python used np.random.seed(42)).
 */
export function runModelII(
  regimes: Regime[],
  Q: number[][],
  v0: number,
  horizonYears: number,
  steps = 60,
  initialState = 0,
  seed = 42,
): ModelIIResult {
  const rng = mulberry32(seed);
  const dt = horizonYears / steps;
  const t: number[] = [];
  const valuation: number[] = new Array(steps);
  const regimeHistory: number[] = new Array(steps);

  valuation[0] = v0;
  regimeHistory[0] = initialState;
  for (let i = 0; i < steps; i++) t.push((i * horizonYears) / steps);

  const P = transitionProbabilities(Q, dt);
  for (let idx = 1; idx < steps; idx++) {
    const s = regimeHistory[idx - 1];
    const nextS = sampleCategorical(P[s], rng);
    regimeHistory[idx] = nextS;

    const { drift: mu, volatility: sigma, jumpIntensity, averageJumpSize } = regimes[nextS];
    // Continuous Brownian component.
    const dW = normal(rng, 0, Math.sqrt(dt));
    // Jump component — Poisson count × normal jump size.
    const dN = poisson(rng, jumpIntensity * dt);
    const totalJump = dN * normal(rng, averageJumpSize, 0.1);
    // Geometric-Brownian update with structural jumps.
    let next = valuation[idx - 1] * (1 + mu * dt + sigma * dW + totalJump);
    valuation[idx] = Math.max(next, 1e-3);
  }

  // Forward annualised realised growth.
  const growth = new Array(steps).fill(0);
  growth[0] = regimes[initialState].drift;
  for (let i = 1; i < steps; i++) {
    growth[i] = (valuation[i] - valuation[i - 1]) / (valuation[i - 1] * dt);
  }

  return {
    t,
    valuation,
    growth,
    regimeHistory,
    regimes,
    startValuation: valuation[0],
    endValuation: valuation[steps - 1],
    peakGrowth: Math.max(...growth),
    finalRegime: regimes[regimeHistory[steps - 1]].name,
  };
}

export interface ModelIIEnsemble {
  paths: number;
  horizonYears: number;
  startValuation: number;
  p5: number;
  p50: number;
  p95: number;
  medianCagr: number;
  /** Mean fraction of time spent in each regime, across the ensemble. */
  regimeOccupancy: { name: string; fraction: number }[];
}

/**
 * Run Model II as an ENSEMBLE — a single Markov path is high-variance
 * and not decision-grade, so the simulator consumes a distribution.
 * Deterministic: seeds are 0..paths-1.
 */
export function runModelIIEnsemble(
  regimes: Regime[],
  Q: number[][],
  v0: number,
  horizonYears: number,
  paths = 2000,
  steps = 60,
): ModelIIEnsemble {
  const ends: number[] = [];
  const occ = new Array(regimes.length).fill(0);
  let occSteps = 0;
  for (let seed = 0; seed < paths; seed++) {
    const r = runModelII(regimes, Q, v0, horizonYears, steps, 0, seed);
    ends.push(r.endValuation);
    for (const reg of r.regimeHistory) { occ[reg] += 1; occSteps += 1; }
  }
  ends.sort((a, b) => a - b);
  const at = (p: number) => ends[Math.floor(paths * p)];
  const p50 = at(0.5);
  return {
    paths,
    horizonYears,
    startValuation: v0,
    p5: at(0.05),
    p50,
    p95: at(0.95),
    medianCagr: Math.pow(p50 / v0, 1 / horizonYears) - 1,
    regimeOccupancy: regimes.map((r, i) => ({ name: r.name, fraction: occ[i] / occSteps })),
  };
}

// ════════════════════════════════════════════════════════════════════
// Simulator gating helper
// ════════════════════════════════════════════════════════════════════

export type MacroModelChoice =
  | { model: "I"; reason: string }
  | { model: "II"; reason: string }
  | { model: "none"; reason: string };

/**
 * Decide which macro model the simulator should use.
 *  - Model I  → short-term (horizon ≤ 3 years)
 *  - Model II → longer-term (horizon ≥ 4 years)
 * Both ONLY for private + IPO universes; public-direct universes
 * keep the existing scenario engine.
 */
export function chooseMacroModel(
  universe: string,
  horizonYears: number,
): MacroModelChoice {
  const isPrivateOrIpo =
    universe === "ipo_watch" ||
    universe === "speculative_all" ||
    universe === "public_and_indirect"; // indirect exposure routes to private labs
  if (!isPrivateOrIpo) {
    return { model: "none", reason: "Macro models apply to private + IPO universes only — public-direct holdings use the scenario engine." };
  }
  if (horizonYears <= 3) {
    return { model: "I", reason: `Short-term horizon (${horizonYears}y) → Model I (MC-SSDF).` };
  }
  return { model: "II", reason: `Longer-term horizon (${horizonYears}y) → Model II (SRS-MJN).` };
}

/** Baseline May-2026 parameter set for Model I. */
export const MODEL_I_BASELINE: MCSSDFParams = {
  cyclical: { omegaC: 0.4, phi: 1.2, gammaC: 0.05, interestRate: 0.045 },
  political: { lambdaP: 0.15, regulatoryFriction: 0.4, sigmaP: 0.08, geoFrag: 0.35 },
  worldEvent: { deltaW: 0.02 },
  social: { kS: 0.35 },
  growth: { g0: 1.5, alpha: 0.4, beta: 0.6 },
};
