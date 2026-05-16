// Unified Hybrid Forward Engine — public AI equities, multi-horizon.
// ──────────────────────────────────────────────────────────────────
// Faithful TypeScript port of the operator-specified UnifiedAIForwardEngine.
//
// Architecture (operator spec):
//   Years 1–3  → Model II  (stochastic regime drift + timeline shock)
//   Years 3–5  → time-weighted blend of Model II and Model I
//   Years 5–10 → Model I   (macro-coupled state-space, structurally bounded)
//
// Rationale: short horizons are driven by discrete events / liquidity /
// binary political decisions — continuous models over-smooth them.
// Long horizons are driven by structural economic ceilings, energy /
// grid limits, and smooth multi-decade adoption — stochastic jump
// models degrade into noise. The hybrid routes each horizon to the
// model that audits cleanly there.
//
// Gating: this engine is for PUBLIC AI equities. Private + IPO
// universes use the separate Model I / Model II macro panel
// (lib/growth-models/macro-models.ts).
//
// The Python reference used scipy RK45 + numpy RNG. This port uses
// fixed-step RK4 and a seeded RNG so a given (t_shock, ξ) reproduces
// the same forecast — required for an auditable simulator.

import { mulberry32 } from "./macro-models";

// ──────────────── Timeline shock operator ────────────────
// S(t; t_shock, ξ) = ξ / (1 + e^(−κ(t − t_shock)))
// κ = 12 forces the shock to fully manifest within ~30 days of onset.
const KAPPA = 12.0;

export function evaluateShock(t: number, tShock: number, xi: number): number {
  return xi / (1 + Math.exp(-KAPPA * (t - tShock)));
}

export interface HybridParams {
  baseCapex: number;       // baseline CapEx index
  interestSpread: number;  // credit-spread drag
  regStringency: number;   // regulatory stringency 0–1
  diffusionRate: number;   // logistic social-adoption rate
}

export const HYBRID_BASELINE: HybridParams = {
  baseCapex: 0.4,
  interestSpread: 0.0225,
  regStringency: 0.3,
  diffusionRate: 0.35,
};

export interface HybridResult {
  /** Year grid (0–10). */
  t: number[];
  /** Final blended growth trajectory (1.0 = +100%). */
  growth: number[];
  /** Underlying Model I (state-space) curve, for transparency. */
  model1Curve: number[];
  /** Underlying Model II (stochastic) curve, for transparency. */
  model2Curve: number[];
  /** State-space trajectories. */
  C: number[]; P: number[]; W: number[]; S: number[];
  /** Which engine is authoritative at each step. */
  activeEngine: ("II" | "blend" | "I")[];
  /** Convenience milestone read-outs. */
  milestones: { year: number; growth: number; engine: "II" | "blend" | "I" }[];
  shock: { tShock: number; xi: number };
}

// ──────────────── State-space system (Model I backing) ────────────────
// 4-state ODE with the timeline shock injected directly into the
// compute, political, and supply-chain channels.
function stateSpaceSystem(
  t: number,
  states: number[],
  params: HybridParams,
  tShock: number,
  xi: number,
): number[] {
  const [C, , W, S] = states;
  const shock = evaluateShock(t, tShock, xi);

  const deltaCapex = params.baseCapex + 0.1 * Math.sin(t);

  // A destructive shock (ξ<0) compresses compute capacity and spikes
  // political friction; an accelerative shock (ξ>0) is gentler on C
  // and mildly positive on P.
  const cShockModifier = xi < 0 ? shock : shock * 0.5;
  const pShockModifier = xi < 0 ? -Math.abs(shock) * 1.5 : shock * 0.2;

  const dC = 0.3 * (deltaCapex + cShockModifier) - 0.05 * params.interestSpread;
  const dP = -0.1 * params.regStringency + pShockModifier;
  const dW = -0.02 * W + (xi > 0 ? shock : shock * 2.0);
  const computeFloor = Math.log(Math.max(C, 1e-4));
  const dS = params.diffusionRate * S * (1 - S) * computeFloor;

  return [dC, dP, dW, dS];
}

