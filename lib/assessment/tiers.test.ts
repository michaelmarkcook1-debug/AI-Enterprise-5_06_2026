import { describe, expect, it } from "vitest";
import { isAssessmentTier, parseTier, DEFAULT_TIER, TIERS } from "./tiers";

describe("assessment tiers", () => {
  it("exposes three tiers in display order: quick, guided, advanced", () => {
    expect(TIERS.map((t) => t.id)).toEqual(["quick", "guided", "advanced"]);
  });

  it("isAssessmentTier accepts the three valid ids", () => {
    expect(isAssessmentTier("quick")).toBe(true);
    expect(isAssessmentTier("guided")).toBe(true);
    expect(isAssessmentTier("advanced")).toBe(true);
  });

  it("isAssessmentTier rejects anything else", () => {
    expect(isAssessmentTier("Quick")).toBe(false);
    expect(isAssessmentTier("expert")).toBe(false);
    expect(isAssessmentTier("")).toBe(false);
    expect(isAssessmentTier(null)).toBe(false);
    expect(isAssessmentTier(undefined)).toBe(false);
    expect(isAssessmentTier(0)).toBe(false);
  });

  it("parseTier defaults to quick when input is missing or invalid", () => {
    expect(parseTier(null)).toBe(DEFAULT_TIER);
    expect(parseTier(undefined)).toBe(DEFAULT_TIER);
    expect(parseTier("")).toBe(DEFAULT_TIER);
    expect(parseTier("bogus")).toBe(DEFAULT_TIER);
  });

  it("parseTier preserves a valid tier id", () => {
    expect(parseTier("quick")).toBe("quick");
    expect(parseTier("guided")).toBe("guided");
    expect(parseTier("advanced")).toBe("advanced");
  });

  it("DEFAULT_TIER is quick — preserves existing assessment behaviour", () => {
    expect(DEFAULT_TIER).toBe("quick");
  });
});
