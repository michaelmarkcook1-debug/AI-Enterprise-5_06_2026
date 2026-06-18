// Regression tests for the 2026-06-18 P1 audit fixes (valuations).
// Guards against the fabricated index-based market caps (NVDA "540" / MSFT "120")
// the audit flagged — real caps must be in the right order of magnitude.
import { describe, it, expect } from "vitest";
import { VALUATION_METRICS } from "./investing/seed";
import { INTELLIGENCE_VENDORS, MARKET_SHARE_ESTIMATES } from "./intelligence/seed";

describe("P1 audit — public market caps are real ($B), not index placeholders", () => {
  const cap = (providerId: string) =>
    VALUATION_METRICS.find((v) => v.providerId === providerId)?.marketCap ?? 0;

  it("puts the trillion-dollar names above $1T", () => {
    expect(cap("nvda")).toBeGreaterThan(1000); // $B
    expect(cap("msft")).toBeGreaterThan(1000);
    expect(cap("googl")).toBeGreaterThan(1000);
  });

  it("ranks NVIDIA as the most valuable (it is, mid-2026)", () => {
    expect(cap("nvda")).toBeGreaterThan(cap("msft"));
  });

  it("does NOT use the old 120 + index*140 placeholder (NVDA was '540')", () => {
    expect(cap("nvda")).not.toBe(540);
    expect(cap("msft")).not.toBe(120);
  });
});

describe("P1 audit — newly-added specialist vendors are tracked with share", () => {
  const has = (id: string) => INTELLIGENCE_VENDORS.some((v) => v.id === id);
  const hasShare = (id: string) => MARKET_SHARE_ESTIMATES.some((s) => s.vendorId === id);

  it("adds Cursor, Sierra, and Abridge to the vendor universe", () => {
    expect(has("cursor")).toBe(true);
    expect(has("sierra")).toBe(true);
    expect(has("abridge")).toBe(true);
  });

  it("gives previously share-less tracked vendors a category share row", () => {
    // Audit flagged these as having vendor rows but no market-share entry.
    for (const id of ["sierra", "abridge", "zai", "minimax"]) {
      expect(hasShare(id)).toBe(true);
    }
  });
});
