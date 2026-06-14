import { describe, expect, it } from "vitest";
import { renderClaim } from "./render-claim";
import { validateClaimSupport } from "./registry";
import type { Claim } from "./types";

const baseClaim: Claim = {
  id: "claim_test",
  entityType: "vendor",
  entityId: "openai",
  claimType: "metric",
  claimText: "Test claim",
  numericValue: 42,
  value: 42,
  unit: "score",
  period: "2026",
  geography: "Global",
  sourceIds: ["source_prompt_pack_zero_hallucination_2026_05_07"],
  sourceUrls: [],
  sourceNames: ["Prompt pack"],
  sourceDates: ["2026-05-07"],
  evidenceGrade: "E2",
  confidenceScore: 70,
  dataStatus: "documented",
  uncertaintyNote: "Test uncertainty.",
  createdAt: "2026-05-07T00:00:00.000Z",
  updatedAt: "2026-05-07T00:00:00.000Z",
  capturedAt: "2026-05-07T00:00:00.000Z",
  lastVerifiedAt: "2026-05-07T00:00:00.000Z",
  staleAfter: "2026-06-07T00:00:00.000Z",
  expiryDate: "2026-06-07T00:00:00.000Z",
  isEstimated: false,
  isSeedData: false,
  isUserGenerated: false,
  isModelGenerated: false,
};

describe("renderClaim truthfulness guard", () => {
  it("does not render unsupported E0 claims as verified", () => {
    const rendered = renderClaim({ ...baseClaim, evidenceGrade: "E0", sourceIds: [], confidenceScore: 0 });

    expect(rendered.value).toBe("Unknown");
    expect(rendered.warnings).toContain("Unknown");
    expect(validateClaimSupport({ ...baseClaim, evidenceGrade: "E0", sourceIds: [], confidenceScore: 0 }).isValid).toBe(false);
  });

  it("always labels seed data as seed estimate and not verified", () => {
    const rendered = renderClaim({ ...baseClaim, dataStatus: "seed", isSeedData: true, isEstimated: true, evidenceGrade: "E1", confidenceScore: 30 });

    expect(rendered.value).toBe("Seed estimate - not verified");
    expect(rendered.warnings).toContain("Seed estimate - not verified");
    expect(rendered.warnings).toContain("Low confidence");
  });

  it("marks stale claims as stale", () => {
    const rendered = renderClaim({ ...baseClaim, staleAfter: "2026-01-01T00:00:00.000Z" }, new Date("2026-05-07T00:00:00.000Z"));

    expect(rendered.dataStatus).toBe("stale");
    expect(rendered.warnings).toContain("Stale data - refresh required");
  });

  it("rejects model-generated claims without source claim traceability", () => {
    const validation = validateClaimSupport({ ...baseClaim, isModelGenerated: true, sourceClaimIds: [] });

    expect(validation.isValid).toBe(false);
    expect(validation.warnings.join(" ")).toContain("source claim traceability");
  });
});
