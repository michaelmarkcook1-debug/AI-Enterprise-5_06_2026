import { describe, it, expect } from "vitest";
import { isSeedSignedSource } from "./provenance";

describe("isSeedSignedSource — robust seed/mock detector", () => {
  it("flags BOTH confirmed prod seed variants (self-attributed to AI Enterprise)", () => {
    expect(isSeedSignedSource("AI Enterprise analyst triangulation (Menlo/Ramp-style enterprise-spend + product-signal proxies)")).toBe(true);
    expect(isSeedSignedSource("AI Enterprise seed data (mock market model)")).toBe(true);
  });

  it("flags any explicit seed/mock marker regardless of attribution", () => {
    expect(isSeedSignedSource("Some seed estimate")).toBe(true);
    expect(isSeedSignedSource("mock market model")).toBe(true);
    expect(isSeedSignedSource("AI ENTERPRISE ...")).toBe(true); // case-insensitive
  });

  it("treats EXTERNAL-cited sources as real (not seed)", () => {
    expect(isSeedSignedSource("Menlo Ventures 2026 State of Enterprise AI report")).toBe(false);
    expect(isSeedSignedSource("SEC 10-K filing, FY2026")).toBe(false);
    expect(isSeedSignedSource("https://example.com/market-report")).toBe(false);
  });

  it("handles null/undefined safely", () => {
    expect(isSeedSignedSource(null)).toBe(false);
    expect(isSeedSignedSource(undefined)).toBe(false);
  });
});
