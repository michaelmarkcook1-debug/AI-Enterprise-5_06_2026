import { describe, expect, it } from "vitest";
import {
  dependencyScore,
  encroachmentScore,
  optionalityScore,
  strategicScores,
  sustainabilityScore,
  viabilityScore,
} from "./strategic-scores";

const platformLeader = {
  overallScore: 90,
  confidenceScore: 84,
  marketPosition: "Leader",
  ownershipType: "public",
  category: "Cloud AI platform",
};

const verticalSpecialist = {
  overallScore: 69,
  confidenceScore: 62,
  marketPosition: "Challenger",
  ownershipType: "private",
  category: "Financial services AI",
};

describe("strategic-scores (single source of truth)", () => {
  it("matches the canonical table formulas for a platform leader", () => {
    // Hand-computed from the formulas with momentum 60:
    // sustainability = min(100, round(90*0.3 + 60*0.25 + 84*0.2 + 20 + 5)) = min(100, round(83.8)) = 84
    // encroachment   = clamp(100 - 36 - 12 + 0 - 15) = 37
    // dependency     = clamp(60 - 13.5 + 0 - 20 + 0) = 27 (round(26.5) = 27 banker's? JS rounds .5 up → 27)
    // optionality    = clamp(27 + 16.8 + 10 + 15 + 10) = 79 — category checks
    // are now CASE-INSENSITIVE (product decision, 10 Jun 2026), so
    // "Cloud AI platform" receives the +15 "Platform" bonus.
    // viability      = min(100, round(36 + 18 + 25.2)) = 79
    expect(sustainabilityScore(platformLeader, 60)).toBe(84);
    expect(encroachmentScore(platformLeader, 60)).toBe(37);
    expect(dependencyScore(platformLeader)).toBe(27);
    expect(optionalityScore(platformLeader)).toBe(79);
    expect(viabilityScore(platformLeader, 60)).toBe(79);
  });

  it("matches categories case-insensitively", () => {
    const lower = { ...platformLeader, category: "cloud ai platform" };
    const upper = { ...platformLeader, category: "CLOUD AI PLATFORM" };
    expect(optionalityScore(lower)).toBe(optionalityScore(upper));
    expect(encroachmentScore(lower, 60)).toBe(encroachmentScore(upper, 60));
  });

  it("treats Financial-category vendors as niche for encroachment (the drift fix)", () => {
    // The OLD overview formula omitted "Financial" from the niche check,
    // under-scoring encroachment for financial-vertical vendors by 25 points.
    // Canonical: 100 - 69*0.4 - 50*0.2 + 25 - 0 = 100 - 27.6 - 10 + 25 = 87.4 → 87
    expect(encroachmentScore(verticalSpecialist, 50)).toBe(87);
    // Without the Financial bump the old overview would have shown 62 — a
    // 25-point disagreement between the headline card and the table.
    const oldOverviewValue = Math.min(100, Math.max(0, Math.round(
      100 - verticalSpecialist.overallScore * 0.4 - 50 * 0.2,
    )));
    expect(oldOverviewValue).toBe(62);
    expect(encroachmentScore(verticalSpecialist, 50)).not.toBe(oldOverviewValue);
  });

  it("defaults momentum to a neutral 50 and clamps everything to 0–100", () => {
    const s = strategicScores(verticalSpecialist);
    for (const value of Object.values(s)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(s.encroachment).toBe(encroachmentScore(verticalSpecialist, 50));
  });
});
