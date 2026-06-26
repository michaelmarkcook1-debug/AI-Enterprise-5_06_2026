import { describe, it, expect } from "vitest";
import {
  computePresenceShares,
  presenceConfidence,
  hasRealSignal,
  type VendorSignal,
} from "./market-presence";

const sig = (o: Partial<VendorSignal> = {}): VendorSignal => ({
  verifiedEvidence: 0,
  productionReferences: 0,
  deploymentDepth: 0,
  momentum: 0,
  ...o,
});

describe("market-presence engine", () => {
  it("derives category shares from real signals (sum ~100), deterministic", () => {
    const members = [
      { vendorId: "a", categoryId: "frontier_model_api" },
      { vendorId: "b", categoryId: "frontier_model_api" },
      { vendorId: "c", categoryId: "frontier_model_api" },
    ];
    const signals = new Map<string, VendorSignal>([
      ["a", sig({ verifiedEvidence: 20, productionReferences: 30, deploymentDepth: 80, momentum: 70 })],
      ["b", sig({ verifiedEvidence: 10, productionReferences: 12, deploymentDepth: 60, momentum: 55 })],
      ["c", sig({ verifiedEvidence: 4, productionReferences: 3, deploymentDepth: 40, momentum: 45 })],
    ]);
    const r1 = computePresenceShares(members, signals);
    const r2 = computePresenceShares(members, signals);
    expect(r1).toEqual(r2); // deterministic
    const sum = r1.reduce((s, x) => s + x.share, 0);
    expect(sum).toBeGreaterThan(99); // ~100
    expect(sum).toBeLessThan(101);
    // Higher real signals → higher share.
    const a = r1.find((x) => x.vendorId === "a")!;
    const c = r1.find((x) => x.vendorId === "c")!;
    expect(a.share).toBeGreaterThan(c.share);
    expect(a.confidence).toBeGreaterThan(c.confidence); // more evidence → more confidence
  });

  it("omits vendors with NO real signal (insufficient evidence, never 0-filled)", () => {
    const members = [
      { vendorId: "real", categoryId: "ai_silicon" },
      { vendorId: "empty", categoryId: "ai_silicon" },
    ];
    const signals = new Map<string, VendorSignal>([
      ["real", sig({ verifiedEvidence: 8, productionReferences: 5 })],
      ["empty", sig()], // all zero
    ]);
    const r = computePresenceShares(members, signals);
    expect(r.map((x) => x.vendorId)).toEqual(["real"]); // empty omitted
    expect(r.find((x) => x.vendorId === "empty")).toBeUndefined();
    expect(r[0].share).toBeCloseTo(100, 1); // sole evidenced member = 100%
  });

  it("ranks each category independently (same vendor, two categories)", () => {
    const members = [
      { vendorId: "x", categoryId: "models" },
      { vendorId: "y", categoryId: "models" },
      { vendorId: "x", categoryId: "agents" },
    ];
    const signals = new Map<string, VendorSignal>([
      ["x", sig({ verifiedEvidence: 5, productionReferences: 5, deploymentDepth: 50, momentum: 50 })],
      ["y", sig({ verifiedEvidence: 50, productionReferences: 50, deploymentDepth: 90, momentum: 90 })],
    ]);
    const r = computePresenceShares(members, signals);
    // In "agents", x is the only member → 100%. In "models", y dominates.
    expect(r.find((v) => v.categoryId === "agents" && v.vendorId === "x")!.share).toBeCloseTo(100, 1);
    expect(r.find((v) => v.categoryId === "models" && v.vendorId === "y")!.share).toBeGreaterThan(
      r.find((v) => v.categoryId === "models" && v.vendorId === "x")!.share,
    );
  });

  it("confidence is monotonic in evidence depth and capped < 100", () => {
    expect(presenceConfidence(0)).toBe(0);
    expect(presenceConfidence(50)).toBeLessThan(100);
    expect(presenceConfidence(50)).toBeGreaterThan(presenceConfidence(5));
    expect(hasRealSignal(sig())).toBe(false);
    expect(hasRealSignal(sig({ momentum: 10 }))).toBe(true);
  });
});
