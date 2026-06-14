import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureRankingSnapshots,
  backfillRankingSnapshots,
  getRankingHistories,
} from "./ranking-snapshots";
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
    lastUpdated: "2026-05-19",
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

const NOW = new Date("2026-05-19T12:00:00Z");
const vendors = [vendor("alpha", 84), vendor("beta", 71)];
const momenta = [momentum("alpha", 78), momentum("beta", 41)];

describe("ranking-snapshots — no-database fallback", () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it("getRankingHistories returns the reconstruction when no DB is configured", async () => {
    const histories = await getRankingHistories(vendors, momenta, NOW);
    expect(histories.size).toBe(2);
    const alpha = histories.get("alpha")!;
    expect(alpha.source).toBe("reconstructed");
    expect(alpha.points[alpha.points.length - 1].score).toBe(84);
  });

  it("captureRankingSnapshots is a no-op without a database", async () => {
    const result = await captureRankingSnapshots(NOW);
    expect(result.skipped).toBe(true);
    expect(result.captured).toBe(0);
  });

  it("backfillRankingSnapshots is a no-op without a database", async () => {
    const result = await backfillRankingSnapshots(NOW);
    expect(result.skipped).toBe(true);
    expect(result.inserted).toBe(0);
  });
});
