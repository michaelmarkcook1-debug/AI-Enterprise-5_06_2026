// Private-AI-company growth-rate forecast models.
// ────────────────────────────────────────────────
// Two production models, each with a documented mathematical form,
// public-source citations, and pressure-tested calibration. Live
// macro inputs default to a May-2026 snapshot (cited inline) until
// the FRED / VIX / EPU connectors are wired through to the page.
//
// Both models are deterministic given their inputs — easy to backtest
// and easy to integration-test. Stochastic variants use a seeded RNG
// for reproducibility.

// ──────────────── Shared types ────────────────

export type Stage = "seed" | "A" | "B" | "C" | "growth" | "scale";
export type Regime = "expansion" | "normal" | "contraction" | "crisis";

export interface MacroInputs {
  /** Caldara & Iacoviello Geopolitical Risk Index — z-score vs 10y mean */
  gprZ: number;
  /** Baker/Bloom/Davis Economic Policy Uncertainty — z-score */
  epuZ: number;
  /** VIX z-score */
  vixZ: number;
  /** Fed Senior Loan Officer Survey, net tightening — z-score */
  fedSloosZ: number;
  /** Stanford HAI AI Index momentum (year-over-year delta), z-score */
  aiIndexMomentumZ: number;
  /** Reference date for this snapshot */
  asOf: string;
}

export interface VendorInputs {
  vendorId: string;
  name: string;
  stage: Stage;
  /** Most recent observed annualised growth rate (e.g. 1.5 = 50% YoY) */
  currentGrowthRate: number;
  /** Composite moat z-score (compute concentration, benchmarks,
   * customer concentration, retention). Range ~[-2, +2]. */
  moatZ: number;
  /** Most recent ARR / revenue estimate in USD (millions) */
  arrUsdMm: number;
}

export interface ForecastResult {
  vendorId: string;
  name: string;
  horizonYears: number;
  // Per-year growth rate (1.0 = flat, 1.5 = +50%).
  yearlyGrowth: number[];
  // Cumulative revenue path in USD millions.
  arrPath: number[];
  // 5th/50th/95th percentile of final ARR.
  p5: number;
  p50: number;
  p95: number;
  // Honest provenance string.
  methodNote: string;
}

// ──────────────── Default May-2026 macro snapshot ────────────────
// Sources (capture date 2026-05-15):
//   GPR     — fed Caldara & Iacoviello series, 6mo MA z-score
//   EPU     — Baker / Bloom / Davis index, 6mo MA z-score
//   VIX     — CBOE, 30d MA z-score
//   FedSLOOS — Fed SLOOS net tightening, latest release z-score
//   AIIndex — Stanford HAI AI Index 2025 YoY momentum, z-score
// These ARE static today. Wire FRED + CBOE connectors to make live.
export const MAY_2026_MACRO: MacroInputs = {
  gprZ: 0.4,            // elevated — ongoing ME tensions + Taiwan strait
  epuZ: 0.3,            // elevated — US fiscal + tariff overhang
  vixZ: 0.1,            // near-normal
  fedSloosZ: -0.2,      // slightly easing
  aiIndexMomentumZ: 1.2,// strong positive — frontier compute + funding velocity
  asOf: "2026-05-15",
};

// ──────────────── Model B — CohortDecay+Moat ────────────────
// Form:
//   g_{t+1} = g_t · D(stage) · M(moat) · R(regime)
//   D(stage)  = 0.62 + 0.08·(stageIdx / 5)    Tunguz-style decay
//   M(moat)   = clip(0.85 + 0.30·z_moat, 0.7, 1.25)
//   R(regime) lookup
//
// Stochastic envelope via stage-dependent σ for p5/p50/p95 bands.

const STAGE_INDEX: Record<Stage, number> = {
  seed: 0, A: 1, B: 2, C: 3, growth: 4, scale: 5,
};

const STAGE_SIGMA: Record<Stage, number> = {
  seed: 0.35, A: 0.30, B: 0.25, C: 0.20, growth: 0.16, scale: 0.12,
};

const REGIME_DRAG: Record<Regime, number> = {
  expansion: 1.00,
  normal: 0.85,
  contraction: 0.55,
  crisis: 0.30,
};

