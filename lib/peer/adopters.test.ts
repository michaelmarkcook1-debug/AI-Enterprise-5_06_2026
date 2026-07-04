import { describe, it, expect } from "vitest";
import { disclosedAdoptersOf } from "./adopters";
import { PEER_COMPANIES } from "./peer-adoption-data";

describe("disclosedAdoptersOf", () => {
  it("returns only peers whose platform_integration cites the vendor, with citations", () => {
    const adopters = disclosedAdoptersOf("openai");
    expect(adopters.length).toBeGreaterThan(0);
    for (const a of adopters) {
      expect(a.citations.length).toBeGreaterThan(0);
      const company = PEER_COMPANIES.find((c) => c.id === a.company.id)!;
      const sig = company.signals.find((s) => s.kind === "platform_integration")!;
      expect(sig.vendorIds ?? []).toContain("openai");
      expect(sig.status).not.toBe("not_disclosed");
    }
  });

  it("accepts the vendor_ prefixed form (normalised to bare)", () => {
    expect(disclosedAdoptersOf("vendor_openai")).toEqual(disclosedAdoptersOf("openai"));
  });

  it("unknown vendor → empty (absence is honest, never invented)", () => {
    expect(disclosedAdoptersOf("not-a-vendor")).toEqual([]);
  });

  it("never surfaces a not_disclosed signal as an adoption", () => {
    // Every returned adopter must map to a disclosed/inferred signal by construction.
    for (const c of PEER_COMPANIES) {
      const s = c.signals.find((x) => x.kind === "platform_integration")!;
      if (s.status !== "not_disclosed") continue;
      for (const v of s.vendorIds ?? []) {
        const hit = disclosedAdoptersOf(v).find((a) => a.company.id === c.id);
        expect(hit, `${c.id} should never appear for ${v}`).toBeUndefined();
      }
    }
  });
});
