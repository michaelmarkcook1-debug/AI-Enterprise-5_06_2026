// Demo runner for the two macro models — mirrors the operator's
// Python reference demos. Usage: npx tsx scripts/demo-macro-models.ts

import {
  runModelI,
  runModelII,
  MODEL_I_BASELINE,
  DEFAULT_REGIMES,
  DEFAULT_Q,
  chooseMacroModel,
} from "../lib/growth-models/macro-models";

console.log("=== MODEL I (MC-SSDF) — short-term, 1–3y horizon ===\n");
// Reproduce the reference demo: 10y span, supply-chain shock at t=4.
const m1 = runModelI(
  { ...MODEL_I_BASELINE, shock: { atYear: 4.0, factor: 0.3 } },
  [1.2, 0.9, 1.0, 0.15],
  10,
  200,
);
console.log(`Initial predicted growth:        ${(m1.initialGrowth * 100).toFixed(2)}%`);
console.log(`Year-5 mid-point (post-shock):   ${(m1.growth[100] * 100).toFixed(2)}%`);
console.log(`Year-10 terminal growth:         ${(m1.terminalGrowth * 100).toFixed(2)}%`);

// Simulator-relevant run: 3-year horizon, no shock (baseline).
const m1short = runModelI(MODEL_I_BASELINE, [1.2, 0.9, 1.0, 0.15], 3, 200);
console.log(`\n3-year simulator horizon:`);
console.log(`  g(0)=${(m1short.growth[0] * 100).toFixed(1)}%  g(1y)=${(m1short.growth[66] * 100).toFixed(1)}%  g(2y)=${(m1short.growth[133] * 100).toFixed(1)}%  g(3y)=${(m1short.terminalGrowth * 100).toFixed(1)}%`);

console.log("\n\n=== MODEL II (SRS-MJN) — longer-term, 4y+ horizon ===\n");
console.log("Single path (seed 42) — faithful reproduction of the Python demo:");
const m2 = runModelII(DEFAULT_REGIMES, DEFAULT_Q, 100.0, 5, 60, 0, 42);
console.log(`  Ending valuation (5y):  $${m2.endValuation.toFixed(0)}M   final regime: ${m2.finalRegime}`);
console.log("  ⚠ A single Markov path is high-variance — not decision-grade. Ensemble below.");

// Ensemble — 4000 seeded paths. This is what the simulator should
// consume: a distribution, not one path.
const N = 4000;
const ends: number[] = [];
const occ = new Array(DEFAULT_REGIMES.length).fill(0);
let occSteps = 0;
for (let seed = 0; seed < N; seed++) {
  const r = runModelII(DEFAULT_REGIMES, DEFAULT_Q, 100.0, 5, 60, 0, seed);
  ends.push(r.endValuation);
  for (const reg of r.regimeHistory) { occ[reg] += 1; occSteps += 1; }
}
ends.sort((a, b) => a - b);
const pct = (p: number) => ends[Math.floor(N * p)];
console.log(`\nEnsemble of ${N} paths · $100M start · 5-year horizon:`);
console.log(`  P5  ending valuation:   $${pct(0.05).toFixed(0)}M`);
console.log(`  P50 ending valuation:   $${pct(0.50).toFixed(0)}M`);
console.log(`  P95 ending valuation:   $${pct(0.95).toFixed(0)}M`);
console.log(`  median 5y CAGR:         ${((Math.pow(pct(0.5) / 100, 1 / 5) - 1) * 100).toFixed(1)}%`);
console.log(`\nMean regime occupancy across the ensemble:`);
DEFAULT_REGIMES.forEach((r, i) =>
  console.log(`  ${r.name.padEnd(30)} ${((occ[i] / occSteps) * 100).toFixed(1)}%`),
);

console.log("\n\n=== Simulator gating ===\n");
for (const [uni, h] of [
  ["public_only", 2], ["public_only", 5],
  ["ipo_watch", 2], ["ipo_watch", 5],
  ["public_and_indirect", 3], ["public_and_indirect", 7],
  ["speculative_all", 1], ["speculative_all", 10],
] as [string, number][]) {
  const c = chooseMacroModel(uni, h);
  console.log(`  ${uni.padEnd(22)} ${h}y → Model ${c.model.padEnd(4)} — ${c.reason}`);
}
