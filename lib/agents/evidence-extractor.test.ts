import { describe, it, expect } from "vitest";
import { extractEvidence, ExtractionResponseSchema } from "./evidence-extractor";

describe("evidence extractor (stub fallback path)", () => {
  it("returns schema-valid proposals for a trust_center source", async () => {
    const r = await extractEvidence({
      vendorName: "Atlas Enterprise AI",
      vendorCategory: "Enterprise AI Platform",
      sourceCategory: "trust_center",
      sourceUrl: "https://example.com/trust",
      rawContent: "Trust centre lists SOC 2 Type II, ISO 27001, GDPR DPA, EU residency, no model training on customer prompts.",
    });
    expect(r.source).toBe("stub");
    expect(ExtractionResponseSchema.parse(r.data).proposals.length).toBeGreaterThan(0);
    expect(r.data.proposals[0].domain).toBe("data_security_privacy");
  });

  it("returns a pricing proposal for pricing_page", async () => {
    const r = await extractEvidence({
      vendorName: "Borealis Frontier",
      vendorCategory: "Frontier model",
      sourceCategory: "pricing_page",
      sourceUrl: "https://example.com/pricing",
      rawContent: "Pricing page lists per-token pricing tiers and an enterprise plan with annual commit discounts.",
    });
    expect(r.data.proposals[0].domain).toBe("cost_finops");
  });

  it("classifier-style cap: marketing language stays at most E2", async () => {
    const r = await extractEvidence({
      vendorName: "Falcon Agents",
      vendorCategory: "Agentic startup",
      sourceCategory: "vendor_docs",
      sourceUrl: "https://example.com/marketing",
      rawContent: "We are SOC 2 in progress and the most secure platform in the world.",
    });
    expect(["E0", "E1", "E2"]).toContain(r.data.proposals[0].proposedGrade);
  });
});
