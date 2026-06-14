// Demo for the Unified Hybrid Engine — mirrors the operator's Python
// reference. Usage: npx tsx scripts/demo-unified-hybrid.ts

import { runUnifiedHybrid } from "../lib/growth-models/unified-hybrid";

function show(label: string, tShock: number, xi: number) {
  const r = runUnifiedHybrid(tShock, xi);
  console.log(`\n=== ${label} ===`);
  console.log(`Shock: year ${tShock}, severity ${xi >= 0 ? "+" : ""}${xi}`);
  for (const m of r.milestones) {
    console.log(
      `  Year ${String(m.year).padStart(2)}  ${(m.growth * 100).toFixed(2).padStart(7)}%   engine=${m.engine}`,
    );
  }
}

// Reference scenario from the spec: chip-material blockade at year 1.5,
// severity -0.65.
show("Chip-material blockade · Y1.5 · ξ=-0.65", 1.5, -0.65);

// Sensitivity sweep: same severity, varying onset.
show("Same shock, later onset · Y6.0", 6.0, -0.65);

// Accelerative shock: energy-generation breakthrough.
show("Energy breakthrough · Y2.0 · ξ=+0.55", 2.0, 0.55);

// No shock — structural baseline.
show("No shock baseline · ξ=0", 5.0, 0.0);

// Severity sweep at fixed onset.
console.log("\n\n=== Severity sweep · onset Y2.0 ===");
console.log("ξ        Y1       Y3       Y5       Y10");
for (const xi of [-1.0, -0.5, 0.0, 0.5, 1.0]) {
  const r = runUnifiedHybrid(2.0, xi);
  const g = (yr: number) => {
    const m = r.milestones.find((x) => x.year === yr)!;
    return (m.growth * 100).toFixed(1).padStart(7);
  };
  console.log(`${(xi >= 0 ? "+" : "") + xi.toFixed(1)}   ${g(1)}  ${g(3)}  ${g(5)}  ${g(10)}`);
}
