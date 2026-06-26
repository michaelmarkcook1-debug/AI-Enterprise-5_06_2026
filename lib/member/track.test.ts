import { describe, it, expect } from "vitest";
import { parseTrackItem, safeReturnTo, trackItemLabel } from "./track";

describe("parseTrackItem", () => {
  it("parses valid vendor + category tokens against the real taxonomies", () => {
    expect(parseTrackItem("vendor:openai")).toEqual({ field: "vendors", id: "openai" });
    expect(parseTrackItem("category:frontier_model_api")).toEqual({ field: "categories", id: "frontier_model_api" });
  });
  it("rejects unknown ids, bad prefixes, and junk", () => {
    expect(parseTrackItem("vendor:not-a-real-vendor")).toBeNull();
    expect(parseTrackItem("category:nope")).toBeNull();
    expect(parseTrackItem("foo:openai")).toBeNull();
    expect(parseTrackItem("openai")).toBeNull();
    expect(parseTrackItem("")).toBeNull();
    expect(parseTrackItem(123)).toBeNull();
    expect(parseTrackItem(null)).toBeNull();
  });
});

describe("safeReturnTo (open-redirect guard)", () => {
  it("allows same-site relative paths", () => {
    expect(safeReturnTo("/vendors/anthropic")).toBe("/vendors/anthropic");
    expect(safeReturnTo("/category/ai_silicon?x=1")).toBe("/category/ai_silicon?x=1");
  });
  it("rejects off-site / protocol-relative / scheme targets → /watchlist", () => {
    expect(safeReturnTo("//evil.com")).toBe("/monitor");
    expect(safeReturnTo("https://evil.com")).toBe("/monitor");
    expect(safeReturnTo("/\\evil.com")).toBe("/monitor");
    expect(safeReturnTo("javascript:alert(1)")).toBe("/monitor");
    expect(safeReturnTo(null)).toBe("/monitor");
    expect(safeReturnTo(undefined)).toBe("/monitor");
  });
});

describe("trackItemLabel", () => {
  it("resolves display names for valid items, null otherwise", () => {
    expect(trackItemLabel("vendor:openai")).toMatch(/OpenAI/i);
    expect(trackItemLabel("category:frontier_model_api")).toBeTruthy();
    expect(trackItemLabel("vendor:nope")).toBeNull();
  });
});
