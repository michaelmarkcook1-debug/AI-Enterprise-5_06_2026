/**
 * Investor simulator audit.
 *
 * Exercises the simulator across the full Cartesian product of inputs and
 * checks numerical sanity, truthfulness invariants, and engine determinism.
 * Reports issues to stdout as a punch list.
 */

import {
  createSimulationState,
  generateRandomShock,
  globalRiskClimateMultiplier,
} from "../lib/investing/simulator";
import { INVESTMENT_PROVIDERS } from "../lib/investing/seed";
import type {
  AllocationStyle,
  GlobalRiskClimate,
  InvestmentUniverse,
  RebalanceFrequency,
  RiskProfile,
  ScenarioPoint,
  SimulationInput,
} from "../lib/investing/types";
import { deriveSignalAdjustedDelta, scoreSignal, listSignals } from "../lib/market-signals/engine";

type Issue = { severity: "error" | "warn" | "info"; combo: string; msg: string };
const issues: Issue[] = [];
let runs = 0;
let cleanRuns = 0;

const RISK_PROFILES: RiskProfile[] = ["conservative", "balanced", "aggressive", "speculative"];
const HORIZONS: SimulationInput["horizonYears"][] = [1, 3, 5, 10];
const UNIVERSES: InvestmentUniverse[] = ["public_only", "public_and_indirect", "ipo_watch", "speculative_all", "single_stock"];
const ALLOC_STYLES: AllocationStyle[] = ["model_guided", "thesis_based", "single_stock"];
const CLIMATES: GlobalRiskClimate[] = ["calm", "elevated", "tense", "crisis"];
const REBALANCE: RebalanceFrequency[] = ["none", "quarterly", "annually"];
const CASH_LEVELS = [0, 8, 25, 50];
const STARTING_CAPITALS = [100, 1000, 10000, 100000];

function checkPath(combo: string, name: string, path: ScenarioPoint[]) {
  if (!Array.isArray(path) || path.length === 0) {
    issues.push({ severity: "error", combo, msg: `${name} path is empty` });
    return;
  }
  for (const point of path) {
    if (!Number.isFinite(point.year) || !Number.isFinite(point.value)) {
      issues.push({ severity: "error", combo, msg: `${name} contains non-finite point: ${JSON.stringify(point)}` });
      return;
    }
    if (point.value < 0) {
      issues.push({ severity: "error", combo, msg: `${name} has negative value ${point.value} at year ${point.year}` });
      return;
    }
  }
}

function checkScenarios(combo: string, result: any, startingCapital: number) {
  const { bullValue, baseValue, bearValue, stressValue } = result;
  for (const [k, v] of Object.entries({ bullValue, baseValue, bearValue, stressValue })) {
    if (!Number.isFinite(v as number)) {
      issues.push({ severity: "error", combo, msg: `${k} is not finite (${v})` });
    }
  }
  // Soft monotonicity: bull >= base >= bear >= stress (not always strict, but
  // a stress value > base is a red flag).
  if (Number.isFinite(bullValue) && Number.isFinite(baseValue) && bullValue + 0.01 < baseValue) {
    issues.push({ severity: "warn", combo, msg: `bull (${bullValue.toFixed(0)}) < base (${baseValue.toFixed(0)})` });
  }
  if (Number.isFinite(stressValue) && Number.isFinite(bearValue) && stressValue > bearValue + 0.01) {
    issues.push({ severity: "warn", combo, msg: `stress (${stressValue.toFixed(0)}) > bear (${bearValue.toFixed(0)})` });
  }
  // Sanity: starting capital should map to scenario range that's not a wildly
  // off-spec value (eg. base growing 100x in 1y is suspect).
  if (Number.isFinite(baseValue) && baseValue > startingCapital * 50) {
    issues.push({ severity: "warn", combo, msg: `base ${baseValue.toFixed(0)} is >50× starting (${startingCapital})` });
  }
  if (Number.isFinite(stressValue) && stressValue < 0) {
    issues.push({ severity: "error", combo, msg: `stress ${stressValue.toFixed(0)} is negative` });
  }
}

