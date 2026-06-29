import { describe, it, expect } from "vitest";
import {
  CATEGORY_DOMAIN_WEIGHTS,
  resolveDomainWeights,
  categoryActivatesModelQuality,
  getCategoryWeightRationale,
  buildMethodologyNote,
} from "./category-weights";
import { ASSESSMENT_DOMAINS } from "./domain-rubric";
import { activeDomains, DEFAULT_DOMAIN_WEIGHTS } from "./composite";

// The full category roster (lib/intelligence/seed.ts MARKET_CATEGORIES).
const ALL_CATEGORIES = [
  "frontier_model_api", "enterprise_assistant", "developer_coding_agent", "agent_platform",
  "rag_enterprise_search", "workflow_automation_ai", "crm_customer_ai", "itsm_hr_service_ai",
  "cloud_ai_platform", "regulated_industry_ai", "ai_silicon", "ai_cloud_compute", "neocloud_inference",
];
const NON_FRONTIER = ALL_CATEGORIES.filter((c) => c !== "frontier_model_api");

describe("category weight profiles — every category has a principled profile", () => {
  it("all 13 categories have a bespoke profile (no category left on the bare even default)", () => {
    for (const c of ALL_CATEGORIES) {
      expect(CATEGORY_DOMAIN_WEIGHTS[c], `missing profile: ${c}`).toBeDefined();
    }
  });

  it("every profile documents a non-trivial rationale (public methodology)", () => {
    for (const c of ALL_CATEGORIES) {
      const r = getCategoryWeightRationale(c);
      expect(r, c).toBeTruthy();
      expect((r ?? "").length, c).toBeGreaterThan(40);
    }
  });

  it("every profile's weights are positive and sum to ~1.0 (renormalizable)", () => {
    for (const c of ALL_CATEGORIES) {
      const w = CATEGORY_DOMAIN_WEIGHTS[c].weights;
      const vals = Object.values(w) as number[];
      for (const v of vals) expect(v, c).toBeGreaterThan(0);
      const sum = vals.reduce((s, v) => s + v, 0);
      expect(Math.abs(sum - 1), `${c} sums to ${sum}`).toBeLessThan(0.011);
    }
  });
});

describe("coverage denominator stays /12 for non-frontier (no gaming)", () => {
  it("non-frontier profiles include EVERY framework domain (so coverage matches the default)", () => {
    for (const c of NON_FRONTIER) {
      const order = activeDomains(resolveDomainWeights(c));
      // identical active set to the framework default → same /12 denominator
      expect(order.length, c).toBe(activeDomains(DEFAULT_DOMAIN_WEIGHTS).length);
      for (const d of ASSESSMENT_DOMAINS) expect(order, `${c} missing ${d}`).toContain(d);
    }
  });

  it("model_quality is activated ONLY for frontier_model_api", () => {
    expect(categoryActivatesModelQuality("frontier_model_api")).toBe(true);
    for (const c of NON_FRONTIER) {
      expect(categoryActivatesModelQuality(c), `${c} should not activate model_quality`).toBe(false);
    }
    // frontier ranks over 13 domains, the rest over 12
    expect(activeDomains(resolveDomainWeights("frontier_model_api")).length).toBe(13);
  });
});

describe("each profile leans where its category's rationale says it should", () => {
  const topDomain = (c: string) => {
    const w = CATEGORY_DOMAIN_WEIGHTS[c].weights as Record<string, number>;
    return Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
  };
  it("compute categories lead on capital/cost, not model quality", () => {
    expect(["capital_resilience", "cost_finops"]).toContain(topDomain("ai_silicon"));
    expect(["capital_resilience", "cost_finops"]).toContain(topDomain("ai_cloud_compute"));
    expect(["capital_resilience", "cost_finops"]).toContain(topDomain("neocloud_inference"));
  });
  it("agent/workflow categories lead on agentic or integration", () => {
    expect(["agentic_autonomy", "integration_architecture"]).toContain(topDomain("agent_platform"));
    expect(["agentic_autonomy", "integration_architecture"]).toContain(topDomain("workflow_automation_ai"));
  });
  it("regulated AI leads on governance/compliance", () => {
    expect(topDomain("regulated_industry_ai")).toBe("governance_compliance");
  });
  it("RAG/search leads on integration or data security", () => {
    expect(["integration_architecture", "data_security_privacy"]).toContain(topDomain("rag_enterprise_search"));
  });
});

describe("methodology note is documented + category-specific", () => {
  it("each category's note names its weighting and rationale", () => {
    for (const c of ALL_CATEGORIES) {
      const note = buildMethodologyNote(c);
      expect(note, c).toContain("Category-specific weighting");
      expect(note.length, c).toBeGreaterThan(200);
    }
    // model-quality citation only where activated
    expect(buildMethodologyNote("frontier_model_api")).toContain("Arena");
    expect(buildMethodologyNote("ai_silicon")).not.toContain("Arena");
  });
});
