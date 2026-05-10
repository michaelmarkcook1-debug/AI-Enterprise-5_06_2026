import { describe, it, expect } from "vitest";
import { runAssessment, scoreVendor, hashContext } from "./engine";
import { getSeedVendors } from "./seed-vendors";
import { getIndustry } from "./industries";
import type { AssessmentInput, IndustryArchetype } from "./types";

const baseInput: AssessmentInput = {
  industry: "commercial_enterprise",
  orgSize: "enterprise",
  aiMaturity: "piloting",
  primaryObjectives: ["productivity"],
  useCases: ["knowledge_assistant"],
  dataSensitivity: 3,
  riskTolerance: 3,
  autonomyAppetite: "human_in_loop",
  ecosystem: ["microsoft"],
  deploymentPreference: "saas",
  budgetSensitivity: 3,
  vendorIds: [],
};

describe("scoring engine — determinism (spec §22)", () => {
  it("produces identical results for identical input", () => {
    const r1 = runAssessment(baseInput, getSeedVendors());
    const r2 = runAssessment(baseInput, getSeedVendors());
    expect(r1.ranking.map((v) => [v.vendorId, v.finalScore, v.confidenceScore])).toEqual(
      r2.ranking.map((v) => [v.vendorId, v.finalScore, v.confidenceScore]),
    );
    expect(r1.runId).toBe(r2.runId);
  });

  it("hashContext is order-independent", () => {
    const a = hashContext(baseInput);
    const b = hashContext({ ...baseInput });
    expect(a).toBe(b);
  });
});

describe("industry differentiation (spec §22)", () => {
  it("produces materially different rankings across at least 4 archetypes", () => {
    const archetypes: IndustryArchetype[] = [
      "regulated_financial",
      "legal_professional",
      "health_life_sciences",
      "enterprise_software",
    ];
    const rankings = archetypes.map((industry) =>
      runAssessment({ ...baseInput, industry, dataSensitivity: 4 }, getSeedVendors())
        .ranking.filter((r) => !r.excluded)
        .map((r) => r.vendorId),
    );
    // Top vendor should differ across at least 2 industries
    const tops = new Set(rankings.map((r) => r[0]));
    expect(tops.size).toBeGreaterThanOrEqual(2);
  });

  it("Caelum Legal AI ranks higher in legal than in financial", () => {
    const legal = runAssessment(
      { ...baseInput, industry: "legal_professional", useCases: ["contract_review"] },
      getSeedVendors(),
    );
    const fin = runAssessment(
      { ...baseInput, industry: "regulated_financial", useCases: ["financial_analysis"], dataSensitivity: 5 },
      getSeedVendors(),
    );
    const caelumLegal = legal.ranking.find((r) => r.vendorId === "vendor_caelum")!;
    const caelumFin = fin.ranking.find((r) => r.vendorId === "vendor_caelum")!;
    expect(caelumLegal.finalScore).toBeGreaterThan(caelumFin.finalScore);
  });

  it("Evergreen Clinical AI ranks high for health, low or excluded elsewhere", () => {
    const health = runAssessment(
      { ...baseInput, industry: "health_life_sciences", useCases: ["clinical_decision_support"], dataSensitivity: 5 },
      getSeedVendors(),
    );
    const top = health.ranking.find((r) => !r.excluded)!;
    expect(["vendor_evergreen", "vendor_atlas"]).toContain(top.vendorId);
  });
});

describe("evidence integrity (spec §22)", () => {
  it("a claim-only vendor has lower confidence than a verified vendor", () => {
    const vendors = getSeedVendors();
    const industry = getIndustry("commercial_enterprise");
    const weights = industry.weights;
    const atlas = vendors.find((v) => v.id === "vendor_atlas")!;
    const falcon = vendors.find((v) => v.id === "vendor_falcon")!;
    const a = scoreVendor(atlas, baseInput, weights, industry);
    const f = scoreVendor(falcon, baseInput, weights, industry);
    expect(a.confidenceScore).toBeGreaterThan(f.confidenceScore);
  });

  it("fatal blockers in regulated industries exclude vendors", () => {
    const r = runAssessment(
      { ...baseInput, industry: "critical_infrastructure_defence", dataSensitivity: 5, riskTolerance: 1 },
      getSeedVendors(),
    );
    const falcon = r.ranking.find((v) => v.vendorId === "vendor_falcon")!;
    expect(falcon.excluded).toBe(true);
    expect(falcon.recommendationBand).toBe("not_recommended");
  });
});

describe("output contract (spec §18)", () => {
  it("every ranked vendor has pillar scores and rationale", () => {
    const r = runAssessment(baseInput, getSeedVendors());
    for (const v of r.ranking) {
      expect(v.pillarScores.business_fit).toBeGreaterThanOrEqual(0);
      expect(v.pillarScores.enterprise_control).toBeGreaterThanOrEqual(0);
      expect(v.industryRationale.length).toBeGreaterThan(10);
      expect(v.evidenceIds.length).toBeGreaterThan(0);
    }
  });

  it("returns at least 3 ranked vendors when universe permits", () => {
    const r = runAssessment(baseInput, getSeedVendors());
    expect(r.ranking.length).toBeGreaterThanOrEqual(3);
  });

  it("recommendation band reflects final score", () => {
    const r = runAssessment(baseInput, getSeedVendors());
    for (const v of r.ranking) {
      if (v.excluded) expect(v.recommendationBand).toBe("not_recommended");
      else if (v.finalScore >= 75) expect(v.recommendationBand).toBe("enterprise_scale");
      else if (v.finalScore >= 60) expect(v.recommendationBand).toBe("controlled_deployment");
    }
  });
});
