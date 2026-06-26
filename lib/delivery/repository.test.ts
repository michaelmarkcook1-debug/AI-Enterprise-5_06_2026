import { describe, it, expect } from "vitest";
import { getDeliveryPartnershipsForVendor, getDeliveryReachByVendor } from "./repository";

// No DB in the test env → these exercise the in-memory curated-seed fallback path.
const TIER_RANK: Record<string, number> = { direct_named: 0, cloud_certified: 1, observed_implementer: 2 };

describe("delivery repository (seed fallback, no DB)", () => {
  it("returns active partnerships for a vendor, tier-sorted, every row carrying provenance + source", async () => {
    const rows = await getDeliveryPartnershipsForVendor("openai");
    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) {
      expect(TIER_RANK[rows[i].partnershipTier]).toBeGreaterThanOrEqual(TIER_RANK[rows[i - 1].partnershipTier]);
    }
    for (const r of rows) {
      expect(r.provenance).toBe("analyst_curated_seed");
      expect(r.source).toBeTruthy();
      expect(r.endedAt).toBeNull(); // active read excludes ended rows
    }
  });

  it("honest absence: xAI has no partnerships (no SI channel evidenced)", async () => {
    const rows = await getDeliveryPartnershipsForVendor("xai");
    expect(rows).toHaveLength(0);
  });

  it("computes delivery reach per vendor; xAI absent; reach is positive for evidenced vendors", async () => {
    const reach = await getDeliveryReachByVendor();
    const openai = reach.get("openai");
    expect(openai).toBeDefined();
    expect(openai!.distinctPartners).toBeGreaterThan(0);
    expect(openai!.reachRaw).toBeGreaterThan(0);
    expect(openai!.newsConfirmed).toBe(0); // seed path → none news-confirmed
    expect(reach.get("xai")).toBeUndefined(); // honest absence, never floated at 0
  });
});
