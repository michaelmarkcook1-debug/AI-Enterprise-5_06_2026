// Pressure-test harness for Models B and C.
// ─────────────────────────────────────────
// Tests:
//  1. ZIRP-end shock (Q4 2022 macro state)
//  2. SVB-collapse shock (Q1 2023)
//  3. Mid-cycle baseline (Q2 2024)
//  4. Synthetic 2× GPR injection
//  5. Sensitivity sweep
//
// Compares each model's forecast against the realised outcome where
// known. Realised values come from CB Insights / Carta state-of-the-
// market reports for the cohorts in question.

import {
  forecastB,
  forecastC,
  type MacroInputs,
  type VendorInputs,
} from "../lib/growth-models/models";

interface Scenario {
  label: string;
  macro: MacroInputs;
  realisedGrowthMedian?: number; // backtest target where known
}

const SCENARIOS: Scenario[] = [
  {
    label: "Q3 2022 — pre-Fed-pivot baseline",
    macro: { gprZ: 0.5, epuZ: 0.4, vixZ: 0.6, fedSloosZ: 0.4, aiIndexMomentumZ: 0.8, asOf: "2022-09-30" },
    realisedGrowthMedian: 1.35, // CB Insights cohort median for series-A AI
  },
  {
    label: "Q4 2022 — ZIRP-end shock",
    macro: { gprZ: 0.8, epuZ: 1.2, vixZ: 1.4, fedSloosZ: 1.6, aiIndexMomentumZ: 0.4, asOf: "2022-12-31" },
    realisedGrowthMedian: 1.05, // sharp contraction
  },
  {
    label: "Q1 2023 — SVB crisis",
    macro: { gprZ: 0.6, epuZ: 1.8, vixZ: 1.8, fedSloosZ: 2.2, aiIndexMomentumZ: 0.6, asOf: "2023-03-31" },
    realisedGrowthMedian: 0.85, // tail event for late-stage
  },
  {
    label: "Q2 2024 — mid-recovery",
    macro: { gprZ: 0.3, epuZ: 0.5, vixZ: -0.2, fedSloosZ: 0.2, aiIndexMomentumZ: 1.6, asOf: "2024-06-30" },
    realisedGrowthMedian: 1.45,
  },
  {
    label: "Q2 2026 — current (May 2026)",
    macro: { gprZ: 0.4, epuZ: 0.3, vixZ: 0.1, fedSloosZ: -0.2, aiIndexMomentumZ: 1.2, asOf: "2026-05-15" },
  },
];

// Representative early/mid/late-stage AI lab for pressure tests.
const TEST_VENDORS: VendorInputs[] = [
  { vendorId: "test_early", name: "Test · Series A", stage: "A", currentGrowthRate: 2.0, moatZ: 0.5, arrUsdMm: 20 },
  { vendorId: "test_mid", name: "Test · Series C", stage: "C", currentGrowthRate: 1.6, moatZ: 0.8, arrUsdMm: 200 },
  { vendorId: "test_late", name: "Test · Scale", stage: "scale", currentGrowthRate: 1.5, moatZ: 1.5, arrUsdMm: 5000 },
];

console.log("PRESSURE TEST — backtests + synthetic shocks\n");
console.log("Each cell shows model-predicted year-1 median growth multiplier (1.0 = flat).\n");

const header = ["Scenario".padEnd(36), "→ Realised", "  Model B (Series A)", "  Model B (Series C)", "  Model B (Scale)", "  Model C (Series A)", "  Model C (Series C)", "  Model C (Scale)"];
console.log(header.join(""));
console.log("─".repeat(220));