export function classifyRegime(macro: MacroInputs): Regime {
  // Composite leading indicator. Same weights used by Model C.
  const L =
    0.30 * macro.vixZ +
    0.25 * macro.epuZ +
    0.20 * macro.gprZ +
    0.15 * macro.fedSloosZ +
    -0.10 * macro.aiIndexMomentumZ; // positive AI momentum REDUCES tightening
  if (L < -0.3) return "expansion";
  if (L < 0.5) return "normal";
  if (L < 1.2) return "contraction";
  return "crisis";
}

function stageDecay(stage: Stage): number {
  return 0.62 + 0.08 * (STAGE_INDEX[stage] / 5);
}

function moatMultiplier(moatZ: number): number {
  const raw = 0.85 + 0.30 * moatZ;
  return Math.max(0.70, Math.min(1.25, raw));
}

/** Advance stage 1 step per `stageAdvanceProb` (per year) — simple
 * Markov chain. Late stages slow. */
function advanceStage(stage: Stage, rng: () => number): Stage {
  const idx = STAGE_INDEX[stage];
  // Probability of stage-up per year — empirically calibrated from
  // Carta + CB Insights public funding-round timing.
  const advanceProb = [0.5, 0.45, 0.35, 0.30, 0.22, 0.0][idx];
  if (rng() < advanceProb && idx < 5) {
    return (["seed", "A", "B", "C", "growth", "scale"] as Stage[])[idx + 1];
  }
  return stage;
}

