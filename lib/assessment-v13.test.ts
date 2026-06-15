// v1.3 assessment-upgrade regression tests.
// Locks in: the schema no longer strips tier fields; the three tiers produce
// different output; structured-data overlay matchers (sovereignty, certs,
// SoR fit, model-quality gate) behave; industry workflow filtering works; and
// the engine stays numerically robust across the new input space.

import { describe, it, expect } from "vitest";
import { AssessmentInputSchema } from "./schema";
import { runAssessment } from "./engine";
import { getSeedVendors } from "./seed-vendors";
import type { AssessmentInput } from "./types";
import {
  workflowsForTierAndIndustry,
  workflowMatchesArchetype,
  USE_CASES,
} from "./use-cases";
import { ARCHETYPE_INDUSTRY_TAGS, tagsForArchetype, archetypeOf } from "./industries";
import { layersForTier, systemsForArchetype, concentrationOf, allInfraItemIds } from "./infrastructure";

const V = getSeedVendors();
const base: AssessmentInput = {
  industry: "commercial_enterprise", orgSize: "enterprise", aiMaturity: "scaling",
  primaryObjectives: ["productivity"], useCases: ["knowledge_assistant"],
  dataSensitivity: 2, riskTolerance: 3, autonomyAppetite: "human_in_loop",
  ecosystem: ["azure"], deploymentPreference: "saas", budgetSensitivity: 3, vendorIds: [],
};

function topFingerprint(input: AssessmentInput): string {
  return runAssessment(input, V).ranking
    .map((v) => `${v.vendorId}:${v.finalScore.toFixed(2)}`)
    .join("|");
}

describe("schema no longer strips tier fields (P0 fix)", () => {
  it("retains every v1.2 + v1.3 field through safeParse", () => {
    const body: Record<string, unknown> = {
      ...base,
      governanceStrictness: 5, sovereigntyRequirement: "hard", region: "eu",
      requiredCertifications: ["cmmc_l2", "fedramp_high_il5"],
      buildVsBuy: "build_on_platform", dataReadiness: 2, useCaseRiskClass: "high_risk",
      maxHallucinationTolerance: "zero", acceptablePricingModels: ["committed_use"],
      selectedSystemsOfRecord: ["temenos"], valueAtStake: "5m_25m",
    };
    const parsed = AssessmentInputSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      for (const k of ["governanceStrictness", "sovereigntyRequirement", "requiredCertifications",
        "buildVsBuy", "useCaseRiskClass", "maxHallucinationTolerance", "selectedSystemsOfRecord", "valueAtStake"]) {
        expect(k in parsed.data).toBe(true);
      }
    }
  });
});

describe("the three tiers now produce different output", () => {
  it("adding Guided + Advanced inputs changes the scores", () => {
    const quick = base;
    const guided: AssessmentInput = { ...quick, governanceStrictness: 5, lockInTolerance: "averse", dataReadiness: 2 };
    const advanced: AssessmentInput = { ...guided, requiredCertifications: ["soc2_type2", "fedramp_high"], maxHallucinationTolerance: "zero" };
    expect(topFingerprint(quick)).not.toBe(topFingerprint(guided));
    expect(topFingerprint(guided)).not.toBe(topFingerprint(advanced));
  });
});

describe("structured-data procurement overlay", () => {
  it("hard sovereignty excludes only out-of-region vendors, not the universe", () => {
    const r = runAssessment({ ...base, sovereigntyRequirement: "hard", region: "apac" }, V);
    const survivors = r.ranking.filter((v) => !v.excluded).map((v) => v.vendorId);
    // Atlas + Delta declare apac regions; the rest do not.
    expect(survivors).toContain("vendor_atlas");
    expect(survivors).toContain("vendor_delta");
    expect(survivors).not.toContain("vendor_falcon"); // us-only
    expect(survivors.length).toBeGreaterThan(0);
    expect(survivors.length).toBeLessThan(V.length);
  });

  it("required certifications penalise the vendor that lacks them more", () => {
    const certReq: AssessmentInput = { ...base, requiredCertifications: ["soc2_type2", "iso_27001", "fedramp_high"] };
    const atlasBase = runAssessment(base, V).ranking.find((v) => v.vendorId === "vendor_atlas")!.finalScore;
    const atlasCert = runAssessment(certReq, V).ranking.find((v) => v.vendorId === "vendor_atlas")!.finalScore;
    // Atlas holds soc2 + iso but not fedramp_high → exactly one missing → −3.
    expect(atlasBase - atlasCert).toBeCloseTo(3, 0);
  });

  it("industry systems-of-record fit rewards the vendor with the native connector", () => {
    const legal: AssessmentInput = { ...base, industry: "legal_professional", useCases: ["contract_review"], dataSensitivity: 3 };
    const noSor = runAssessment(legal, V).ranking.find((v) => v.vendorId === "vendor_caelum")!.finalScore;
    const withSor = runAssessment({ ...legal, selectedSystemsOfRecord: ["imanage", "netdocuments"] }, V)
      .ranking.find((v) => v.vendorId === "vendor_caelum")!.finalScore;
    expect(withSor).toBeGreaterThan(noSor);
  });

  it("zero-hallucination tolerance never lifts a band, only constrains it", () => {
    const plain = runAssessment(base, V).ranking;
    const gated = runAssessment({ ...base, maxHallucinationTolerance: "zero" }, V).ranking;
    const rank = { not_recommended: 0, pilot_only: 1, controlled_deployment: 2, enterprise_scale: 3 } as const;
    for (const g of gated) {
      const p = plain.find((x) => x.vendorId === g.vendorId)!;
      expect(rank[g.recommendationBand]).toBeLessThanOrEqual(rank[p.recommendationBand]);
    }
  });
});

