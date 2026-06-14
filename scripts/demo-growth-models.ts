// Demo runner — model B + model C against the AI-vendor universe.
// Usage: npx tsx scripts/demo-growth-models.ts
//
// Vendor inputs use the most-recently-reported public ARR figures
// (cited inline). Where a value is journalist-reported rather than
// company-disclosed, the row is flagged in `note`. The growth-rate
// inputs use the 12-month-trailing growth most-recently-cited in
// the open press; these are imperfect but they're the same data
// any analyst would use.

import {
  MAY_2026_MACRO,
  forecastB,
  forecastC,
  type VendorInputs,
  type Stage,
} from "../lib/growth-models/models";

interface VendorRow extends VendorInputs {
  note: string;
}

const VENDORS: VendorRow[] = [
  { vendorId: "openai", name: "OpenAI", stage: "scale" as Stage, currentGrowthRate: 1.95, moatZ: 1.6, arrUsdMm: 11500,
    note: "ARR ~$11.5B reported The Information / Bloomberg 2025; growth ~95% YoY" },
  { vendorId: "anthropic", name: "Anthropic", stage: "growth" as Stage, currentGrowthRate: 2.4, moatZ: 1.4, arrUsdMm: 4500,
    note: "ARR ~$4.5B reported Reuters / Bloomberg early-2025; growth 140%+ YoY on coding lead" },
  { vendorId: "xai", name: "xAI", stage: "growth" as Stage, currentGrowthRate: 1.8, moatZ: 0.5, arrUsdMm: 800,
    note: "ARR estimate $800M; growth high but volatile; governance opacity discounts moatZ" },
  { vendorId: "mistral", name: "Mistral", stage: "C" as Stage, currentGrowthRate: 1.7, moatZ: 0.3, arrUsdMm: 200,
    note: "ARR estimate ~$200M based on Le Monde + The Information reports" },
  { vendorId: "cohere", name: "Cohere", stage: "C" as Stage, currentGrowthRate: 1.4, moatZ: 0.0, arrUsdMm: 100,
    note: "ARR ~$100M reported The Information 2024 (lower bound)" },
  { vendorId: "databricks", name: "Databricks", stage: "scale" as Stage, currentGrowthRate: 1.55, moatZ: 1.1, arrUsdMm: 3700,
    note: "ARR ~$3.7B reported by company 2025; growth 55% YoY" },
  { vendorId: "perplexity", name: "Perplexity", stage: "growth" as Stage, currentGrowthRate: 2.5, moatZ: 0.4, arrUsdMm: 150,
    note: "ARR estimate $150M; high growth in search-answer category" },
  { vendorId: "glean", name: "Glean", stage: "growth" as Stage, currentGrowthRate: 1.9, moatZ: 0.7, arrUsdMm: 120,
    note: "ARR ~$120M reported The Information 2024" },
  { vendorId: "harvey", name: "Harvey", stage: "C" as Stage, currentGrowthRate: 2.2, moatZ: 0.8, arrUsdMm: 75,
    note: "ARR ~$75M reported The Information 2024" },
  { vendorId: "deepseek", name: "DeepSeek", stage: "B" as Stage, currentGrowthRate: 3.0, moatZ: 0.6, arrUsdMm: 40,
    note: "ARR estimate; cost-leadership thesis but jurisdictional risk depresses moat" },
];

function fmtUsd(usdMm: number): string {
  if (usdMm >= 1000) return `$${(usdMm / 1000).toFixed(2)}B`;
  return `$${usdMm.toFixed(0)}M`;
}

function table(title: string, rows: string[][]): void {
  console.log(`\n${title}`);
  console.log("─".repeat(110));
  rows.forEach((r) => console.log(r.join("")));
}

console.log("AI Enterprise — Private AI growth forecasts");
console.log("Macro snapshot: " + MAY_2026_MACRO.asOf);
console.log("GPR=" + MAY_2026_MACRO.gprZ + "  EPU=" + MAY_2026_MACRO.epuZ + "  VIX=" + MAY_2026_MACRO.vixZ +
  "  SLOOS=" + MAY_2026_MACRO.fedSloosZ + "  AIIndex=" + MAY_2026_MACRO.aiIndexMomentumZ);

// ──────────────── Model B output ────────────────
const headerB = [
  "Vendor".padEnd(15), "Stage".padEnd(8), "Now".padStart(10),
  "g₁".padStart(7), "g₂".padStart(7), "g₃".padStart(7),
  "P5".padStart(10), "P50".padStart(10), "P95".padStart(10),
];
const rowsB: string[][] = [headerB];
for (const v of VENDORS) {
  const r = forecastB(v, MAY_2026_MACRO, 3, 2000);
  rowsB.push([
    v.name.padEnd(15),
    v.stage.padEnd(8),
    fmtUsd(v.arrUsdMm).padStart(10),
    r.yearlyGrowth[0].toFixed(2).padStart(7),
    r.yearlyGrowth[1].toFixed(2).padStart(7),
    r.yearlyGrowth[2].toFixed(2).padStart(7),
    fmtUsd(r.p5).padStart(10),
    fmtUsd(r.p50).padStart(10),
    fmtUsd(r.p95).padStart(10),
  ]);
}
table("MODEL B — CohortDecay+Moat · 3-year horizon · 2000 paths", rowsB);

// ──────────────── Model C output ────────────────
const headerC = [
  "Vendor".padEnd(15), "Stage".padEnd(8), "Now".padStart(10),
  "g̅₁".padStart(7), "g̅₃".padStart(7), "g̅₅".padStart(7),
  "P5".padStart(10), "P50".padStart(10), "P95".padStart(10),
];
const rowsC: string[][] = [headerC];
for (const v of VENDORS) {
  const r = forecastC(v, MAY_2026_MACRO, 5, 2000);
  rowsC.push([
    v.name.padEnd(15),
    v.stage.padEnd(8),
    fmtUsd(v.arrUsdMm).padStart(10),
    r.yearlyGrowth[0].toFixed(2).padStart(7),
    r.yearlyGrowth[2].toFixed(2).padStart(7),
    r.yearlyGrowth[4].toFixed(2).padStart(7),
    fmtUsd(r.p5).padStart(10),
    fmtUsd(r.p50).padStart(10),
    fmtUsd(r.p95).padStart(10),
  ]);
}
table("MODEL C — RegimeMarkov · 5-year horizon · 2000 paths", rowsC);

console.log("\nMethodology + provenance:");
console.log("- Model B: " + forecastB(VENDORS[0], MAY_2026_MACRO).methodNote);
console.log("- Model C: " + forecastC(VENDORS[0], MAY_2026_MACRO).methodNote);
console.log("\nVendor input citations:");
for (const v of VENDORS) console.log(`  ${v.name.padEnd(15)} — ${v.note}`);