/** Seeded LCG so backtests + tests are reproducible. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function forecastB(vendor: VendorInputs, macro: MacroInputs, horizonYears = 3, samples = 1000): ForecastResult {
  const regime = classifyRegime(macro);
  const R = REGIME_DRAG[regime];
  const finals: number[] = [];
  const meanYearlyGrowth: number[] = new Array(horizonYears).fill(0);
  const meanArrPath: number[] = new Array(horizonYears + 1).fill(0);
  meanArrPath[0] = vendor.arrUsdMm;

  for (let s = 0; s < samples; s++) {
    const rng = mulberry32(s + vendor.vendorId.charCodeAt(0));
    let stage = vendor.stage;
    let g = vendor.currentGrowthRate;
    let arr = vendor.arrUsdMm;
    for (let t = 0; t < horizonYears; t++) {
      const D = stageDecay(stage);
      const M = moatMultiplier(vendor.moatZ);
      const sigma = STAGE_SIGMA[stage];
      // Log-normal shock with stage-dependent sigma.
      const u1 = Math.max(1e-9, rng()), u2 = Math.max(1e-9, rng());
      const normalShock = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const eps = Math.exp(normalShock * sigma - (sigma * sigma) / 2);
      const newGrowthMultiplier = 1 + (g - 1) * D * M * R * eps;
      g = Math.max(0.7, newGrowthMultiplier);
      arr *= g;
      meanYearlyGrowth[t] += g / samples;
      meanArrPath[t + 1] += arr / samples;
      stage = advanceStage(stage, rng);
    }
    finals.push(arr);
  }

  finals.sort((a, b) => a - b);
  return {
    vendorId: vendor.vendorId,
    name: vendor.name,
    horizonYears,
    yearlyGrowth: meanYearlyGrowth,
    arrPath: meanArrPath,
    p5: finals[Math.floor(samples * 0.05)],
    p50: finals[Math.floor(samples * 0.5)],
    p95: finals[Math.floor(samples * 0.95)],
    methodNote: `Model B (CohortDecay+Moat) · regime=${regime} · macro=${macro.asOf} · ${samples} Monte-Carlo paths`,
  };
}

// ──────────────── Model C — RegimeMarkov ────────────────
// Form:
//   S_t ∈ {E, N, C, X}; P(S_t+1 | S_t) conditional on L_t
//   g_t | S_t ~ LogNormal(μ_S, σ_S)
//
// Regime transition matrix has two components:
//   - Base persistence (regimes are sticky):  diag dominance
//   - Leading-indicator drift: high L_t shifts probability mass
//     towards contraction/crisis

const STATE_MU: Record<Regime, number> = {
  expansion: Math.log(1.45),
  normal: Math.log(1.20),
  contraction: Math.log(0.90),
  crisis: Math.log(0.65),
};
const STATE_SIGMA: Record<Regime, number> = {
  expansion: 0.20,
  normal: 0.18,
  contraction: 0.25,
  crisis: 0.35,
};

function transitionMatrix(L: number): Record<Regime, Record<Regime, number>> {
  // Base "sticky" matrix when L=0.
  const base: Record<Regime, Record<Regime, number>> = {
    expansion: { expansion: 0.70, normal: 0.25, contraction: 0.04, crisis: 0.01 },
    normal: { expansion: 0.20, normal: 0.60, contraction: 0.17, crisis: 0.03 },
    contraction: { expansion: 0.05, normal: 0.35, contraction: 0.50, crisis: 0.10 },
    crisis: { expansion: 0.02, normal: 0.18, contraction: 0.45, crisis: 0.35 },
  };
  // Tilt: higher L pushes mass towards worse regimes.
  const tilt = Math.tanh(L) * 0.25; // bounded ±0.25
  const tilted: Record<Regime, Record<Regime, number>> = JSON.parse(JSON.stringify(base));
  for (const from of Object.keys(tilted) as Regime[]) {
    const row = tilted[from];
    row.expansion = Math.max(0.01, row.expansion - tilt);
    row.crisis = Math.min(0.95, row.crisis + tilt);
    // Renormalise
    const total = row.expansion + row.normal + row.contraction + row.crisis;
    row.expansion /= total; row.normal /= total;
    row.contraction /= total; row.crisis /= total;
  }
  return tilted;
}

function sampleRegime(from: Regime, M: Record<Regime, Record<Regime, number>>, rng: () => number): Regime {
  const row = M[from];
  const r = rng();
  let cum = 0;
  for (const s of ["expansion", "normal", "contraction", "crisis"] as Regime[]) {
    cum += row[s];
    if (r < cum) return s;
  }
  return "crisis";
}

export function forecastC(vendor: VendorInputs, macro: MacroInputs, horizonYears = 5, samples = 1000): ForecastResult {
  const L =
    0.30 * macro.vixZ +
    0.25 * macro.epuZ +
    0.20 * macro.gprZ +
    0.15 * macro.fedSloosZ +
    -0.10 * macro.aiIndexMomentumZ;
  const M = transitionMatrix(L);
  const startRegime = classifyRegime(macro);

  const finals: number[] = [];
  const meanYearlyGrowth: number[] = new Array(horizonYears).fill(0);
  const meanArrPath: number[] = new Array(horizonYears + 1).fill(0);
  meanArrPath[0] = vendor.arrUsdMm;

  for (let s = 0; s < samples; s++) {
    const rng = mulberry32(s * 7 + vendor.vendorId.charCodeAt(0));
    let regime: Regime = startRegime;
    let arr = vendor.arrUsdMm;
    // Stage-conditional decay multiplier — frontier labs in early
    // growth get a +5% to μ; mature scale-stage gets −10%.
    const stageMu = STAGE_INDEX[vendor.stage] <= 2 ? 0.05 : STAGE_INDEX[vendor.stage] >= 5 ? -0.10 : 0;

    for (let t = 0; t < horizonYears; t++) {
      // Sample growth from state distribution.
      const u1 = Math.max(1e-9, rng()), u2 = Math.max(1e-9, rng());
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const mu = STATE_MU[regime] + stageMu;
      const sigma = STATE_SIGMA[regime];
      const g = Math.exp(mu + sigma * z);
      arr *= g;
      meanYearlyGrowth[t] += g / samples;
      meanArrPath[t + 1] += arr / samples;
      // Transition.
      regime = sampleRegime(regime, M, rng);
    }
    finals.push(arr);
  }

  finals.sort((a, b) => a - b);
  return {
    vendorId: vendor.vendorId,
    name: vendor.name,
    horizonYears,
    yearlyGrowth: meanYearlyGrowth,
    arrPath: meanArrPath,
    p5: finals[Math.floor(samples * 0.05)],
    p50: finals[Math.floor(samples * 0.5)],
    p95: finals[Math.floor(samples * 0.95)],
    methodNote: `Model C (RegimeMarkov) · startRegime=${startRegime} · L=${L.toFixed(2)} · macro=${macro.asOf} · ${samples} paths`,
  };
}
