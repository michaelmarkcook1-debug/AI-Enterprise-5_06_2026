import { describe, it, expect } from "vitest";
import { classify } from "./IntentBeacon";

describe("IntentBeacon classify — /shared token-leak guard (SEC-001 regression)", () => {
  it("never classifies a /shared/<token> path — must not regress into logging a raw share token", () => {
    expect(classify("/shared/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
    expect(classify("/shared/")).toBeNull();
    expect(classify("/shared")).toBeNull();
  });

  it("still excludes admin and api as before", () => {
    expect(classify("/admin/anything")).toBeNull();
    expect(classify("/api/anything")).toBeNull();
  });

  it("still classifies real public views normally", () => {
    expect(classify("/vendors/openai")).toEqual({ eventType: "vendor_viewed", targetType: "vendor", targetId: "openai" });
    expect(classify("/category/frontier_model_api")).toEqual({
      eventType: "category_browsed",
      targetType: "category",
      targetId: "frontier_model_api",
    });
    expect(classify("/")).toEqual({ eventType: "page_view" });
  });
});
