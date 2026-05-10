import { describe, expect, it } from "vitest";
import {
  capabilityRenderState,
  isInfrastructureOnlyVendor,
  summariseCapabilityOverview,
} from "./capabilities-truthfulness";
import type { VendorCapability } from "./types";

const FIXED_NOW = new Date("2026-05-10T00:00:00.000Z");

function vc(overrides: Partial<VendorCapability> = {}): VendorCapability {
  return {
    vendorId: "vendor_test",
    capabilityId: "models",
    status: "documented",
    maturityScore: 80,
    evidenceGrade: "E3",
    lastVerified: "2026-04-01",
    notes: "",
    ...overrides,
  };
}

describe("capabilities-truthfulness: render gates", () => {
  it("verified mode requires E3+ AND sourceUrls AND productScopeIds AND non-seed", () => {
    const r = capabilityRenderState(vc({
      evidenceGrade: "E4",
      sourceUrls: ["https://docs.openai.com/x"],
      sourceIds: ["src_x"],
      productScopeIds: ["scope_chatgpt_enterprise"],
      dataStatus: "documented",
      sourceDate: "2026-04-01",
      confidenceScore: 90,
    }), { now: FIXED_NOW });
    expect(r.mode).toBe("verified");
    expect(r.showScore).toBe(true);
  });

  it("E3 with sources but NO ProductScope → validation_required, never verified", () => {
    const r = capabilityRenderState(vc({
      evidenceGrade: "E3",
      sourceUrls: ["https://docs.openai.com/x"],
      productScopeIds: [],
      dataStatus: "documented",
      sourceDate: "2026-04-01",
    }), { now: FIXED_NOW });
    expect(r.mode).toBe("validation_required");
  });

  it("E2 + sources + ProductScope → documented (not verified)", () => {
    const r = capabilityRenderState(vc({
      evidenceGrade: "E2",
      sourceUrls: ["https://docs.openai.com/x"],
      productScopeIds: ["scope_chatgpt_enterprise"],
      dataStatus: "documented",
      sourceDate: "2026-04-01",
    }), { now: FIXED_NOW });
    expect(r.mode).toBe("documented");
  });

  it("seed score never renders as verified, even if other fields are present", () => {
    const r = capabilityRenderState(vc({
      evidenceGrade: "E5",
      sourceUrls: ["https://docs.openai.com/x"],
      productScopeIds: ["scope_chatgpt_enterprise"],
      isSeedScore: true,
      dataStatus: "seed",
    }), { now: FIXED_NOW });
    expect(r.mode).toBe("seed");
    expect(r.confidence).toBeLessThanOrEqual(50);
  });

  it("dataStatus 'stale' downgrades and reduces confidence", () => {
    const r = capabilityRenderState(vc({
      evidenceGrade: "E4",
      sourceUrls: ["https://x"],
      productScopeIds: ["scope_a"],
      dataStatus: "stale",
      confidenceScore: 92,
    }), { now: FIXED_NOW });
    expect(r.mode).toBe("stale");
    expect(r.confidence).toBeLessThan(92);
  });

  it("disputed dataStatus blocks score render and caps confidence ≤ 40", () => {
    const r = capabilityRenderState(vc({
      evidenceGrade: "E5",
      sourceUrls: ["https://x"],
      productScopeIds: ["scope_a"],
      dataStatus: "disputed",
      confidenceScore: 90,
    }), { now: FIXED_NOW });
    expect(r.mode).toBe("disputed");
    expect(r.showScore).toBe(false);
    expect(r.confidence).toBeLessThanOrEqual(40);
  });

  it("freshness gate fires when sourceDate older than dataStatus horizon", () => {
    const r = capabilityRenderState(vc({
      evidenceGrade: "E4",
      sourceUrls: ["https://x"],
      productScopeIds: ["scope_a"],
      dataStatus: "documented",   // horizon 180d
      sourceDate: "2024-12-01",   // > 180 days before FIXED_NOW (2026-05-10)
      confidenceScore: 88,
    }), { now: FIXED_NOW });
    expect(r.mode).toBe("stale");
  });

  it("missing record → unknown", () => {
    const r = capabilityRenderState(undefined, { now: FIXED_NOW });
    expect(r.mode).toBe("unknown");
    expect(r.showScore).toBe(false);
    expect(r.confidence).toBe(0);
  });

  it("infrastructure-only vendor short-circuits to infrastructure_only mode", () => {
    const r = capabilityRenderState(
      vc({ evidenceGrade: "E5", sourceUrls: ["https://x"], productScopeIds: ["a"], dataStatus: "verified" }),
      { isInfrastructureOnly: true, now: FIXED_NOW },
    );
    expect(r.mode).toBe("infrastructure_only");
    expect(r.showScore).toBe(false);
  });

  it("E1 vendor-claim only with no sources → seed", () => {
    const r = capabilityRenderState(vc({ evidenceGrade: "E1", dataStatus: "seed" }), { now: FIXED_NOW });
    expect(r.mode).toBe("seed");
  });

  it("explicit unknown dataStatus → unknown mode", () => {
    const r = capabilityRenderState(vc({ dataStatus: "unknown" }), { now: FIXED_NOW });
    expect(r.mode).toBe("unknown");
  });

  it("unsupported dataStatus → unknown mode", () => {
    const r = capabilityRenderState(vc({ dataStatus: "unsupported" }), { now: FIXED_NOW });
    expect(r.mode).toBe("unknown");
  });
});

describe("capabilities-truthfulness: infrastructure-only list", () => {
  it("AMD/Broadcom/ASML/Arm/Cerebras/Hebbia/Rogo treated as infrastructure-only", () => {
    expect(isInfrastructureOnlyVendor("vendor_amd")).toBe(true);
    expect(isInfrastructureOnlyVendor("vendor_broadcom")).toBe(true);
    expect(isInfrastructureOnlyVendor("vendor_asml")).toBe(true);
    expect(isInfrastructureOnlyVendor("vendor_arm")).toBe(true);
    expect(isInfrastructureOnlyVendor("vendor_cerebras")).toBe(true);
    expect(isInfrastructureOnlyVendor("vendor_hebbia")).toBe(true);
    expect(isInfrastructureOnlyVendor("vendor_rogo")).toBe(true);
  });
  it("OpenAI / Microsoft / Google are NOT infrastructure-only", () => {
    expect(isInfrastructureOnlyVendor("vendor_openai")).toBe(false);
    expect(isInfrastructureOnlyVendor("vendor_microsoft")).toBe(false);
    expect(isInfrastructureOnlyVendor("vendor_google")).toBe(false);
  });
});

describe("capabilities-truthfulness: overview summary", () => {
  it("counts each mode correctly", () => {
    const states = [
      capabilityRenderState(vc({ evidenceGrade: "E4", sourceUrls: ["https://x"], productScopeIds: ["a"], dataStatus: "documented", sourceDate: "2026-04-01" }), { now: FIXED_NOW }),
      capabilityRenderState(vc({ dataStatus: "seed", isSeedScore: true }), { now: FIXED_NOW }),
      capabilityRenderState(undefined, { now: FIXED_NOW }),
      capabilityRenderState(vc(), { isInfrastructureOnly: true, now: FIXED_NOW }),
    ];
    const overview = summariseCapabilityOverview(2, 2, states);
    expect(overview.cellsTotal).toBe(4);
    expect(overview.cellsVerified).toBe(1);
    expect(overview.cellsSeed).toBe(1);
    expect(overview.cellsUnknown).toBe(1);
    expect(overview.cellsInfrastructureOnly).toBe(1);
  });
});
