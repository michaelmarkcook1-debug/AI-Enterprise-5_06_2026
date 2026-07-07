import { describe, it, expect } from "vitest";
import { sanitizeExpiryDays, sanitizeDisplayName } from "./decision-shares";

describe("sanitizeExpiryDays", () => {
  it("accepts the three allowed values", () => {
    expect(sanitizeExpiryDays(7)).toBe(7);
    expect(sanitizeExpiryDays(30)).toBe(30);
    expect(sanitizeExpiryDays(90)).toBe(90);
  });

  it("falls back to the 30-day default for anything else — never trusts an arbitrary caller-supplied window", () => {
    expect(sanitizeExpiryDays(1)).toBe(30);
    expect(sanitizeExpiryDays(365)).toBe(30);
    expect(sanitizeExpiryDays(0)).toBe(30);
    expect(sanitizeExpiryDays(-30)).toBe(30);
    expect(sanitizeExpiryDays("30")).toBe(30);
    expect(sanitizeExpiryDays("not-a-number")).toBe(30);
    expect(sanitizeExpiryDays(undefined)).toBe(30);
    expect(sanitizeExpiryDays(null)).toBe(30);
  });
});

describe("sanitizeDisplayName", () => {
  it("trims and caps length", () => {
    expect(sanitizeDisplayName("  procurement team  ")).toBe("procurement team");
    expect(sanitizeDisplayName("x".repeat(200))?.length).toBe(80);
  });

  it("blank or non-string input never becomes a fallback identity — always null", () => {
    expect(sanitizeDisplayName("")).toBeNull();
    expect(sanitizeDisplayName("   ")).toBeNull();
    expect(sanitizeDisplayName(undefined)).toBeNull();
    expect(sanitizeDisplayName(null)).toBeNull();
    expect(sanitizeDisplayName(42)).toBeNull();
  });
});
