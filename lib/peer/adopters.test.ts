import { describe, it, expect } from "vitest";
import { disclosedAdoptersOf } from "./adopters";
import { PEER_COMPANIES } from "./peer-adoption-data";

describe("disclosedAdoptersOf", () => {
  it("returns only peers whose platform_integration cites the vendor, cited or explicitly pending", () => {
    const adopters = disclosedAdoptersOf("openai");
    expect(adopters.length).toBeGreaterThan(0);
    for (const a of adopters) {
      const company = PEER_COMPANIES.find((c) => c.id === a.company.id)!;
      const sig = company.signals.find((s) => s.kind === "platform_integration")!;
      expect(sig.vendorIds ?? []).toContain("openai");
      expect(sig.status).toBe("disclosed");
      // Citations are optional (owner ruling 2026-07-04). An entry with ZERO
      // citations must be EXPLICITLY labelled pending_enrichment — an empty
      // citations array can never pass silently as "fully sourced".
      if (a.citations.length === 0) {
        expect(a.citationStatus, `${a.company.id} has no citations but no pending_enrichment label`).toBe(
          "pending_enrichment",
        );
      } else {
        expect(a.citationStatus, `${a.company.id} has citations but is still labelled pending`).toBeUndefined();
      }
    }
  });

  it("every adopter, for every vendor, has status disclosed — inferred can NEVER pass as disclosure", () => {
    const allVendorIds = new Set(
      PEER_COMPANIES.flatMap((c) => c.signals.flatMap((s) => s.vendorIds ?? [])),
    );
    for (const v of allVendorIds) {
      for (const a of disclosedAdoptersOf(v)) {
        expect(a.status, `${a.company.id} for ${v}`).toBe("disclosed");
      }
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
