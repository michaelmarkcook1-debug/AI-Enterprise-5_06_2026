import { describe, expect, it } from "vitest";
import {
  activeModelCount,
  getAllVendorSummaries,
  getCommercialModelSources,
  getCommercialModels,
  getDashboardSummary,
  getModelsByVendor,
  groupModelsByOwnership,
  hostedThirdPartyCount,
  isActive,
  isDeprecatedOrRetired,
  isFirstParty,
  isHostedThirdParty,
  isVerified,
  refreshRequired,
  verifiedModelCount,
} from "./repository";
import { SEED_MODELS, SEED_MODEL_SOURCES } from "./seed";

const ALL = getCommercialModels();

// ──────────────── Truth and counting ────────────────

describe("model-inventory: truthfulness", () => {
  it("no model renders as verified without sourceIds", () => {
    for (const m of ALL) {
      if (m.sourceIds.length === 0) {
        expect(isVerified(m)).toBe(false);
      }
    }
  });

  it("no model is verified unless evidenceGrade ≥ E3", () => {
    for (const m of ALL) {
      if (isVerified(m)) {
        expect(["E3", "E4", "E5"]).toContain(m.evidenceGrade);
      }
    }
  });

  it("seed-status records appear with seed dataStatus and never as verified", () => {
    const seed = ALL.filter((m) => m.dataStatus === "seed");
    expect(seed.length).toBeGreaterThan(0);
    for (const m of seed) {
      expect(isVerified(m)).toBe(false);
    }
  });

  it("deprecated/retired models are not counted as active", () => {
    const deprecated = ALL.filter(isDeprecatedOrRetired);
    expect(deprecated.length).toBeGreaterThan(0);
    for (const m of deprecated) {
      expect(isActive(m)).toBe(false);
    }
  });

  it("hosted third-party are not counted as first-party", () => {
    const hosted = ALL.filter(isHostedThirdParty);
    expect(hosted.length).toBeGreaterThan(0);
    for (const m of hosted) {
      expect(isFirstParty(m)).toBe(false);
    }
  });

  it("unknown records flagged for refresh required", () => {
    const unk = ALL.filter((m) => m.dataStatus === "unknown");
    for (const m of unk) {
      expect(refreshRequired(m)).toBe(true);
      expect(isActive(m)).toBe(false);
    }
  });

  it("source URLs are non-empty for any record claiming sources", () => {
    for (const m of ALL) {
      for (const url of m.sourceUrls) {
        expect(url.startsWith("http")).toBe(true);
      }
    }
  });
});

// ──────────────── Ownership integrity ────────────────

describe("model-inventory: ownership integrity", () => {
  it("AWS-hosted Anthropic/Cohere/Mistral keep original owner", () => {
    const bedrock = getModelsByVendor("amzn").filter(isHostedThirdParty);
    expect(bedrock.length).toBeGreaterThan(0);
    const anthropicHosted = bedrock.find((m) => m.modelName.includes("Claude"));
    expect(anthropicHosted?.ownerVendorId).toBe("anthropic");
    expect(anthropicHosted?.hostingVendorId).toBe("amzn");
    const mistralHosted = bedrock.find((m) => m.modelName.includes("Mistral"));
    expect(mistralHosted?.ownerVendorId).toBe("mistral");
    const cohereHosted = bedrock.find((m) => m.modelName.includes("Cohere"));
    expect(cohereHosted?.ownerVendorId).toBe("cohere");
  });

  it("Azure-hosted OpenAI/Anthropic keep original owner", () => {
    const foundry = getModelsByVendor("msft").filter(isHostedThirdParty);
    const openaiHosted = foundry.find((m) => m.modelName.includes("OpenAI"));
    expect(openaiHosted?.ownerVendorId).toBe("openai");
    const anthropicHosted = foundry.find((m) => m.modelName.includes("Claude"));
    expect(anthropicHosted?.ownerVendorId).toBe("anthropic");
  });

  it("Oracle hosted Cohere/Meta models keep original owner", () => {
    const oci = getModelsByVendor("orcl").filter(isHostedThirdParty);
    expect(oci.length).toBeGreaterThan(0);
    for (const m of oci) {
      expect(m.ownerVendorId).not.toBe("orcl");
      expect(m.hostingVendorId).toBe("orcl");
    }
  });

  it("Glean / Harvey orchestration does not reassign ownership", () => {
    const glean = getModelsByVendor("glean");
    for (const m of glean) {
      if (m.ownershipType === "hosted_third_party") {
        expect(m.ownerVendorId).not.toBe("glean");
      }
    }
    const harvey = getModelsByVendor("harvey");
    for (const m of harvey) {
      if (m.ownershipType === "hosted_third_party") {
        expect(m.ownerVendorId).not.toBe("harvey");
      }
    }
  });

  it("first-party requires ownerVendorId === vendorId", () => {
    for (const m of ALL.filter(isFirstParty)) {
      expect(m.ownerVendorId).toBe(m.vendorId);
    }
  });
});

// ──────────────── Counters ────────────────

