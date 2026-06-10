import { describe, expect, it } from "vitest";
import { boardDefenceScore } from "./board-defence-score";

const scope = { industries: 1, useCases: 2, hasRegion: true, hasDataSensitivity: true, hasCostSensitivity: true };

describe("boardDefenceScore (quality-weighted)", () => {
  it("returns 0 with no shortlist — nothing to defend", () => {
    expect(boardDefenceScore({ vendors: [], scope }).score).toBe(0);
  });

  it("weights quality, not mere presence", () => {
    // Strong shortlist: 90/84 vendor, momentum 70, reputation present, full scope
    // = 90*.3 + 84*.25 + 70*.15 + 100*.15 + 100*.15 = 27+21+10.5+15+15 = 88.5 → 89 (rounded)
    const strong = boardDefenceScore({
      vendors: [{ overallScore: 90, confidenceScore: 84, momentumScore: 70, hasReputation: true }],
      scope,
    });
    expect(strong.score).toBe(89);
    // Weak shortlist with identical SECTION PRESENCE scores far lower — the
    // old completeness meter would have shown 100 for both.
    const weak = boardDefenceScore({
      vendors: [{ overallScore: 55, confidenceScore: 40, momentumScore: 45, hasReputation: false }],
      scope: { industries: 1, useCases: 0, hasRegion: false, hasDataSensitivity: false, hasCostSensitivity: false },
    });
    expect(weak.score).toBeLessThan(50);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("defaults missing momentum to neutral 50 and never exceeds 100", () => {
    const r = boardDefenceScore({
      vendors: [{ overallScore: 100, confidenceScore: 100, hasReputation: true }],
      scope,
    });
    expect(r.components.momentumAlignment).toBe(50);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
