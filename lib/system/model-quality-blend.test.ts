import { describe, it, expect } from "vitest";
import { blendModelQuality, normalizeIndex, normalizeIntelligence, MODEL_QUALITY_CAP, type MqIndexRow } from "./model-quality-blend";

const SRC = "https://artificialanalysis.ai/models";
const rows = (overrides: Partial<Record<"intelligence" | "coding" | "agentic", number | null>> = {}): MqIndexRow[] => {
  const vals = { intelligence: 55.7, coding: 74.3, agentic: 47.2, ...overrides };
  return (Object.entries(vals) as ["intelligence" | "coding" | "agentic", number | null][])
    .filter(([, v]) => v != null)
    .map(([category, rating]) => ({ category, rating: rating as number, modelName: `best-${category}-model`, sourceUrl: SRC }));
};

describe("normalizeIndex — per-category fixed windows", () => {
  it("clamps to [0,1] outside each window and is monotonic", () => {
    expect(normalizeIndex("intelligence", -100)).toBe(0);
    expect(normalizeIndex("intelligence", 1000)).toBe(1);
    expect(normalizeIndex("coding", 50)).toBeGreaterThan(normalizeIndex("coding", 30));
  });

  it("each index normalises on ITS OWN scale — a frontier coding value doesn't clamp to 1 in its own window", () => {
    // Verified live 2026-07-08: coding tops at 76.5 (vs intelligence 59.9) —
    // in the intelligence window 76.5 would read a misleading 100%.
    expect(normalizeIndex("coding", 76.5)).toBeLessThan(1);
    expect(normalizeIntelligence(76.5)).toBe(1); // the wrong window would clamp
  });
});

describe("blendModelQuality — one driver index per score", () => {
  it("defaults to the intelligence driver and returns null without an intelligence row", () => {
    expect(blendModelQuality(rows({ intelligence: null }))).toBeNull();
    const r = blendModelQuality(rows())!;
    expect(r.driver).toBe("intelligence");
  });

  it("coding driver: scores from the coding row, null without one — never inferred from intelligence", () => {
    expect(blendModelQuality(rows({ coding: null }), "coding")).toBeNull();
    const r = blendModelQuality(rows(), "coding")!;
    expect(r.driver).toBe("coding");
    expect(r.normalized).toBeCloseTo(normalizeIndex("coding", 74.3), 9);
    expect(r.contributions.find((c) => c.category === "coding")?.weight).toBe(1);
    expect(r.contributions.find((c) => c.category === "intelligence")?.weight).toBe(0);
  });

  it("non-driver indices never change the score — informational context only", () => {
    const withExtras = blendModelQuality(rows({ coding: 99, agentic: 99 }))!;
    const withoutExtras = blendModelQuality(rows({ coding: null, agentic: null }))!;
    expect(withExtras.score).toBe(withoutExtras.score);
  });

  it("never exceeds the E4 cap even at an extreme index", () => {
    const r = blendModelQuality(rows({ intelligence: 9999 }))!;
    expect(r.score).toBeCloseTo(MODEL_QUALITY_CAP, 5);
  });

  it("a higher driver index outranks a lower one, per driver", () => {
    expect(blendModelQuality(rows({ intelligence: 56 }))!.score).toBeGreaterThan(blendModelQuality(rows({ intelligence: 44 }))!.score);
    expect(blendModelQuality(rows({ coding: 76.5 }), "coding")!.score).toBeGreaterThan(blendModelQuality(rows({ coding: 51.5 }), "coding")!.score);
  });

  it("each contribution keeps ITS OWN row's model name — a rating is never re-attributed", () => {
    const r = blendModelQuality(rows())!;
    expect(r.contributions.find((c) => c.category === "coding")?.modelName).toBe("best-coding-model");
    expect(r.contributions.find((c) => c.category === "intelligence")?.modelName).toBe("best-intelligence-model");
  });

  it("keeps the best rating per category when duplicates appear", () => {
    const r = blendModelQuality([
      { category: "coding", rating: 40, modelName: "older" },
      { category: "coding", rating: 74.3, modelName: "newer" },
    ], "coding")!;
    expect(r.contributions[0].rating).toBe(74.3);
    expect(r.contributions[0].modelName).toBe("newer");
  });

  it("full 3-index coverage yields higher confidence than the driver alone; never above 95", () => {
    const full = blendModelQuality(rows())!;
    const partial = blendModelQuality(rows({ coding: null, agentic: null }))!;
    expect(full.confidence).toBeGreaterThan(partial.confidence);
    expect(full.confidence).toBeLessThanOrEqual(95);
  });

  it("contributions render in canonical order regardless of driver", () => {
    const r = blendModelQuality(rows(), "coding")!;
    expect(r.contributions.map((c) => c.category)).toEqual(["intelligence", "coding", "agentic"]);
  });

  it("is deterministic", () => {
    expect(blendModelQuality(rows(), "coding")).toEqual(blendModelQuality(rows(), "coding"));
  });

  it("ignores unknown categories", () => {
    const r = blendModelQuality([
      { category: "intelligence", rating: 50 },
      { category: "math" as never, rating: 60 },
    ])!;
    expect(r.contributions.map((c) => c.category)).toEqual(["intelligence"]);
  });
});
