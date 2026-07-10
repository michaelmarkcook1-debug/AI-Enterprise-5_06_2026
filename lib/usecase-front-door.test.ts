// C6 front door — feasibility model, impact-library validation, routing, ranking.
import { describe, it, expect } from "vitest";
import { USE_CASES, type UseCase } from "./use-cases";
import {
  feasibilityScore,
  feasibilityBand,
  frontDoorRank,
  commonFastWins,
  impactFor,
  flagsFor,
  priorityQuadrant,
  impactIsHigh,
  routesForUseCase,
  USECASE_IMPACT,
  FAMILY_ROUTES,
  MARKET_CATEGORY_IDS,
  MATURITY_LEVELS,
} from "./usecase-front-door";
import { USECASE_EVIDENCE_FLAGS } from "./usecase-impact-data";

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
  const ids = new Set(USE_CASES.map((u) => u.id));

  it("every curated row resolves to a REAL use-case id and carries full uplift provenance", () => {
    expect(USECASE_IMPACT.length).toBeGreaterThan(0);
    for (const row of USECASE_IMPACT) {
      expect(ids.has(row.useCaseId), `unknown useCaseId ${row.useCaseId}`).toBe(true);
      expect(["lt_10%", "10_25%", "25_50%", "gt_50%"]).toContain(row.upliftBand);
      expect(row.upliftBasis.length, `empty basis for ${row.useCaseId}`).toBeGreaterThan(3);
      expect(row.sourceName.length).toBeGreaterThan(3);
      expect(row.sourceUrl).toMatch(/^https?:\/\//);
      expect(["E2", "E3", "E4", "E5"]).toContain(row.evidenceGrade);
      expect(row.confidence).toBeGreaterThanOrEqual(0);
      expect(row.confidence).toBeLessThanOrEqual(100);
      expect(row.sourceName).not.toMatch(/REQUIRED|EXAMPLE|placeholder/i);
    }
  });

  it("every $ value carries its OWN provenance (never inferred from uplift)", () => {
    const bands = ["lt_250k", "250k_1m", "1m_5m", "5m_25m", "gt_25m"];
    for (const row of USECASE_IMPACT) {
      if (!row.value) continue;
      expect(bands).toContain(row.value.band);
      expect(row.value.basis.length).toBeGreaterThan(3);
      expect(row.value.sourceName.length).toBeGreaterThan(3);
      expect(row.value.sourceUrl).toMatch(/^https?:\/\//);
      expect(["E2", "E3", "E4", "E5"]).toContain(row.value.evidenceGrade);
    }
  });

  it("no unique row is duplicated on the same (useCaseId × industryTag)", () => {
    const seen = new Set<string>();
    for (const row of USECASE_IMPACT) {
      const key = `${row.useCaseId}::${row.industryTag}`;
      expect(seen.has(key), `duplicate cell ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("impactFor returns a real row for an evidenced use-case, null for an honestly-empty one", () => {
    expect(impactFor("customer_service_agent", "financial_services")).not.toBeNull(); // "*" row applies
    expect(impactFor("tier1_triage", "financial_services")).toBeNull(); // no citable source → empty
    expect(impactFor("incident_response", "technology_software")).toBeNull();
  });

  it("an exact-industry row beats a horizontal one", () => {
    // translation_localisation is curated for financial_services specifically.
    const fin = impactFor("translation_localisation", "financial_services");
    expect(fin?.industryTag).toBe("financial_services");
  });

  it("evidence flags resolve to REAL use-case ids with full provenance", () => {
    expect(USECASE_EVIDENCE_FLAGS.length).toBeGreaterThan(0);
    for (const f of USECASE_EVIDENCE_FLAGS) {
      expect(ids.has(f.useCaseId), `unknown flag useCaseId ${f.useCaseId}`).toBe(true);
      expect(["contested", "not_a_net_win", "accuracy_only", "capability_limited"]).toContain(f.kind);
      expect(f.summary.length).toBeGreaterThan(10);
      expect(f.sourceUrl).toMatch(/^https?:\/\//);
      expect(["E2", "E3", "E4", "E5"]).toContain(f.evidenceGrade);
    }
  });
});

describe("priority quadrant + flags — evidenced Uplift × Feasibility (methodology §5)", () => {
  it("impactIsHigh: only the upper two uplift bands count as high impact", () => {
    expect(impactIsHigh("gt_50%")).toBe(true);
    expect(impactIsHigh("25_50%")).toBe(true);
    expect(impactIsHigh("10_25%")).toBe(false);
    expect(impactIsHigh("lt_10%")).toBe(false);
  });

  it("null impact ⇒ null quadrant (not placeable — honest, never defaulted)", () => {
    expect(priorityQuadrant(null, "high")).toBeNull();
  });

  it("places the four quadrants from real curated rows", () => {
    const high = impactFor("marketing_content", "technology_software"); // gt_50%
    const low = impactFor("knowledge_assistant", "technology_software"); // lt_10%
    expect(high && impactIsHigh(high.upliftBand)).toBe(true);
    expect(low && impactIsHigh(low.upliftBand)).toBe(false);
    expect(priorityQuadrant(high, "high")).toBe("quick_win");
    expect(priorityQuadrant(high, "low")).toBe("big_bet");
    expect(priorityQuadrant(low, "high")).toBe("easy_fill_in");
    expect(priorityQuadrant(low, "medium")).toBe("question_mark");
  });

  it("flagsFor surfaces counter-evidence and is empty for a clean use-case", () => {
    expect(flagsFor("code_assistant", "technology_software").some((f) => f.kind === "contested")).toBe(true);
    expect(flagsFor("text_to_sql", "financial_services").some((f) => f.kind === "capability_limited")).toBe(true);
    expect(flagsFor("meeting_assistant", "financial_services")).toHaveLength(0);
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
  it("every entry carries routes, a flags array, and a quadrant consistent with its impact", () => {
    const out = frontDoorRank("healthcare", "established");
    for (const e of out) {
      expect(e.routes.length).toBeGreaterThan(0);
      expect(Array.isArray(e.flags)).toBe(true);
      // Honest impact state: impact is null (not evidenced) or a real curated row —
      // never a manufactured default. Quadrant is placeable IFF impact is evidenced.
      if (e.impact === null) {
        expect(e.quadrant).toBeNull();
      } else {
        expect(e.impact.upliftBand).toBeTruthy();
        expect(e.quadrant).not.toBeNull();
      }
    }
  });
  it("at least some healthcare workflows are placed on the 2×2 (horizontal impact rows apply)", () => {
    const placed = frontDoorRank("healthcare", "established").filter((e) => e.quadrant);
    expect(placed.length).toBeGreaterThan(0);
  });
  it("all maturity levels are usable", () => {
    for (const m of MATURITY_LEVELS) {
      expect(frontDoorRank("technology_software", m.id).length).toBeGreaterThan(0);
    }
  });
});

describe("commonFastWins — the cold-state preview: honest, non-empty, maturity-independent", () => {
  it("is never empty — the front door always has something concrete before any selection", () => {
    expect(commonFastWins().length).toBeGreaterThan(0);
  });

  it("only shows HORIZONTAL use-cases (no industry tags) — honestly relevant to every visitor", () => {
    for (const e of commonFastWins()) {
      expect(!e.useCase.industries || e.useCase.industries.length === 0).toBe(true);
    }
  });

  it("every preview item is HIGH feasibility, carries routes, and has null impact (never defaulted)", () => {
    for (const e of commonFastWins()) {
      expect(e.feasibility).toBe("high");
      expect(e.routes.length).toBeGreaterThan(0);
      expect(e.impact).toBeNull();
    }
  });

  it("HONESTY: each preview item stays HIGH even at the LOWEST maturity — the band never presupposes a maturity", () => {
    const lowest = MATURITY_LEVELS[0].id; // "early", worst-case fit
    for (const e of commonFastWins()) {
      const score = feasibilityScore(e.useCase, MATURITY_LEVELS[0].fit);
      expect(feasibilityBand(score)).toBe("high");
      // …and it therefore also surfaces HIGH once the buyer actually picks (any industry it's horizontal for).
      const ranked = frontDoorRank("technology_software", lowest).find((r) => r.useCase.id === e.useCase.id);
      expect(ranked?.feasibility).toBe("high");
    }
  });

  it("is a strict SUBSET of the real ranked list — selection only tailors/expands, never a different set", () => {
    const rankedIds = new Set(frontDoorRank("manufacturing", "developing").map((e) => e.useCase.id));
    for (const e of commonFastWins()) {
      expect(rankedIds.has(e.useCase.id)).toBe(true); // horizontal → present for every industry
    }
  });

  it("respects the limit", () => {
    expect(commonFastWins(3).length).toBeLessThanOrEqual(3);
  });
});
