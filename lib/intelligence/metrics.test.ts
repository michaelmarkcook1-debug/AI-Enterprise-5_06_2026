import { describe, expect, it } from "vitest";
import {
  calculateMarketMomentum,
  calculateRiskPenalty,
  calculateVendorRiskScore,
  evidenceConfidenceFromGrade,
  evidenceStatusFromGrade,
  marketMoverStatus,
  marketShareChangePct,
  momentumStatus,
  riskStatusForVendor,
} from "./metrics";

describe("market momentum calculations", () => {
  it("rewards product, adoption, partner, share, and customer signals while penalising risk events", () => {
    const strong = calculateMarketMomentum({
      newsVelocity: 80,
      productVelocity: 90,
      adoptionSignal: 78,
      partnerSignal: 75,
      marketShareMovement: 70,
      customerSignal: 82,
      riskSignal: 10,
    });
    const riskier = calculateMarketMomentum({
      newsVelocity: 80,
      productVelocity: 90,
      adoptionSignal: 78,
      partnerSignal: 75,
      marketShareMovement: 70,
      customerSignal: 82,
      riskSignal: 80,
    });

    expect(strong).toBeGreaterThan(riskier);
    expect(strong).toBeGreaterThanOrEqual(60);
  });

  it("calculates category-specific market share movement", () => {
    expect(marketShareChangePct(18, 15)).toBe(20);
    expect(marketShareChangePct(12, 15)).toBe(-20);
    expect(marketShareChangePct(10)).toBe(0);
    expect(marketMoverStatus(16)).toBe("gaining");
    expect(marketMoverStatus(-16)).toBe("declining");
    expect(marketMoverStatus(3)).toBe("watch");
  });

  it("labels momentum bands for the dashboard", () => {
    expect(momentumStatus(78)).toBe("surging");
    expect(momentumStatus(62)).toBe("advancing");
    expect(momentumStatus(48)).toBe("steady");
    expect(momentumStatus(20)).toBe("softening");
  });
});

describe("evidence confidence", () => {
  it("maps E0-E5 into confidence and evidence status labels", () => {
    expect(evidenceConfidenceFromGrade("E0")).toBe(0);
    expect(evidenceConfidenceFromGrade("E5")).toBe(100);
    expect(evidenceStatusFromGrade("E1")).toBe("inferred");
    expect(evidenceStatusFromGrade("E2")).toBe("documented");
    expect(evidenceStatusFromGrade("E3")).toBe("tested");
    expect(evidenceStatusFromGrade("E4")).toBe("verified");
  });
});

describe("risk penalty behaviour", () => {
  it("applies harsher penalties when risk tolerance is lower", () => {
    expect(calculateRiskPenalty("severe", 1)).toBeGreaterThan(calculateRiskPenalty("severe", 5));
    expect(calculateRiskPenalty("fatal", 5)).toBe(100);
  });

  it("combines confidence, risk profile, and risk signals into a radar status", () => {
    const vendor = { confidenceScore: 58, riskProfile: ["control gap", "pricing uncertainty"] };
    expect(calculateVendorRiskScore(vendor, { riskSignal: 75 })).toBeGreaterThan(55);
    expect(riskStatusForVendor(vendor, { riskSignal: 75 })).toBe("high");
    expect(riskStatusForVendor({ confidenceScore: 84, riskProfile: [] }, { riskSignal: 12 })).toBe("watch");
  });
});