describe("industry-tailored workflow filtering", () => {
  it("maps all 16 tags 1:1 to the 8 archetypes", () => {
    const tags = Object.values(ARCHETYPE_INDUSTRY_TAGS).flat();
    expect(tags.length).toBe(16);
    expect(new Set(tags).size).toBe(16);
    expect(archetypeOf("legal")).toBe("legal_professional");
    expect(archetypeOf("aerospace_defence")).toBe("critical_infrastructure_defence");
  });

  it("never surfaces another industry's workflow to a financial buyer", () => {
    const offered = workflowsForTierAndIndustry("advanced", "regulated_financial", tagsForArchetype);
    for (const w of offered) {
      expect(workflowMatchesArchetype(w, "regulated_financial", tagsForArchetype)).toBe(true);
    }
    // A manufacturing-only workflow must not appear.
    const visibleIds = new Set(offered.map((w) => w.id));
    expect(visibleIds.has("quality_inspection")).toBe(false);
    expect(visibleIds.has("field_dispatch")).toBe(false);
  });

  it("horizontal workflows appear for every archetype", () => {
    for (const a of Object.keys(ARCHETYPE_INDUSTRY_TAGS)) {
      const offered = workflowsForTierAndIndustry("quick", a, tagsForArchetype);
      expect(offered.some((w) => w.id === "knowledge_assistant")).toBe(true);
    }
  });

  it("library grew to 146 workflows with unique ids", () => {
    const ids = USE_CASES.map((u) => u.id);
    expect(USE_CASES.length).toBe(146);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("layered + industry infrastructure taxonomy", () => {
  it("is progressively disclosed by tier", () => {
    expect(layersForTier("quick").length).toBeLessThan(layersForTier("guided").length);
    expect(layersForTier("guided").length).toBeLessThan(layersForTier("advanced").length);
    expect(layersForTier("advanced").length).toBe(11);
  });

  it("gates systems-of-record by archetype", () => {
    expect(systemsForArchetype("health_life_sciences").some((s) => s.id === "epic")).toBe(true);
    expect(systemsForArchetype("regulated_financial").some((s) => s.id === "murex")).toBe(true);
    expect(systemsForArchetype("health_life_sciences").some((s) => s.id === "murex")).toBe(false);
  });

  it("computes single-parent concentration", () => {
    const { topParent, share } = concentrationOf(["azure", "microsoft_365_copilot", "microsoft_dynamics", "aws"]);
    expect(topParent).toBe("microsoft");
    expect(share).toBeCloseTo(0.75, 2);
  });

  it("exposes a non-trivial item catalogue", () => {
    expect(allInfraItemIds().length).toBeGreaterThan(80);
  });
});

describe("numerical robustness across the new input space", () => {
  it("keeps every score in [0,100] with no NaN across a combinatorial sweep", () => {
    const tols = ["zero", "low", "moderate", "best_effort"] as const;
    const builds = ["buy_saas", "build_from_scratch", "undecided"] as const;
    const govs = [1, 3, 5] as const;
    let runs = 0;
    for (const t of tols) for (const b of builds) for (const gv of govs) for (const dr of [1, 3, 5] as const) {
      const r = runAssessment({
        ...base, maxHallucinationTolerance: t, buildVsBuy: b,
        governanceStrictness: gv, dataReadiness: dr,
      }, V);
      runs++;
      for (const v of r.ranking) {
        expect(Number.isNaN(v.finalScore)).toBe(false);
        expect(v.finalScore).toBeGreaterThanOrEqual(0);
        expect(v.finalScore).toBeLessThanOrEqual(100);
      }
    }
    expect(runs).toBe(108);
  });
});
