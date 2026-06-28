import { describe, it, expect } from "vitest";
import {
  coverageAdjustedComposite,
  compareAdjusted,
  assessDiscrimination,
  assignTiers,
  detectRankingAnomalies,
  NOISE_BAND,
  type RankRow,
} from "./credibility";

describe("coverageAdjustedComposite", () => {
  it("discounts a raw composite by domain coverage (missing domains contribute 0)", () => {
    expect(coverageAdjustedComposite(60, 1)).toBe(60);
    expect(coverageAdjustedComposite(60, 0.5)).toBe(30);
    expect(coverageAdjustedComposite(60, 0)).toBe(0);
  });
  it("clamps coverage to [0,1]", () => {
    expect(coverageAdjustedComposite(60, 1.5)).toBe(60);
    expect(coverageAdjustedComposite(60, -1)).toBe(0);
  });

  it("resolves the documented Alibaba anomaly via logic (not hand-placing)", () => {
    // Live data: Alibaba raw 56 on 7/12 domains; Anthropic raw 55 on 12/12.
    const alibaba = coverageAdjustedComposite(56, 7 / 12); // ≈ 32.7
    const anthropic = coverageAdjustedComposite(55, 12 / 12); // 55
    // After the coverage-discount, fuller evidence outranks thinner on the near-tied raw.
    expect(anthropic).toBeGreaterThan(alibaba);
  });
});

describe("compareAdjusted", () => {
  const row = (id: string, adj: number, cov: number, conf: number): RankRow => ({
    vendorId: id,
    vendorName: id,
    rawComposite: adj,
    adjustedComposite: adj,
    domainCoverage: cov,
    confidence: conf,
  });
  it("orders by adjusted composite, then coverage, then confidence, then id", () => {
    const rows = [row("b", 40, 0.9, 80), row("a", 55, 1, 84), row("c", 40, 0.9, 70)];
    const sorted = [...rows].sort(compareAdjusted).map((r) => r.vendorId);
    expect(sorted).toEqual(["a", "b", "c"]); // a (55) first; b before c on higher confidence
  });
});

describe("assessDiscrimination", () => {
  it("flags low discrimination when the spread is within the noise band", () => {
    expect(assessDiscrimination([55, 54, 53, 52]).low).toBe(true); // spread 3 < NOISE_BAND
  });
  it("not low when vendors are well separated", () => {
    expect(assessDiscrimination([55, 40, 30]).low).toBe(false);
  });
  it("single vendor is never 'low discrimination'", () => {
    expect(assessDiscrimination([55]).low).toBe(false);
  });
});

describe("assignTiers (natural breaks at gaps > noise band)", () => {
  it("keeps statistically-inseparable vendors in one tier", () => {
    // All within noise → all Leaders (honest: not separable).
    expect(assignTiers([55, 54, 53])).toEqual(["Leaders", "Leaders", "Leaders"]);
  });
  it("starts a new tier where a gap exceeds the noise band", () => {
    const tiers = assignTiers([60, 59, 40, 39, 20]);
    expect(tiers).toEqual(["Leaders", "Leaders", "Contenders", "Contenders", "Emerging"]);
  });
});

describe("detectRankingAnomalies (sanity-check)", () => {
  const row = (id: string, adj: number, cov: number, conf: number): RankRow => ({
    vendorId: id,
    vendorName: id,
    rawComposite: adj,
    adjustedComposite: adj,
    domainCoverage: cov,
    confidence: conf,
  });
  it("flags a thinner vendor out-ranking a fuller one on a near-tied composite", () => {
    const sorted = [row("thin", 50, 0.5, 70), row("full", 48, 0.95, 85)]; // within noise, thinner above
    const notes = detectRankingAnomalies(sorted);
    expect(notes.length).toBe(1);
    expect(notes[0]).toContain("thin");
    expect(notes[0]).toContain("full");
  });
  it("does not flag a clean order (fuller/higher-confidence on top)", () => {
    const sorted = [row("full", 50, 0.95, 85), row("thin", 48, 0.5, 70)];
    expect(detectRankingAnomalies(sorted)).toEqual([]);
  });
  it("does not flag when vendors are well separated (gap beyond noise)", () => {
    const sorted = [row("thin", 60, 0.5, 70), row("full", 40, 0.95, 85)]; // 20 gap > noise
    expect(detectRankingAnomalies(sorted)).toEqual([]);
  });
});
