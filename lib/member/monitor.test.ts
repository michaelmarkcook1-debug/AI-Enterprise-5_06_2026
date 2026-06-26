import { describe, it, expect } from "vitest";
import { buildMonitor } from "./monitor";

const EMPTY = { vendors: [], categories: [], useCases: [], currentStack: [] };

describe("buildMonitor", () => {
  it("empty watchlist → honest empty (no items, no signal)", async () => {
    const m = await buildMonitor(EMPTY);
    expect(m.hasItems).toBe(false);
    expect(m.hasSignal).toBe(false);
    expect(m.rankingMoves).toEqual([]);
    expect(m.graphAlerts).toEqual([]);
    expect(m.news).toEqual([]);
  });

  it("composes a SCOPED signal for a saved vendor + category from cached data", async () => {
    const m = await buildMonitor({ ...EMPTY, vendors: ["anthropic"], categories: ["frontier_model_api"] });
    expect(m.hasItems).toBe(true);
    expect(m.savedVendors.map((v) => v.slug)).toContain("anthropic");
    expect(m.savedCategories.map((c) => c.id)).toContain("frontier_model_api");

    // Every ranking move must touch a SAVED vendor or a SAVED category (no leakage).
    for (const mv of m.rankingMoves) {
      expect(mv.vendorSlug === "anthropic" || mv.categoryId === "frontier_model_api").toBe(true);
    }
    // Graph alerts + moves come from cached/static data, so there's real signal.
    expect(m.hasSignal).toBe(true);
  });

  it("does not surface signal for vendors the user did NOT save", async () => {
    const m = await buildMonitor({ ...EMPTY, vendors: ["anthropic"] });
    // A move for an unsaved vendor in an unsaved category must not appear.
    for (const mv of m.rankingMoves) {
      expect(mv.vendorSlug).toBe("anthropic");
    }
  });
});
