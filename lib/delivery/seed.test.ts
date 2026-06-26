import { describe, it, expect } from "vitest";
import {
  DELIVERY_PARTNERS,
  DELIVERY_PARTNERSHIPS,
  DELIVERY_PARTNERSHIP_VENDOR_IDS,
  PARTNERSHIP_SOURCE,
} from "./seed";
import { INTELLIGENCE_VENDORS } from "../intelligence/seed";

const VALID_VENDOR_IDS = new Set(INTELLIGENCE_VENDORS.map((v) => v.id));
const PARTNER_IDS = new Set(DELIVERY_PARTNERS.map((p) => p.id));

describe("delivery-partnership seed honesty", () => {
  it("FK-validity: every referenced AI vendor id is a real vendor (no dangling FK)", () => {
    for (const vendorId of DELIVERY_PARTNERSHIP_VENDOR_IDS) {
      expect(VALID_VENDOR_IDS.has(vendorId), `unknown vendor id: ${vendorId}`).toBe(true);
    }
  });

  it("FK-validity: every partnership resolves to a known delivery partner", () => {
    for (const p of DELIVERY_PARTNERSHIPS) {
      expect(PARTNER_IDS.has(p.deliveryPartnerId), `unknown partner: ${p.deliveryPartnerId}`).toBe(true);
    }
  });

  it("preserves all three partnership tiers (never merged to a single grade)", () => {
    const tiers = new Set(DELIVERY_PARTNERSHIPS.map((p) => p.partnershipTier));
    expect(tiers.has("direct_named")).toBe(true);
    expect(tiers.has("cloud_certified")).toBe(true);
    expect(tiers.has("observed_implementer")).toBe(true);
  });

  it("every partnership carries tier + evidence + provenance + source", () => {
    for (const p of DELIVERY_PARTNERSHIPS) {
      expect(p.partnershipTier).toBeTruthy();
      expect(p.evidenceTier).toBeTruthy();
      // Seed rows are analyst-curated until a real cited item upgrades them.
      expect(p.provenance).toBe("analyst_curated_seed");
      expect(p.source).toBe(PARTNERSHIP_SOURCE);
    }
  });

  it("honest absence: xAI has NO delivery edges (no SI channel evidenced)", () => {
    expect(DELIVERY_PARTNERSHIPS.some((p) => p.aiVendorId === "xai")).toBe(false);
  });

  it("firewall: a partnership row carries no vendor-score field", () => {
    const scoreKeys = ["overallScore", "capabilityScore", "confidenceScore", "score", "estimatedShare"];
    for (const p of DELIVERY_PARTNERSHIPS) {
      for (const k of scoreKeys) {
        expect(Object.prototype.hasOwnProperty.call(p, k), `unexpected score field ${k}`).toBe(false);
      }
    }
  });
});
