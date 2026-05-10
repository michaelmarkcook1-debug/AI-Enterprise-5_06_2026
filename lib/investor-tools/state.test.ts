import { describe, it, expect } from "vitest";
import {
  EMPTY_STATE,
  STATE_VERSION,
  addToWatchlist,
  removeFromWatchlist,
  recordProviderView,
  setSimulatorInput,
  patchSimulatorInput,
  savePortfolio,
  loadPortfolio,
  deletePortfolio,
} from "./state";

describe("InvestorState", () => {
  it("EMPTY_STATE has the current version", () => {
    expect(EMPTY_STATE.version).toBe(STATE_VERSION);
  });

  it("addToWatchlist is idempotent", () => {
    const a = addToWatchlist(EMPTY_STATE, "vendor_openai");
    const b = addToWatchlist(a, "vendor_openai");
    expect(a.watchlist).toEqual(["vendor_openai"]);
    expect(b.watchlist).toEqual(["vendor_openai"]);
  });

  it("removeFromWatchlist removes only the named provider", () => {
    const a = addToWatchlist(addToWatchlist(EMPTY_STATE, "vendor_openai"), "vendor_microsoft");
    const b = removeFromWatchlist(a, "vendor_openai");
    expect(b.watchlist).toEqual(["vendor_microsoft"]);
  });

  it("recordProviderView puts most-recent first and dedupes", () => {
    let s = recordProviderView(EMPTY_STATE, "a");
    s = recordProviderView(s, "b");
    s = recordProviderView(s, "a");
    expect(s.recentlyViewedProviderIds).toEqual(["a", "b"]);
    expect(s.focusProviderId).toBe("a");
  });

  it("recordProviderView caps at MAX_RECENT (12)", () => {
    let s = EMPTY_STATE;
    for (let i = 0; i < 20; i++) s = recordProviderView(s, `v${i}`);
    expect(s.recentlyViewedProviderIds.length).toBe(12);
    expect(s.recentlyViewedProviderIds[0]).toBe("v19");
  });

  it("setSimulatorInput overwrites; patchSimulatorInput merges", () => {
    const a = setSimulatorInput(EMPTY_STATE, { startingCapital: 10_000, horizonYears: 5 });
    expect(a.simulatorInput).toEqual({ startingCapital: 10_000, horizonYears: 5 });
    const b = patchSimulatorInput(a, { horizonYears: 10 });
    expect(b.simulatorInput).toEqual({ startingCapital: 10_000, horizonYears: 10 });
  });

  it("save/load/delete portfolio round-trips simulator input", () => {
    const seeded = setSimulatorInput(EMPTY_STATE, { startingCapital: 25_000, horizonYears: 3, riskProfile: "balanced" });
    const saved = savePortfolio(seeded, "Balanced 25k");
    expect(saved.savedPortfolios.length).toBe(1);
    const loaded = loadPortfolio(setSimulatorInput(saved, {}), saved.savedPortfolios[0].id);
    expect(loaded.simulatorInput.startingCapital).toBe(25_000);
    const removed = deletePortfolio(saved, saved.savedPortfolios[0].id);
    expect(removed.savedPortfolios.length).toBe(0);
  });

  it("every mutator updates lastUpdatedAt", () => {
    const a = addToWatchlist(EMPTY_STATE, "x");
    expect(new Date(a.lastUpdatedAt).getTime()).toBeGreaterThan(new Date(EMPTY_STATE.lastUpdatedAt).getTime());
  });
});