function checkScores(combo: string, result: any) {
  const fields = ["aiExposureScore", "qualityScore", "speculationScore", "riskScore", "confidenceScore"] as const;
  for (const f of fields) {
    const v = result[f];
    if (!Number.isFinite(v)) {
      issues.push({ severity: "error", combo, msg: `${f} is not finite (${v})` });
    } else if (v < 0 || v > 100) {
      issues.push({ severity: "warn", combo, msg: `${f} is out of [0,100] range (${v})` });
    }
  }
}

function runOne(input: Partial<SimulationInput>, label: string) {
  runs += 1;
  try {
    const state = createSimulationState(input, INVESTMENT_PROVIDERS);
    if (state.errors.length > 0) {
      // Universe / allocation errors are expected for some combos. Just track.
      issues.push({ severity: "info", combo: label, msg: `errors: ${state.errors.join(" | ").slice(0, 140)}` });
      return;
    }
    if (!state.result) {
      issues.push({ severity: "error", combo: label, msg: "no result despite zero errors" });
      return;
    }
    checkPath(label, "bull", state.result.bullPath);
    checkPath(label, "base", state.result.basePath);
    checkPath(label, "bear", state.result.bearPath);
    checkPath(label, "stress", state.result.stressPath);
    checkScenarios(label, state.result, input.startingCapital ?? 10000);
    checkScores(label, state.result);
    cleanRuns += 1;
  } catch (e: any) {
    issues.push({ severity: "error", combo: label, msg: `THREW: ${e.message ?? String(e)}` });
  }
}

// ──────────────── Sweep 1: full Cartesian over the main dimensions ────────────────
console.log("Sweep 1: risk × horizon × universe × climate × overlay (model_guided)");
for (const riskProfile of RISK_PROFILES) {
  for (const horizonYears of HORIZONS) {
    for (const investmentUniverse of UNIVERSES) {
      for (const globalRiskClimate of CLIMATES) {
        for (const applySignalOverlay of [false, true]) {
          const label = `${riskProfile}/${horizonYears}y/${investmentUniverse}/${globalRiskClimate}/overlay=${applySignalOverlay}`;
          runOne(
            {
              riskProfile,
              horizonYears,
              investmentUniverse,
              globalRiskClimate,
              applySignalOverlay,
              allocationStyle: "model_guided",
              startingCapital: 10000,
            },
            label,
          );
        }
      }
    }
  }
}

// ──────────────── Sweep 2: cash levels + starting capitals ────────────────
console.log("Sweep 2: cash levels × starting capital");
for (const cashReservePct of CASH_LEVELS) {
  for (const startingCapital of STARTING_CAPITALS) {
    runOne(
      { cashReservePct, startingCapital, riskProfile: "balanced", horizonYears: 5 },
      `cash=${cashReservePct}/$${startingCapital}`,
    );
  }
}

// ──────────────── Sweep 3: rebalance frequencies ────────────────
console.log("Sweep 3: rebalance frequency");
for (const rebalanceFrequency of REBALANCE) {
  runOne({ rebalanceFrequency }, `rebalance=${rebalanceFrequency}`);
}

// ──────────────── Sweep 4: shock generation determinism ────────────────
console.log("Sweep 4: shock determinism");
for (const horizon of HORIZONS) {
  for (const universe of UNIVERSES) {
    const a = generateRandomShock(horizon, universe, "balanced", "audit-seed");
    const b = generateRandomShock(horizon, universe, "balanced", "audit-seed");
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      issues.push({ severity: "error", combo: `shock-${horizon}/${universe}`, msg: "shock generation is non-deterministic" });
    }
  }
}

// ──────────────── Sweep 5: simulation determinism (same input → same hash) ────────────────
console.log("Sweep 5: simulation determinism");
for (const riskProfile of RISK_PROFILES) {
  for (const universe of UNIVERSES) {
    const a = createSimulationState({ riskProfile, investmentUniverse: universe });
    const b = createSimulationState({ riskProfile, investmentUniverse: universe });
    if (a.stateHash !== b.stateHash) {
      issues.push({ severity: "error", combo: `det-${riskProfile}/${universe}`, msg: `stateHash drift: ${a.stateHash} vs ${b.stateHash}` });
    }
    if (a.result && b.result && JSON.stringify(a.result.basePath) !== JSON.stringify(b.result.basePath)) {
      issues.push({ severity: "error", combo: `det-${riskProfile}/${universe}`, msg: "basePath non-deterministic" });
    }
  }
}

