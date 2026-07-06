import { describe, it, expect } from "vitest";
import { buildFrontierComparison, summarizeFrontierComparison, FRONTIER_VENDOR_IDS } from "./frontier";
import type { LiveModel, LiveModelInventory } from "./live";

function model(vendorId: string, modelName: string, cats: Record<string, number>): LiveModel {
  const categories = Object.entries(cats).map(([category, rating]) => ({ category, rating, voteCount: null }));
  const overall = cats.overall;
  const headline = overall ?? Math.max(...Object.values(cats));
  return {
    modelName,
    vendorId,
    vendorName: vendorId.charAt(0).toUpperCase() + vendorId.slice(1),
    headlineRating: headline,
    headlineCategory: overall !== undefined ? "overall" : "coding",
    categories,
    publishDate: "2026-07-02",
    capturedAt: "2026-07-02T00:00:00.000Z",
    sourceUrl: "https://lmarena.ai/leaderboard",
    source: "lmarena",
  };
}

function inv(models: LiveModel[]): LiveModelInventory {
  return {
    models,
    totalModels: models.length,
    totalVendors: new Set(models.map((m) => m.vendorId)).size,
    freshestPublishDate: "2026-07-02",
    sources: ["lmarena"],
  };
}

describe("buildFrontierComparison — honest, cited, no fabrication", () => {
  it("has exactly the four owner-set vendor columns, in order", () => {
    const c = buildFrontierComparison(inv([]));
    expect(c.columns.map((x) => x.vendorId)).toEqual([...FRONTIER_VENDOR_IDS]);
  });

  it("a vendor with NO benchmark row is an honest absent column, never a fabricated number", () => {
    const c = buildFrontierComparison(
      inv([
        model("openai", "gpt-x", { overall: 1470, coding: 1495 }),
        model("anthropic", "claude-x", { overall: 1501, coding: 1535 }),
        model("google", "gemini-x", { overall: 1482 }),
        // xai deliberately absent
      ]),
    );
    const xai = c.columns.find((x) => x.vendorId === "xai")!;
    expect(xai.present).toBe(false);
    expect(xai.modelName).toBeUndefined();
    expect(xai.overall).toBeUndefined();
    expect(Object.values(xai.ratings)).toEqual([]); // no invented categories
    expect(xai.overallRank).toBeUndefined();
    expect(c.presentCount).toBe(3);
  });

  it("picks each vendor's highest-OVERALL model and shows ONLY that model's categories (never mixes models)", () => {
    // openai has two models: one leads overall, another leads coding. The
    // flagship (top overall) must be chosen and coding must be ITS coding value,
    // not the other model's higher coding score.
    const c = buildFrontierComparison(
      inv([
        model("openai", "flagship", { overall: 1470, coding: 1400 }),
        model("openai", "coding-specialist", { overall: 1200, coding: 1600 }),
        model("anthropic", "claude", { overall: 1501, coding: 1535 }),
      ]),
    );
    const oa = c.columns.find((x) => x.vendorId === "openai")!;
    expect(oa.modelName).toBe("flagship");
    expect(oa.overall).toBe(1470);
    expect(oa.ratings.coding).toBe(1400); // NOT 1600 from the other model
  });

  it("overall rank is 1..N among present columns, by cited Elo", () => {
    const c = buildFrontierComparison(
      inv([
        model("openai", "a", { overall: 1470 }),
        model("anthropic", "b", { overall: 1501 }),
        model("google", "c", { overall: 1482 }),
        model("xai", "d", { overall: 1454 }),
      ]),
    );
    const rankByVendor = Object.fromEntries(c.columns.map((x) => [x.vendorId, x.overallRank]));
    expect(rankByVendor.anthropic).toBe(1);
    expect(rankByVendor.google).toBe(2);
    expect(rankByVendor.openai).toBe(3);
    expect(rankByVendor.xai).toBe(4);
  });

  it("category leaders + leadsCategory reflect the true #1 among the four, from real ratings", () => {
    const c = buildFrontierComparison(
      inv([
        model("openai", "a", { overall: 1470, coding: 1495, vision: 1300 }),
        model("anthropic", "b", { overall: 1501, coding: 1535, vision: 1326 }),
        model("google", "c", { overall: 1482, coding: 1493, vision: 1305 }),
        model("xai", "d", { overall: 1454, coding: 1462, vision: 1260 }),
      ]),
    );
    expect(c.categoryLeaders.overall).toBe("anthropic");
    expect(c.categoryLeaders.coding).toBe("anthropic");
    expect(c.categoryLeaders.vision).toBe("anthropic");
    // anthropic leads all three; the others lead nothing → leadsCategory undefined.
    expect(c.columns.find((x) => x.vendorId === "anthropic")!.leadsCategory).toBe("overall");
    expect(c.columns.find((x) => x.vendorId === "openai")!.leadsCategory).toBeUndefined();
  });

  it("flags (never blends) a category covered only by a DIFFERENT model of the same vendor", () => {
    // Mirrors a real production shape: a vendor's vision-arena leader can be a
    // different model than its text-arena (overall/coding) leader, because
    // vision runs on a separate LMArena arena/config with its own winner.
    const c = buildFrontierComparison(
      inv([
        model("anthropic", "claude-opus-flagship", { overall: 1501, coding: 1535 }), // no vision
        model("anthropic", "claude-vision-specialist", { vision: 1326 }), // different model, real cited vision
      ]),
    );
    const anthropic = c.columns.find((x) => x.vendorId === "anthropic")!;
    expect(anthropic.modelName).toBe("claude-opus-flagship");
    expect(anthropic.ratings.vision).toBeUndefined(); // never blended in from the other model
    expect(anthropic.uncoveredWithOtherModel).toEqual(["vision"]);
  });

  it("does NOT flag a category as 'covered elsewhere' when no model of the vendor has it", () => {
    const c = buildFrontierComparison(inv([model("anthropic", "claude-x", { overall: 1501, coding: 1535 })]));
    const anthropic = c.columns.find((x) => x.vendorId === "anthropic")!;
    expect(anthropic.uncoveredWithOtherModel).toBeUndefined();
  });

  it("carries a real as-of date + cited source url, or null when no data", () => {
    const empty = buildFrontierComparison(inv([]));
    expect(empty.asOf).toBeNull();
    expect(empty.sourceUrl).toBeNull();
    const full = buildFrontierComparison(inv([model("openai", "a", { overall: 1470 })]));
    expect(full.asOf).toBe("2026-07-02");
    expect(full.sourceUrl).toMatch(/^https:\/\/lmarena\.ai/);
  });
});

