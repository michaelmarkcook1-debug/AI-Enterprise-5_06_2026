import { describe, expect, it } from "vitest";
import { buildRankingHistories } from "./ranking-history";
import type { Vendor, VendorMomentum } from "./types";

function vendor(id: string, overallScore: number): Vendor {
  return {
    id,
    name: id,
    slug: id,
    category: "Frontier model",
    description: "",
    ownershipType: "private",
    supportedIndustries: [],
    supportedUseCases: [],
    supportedEcosystems: [],
    deploymentOptions: [],
    autonomyLevelMax: "L2",
    overallScore,
    confidenceScore: 70,
    marketPosition: "Leader",
    strategy: "",
    productCapabilities: [],
    enterpriseControls: [],
    agenticCapability: "",
    industryStrength: [],
    riskProfile: [],
    analystInterpretation: "",
    lastUpdated: "2026-05-18",
  };
}

function momentum(vendorId: string, momentumScore: number): VendorMomentum {
  return {
    vendorId,
    period: "2026-05",
    momentumScore,
    newsVelocity: 0,
    productVelocity: 0,
    adoptionSignal: 0,
    hiringSignal: 0,
    customerSignal: 0,
    partnerSignal: 0,
    marketShareMovement: 0,
    riskSignal: 0,
    confidence: 70,
  };
}

const NOW = new Date("2026-05-18T12:00:00Z");

describe("buildRankingHistories", () => {
  const vendors = [vendor("alpha", 84), vendor("beta", 71), vendor("gamma", 62)];
  const momenta = [momentum("alpha", 78), momentum("beta", 40), momentum("gamma", 55)];

  it("ends each series exactly at the vendor's current score", () => {
    const histories = buildRankingHistories(vendors, momenta, NOW);
    for (const v of vendors) {
      const h = histories.get(v.id)!;
      expect(h.points[h.points.length - 1].score).toBe(v.overallScore);
    }
  });

  it("is deterministic across runs", () => {
    const a = buildRankingHistories(vendors, momenta, NOW);
    const b = buildRankingHistories(vendors, momenta, NOW);
    for (const v of vendors) {
      expect(a.get(v.id)!.points).toEqual(b.get(v.id)!.points);
    }
  });

  it("last point date is today and series is contiguous daily", () => {
    const h = buildRankingHistories(vendors, momenta, NOW).get("alpha")!;
    expect(h.points[h.points.length - 1].date).toBe("2026-05-18");
    expect(h.points[0].date).toBe(h.trackingStart);
    expect(h.points.length).toBeGreaterThan(60);
  });

  it("high momentum trends up, low momentum trends down", () => {
    const histories = buildRankingHistories(vendors, momenta, NOW);
    expect(histories.get("alpha")!.scoreDelta).toBeGreaterThan(0);
    expect(histories.get("beta")!.scoreDelta).toBeLessThan(0);
  });

  it("assigns a daily rank within the tracked field", () => {
    const h = buildRankingHistories(vendors, momenta, NOW).get("alpha")!;
    for (const p of h.points) {
      expect(p.rank).toBeGreaterThanOrEqual(1);
      expect(p.rank).toBeLessThanOrEqual(vendors.length);
    }
  });
});
