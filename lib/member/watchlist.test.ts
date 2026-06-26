import { describe, it, expect } from "vitest";
import { sanitizeWatchlist } from "./watchlist";

describe("sanitizeWatchlist", () => {
  it("drops unknown vendor slugs and keeps valid ones", () => {
    const out = sanitizeWatchlist({ vendors: ["openai", "not-a-real-vendor", "anthropic"] });
    expect(out.vendors).toContain("openai");
    expect(out.vendors).toContain("anthropic");
    expect(out.vendors).not.toContain("not-a-real-vendor");
  });

  it("dedupes within a list", () => {
    expect(sanitizeWatchlist({ vendors: ["openai", "openai"] }).vendors).toEqual(["openai"]);
  });

  it("validates categories and use-cases against their taxonomies", () => {
    const out = sanitizeWatchlist({
      categories: ["frontier_model_api", "bogus_category"],
      useCases: ["knowledge_assistant", "not_a_use_case"],
    });
    expect(out.categories).toEqual(["frontier_model_api"]);
    expect(out.useCases).toEqual(["knowledge_assistant"]);
  });

  it("ignores non-array and non-string input safely", () => {
    expect(sanitizeWatchlist({ vendors: "openai" }).vendors).toEqual([]);
    expect(sanitizeWatchlist(null)).toEqual({ vendors: [], categories: [], useCases: [], currentStack: [] });
    expect(sanitizeWatchlist({ vendors: [123, "openai", null] }).vendors).toEqual(["openai"]);
  });

  it("currentStack uses the vendor taxonomy too", () => {
    const out = sanitizeWatchlist({ currentStack: ["anthropic", "ghost-vendor"] });
    expect(out.currentStack).toEqual(["anthropic"]);
  });
});