describe("summarizeFrontierComparison — a derived sentence, no new numbers", () => {
  it("returns null when fewer than two vendors have cited data", () => {
    expect(summarizeFrontierComparison(buildFrontierComparison(inv([])))).toBeNull();
    expect(
      summarizeFrontierComparison(buildFrontierComparison(inv([model("openai", "a", { overall: 1470 })]))),
    ).toBeNull();
  });

  it("names the real leader, its real Elo, the real margin, and categories it actually leads", () => {
    const c = buildFrontierComparison(
      inv([
        model("openai", "gpt-x", { overall: 1470, coding: 1495 }),
        model("anthropic", "claude-x", { overall: 1501, coding: 1535, vision: 1326 }),
        model("google", "gemini-x", { overall: 1482, coding: 1493 }),
      ]),
    );
    const s = summarizeFrontierComparison(c)!;
    expect(s).toContain("Anthropic's claude-x leads overall (1501 Elo)");
    expect(s).toContain("19 points ahead of Google's gemini-x (1482)");
    expect(s).toContain("Coding");
    expect(s).toContain("Vision");
  });

  it("honestly names vendors with no cited data yet, without inventing a score for them", () => {
    const c = buildFrontierComparison(
      inv([
        model("openai", "gpt-x", { overall: 1470 }),
        model("anthropic", "claude-x", { overall: 1501 }),
      ]),
    );
    const s = summarizeFrontierComparison(c)!;
    expect(s).toContain("Google and xAI have no cited benchmark on the tracked leaderboard yet");
  });
});
