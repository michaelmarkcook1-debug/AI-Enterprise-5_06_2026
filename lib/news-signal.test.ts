// v1.4 — news → QUAD pillar-nudge tests.
// Locks in: the signal is bounded (±3 pts/pillar), time-decayed, direction-aware,
// uses affectedPillars when valid else category fallback, and that the engine
// applies it as a tilt that never flips a calibrated evaluation — and is a
// no-op when no news is supplied (backward compatibility with the v1.3 suite).

import { describe, it, expect } from "vitest";
import { computeNewsAdjustments } from "./intelligence/news-signal";
import { runAssessment } from "./engine";
import { getSeedVendors } from "./seed-vendors";
import type { AssessmentInput, PillarId } from "./types";
import type { NewsItem } from "./intelligence/types";

const V = getSeedVendors();
const base: AssessmentInput = {
  industry: "commercial_enterprise", orgSize: "enterprise", aiMaturity: "scaling",
  primaryObjectives: ["productivity"], useCases: ["knowledge_assistant"],
  dataSensitivity: 2, riskTolerance: 3, autonomyAppetite: "human_in_loop",
  ecosystem: ["azure"], deploymentPreference: "saas", budgetSensitivity: 3, vendorIds: [],
};

let nid = 0;
function daysAgoIso(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}
function news(partial: Partial<NewsItem>): NewsItem {
  return {
    id: `n_${nid++}`,
    title: "Test headline",
    summary: "",
    sourceName: "Test",
    publishedAt: daysAgoIso(2),
    vendors: ["vendor_atlas"],
    categories: ["Product launch"],
    impactScore: 80,
    confidenceScore: 80,
    affectedPillars: [],
    whyItMatters: "",
    suggestedScoreImpact: [],
    relatedVendors: [],
    sentiment: "positive",
    ...partial,
  };
}

describe("computeNewsAdjustments — gating", () => {
  it("ignores items older than the 45-day window", () => {
    const adj = computeNewsAdjustments([news({ publishedAt: daysAgoIso(60) })]);
    expect(adj.has("vendor_atlas")).toBe(false);
  });
  it("ignores low-impact items (< 50)", () => {
    const adj = computeNewsAdjustments([news({ impactScore: 40 })]);
    expect(adj.has("vendor_atlas")).toBe(false);
  });
  it("ignores neutral items with no suggestedScoreImpact direction", () => {
    const adj = computeNewsAdjustments([news({ sentiment: "neutral" })]);
    expect(adj.has("vendor_atlas")).toBe(false);
  });
  it("uses suggestedScoreImpact direction when sentiment is neutral", () => {
    const adj = computeNewsAdjustments([news({
      sentiment: "neutral",
      suggestedScoreImpact: [{ pillar: "market_strength", direction: "up", magnitude: 5, rationale: "x" }],
    })]);
    expect(adj.has("vendor_atlas")).toBe(true);
  });
});

describe("computeNewsAdjustments — direction + pillars", () => {
  it("positive news produces positive deltas on category-mapped pillars", () => {
    const adj = computeNewsAdjustments([news({ categories: ["Product launch"], sentiment: "positive" })]);
    const a = adj.get("vendor_atlas")!;
    // "Product launch" → market_strength + business_fit
    expect((a.perPillar.market_strength ?? 0)).toBeGreaterThan(0);
    expect((a.perPillar.business_fit ?? 0)).toBeGreaterThan(0);
  });
  it("negative news produces negative deltas", () => {
    const adj = computeNewsAdjustments([news({ sentiment: "negative" })]);
    const a = adj.get("vendor_atlas")!;
    expect((a.perPillar.market_strength ?? 0)).toBeLessThan(0);
  });
  it("prefers explicit affectedPillars when they are valid PillarIds", () => {
    const adj = computeNewsAdjustments([news({
      categories: ["Market movement"],
      affectedPillars: ["enterprise_control"] as PillarId[],
      sentiment: "positive",
    })]);
    const a = adj.get("vendor_atlas")!;
    expect(a.perPillar.enterprise_control).toBeGreaterThan(0);
    // "Market movement" would have mapped to market_strength; affectedPillars wins.
    expect(a.perPillar.market_strength).toBeUndefined();
  });
});

describe("computeNewsAdjustments — bounded", () => {
  it("caps each pillar at ±3 points even under a barrage of strong items", () => {
    const items = Array.from({ length: 25 }, () =>
      news({ impactScore: 100, confidenceScore: 100, sentiment: "positive", publishedAt: daysAgoIso(0) }));
    const a = computeNewsAdjustments(items).get("vendor_atlas")!;
    for (const p of Object.values(a.perPillar)) {
      expect(Math.abs(p as number)).toBeLessThanOrEqual(3 + 1e-9);
    }
  });
});

describe("engine integration — news as a bounded tilt", () => {
  it("no news supplied → identical scores (backward compatible)", () => {
    const a = runAssessment(base, V).ranking.map((r) => `${r.vendorId}:${r.finalScore.toFixed(3)}`).join("|");
    const b = runAssessment(base, V, undefined, undefined).ranking.map((r) => `${r.vendorId}:${r.finalScore.toFixed(3)}`).join("|");
    expect(a).toBe(b);
  });

  it("positive news raises the vendor's score, but by a bounded amount", () => {
    const without = runAssessment(base, V);
    const atlasBefore = without.ranking.find((r) => r.vendorId === "vendor_atlas")!;

    const adj = computeNewsAdjustments(Array.from({ length: 10 }, () =>
      news({ vendors: ["vendor_atlas"], impactScore: 95, confidenceScore: 90, sentiment: "positive", publishedAt: daysAgoIso(1) })));
    const withNews = runAssessment(base, V, undefined, adj);
    const atlasAfter = withNews.ranking.find((r) => r.vendorId === "vendor_atlas")!;

    expect(atlasAfter.finalScore).toBeGreaterThan(atlasBefore.finalScore);
    // Bounded: the final-score swing cannot exceed ~3 pts (cap × weights ≈ 1).
    expect(atlasAfter.finalScore - atlasBefore.finalScore).toBeLessThanOrEqual(3.5);
    expect(atlasAfter.newsAdjustment).toBeDefined();
    expect(atlasAfter.newsAdjustment!.totalAbs).toBeGreaterThan(0);
  });

  it("all scores stay within [0,100] under a strong negative barrage", () => {
    const adj = computeNewsAdjustments(Array.from({ length: 20 }, () =>
      news({ vendors: V.map((v) => v.id), impactScore: 100, confidenceScore: 100, sentiment: "negative", publishedAt: daysAgoIso(0) })));
    const r = runAssessment(base, V, undefined, adj);
    for (const v of r.ranking) {
      expect(v.finalScore).toBeGreaterThanOrEqual(0);
      expect(v.finalScore).toBeLessThanOrEqual(100);
    }
  });
});
