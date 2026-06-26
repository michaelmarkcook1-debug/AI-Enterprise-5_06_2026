import { describe, it, expect, vi, beforeEach } from "vitest";

// buildMonitor gates ranking moves + graph alerts on live provenance (STRICT:
// no seed/hardcoded figures unless backed by verified evidence). Mock it so we
// can exercise both the live and not-live paths deterministically.
vi.mock("../intelligence/provenance", () => ({ isLiveData: vi.fn() }));

import { buildMonitor } from "./monitor";
import { isLiveData } from "../intelligence/provenance";

const live = isLiveData as unknown as ReturnType<typeof vi.fn>;
const EMPTY = { vendors: [], categories: [], useCases: [], currentStack: [] };

describe("buildMonitor", () => {
  beforeEach(() => live.mockReset());

  it("empty watchlist → honest empty (no items, no signal)", async () => {
    live.mockResolvedValue(true);
    const m = await buildMonitor(EMPTY);
    expect(m.hasItems).toBe(false);
    expect(m.hasSignal).toBe(false);
    expect(m.rankingMoves).toEqual([]);
    expect(m.graphAlerts).toEqual([]);
    expect(m.news).toEqual([]);
  });

  it("LIVE: composes a SCOPED signal for a saved vendor + category", async () => {
    live.mockResolvedValue(true);
    const m = await buildMonitor({ ...EMPTY, vendors: ["anthropic"], categories: ["frontier_model_api"] });
    expect(m.hasItems).toBe(true);
    expect(m.isLive).toBe(true);
    expect(m.savedVendors.map((v) => v.slug)).toContain("anthropic");
    expect(m.savedCategories.map((c) => c.id)).toContain("frontier_model_api");

    // Every ranking move must touch a SAVED vendor or a SAVED category (no leakage).
    for (const mv of m.rankingMoves) {
      expect(mv.vendorSlug === "anthropic" || mv.categoryId === "frontier_model_api").toBe(true);
    }
    // With live evidence, moves + graph alerts compose real signal.
    expect(m.hasSignal).toBe(true);
  });

  it("STRICT (not live): saved items but moves + alerts are HELD — no seed signal", async () => {
    live.mockResolvedValue(false);
    const m = await buildMonitor({ ...EMPTY, vendors: ["anthropic"], categories: ["frontier_model_api"] });
    expect(m.hasItems).toBe(true);
    expect(m.isLive).toBe(false);
    // No seed/hardcoded figures surfaced when there's no verified evidence.
    expect(m.rankingMoves).toEqual([]);
    expect(m.graphAlerts).toEqual([]);
    // Only real-gated news could create signal; there is none in tests → none.
    expect(m.hasSignal).toBe(false);
  });

  it("LIVE: does not surface signal for vendors the user did NOT save", async () => {
    live.mockResolvedValue(true);
    const m = await buildMonitor({ ...EMPTY, vendors: ["anthropic"] });
    for (const mv of m.rankingMoves) {
      expect(mv.vendorSlug).toBe("anthropic");
    }
  });
});
