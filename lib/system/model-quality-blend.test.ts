import { describe, it, expect } from "vitest";
import {
  blendModelQuality,
  normalizeCategory,
  MODEL_QUALITY_CATEGORIES,
  MODEL_QUALITY_CAP,
  MQ_CATEGORY_BY_KEY,
  type MqCategoryInput,
} from "./model-quality-blend";

const full = (ratings: Partial<Record<string, number>>): MqCategoryInput[] =>
  Object.entries(ratings).map(([category, rating]) => ({ category: category as never, rating: rating as number }));

describe("model-quality blend — weights + anchors", () => {
  it("weights sum to 1.0", () => {
    const sum = MODEL_QUALITY_CATEGORIES.reduce((s, c) => s + c.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  it("coding carries the largest weight (per the chosen rationale)", () => {
    const coding = MQ_CATEGORY_BY_KEY.coding.weight;
    for (const c of MODEL_QUALITY_CATEGORIES) {
      if (c.key !== "coding") expect(coding).toBeGreaterThanOrEqual(c.weight);
    }
    expect(coding).toBeCloseTo(0.35, 5);
  });

  it("each arena has its own anchor scale (vision lower than text)", () => {
    expect(MQ_CATEGORY_BY_KEY.vision.anchorHi).toBeLessThan(MQ_CATEGORY_BY_KEY.coding.anchorHi);
    // a 250-Elo competitive window per category
    for (const c of MODEL_QUALITY_CATEGORIES) {
      expect(c.anchorHi - c.anchorLo).toBe(250);
    }
  });
});

describe("normalizeCategory — within-arena normalization", () => {
  it("maps lo→0, hi→1, clamps outside", () => {
    expect(normalizeCategory("coding", MQ_CATEGORY_BY_KEY.coding.anchorLo)).toBeCloseTo(0, 6);
    expect(normalizeCategory("coding", MQ_CATEGORY_BY_KEY.coding.anchorHi)).toBeCloseTo(1, 6);
    expect(normalizeCategory("coding", MQ_CATEGORY_BY_KEY.coding.anchorLo - 500)).toBe(0);
    expect(normalizeCategory("coding", MQ_CATEGORY_BY_KEY.coding.anchorHi + 500)).toBe(1);
  });

  it("a vision Elo (lower absolute scale) is not penalised vs a text Elo", () => {
    // vision SOTA ~1323 normalises high even though it is < a mid text Elo of 1450.
    const visionTop = normalizeCategory("vision", 1323);
    const textMid = normalizeCategory("coding", 1450);
    expect(visionTop).toBeGreaterThan(textMid);
  });
});

describe("blendModelQuality — composition", () => {
  it("returns null for no data (honest absence, never a default)", () => {
    expect(blendModelQuality([])).toBeNull();
  });

  it("never exceeds the E4 cap even at max ratings", () => {
    const maxed = full({ coding: 9999, hard_prompts: 9999, overall: 9999, vision: 9999, instruction_following: 9999 });
    const r = blendModelQuality(maxed)!;
    expect(r.score).toBeLessThanOrEqual(MODEL_QUALITY_CAP);
    expect(r.score).toBeCloseTo(MODEL_QUALITY_CAP, 5);
    expect(r.coverage).toBe(1);
  });

  it("is deterministic", () => {
    const inp = full({ coding: 1500, hard_prompts: 1490, overall: 1480, vision: 1290, instruction_following: 1470 });
    expect(blendModelQuality(inp)).toEqual(blendModelQuality(inp));
  });

  it("a uniformly stronger vendor outranks a uniformly weaker one", () => {
    const strong = blendModelQuality(full({ coding: 1535, hard_prompts: 1525, overall: 1500, vision: 1323, instruction_following: 1521 }))!;
    const weak = blendModelQuality(full({ coding: 1400, hard_prompts: 1390, overall: 1380, vision: 1180, instruction_following: 1370 }))!;
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("coding dominance: a coding-strong vendor beats a coding-weak one, others equal", () => {
    const base = { hard_prompts: 1450, overall: 1450, vision: 1250, instruction_following: 1450 };
    const codingStrong = blendModelQuality(full({ ...base, coding: 1535 }))!;
    const codingWeak = blendModelQuality(full({ ...base, coding: 1330 }))!;
    expect(codingStrong.score).toBeGreaterThan(codingWeak.score);
  });

  it("missing a category renormalises weights + lowers coverage and confidence", () => {
    const all = blendModelQuality(full({ coding: 1500, hard_prompts: 1490, overall: 1480, vision: 1290, instruction_following: 1470 }))!;
    const noVision = blendModelQuality(full({ coding: 1500, hard_prompts: 1490, overall: 1480, instruction_following: 1470 }))!;
    expect(noVision.coverage).toBeLessThan(all.coverage);
    expect(noVision.confidence).toBeLessThan(all.confidence);
    expect(noVision.contributions.length).toBe(4);
    // renormalised over present categories → still a valid 0..CAP score
    expect(noVision.score).toBeGreaterThan(0);
    expect(noVision.score).toBeLessThanOrEqual(MODEL_QUALITY_CAP);
  });

  it("keeps the best rating when a category appears twice", () => {
    const r = blendModelQuality([
      { category: "coding", rating: 1400 },
      { category: "coding", rating: 1535 },
    ])!;
    expect(r.contributions[0].rating).toBe(1535);
  });

  it("contributions are in canonical category order", () => {
    const r = blendModelQuality(full({ instruction_following: 1470, coding: 1500, vision: 1290, overall: 1480, hard_prompts: 1490 }))!;
    const order = r.contributions.map((c) => c.category);
    const canonical = MODEL_QUALITY_CATEGORIES.map((c) => c.key).filter((k) => order.includes(k));
    expect(order).toEqual(canonical);
  });

  it("ignores unknown categories", () => {
    const r = blendModelQuality([
      { category: "coding", rating: 1500 },
      { category: "math" as never, rating: 1520 },
    ])!;
    expect(r.contributions.map((c) => c.category)).toEqual(["coding"]);
  });
});