// ──────────────── Sweep 6: signal-overlay differentiation ────────────────
console.log("Sweep 6: signal overlay differentiation per vendor");
const sampleVendors = ["msft", "googl", "amzn", "nvda", "anthropic", "openai", "orcl"];
const deltas = sampleVendors.map((v) => {
  const d = deriveSignalAdjustedDelta(v, 0.09, 0.18);
  return { vendor: v, delta: (d.signalAdjustedAnnualReturn - d.baseAnnualReturn) * 100 };
});
const distinctDeltaCount = new Set(deltas.map((d) => d.delta.toFixed(3))).size;
if (distinctDeltaCount < 3) {
  issues.push({ severity: "warn", combo: "signal-overlay", msg: `Only ${distinctDeltaCount} distinct deltas across ${sampleVendors.length} vendors — under-differentiated` });
}

// ──────────────── Sweep 7: signal-engine truthfulness regression ────────────────
console.log("Sweep 7: signal truthfulness gates");
const allSignals = listSignals();
for (const sig of allSignals) {
  const score = scoreSignal(sig);
  if (sig.evidenceGrade === "E0" && score.impactScore !== 0) {
    issues.push({ severity: "error", combo: `signal-${sig.id}`, msg: `E0 produced impact ${score.impactScore}` });
  }
  if (sig.signalCategory === "social_market_talk" && score.impactScore > 2) {
    issues.push({ severity: "error", combo: `signal-${sig.id}`, msg: `market-talk impact ${score.impactScore} > 2pt cap` });
  }
  if (sig.signalCategory === "social_market_talk" && score.confidenceScore > 25) {
    issues.push({ severity: "error", combo: `signal-${sig.id}`, msg: `market-talk confidence ${score.confidenceScore} > 25 cap` });
  }
}

// ──────────────── Sweep 8: climate multiplier sanity ────────────────
console.log("Sweep 8: climate multipliers");
for (const climate of CLIMATES) {
  const m = globalRiskClimateMultiplier(climate);
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === "number" && !Number.isFinite(v)) {
      issues.push({ severity: "error", combo: `climate-${climate}`, msg: `${k} not finite` });
    }
  }
}

// ──────────────── Edge cases ────────────────
console.log("Edge cases");
runOne({ startingCapital: 100, horizonYears: 1, cashReservePct: 50 }, "min-capital/min-horizon/max-cash");
runOne({ startingCapital: 100000, horizonYears: 10, cashReservePct: 0 }, "max-capital/max-horizon/no-cash");
runOne({ riskProfile: "speculative", investmentUniverse: "ipo_watch", globalRiskClimate: "crisis", applySignalOverlay: true }, "stress-stack");

// ──────────────── Report ────────────────
console.log(`\n${"=".repeat(70)}`);
console.log(`AUDIT SUMMARY: ${runs} runs · ${cleanRuns} clean · ${issues.length} issues`);
console.log("=".repeat(70));

const errors = issues.filter((i) => i.severity === "error");
const warns = issues.filter((i) => i.severity === "warn");
const infos = issues.filter((i) => i.severity === "info");

console.log(`\nERRORS (${errors.length}):`);
for (const i of errors.slice(0, 50)) console.log(`  [${i.combo}] ${i.msg}`);
if (errors.length > 50) console.log(`  …and ${errors.length - 50} more`);

console.log(`\nWARNINGS (${warns.length}):`);
const warnsByMsg = new Map<string, number>();
for (const w of warns) warnsByMsg.set(w.msg.slice(0, 60), (warnsByMsg.get(w.msg.slice(0, 60)) ?? 0) + 1);
for (const [msg, count] of warnsByMsg) console.log(`  ×${count}: ${msg}`);

console.log(`\nEXPECTED-ERROR COMBINATIONS (${infos.length}):`);
const infosByMsg = new Map<string, number>();
for (const i of infos) infosByMsg.set(i.msg.slice(0, 60), (infosByMsg.get(i.msg.slice(0, 60)) ?? 0) + 1);
for (const [msg, count] of infosByMsg) console.log(`  ×${count}: ${msg}`);

console.log(`\nSignal overlay deltas:`);
for (const d of deltas) console.log(`  ${d.vendor.padEnd(22)} ${d.delta.toFixed(2).padStart(7)}pp`);

if (errors.length > 0) process.exit(1);
