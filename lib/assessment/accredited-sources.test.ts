// Accredited-certification grade floor — the correction must be SYMMETRIC
// (source-based, never vendor-based) and TIGHT (only real cert/registry pages).
import { describe, it, expect } from "vitest";
import { isAccreditedCertSource, accreditedCorrectedGrade } from "./accredited-sources";

describe("isAccreditedCertSource — matches genuine certification/registry pages only", () => {
  it("matches accredited cert / attestation / registry pages, for ANY vendor", () => {
    for (const u of [
      "https://cloud.google.com/security/compliance/iso-27001", // Google
      "https://cloud.google.com/security/compliance/soc-2", // Google (was mis-graded E2)
      "https://trust.anthropic.com/", // Anthropic trust center
      "https://support.claude.com/en/articles/10015870-what-certifications-has-anthropic-obtained",
      "https://privacy.claude.com/en/articles/10015870-what-certifications-has-anthropic-obtained",
      "https://www.anthropic.com/news/anthropic-achieves-iso-42001-certification-for-responsible-ai",
      "https://cloudsecurityalliance.org/star/registry/anthropic",
      "https://trustlists.org/company/anthropic/",
      "https://www.anthropic.com/news/claude-in-amazon-bedrock-fedramp-high",
    ]) {
      expect(isAccreditedCertSource(u), u).toBe(true);
    }
  });

  it("does NOT match generic docs / pricing / marketing / status pages", () => {
    for (const u of [
      "https://www.anthropic.com/pricing",
      "https://cloud.google.com/vertex-ai/generative-ai/pricing",
      "https://cloud.google.com/vertex-ai/generative-ai/docs/overview",
      "https://status.cloud.google.com/",
      "https://docs.anthropic.com/en/docs/welcome",
      "https://www.anthropic.com/news/tcs-anthropic-partnership",
      null,
      "",
    ]) {
      expect(isAccreditedCertSource(u), String(u)).toBe(false);
    }
  });
});

describe("accreditedCorrectedGrade — floors at E4, symmetric, never lowers", () => {
  it("floors an E2 accredited cert to E4 — same for Google and Anthropic", () => {
    expect(accreditedCorrectedGrade("E2", "https://cloud.google.com/security/compliance/soc-2")).toBe("E4");
    expect(accreditedCorrectedGrade("E2", "https://trust.anthropic.com/")).toBe("E4");
    expect(accreditedCorrectedGrade("E3", "https://trustlists.org/company/anthropic/")).toBe("E4");
  });

  it("never LOWERS a grade — an already-E4/E5 cert row is unchanged", () => {
    expect(accreditedCorrectedGrade("E4", "https://cloud.google.com/security/compliance/iso-27001")).toBe("E4");
    expect(accreditedCorrectedGrade("E5", "https://trust.anthropic.com/")).toBe("E5");
  });

  it("leaves non-cert sources completely untouched (no over-application)", () => {
    expect(accreditedCorrectedGrade("E1", "https://www.anthropic.com/pricing")).toBe("E1");
    expect(accreditedCorrectedGrade("E2", "https://cloud.google.com/vertex-ai/generative-ai/docs/overview")).toBe("E2");
  });
});