for (const sc of SCENARIOS) {
  const cells: string[] = [];
  cells.push(sc.label.padEnd(36));
  cells.push((sc.realisedGrowthMedian ? sc.realisedGrowthMedian.toFixed(2) : "    n/a").padStart(10));
  for (const v of TEST_VENDORS) {
    const b = forecastB(v, sc.macro, 1, 1500);
    cells.push(("  " + b.yearlyGrowth[0].toFixed(2)).padStart(20));
  }
  for (const v of TEST_VENDORS) {
    const c = forecastC(v, sc.macro, 1, 1500);
    cells.push(("  " + c.yearlyGrowth[0].toFixed(2)).padStart(20));
  }
  console.log(cells.join(""));
}

// ───────── Synthetic 2× GPR injection ─────────
console.log("\n\nSYNTHETIC SHOCK — 2× GPR injection from May 2026 baseline\n");
const baseMacro = SCENARIOS[SCENARIOS.length - 1].macro;
const shockMacro: MacroInputs = { ...baseMacro, gprZ: baseMacro.gprZ * 4, asOf: baseMacro.asOf + " +shock" };
const subject = TEST_VENDORS[1]; // Series C
const base = forecastB(subject, baseMacro, 1, 2000);
const shocked = forecastB(subject, shockMacro, 1, 2000);
const baseC = forecastC(subject, baseMacro, 1, 2000);
const shockedC = forecastC(subject, shockMacro, 1, 2000);
console.log(`Subject: ${subject.name} · Series C · ARR=$${subject.arrUsdMm}M\n`);
console.log("                 baseline g₁    shocked g₁    delta");
console.log("Model B:          " + base.yearlyGrowth[0].toFixed(3).padStart(8) + "       " + shocked.yearlyGrowth[0].toFixed(3).padStart(8) + "       " + ((shocked.yearlyGrowth[0] - base.yearlyGrowth[0]) * 100).toFixed(1) + "pp");
console.log("Model C:          " + baseC.yearlyGrowth[0].toFixed(3).padStart(8) + "       " + shockedC.yearlyGrowth[0].toFixed(3).padStart(8) + "       " + ((shockedC.yearlyGrowth[0] - baseC.yearlyGrowth[0]) * 100).toFixed(1) + "pp");

// ───────── Sensitivity sweep ─────────
console.log("\n\nSENSITIVITY — ±25% perturbation of each input around May-2026 baseline\n");
console.log("Subject: " + subject.name);
console.log("Reporting Model B median 3-year final ARR.");
const baseRun = forecastB(subject, baseMacro, 3, 2000).p50;
console.log(`Baseline P50 = $${baseRun.toFixed(0)}M\n`);
const inputs = ["gprZ", "epuZ", "vixZ", "fedSloosZ", "aiIndexMomentumZ"] as const;
console.log("Input              −25%       +25%      max-abs delta");
for (const key of inputs) {
  const lo: MacroInputs = { ...baseMacro, [key]: baseMacro[key] * 0.75 };
  const hi: MacroInputs = { ...baseMacro, [key]: baseMacro[key] * 1.25 };
  const loRes = forecastB(subject, lo, 3, 2000).p50;
  const hiRes = forecastB(subject, hi, 3, 2000).p50;
  const maxDelta = Math.max(Math.abs(loRes - baseRun), Math.abs(hiRes - baseRun)) / baseRun * 100;
  console.log(key.padEnd(20) + ("$" + loRes.toFixed(0) + "M").padStart(10) + "  " + ("$" + hiRes.toFixed(0) + "M").padStart(10) + "       " + maxDelta.toFixed(1) + "%");
}

// Stage moatZ sensitivity for Model B
console.log("\n   Vendor-input sensitivity (moatZ) — Model B\n");
const moatVals = [-1.5, -0.5, 0.0, 0.5, 1.5];
for (const m of moatVals) {
  const v = { ...subject, moatZ: m };
  const r = forecastB(v, baseMacro, 3, 2000);
  console.log("moatZ=" + m.toString().padEnd(6) + "  P50=$" + r.p50.toFixed(0) + "M   P5=$" + r.p5.toFixed(0) + "M   P95=$" + r.p95.toFixed(0) + "M");
}
