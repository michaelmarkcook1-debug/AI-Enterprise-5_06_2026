/**
 * Audit pass 2: failure-mode coverage.
 *
 * Verifies the simulator produces *useful, distinguishable* error messages for
 * common user mistakes — not just generic blocks. Findings inform UX copy.
 */

import { createSimulationState, validateSimulationAllocation } from "../lib/investing/simulator";
import type { SimulationInput } from "../lib/investing/types";

type Case = { name: string; input: Partial<SimulationInput>; expects: "errors" | "ok" };
const cases: Case[] = [
  { name: "manual-no-vendors-selected", input: { allocationStyle: "manual", selectedVendorIds: [], manualAllocations: {} }, expects: "errors" },
  { name: "manual-allocation-over-100", input: { allocationStyle: "manual", selectedVendorIds: ["msft"], manualAllocations: { msft: 150 } }, expects: "errors" },
  { name: "manual-allocation-under-100", input: { allocationStyle: "manual", selectedVendorIds: ["msft"], manualAllocations: { msft: 30 } }, expects: "errors" },
  { name: "manual-allocation-exact-100", input: { allocationStyle: "manual", selectedVendorIds: ["msft"], manualAllocations: { msft: 92 }, cashReservePct: 8 }, expects: "ok" },
  { name: "ipo-watch-with-public-vendor-selected", input: { allocationStyle: "manual", investmentUniverse: "ipo_watch", selectedVendorIds: ["msft"], manualAllocations: { msft: 92 }, cashReservePct: 8 }, expects: "errors" },
  { name: "public-only-with-private-vendor", input: { allocationStyle: "manual", investmentUniverse: "public_only", selectedVendorIds: ["anthropic"], manualAllocations: { anthropic: 92 }, cashReservePct: 8 }, expects: "errors" },
  { name: "unknown-vendor-id", input: { allocationStyle: "manual", selectedVendorIds: ["nonexistent_vendor"], manualAllocations: { nonexistent_vendor: 100 } }, expects: "errors" },
  { name: "negative-capital", input: { startingCapital: -1000 }, expects: "ok" },
  { name: "zero-capital", input: { startingCapital: 0 }, expects: "ok" },
  { name: "tiny-capital", input: { startingCapital: 1 }, expects: "ok" },
  { name: "max-cash-50", input: { cashReservePct: 50 }, expects: "ok" },
  { name: "over-max-cash-99", input: { cashReservePct: 99 }, expects: "ok" }, // engine should clamp
];

let pass = 0;
let fail = 0;
const findings: { name: string; status: string; messages: string[] }[] = [];

for (const c of cases) {
  const state = createSimulationState(c.input);
  const hasErrors = state.errors.length > 0;
  const ok = (c.expects === "errors") === hasErrors;
  if (ok) pass += 1;
  else fail += 1;
  findings.push({
    name: c.name,
    status: ok ? "PASS" : "FAIL",
    messages: state.errors.length > 0 ? state.errors : ["(no errors)"],
  });
}

// Validate allocation messages helper directly
console.log("─── Allocation validation messages ───");
const v1 = validateSimulationAllocation({ allocationStyle: "manual", selectedVendorIds: ["msft"], manualAllocations: { msft: 50 }, cashReservePct: 10 });
console.log(`50% MSFT + 10% cash = total ${v1.totalAllocationPct}, errors: ${v1.errors.join(" | ")}`);

const v2 = validateSimulationAllocation({ allocationStyle: "manual", selectedVendorIds: ["msft", "googl"], manualAllocations: { msft: 50, googl: 60 }, cashReservePct: 0 });
console.log(`50/60 + 0 cash = total ${v2.totalAllocationPct}, errors: ${v2.errors.join(" | ")}`);

console.log(`\n${"=".repeat(60)}`);
console.log(`Failure coverage: ${pass}/${cases.length} passed`);
console.log("=".repeat(60));
for (const f of findings) {
  console.log(`[${f.status}] ${f.name}`);
  for (const msg of f.messages) console.log(`        ${msg.slice(0, 110)}`);
}

if (fail > 0) process.exit(1);
