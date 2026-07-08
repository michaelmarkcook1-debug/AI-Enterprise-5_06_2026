import { describe, it, expect } from "vitest";
import { buildFrontierComparison, summarizeFrontierComparison, FRONTIER_VENDOR_IDS } from "./frontier";
import type { LiveModel, LiveModelInventory } from "./live";

function model(vendorId: string, modelName: string, cats: Record<string, number>): LiveModel {
  const categories = Object.entries(cats).map(([category, rating]) => ({ category, rating, voteCount: null }));
  const intelligence = cats.intelligence;
  const headline = intelligence ?? Math.max(...Object.values(cats));
  return {
    modelName,
    vendorId,
    vendorName: vendorId.charAt(0).toUpperCase() + vendorId.slice(1),
    headlineRating: headline,
    headlineCategory: intelligence !== undefined ? "intelligence" : "coding",
    categories,
    publishDate: "2026-07-02",
    capturedAt: "2026-07-02T00:00:00.000Z",
    sourceUrl: "https://artificialanalysis.ai/models",
    source: "artificial_analysis",
  };
}

function inv(models: LiveModel[]): LiveModelInventory {
  return {
    models,
    totalModels: models.length,
    totalVendors: new Set(models.map((m) => m.vendorId)).size,
    freshestPublishDate: "2026-07-02",
    sources: ["artificial_analysis"],
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
        model("openai", "gpt-x", { intelligence: 55, coding: 58 }),
        model("anthropic", "claude-x", { intelligence: 60, coding: 62 }),
        model("google", "gemini-x", { intelligence: 53 }),
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

  it("picks each vendor's highest-INTELLIGENCE-INDEX model and shows ONLY that model's categories (never mixes models)", () => {
    // openai has two models: one leads intelligence, another leads coding. The
    // flagship (top intelligence) must be chosen and coding must be ITS coding
    // value, not the other model's higher coding score.
    const c = buildFrontierComparison(
      inv([
        model("openai", "flagship", { intelligence: 50, coding: 45 }),
        model("openai", "coding-specialist", { intelligence: 30, coding: 62 }),
        model("anthropic", "claude", { intelligence: 60, coding: 62 }),
      ]),
    );
    const oa = c.columns.find((x) => x.vendorId === "openai")!;
    expect(oa.modelName).toBe("flagship");
    expect(oa.overall).toBe(50);
    expect(oa.ratings.coding).toBe(45); // NOT 62 from the other model
  });

  it("overall rank is 1..N among present columns, by cited Intelligence Index", () => {
    const c = buildFrontierComparison(
      inv([
        model("openai", "a", { intelligence: 55 }),
        model("anthropic", "b", { intelligence: 60 }),
        model("google", "c", { intelligence: 53 }),
        model("xai", "d", { intelligence: 44 }),
      ]),
    );
    const rankByVendor = Object.fromEntries(c.columns.map((x) => [x.vendorId, x.overallRank]));
    expect(rankByVendor.anthropic).toBe(1);
    expect(rankByVendor.openai).toBe(2);
    expect(rankByVendor.google).toBe(3);
    expect(rankByVendor.xai).toBe(4);
  });

  it("category leaders + leadsCategory reflect the true #1 among the four, from real ratings", () => {
    const c = buildFrontierComparison(
      inv([
        model("openai", "a", { intelligence: 55, coding: 58, agentic: 50 }),
        model("anthropic", "b", { intelligence: 60, coding: 62, agentic: 60 }),
        model("google", "c", { intelligence: 53, coding: 54, agentic: 48 }),
        model("xai", "d", { intelligence: 44, coding: 45, agentic: 40 }),
      ]),
    );
    expect(c.categoryLeaders.intelligence).toBe("anthropic");
    expect(c.categoryLeaders.coding).toBe("anthropic");
    expect(c.categoryLeaders.agentic).toBe("anthropic");
    // anthropic leads all three; the others lead nothing → leadsCategory undefined.
    expect(c.columns.find((x) => x.vendorId === "anthropic")!.leadsCategory).toBe("intelligence");
    expect(c.columns.find((x) => x.vendorId === "openai")!.leadsCategory).toBeUndefined();
  });

  it("flags (never blends) a category covered only by a DIFFERENT model of the same vendor", () => {
    // A vendor's flagship may lack an Agentic Index while another of its
    // tracked models does carry one (partial coverage per model).
    const c = buildFrontierComparison(
      inv([
        model("anthropic", "claude-opus-flagship", { intelligence: 60, coding: 62 }), // no agentic
        model("anthropic", "claude-agentic-variant", { agentic: 58 }), // different model, real cited agentic
      ]),
    );
    const anthropic = c.columns.find((x) => x.vendorId === "anthropic")!;
    expect(anthropic.modelName).toBe("claude-opus-flagship");
    expect(anthropic.ratings.agentic).toBeUndefined(); // never blended in from the other model
    expect(anthropic.uncoveredWithOtherModel).toEqual(["agentic"]);
  });

  it("does NOT flag a category as 'covered elsewhere' when no model of the vendor has it", () => {
    const c = buildFrontierComparison(inv([model("anthropic", "claude-x", { intelligence: 60, coding: 62 })]));
    const anthropic = c.columns.find((x) => x.vendorId === "anthropic")!;
    expect(anthropic.uncoveredWithOtherModel).toBeUndefined();
  });

  it("carries a real as-of date + cited source url, or null when no data", () => {
    const empty = buildFrontierComparison(inv([]));
    expect(empty.asOf).toBeNull();
    expect(empty.sourceUrl).toBeNull();
    const full = buildFrontierComparison(inv([model("openai", "a", { intelligence: 55 })]));
    expect(full.asOf).toBe("2026-07-02");
    expect(full.sourceUrl).toMatch(/^https:\/\/artificialanalysis\.ai/);
  });
});

describe("summarizeFrontierComparison — a derived sentence, no new numbers", () => {
  it("returns null when fewer than two vendors have cited data", () => {
    expect(summarizeFrontierComparison(buildFrontierComparison(inv([])))).toBeNull();
    expect(
      summarizeFrontierComparison(buildFrontierComparison(inv([model("openai", "a", { intelligence: 55 })]))),
    ).toBeNull();
  });

  it("names the real leader, its real index, the real margin, and categories it actually leads", () => {
    const c = buildFrontierComparison(
      inv([
        model("openai", "gpt-x", { intelligence: 55, coding: 58 }),
        model("anthropic", "claude-x", { intelligence: 60, coding: 62, agentic: 60 }),
        model("google", "gemini-x", { intelligence: 53, coding: 54 }),
      ]),
    );
    const s = summarizeFrontierComparison(c)!;
    expect(s).toContain("Anthropic's claude-x leads on Intelligence Index (60.0)");
    expect(s).toContain("5 points ahead of Openai's gpt-x (55.0)"); // 55 (OpenAI) > 53 (Google) → real runner-up
    expect(s).toContain("Coding");
    expect(s).toContain("Agentic");
  });

  it("honestly names vendors with no cited data yet, without inventing a score for them", () => {
    const c = buildFrontierComparison(
      inv([
        model("openai", "gpt-x", { intelligence: 55 }),
        model("anthropic", "claude-x", { intelligence: 60 }),
      ]),
    );
    const s = summarizeFrontierComparison(c)!;
    expect(s).toContain("Google and xAI have no cited benchmark on the tracked leaderboard yet");
  });
});
