// C6 front door — feasibility model, impact-library validation, routing, ranking.
import { describe, it, expect } from "vitest";
import { USE_CASES, type UseCase } from "./use-cases";
import {
  feasibilityScore,
  feasibilityBand,
  frontDoorRank,
  impactFor,
  routesForUseCase,
  USECASE_IMPACT,
  FAMILY_ROUTES,
  MARKET_CATEGORY_IDS,
  MATURITY_LEVELS,
} from "./usecase-front-door";

const uc = (over: Partial<UseCase>): UseCase => ({
  id: "t",
  label: "t",
  riskTier: "low",
  reliabilityRequirement: 1,
  autonomyDefault: "human_in_loop",
  category: "Operations",
  complexity: "simple",
  regulatoryFlags: [],
  ...over,
});

describe("feasibilityScore — documented formula (methodology §3)", () => {
  it("best case: simple, low-risk, low reliability bar, no regs, advanced buyer = 1.0", () => {
    // 0.35·1 + 0.25·(6-1)/5 + 0.2·1 + 0.1·1 + 0.1·1 = 0.35+0.25+0.2+0.1+0.1 = 1.0
    expect(feasibilityScore(uc({}), 1.0)).toBeCloseTo(1.0, 10);
  });
  it("worst case: complex, critical, reliability 5, 5+ regs, early buyer", () => {
    // 0.35·0.3 + 0.25·(6-5)/5 + 0.2·0.2 + 0.1·0 + 0.1·0.25 = 0.105+0.05+0.04+0+0.025 = 0.22
    const w = uc({
      complexity: "complex",
      riskTier: "critical",
      reliabilityRequirement: 5,
      regulatoryFlags: ["hipaa", "gdpr", "sox", "pci", "fedramp"] as never[],
    });
    expect(feasibilityScore(w, 0.25)).toBeCloseTo(0.22, 10);
  });
  it("is monotonic in maturity and penalises complexity", () => {
    expect(feasibilityScore(uc({}), 1.0)).toBeGreaterThan(feasibilityScore(uc({}), 0.25));
    expect(feasibilityScore(uc({ complexity: "simple" }), 0.5)).toBeGreaterThan(
      feasibilityScore(uc({ complexity: "complex" }), 0.5),
    );
  });
  it("undefined complexity defaults to moderate (0.6), matching taxonomy accessor defaults", () => {
    expect(feasibilityScore(uc({ complexity: undefined }), 0.5)).toBeCloseTo(
      feasibilityScore(uc({ complexity: "moderate" }), 0.5),
      10,
    );
  });
});

describe("feasibilityBand — documented thresholds, bands not decimals", () => {
  it("maps 0.7/0.45 edges", () => {
    expect(feasibilityBand(0.7)).toBe("high");
    expect(feasibilityBand(0.699)).toBe("medium");
    expect(feasibilityBand(0.45)).toBe("medium");
    expect(feasibilityBand(0.449)).toBe("low");
  });
});

describe("impact library — FACTUAL-DATA-ONLY validation", () => {
  it("every curated row resolves to a REAL use-case id and carries full provenance", () => {
    const ids = new Set(USE_CASES.map((u) => u.id));
    for (const row of USECASE_IMPACT) {
      expect(ids.has(row.useCaseId), `unknown useCaseId ${row.useCaseId}`).toBe(true);
      expect(row.sourceName.length).toBeGreaterThan(3);
      expect(row.sourceUrl).toMatch(/^https?:\/\//);
      expect(["E2", "E3", "E4", "E5"]).toContain(row.evidenceGrade);
      expect(row.confidence).toBeGreaterThanOrEqual(0);
      expect(row.confidence).toBeLessThanOrEqual(100);
      expect(row.sourceName).not.toMatch(/REQUIRED|EXAMPLE|placeholder/i);
    }
  });
  it("no curated rows yet ⇒ impactFor is null (honest 'not yet evidenced'), never a default", () => {
    if (USECASE_IMPACT.length === 0) {
      expect(impactFor(USE_CASES[0].id, "financial_services")).toBeNull();
    }
  });
});

describe("routing — every family route targets a real market category", () => {
  it("all FAMILY_ROUTES values are real category ids", () => {
    const valid = new Set<string>(MARKET_CATEGORY_IDS);
    for (const [family, routes] of Object.entries(FAMILY_ROUTES)) {
      expect(routes.length, `family ${family} has no routes`).toBeGreaterThan(0);
      for (const r of routes) expect(valid.has(r), `${family} → unknown category ${r}`).toBe(true);
    }
  });
  it("unmapped family falls back (never a dead end)", () => {
    expect(routesForUseCase(uc({ category: "Some Future Family" })).length).toBeGreaterThan(0);
  });
});

describe("frontDoorRank — real library, deterministic order, industry scoping", () => {
  it("returns entries for a real industry, sorted by descending feasibility", () => {
    const out = frontDoorRank("financial_services", "developing");
    expect(out.length).toBeGreaterThan(5);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].feasibilityScore).toBeGreaterThanOrEqual(out[i].feasibilityScore);
    }
  });
  it("industry-tagged workflows for OTHER industries are excluded", () => {
    const out = frontDoorRank("legal", "developing");
    for (const e of out) {
      if (e.useCase.industries && e.useCase.industries.length > 0) {
        expect(e.useCase.industries).toContain("legal");
      }
    }
  });
  it("every entry carries routes and an honest impact state", () => {
    const out = frontDoorRank("healthcare", "established");
    for (const e of out.slice(0, 10)) {
      expect(e.routes.length).toBeGreaterThan(0);
      // Until curated rows land, impact must be null — never defaulted.
      if (USECASE_IMPACT.length === 0) expect(e.impact).toBeNull();
    }
  });
  it("all maturity levels are usable", () => {
    for (const m of MATURITY_LEVELS) {
      expect(frontDoorRank("technology_software", m.id).length).toBeGreaterThan(0);
    }
  });
});