function rk4(
  t: number, y: number[], h: number,
  params: HybridParams, tShock: number, xi: number,
): number[] {
  const add = (a: number[], b: number[], s: number) => a.map((ai, i) => ai + s * b[i]);
  const k1 = stateSpaceSystem(t, y, params, tShock, xi);
  const k2 = stateSpaceSystem(t + h / 2, add(y, k1, h / 2), params, tShock, xi);
  const k3 = stateSpaceSystem(t + h / 2, add(y, k2, h / 2), params, tShock, xi);
  const k4 = stateSpaceSystem(t + h, add(y, k3, h), params, tShock, xi);
  return y.map((yi, i) => yi + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/**
 * Run the Unified Hybrid Engine.
 *  - tShock ∈ [0, 10] — year the disruption triggers
 *  - xi ∈ [-1, 1] — severity; negative = destructive, positive = accelerative
 *  - seed makes the Model-II noise reproducible
 */
export function runUnifiedHybrid(
  tShock: number,
  xi: number,
  params: HybridParams = HYBRID_BASELINE,
  totalHorizon = 10,
  steps = 100,
  seed = 42,
): HybridResult {
  const clampedXi = Math.max(-1, Math.min(1, xi));
  const rng = mulberry32(seed);
  const h = totalHorizon / steps;
  const t: number[] = [];
  const C: number[] = [], P: number[] = [], W: number[] = [], S: number[] = [];

  // 1. Continuous long-term state trajectories (Model I backing).
  let y = [1.2, 0.85, 1.0, 0.12];
  for (let i = 0; i <= steps; i++) {
    const time = i * h;
    t.push(time);
    C.push(y[0]); P.push(y[1]); W.push(y[2]); S.push(y[3]);
    if (i < steps) y = rk4(time, y, h, params, tShock, clampedXi);
  }

  const model1Curve = t.map((time, i) =>
    1.15 * Math.exp(-0.22 * time) + 0.50 * (C[i] * P[i] * W[i] * S[i]),
  );

  // 2. High-volatility short-term Markov fluctuations (Model II backing).
  const model2Curve: number[] = new Array(t.length);
  let regimeDrift = 1.10; // initial Hyper-Growth regime
  for (let i = 0; i < t.length; i++) {
    const time = t[i];
    const shockImpact = evaluateShock(time, tShock, clampedXi);
    if (time <= 3.0) {
      const noise = (rng() * 2 - 1) * 0.05 + (rng() - 0.5) * 0.05; // ≈ N(0, 0.05)
      if (time >= tShock && clampedXi < 0) {
        regimeDrift = 0.12; // forced transition to Regulatory/Supply Containment
      }
      model2Curve[i] = regimeDrift + shockImpact * 0.7 + noise;
    } else {
      model2Curve[i] = model1Curve[i]; // hand control to the state-space model
    }
  }

  // 3. Time-weighted routing — Model II for 1–3y, blend 3–5y, Model I 5–10y.
  const growth: number[] = new Array(t.length);
  const activeEngine: ("II" | "blend" | "I")[] = new Array(t.length);
  for (let i = 0; i < t.length; i++) {
    const time = t[i];
    if (time <= 3.0) {
      growth[i] = model2Curve[i];
      activeEngine[i] = "II";
    } else if (time <= 5.0) {
      const w = (time - 3.0) / 2.0;
      growth[i] = (1 - w) * model2Curve[i] + w * model1Curve[i];
      activeEngine[i] = "blend";
    } else {
      growth[i] = model1Curve[i];
      activeEngine[i] = "I";
    }
  }

  const milestoneYears = [1, 3, 5, 10];
  const milestones = milestoneYears.map((yr) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < t.length; i++) {
      const d = Math.abs(t[i] - yr);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return { year: yr, growth: growth[bestIdx], engine: activeEngine[bestIdx] };
  });

  return {
    t, growth, model1Curve, model2Curve,
    C, P, W, S, activeEngine, milestones,
    shock: { tShock, xi: clampedXi },
  };
}
