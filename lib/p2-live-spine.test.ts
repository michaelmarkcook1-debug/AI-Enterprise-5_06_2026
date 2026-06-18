// Tests for the P2 live-scoring keystone: evidence → pillar-score blend.
// These guard the math that makes ingested evidence move the dashboard while
// staying stable for un-ingested (cold-start) vendors.
import { describe, it, expect } from "vitest";
import { pillarGradeWeight, blendPillarScore } from "./services/intelligence-projector";
import { momentumTiltedShare } from "./system/derive-market-share";
import { DOMAIN_TO_PILLAR, type DomainId } from "./types";

describe("P2 — pillar grade weighting (E5 strongest, not inverted)", () => {
  it("ranks higher evidence grades above lower ones", () => {
    expect(pillarGradeWeight("E5")).toBeGreaterThan(pillarGradeWeight("E3"));
    expect(pillarGradeWeight("E3")).toBeGreaterThan(pillarGradeWeight("E1"));
    expect(pillarGradeWeight("E1")).toBeGreaterThan(pillarGradeWeight("E0"));
  });
});

describe("P2 — evidence/baseline blend by depth", () => {
  it("keeps the baseline when there is no evidence (cold start)", () => {
    // depth 0 → weight 0 → pure baseline; a freshly-added vendor is unchanged.
    expect(blendPillarScore(90, 60, 0)).toBe(60);
  });

  it("nudges toward evidence with sparse data, dominates with depth", () => {
    const sparse = blendPillarScore(90, 60, 1); // ~0.22 toward 90
    const deep = blendPillarScore(90, 60, 20);  // ~fully 90
    expect(sparse).toBeGreaterThan(60);
    expect(sparse).toBeLessThan(deep);
    expect(deep).toBeGreaterThan(88);
  });

  it("moves the score DOWN when evidence is worse than the seed baseline", () => {
    // The whole point: live evidence can lower an over-optimistic seed.
    expect(blendPillarScore(40, 90, 10)).toBeLessThan(90);
  });
});

describe("P2 — market-share momentum tilt (live movement, bounded)", () => {
  it("leaves share unchanged when momentum equals the category average", () => {
    expect(momentumTiltedShare(20, 50, 50)).toBe(20);
  });
  it("tilts share UP for above-average momentum and DOWN for below", () => {
    expect(momentumTiltedShare(20, 80, 50)).toBeGreaterThan(20);
    expect(momentumTiltedShare(20, 20, 50)).toBeLessThan(20);
  });
  it("clamps the tilt so a share can never swing more than ±25% of baseline", () => {
    expect(momentumTiltedShare(20, 100, 0)).toBeLessThanOrEqual(20 * 1.25 + 1e-9);
    expect(momentumTiltedShare(20, 0, 100)).toBeGreaterThanOrEqual(20 * 0.75 - 1e-9);
  });
});

describe("P2 — every ingestion domain maps to a pillar (no silent drops)", () => {
  it("DOMAIN_TO_PILLAR covers all 13 domains with valid pillars", () => {
    const pillars = new Set([
      "business_fit", "enterprise_control", "reliability_safety",
      "integration_ops", "vendor_resilience", "market_strength",
    ]);
    const domains = Object.keys(DOMAIN_TO_PILLAR) as DomainId[];
    expect(domains.length).toBeGreaterThanOrEqual(13);
    for (const d of domains) {
      expect(pillars.has(DOMAIN_TO_PILLAR[d])).toBe(true);
    }
  });
});
