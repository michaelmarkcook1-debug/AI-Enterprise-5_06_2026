import { describe, expect, it } from "vitest";
import { toVendor, type PersistedVendorProfile } from "./vendor-mapper";

describe("vendor persistence mapper", () => {
  it("converts database rows into the pure scoring-engine vendor shape", () => {
    const row: PersistedVendorProfile = {
      id: "vendor_test",
      name: "Test AI",
      category: "Enterprise AI Platform",
      website: null,
      hq: "London",
      ownership: "private",
      summary: "Profile used to verify persistence mapping.",
      supportedDeployments: ["saas", "vpc"],
      ecosystemFit: ["microsoft"],
      useCaseFit: ["knowledge_assistant"],
      evidence: [
        {
          id: "ev_test",
          vendorId: "vendor_test",
          domain: "data_security_privacy",
          subfactor: "Training data policy",
          excerpt: "Independent evidence confirms enterprise data controls.",
          sourceUrl: null,
          capturedAt: new Date("2026-04-15T00:00:00.000Z"),
          evidenceGrade: "E4",
          rawScore: 88,
          freshnessDays: null,
        },
      ],
      risks: [
        {
          id: "risk_test",
          vendorId: "vendor_test",
          severity: "severe",
          description: "Limited deployment evidence in regulated markets.",
          domain: "market_position",
          isFatalIfTriggered: false,
          fatalInIndustries: ["regulated_financial"],
        },
      ],
      industryAdoption: [
        {
          industry: "commercial_enterprise",
          productionReferenceCount: 12,
          deploymentDepthScore: 64,
          confidence: 72,
        },
      ],
    };

    const vendor = toVendor(row);

    expect(vendor.website).toBeUndefined();
    expect(vendor.supportedDeployments).toEqual(["saas", "vpc"]);
    expect(vendor.evidence[0]).toMatchObject({
      id: "ev_test",
      grade: "E4",
      capturedAt: "2026-04-15T00:00:00.000Z",
    });
    expect(vendor.risks[0].fatalInIndustries).toEqual(["regulated_financial"]);
    expect(vendor.industryAdoption[0].deploymentDepthScore).toBe(64);
  });
});
