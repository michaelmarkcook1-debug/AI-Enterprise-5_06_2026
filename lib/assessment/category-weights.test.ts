import { describe, it, expect } from "vitest";
import {
  CATEGORY_DOMAIN_WEIGHTS,
  resolveDomainWeights,
  categoryActivatesModelQuality,
  categoryActivatesDevSentiment,
  categoryActivatesMarketPosition,
  categoryModelQualityDriver,
  MODEL_QUALITY_CODING_WEIGHT,
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
// Infrastructure categories are SCOPED to the domains that apply to hardware/
// capacity — they intentionally do NOT include all 12 framework domains (a chip
// has no hallucination/agentic/workforce/data-privacy axis). See category-weights.
const INFRA = ["ai_silicon", "ai_cloud_compute", "neocloud_inference"];
// Pure model-application domains that never apply to raw hardware/compute.
const INFRA_EXCLUDED_ALWAYS = ["model_reliability", "agentic_autonomy", "workforce_adoption"];

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

describe("coverage denominator: /12 framework + category-scoped domains", () => {
  it("every NON-INFRA category includes ALL 12 framework domains; category-scoped extras only where activated", () => {
    for (const c of NON_FRONTIER) {
      if (INFRA.includes(c)) continue; // infra is deliberately scoped — asserted separately below
      const order = activeDomains(resolveDomainWeights(c));
      for (const d of ASSESSMENT_DOMAINS) expect(order, `${c} missing ${d}`).toContain(d);
      // Length = 12 framework + dev_sentiment (coding categories, flag on)
      // + model_quality (developer_coding_agent — Coding-Index-driven).
      const extra =
        (categoryActivatesDevSentiment(c) ? 1 : 0) +
        (categoryActivatesModelQuality(c) ? 1 : 0) +
        (categoryActivatesMarketPosition(c) ? 1 : 0);
      expect(order.length, c).toBe(ASSESSMENT_DOMAINS.length + extra);
    }
  });

  it("infra categories are SCOPED to applicable domains — N/A model-app domains excluded, capability driver led", () => {
    for (const c of INFRA) {
      const order = activeDomains(resolveDomainWeights(c));
      // Scoped: fewer than the full framework set (they drop N/A axes).
      expect(order.length, `${c} should be scoped (< full framework)`).toBeLessThan(ASSESSMENT_DOMAINS.length);
      // The cited capability driver is always present and is the lead weight.
      expect(order, `${c} must weight market_position`).toContain("market_position");
      expect(categoryActivatesMarketPosition(c), c).toBe(true);
      // Pure model-application domains are NEVER weighted for raw hardware/compute
      // (they are not-applicable, not "insufficient evidence").
      for (const d of INFRA_EXCLUDED_ALWAYS) {
        expect(order, `${c} must NOT weight N/A domain ${d}`).not.toContain(d);
      }
    }
    // A bare accelerator additionally has no enterprise-control posture.
    const silicon = activeDomains(resolveDomainWeights("ai_silicon"));
    for (const d of ["data_security_privacy", "identity_access", "governance_compliance"]) {
      expect(silicon, `ai_silicon must NOT weight enterprise-control domain ${d}`).not.toContain(d);
    }
  });

  it("model_quality is activated ONLY for the model-capability categories (frontier + developer coding)", () => {
    expect(categoryActivatesModelQuality("frontier_model_api")).toBe(true);
    expect(categoryActivatesModelQuality("developer_coding_agent")).toBe(true);
    for (const c of ALL_CATEGORIES) {
      if (c === "frontier_model_api" || c === "developer_coding_agent") continue;
      expect(categoryActivatesModelQuality(c), `${c} should not activate model_quality`).toBe(false);
    }
    // frontier ranks over 14 domains (12 framework + model_quality + dev_sentiment).
    expect(activeDomains(resolveDomainWeights("frontier_model_api")).length).toBe(14);
    // developer_coding_agent likewise (12 framework + model_quality + dev_sentiment).
    expect(activeDomains(resolveDomainWeights("developer_coding_agent")).length).toBe(14);
  });

  it("each model_quality category scores on its own published driver index — never varied per vendor", () => {
    expect(categoryModelQualityDriver("frontier_model_api")).toBe("intelligence");
    expect(categoryModelQualityDriver("developer_coding_agent")).toBe("coding");
    expect(resolveDomainWeights("developer_coding_agent").model_quality).toBe(MODEL_QUALITY_CODING_WEIGHT);
    // The methodology note names the coding driver publicly.
    expect(buildMethodologyNote("developer_coding_agent")).toContain("Coding Index");
    expect(buildMethodologyNote("frontier_model_api")).toContain("Intelligence Index");
  });

  it("dev_sentiment is activated ONLY for the coding categories", () => {
    expect(categoryActivatesDevSentiment("frontier_model_api")).toBe(true);
    expect(categoryActivatesDevSentiment("developer_coding_agent")).toBe(true);
    for (const c of ALL_CATEGORIES) {
      if (c === "frontier_model_api" || c === "developer_coding_agent") continue;
      expect(categoryActivatesDevSentiment(c), `${c} should not activate dev_sentiment`).toBe(false);
    }
  });

  it("market_position (infra capability driver) is activated ONLY for the three infra categories", () => {
    const INFRA = ["ai_silicon", "ai_cloud_compute", "neocloud_inference"];
    for (const c of INFRA) expect(categoryActivatesMarketPosition(c), `${c} should activate market_position`).toBe(true);
    for (const c of ALL_CATEGORIES) {
      if (INFRA.includes(c)) continue;
      expect(categoryActivatesMarketPosition(c), `${c} should not activate market_position`).toBe(false);
    }
  });
});

describe("each profile leans where its category's rationale says it should", () => {
  const topDomain = (c: string) => {
    const w = CATEGORY_DOMAIN_WEIGHTS[c].weights as Record<string, number>;
    return Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
  };
  it("infra categories lead on the cited capability driver (market_position), not model quality", () => {
    // The three hardware/infra categories are led by market_position — the cited
    // capability driver (silicon = MLPerf + share; cloud/neocloud = capacity +
    // share + backlog). Capital/cost follow, but capability comes first.
    expect(topDomain("ai_silicon")).toBe("market_position");
    expect(topDomain("ai_cloud_compute")).toBe("market_position");
    expect(topDomain("neocloud_inference")).toBe("market_position");
    // …and none of them lead on the software model-capability domains.
    for (const c of ["ai_silicon", "ai_cloud_compute", "neocloud_inference"]) {
      expect(["model_quality", "agentic_autonomy"]).not.toContain(topDomain(c));
    }
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