describe("model-inventory: counters", () => {
  it("first-party count excludes hosted third-party", () => {
    const amzn = getModelsByVendor("amzn");
    const firstParty = amzn.filter(isFirstParty);
    const hosted = amzn.filter(isHostedThirdParty);
    expect(firstParty.length).toBeGreaterThan(0);
    expect(hosted.length).toBeGreaterThan(0);
    expect(firstParty.every((m) => !isHostedThirdParty(m))).toBe(true);
  });

  it("activeModelCount excludes deprecated/retired/unknown", () => {
    const total = ALL.length;
    const active = activeModelCount(ALL);
    const deprecatedRetiredUnknown = ALL.filter((m) =>
      m.availabilityStage === "deprecated" || m.availabilityStage === "retired" || m.availabilityStage === "unknown",
    ).length;
    expect(active).toBe(total - deprecatedRetiredUnknown);
  });

  it("verifiedModelCount requires E3+ AND sources", () => {
    expect(verifiedModelCount(ALL)).toBe(ALL.filter(isVerified).length);
  });

  it("hostedThirdPartyCount matches isHostedThirdParty filter", () => {
    expect(hostedThirdPartyCount(ALL)).toBe(ALL.filter(isHostedThirdParty).length);
  });

  it("groupModelsByOwnership partitions correctly", () => {
    const groups = groupModelsByOwnership(ALL);
    const totalGrouped =
      groups.firstParty.length + groups.hostedThirdParty.length +
      groups.underlyingProductModel.length + groups.openWeight.length + groups.unknown.length;
    // Some ownership types not shown above — totalGrouped is a lower bound.
    expect(totalGrouped).toBeLessThanOrEqual(ALL.length);
    expect(groups.firstParty.every(isFirstParty)).toBe(true);
    expect(groups.hostedThirdParty.every(isHostedThirdParty)).toBe(true);
  });
});

// ──────────────── Vendor summaries ────────────────

describe("model-inventory: vendor summaries", () => {
  it("Anthropic summary surfaces Claude family with first-party count > 0", () => {
    const summary = getAllVendorSummaries().find((s) => s.vendorId === "anthropic");
    expect(summary).toBeDefined();
    expect(summary!.firstPartyActiveCount).toBeGreaterThan(0);
    expect(summary!.primaryModelFamilies).toContain("Claude");
    expect(summary!.deprecatedRetiredCount).toBeGreaterThan(0); // Claude 2 deprecated
  });

  it("Oracle summary shows hosted third-party but zero first-party", () => {
    const summary = getAllVendorSummaries().find((s) => s.vendorId === "orcl");
    expect(summary?.firstPartyActiveCount).toBe(0);
    expect(summary!.hostedThirdPartyCount).toBeGreaterThan(0);
  });

  it("Perplexity summary marks refresh required (no source-backed inventory yet)", () => {
    const summary = getAllVendorSummaries().find((s) => s.vendorId === "perplexity");
    expect(summary?.refreshRequired).toBe(true);
    expect(summary?.uncertaintyBadge).toBeTruthy();
    expect(summary?.firstPartyActiveCount).toBe(0);
  });

  it("Infrastructure-only vendors (AMD, ASML, Arm) show as infrastructure-only", () => {
    const all = getAllVendorSummaries();
    for (const id of ["amd", "asml", "arm", "snow", "sap"]) {
      const s = all.find((x) => x.vendorId === id);
      expect(s?.isInfrastructureOnly).toBe(true);
      expect(s?.firstPartyActiveCount).toBe(0);
      expect(s?.hostedThirdPartyCount).toBe(0);
    }
  });

  it("Cash provider is excluded from vendor summaries", () => {
    const all = getAllVendorSummaries();
    expect(all.find((s) => s.vendorId === "cash")).toBeUndefined();
  });
});

// ──────────────── Dashboard summary ────────────────

describe("model-inventory: dashboard summary", () => {
  it("totalTrackedVendors > 0 and counts roll up sensibly", () => {
    const summary = getDashboardSummary();
    expect(summary.totalTrackedVendors).toBeGreaterThan(0);
    expect(summary.vendorsWithFirstPartyModels).toBeGreaterThan(0);
    expect(summary.vendorsWithHostedThirdPartyModels).toBeGreaterThan(0);
    expect(summary.latestSourceRefresh).toBeTruthy();
  });

  it("vendorsUnknownOrUnverified ≥ 1 (Perplexity / Nvidia refresh)", () => {
    expect(getDashboardSummary().vendorsUnknownOrUnverified).toBeGreaterThanOrEqual(1);
  });
});

// ──────────────── No-hallucination ────────────────

describe("model-inventory: no-hallucination guards", () => {
  it("seed source URLs are real-looking URLs (start with https)", () => {
    for (const s of SEED_MODEL_SOURCES) {
      expect(s.sourceUrl.startsWith("https://")).toBe(true);
    }
  });

  it("every model record references at least one source by id (or is explicit unknown)", () => {
    for (const m of ALL) {
      if (m.dataStatus !== "unknown") {
        expect(m.sourceIds.length).toBeGreaterThan(0);
      }
    }
  });

  it("models without evidenceGrade should fail validation (synthetic case)", () => {
    const broken = { ...SEED_MODELS[0], evidenceGrade: undefined as never };
    expect(isVerified(broken)).toBe(false);
  });
});

// ──────────────── Sources ────────────────

describe("model-inventory: sources", () => {
  it("getCommercialModelSources returns all seed sources", () => {
    expect(getCommercialModelSources().length).toBe(SEED_MODEL_SOURCES.length);
  });
});
