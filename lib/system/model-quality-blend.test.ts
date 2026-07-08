import { describe, it, expect } from "vitest";
import { blendModelQuality, normalizeIntelligence, MODEL_QUALITY_CAP, type MqModelInput } from "./model-quality-blend";

const input = (overrides: Partial<MqModelInput> = {}): MqModelInput => ({
  intelligenceIndex: 56,
  codingIndex: 58,
  agenticIndex: 60,
  modelName: "claude-opus-4-8",
  sourceUrl: "https://artificialanalysis.ai/models",
  ...overrides,
});

describe("normalizeIntelligence — fixed-window normalization", () => {
  it("clamps to [0,1] outside the anchor window", () => {
    expect(normalizeIntelligence(-100)).toBe(0);
    expect(normalizeIntelligence(1000)).toBe(1);
  });

  it("is monotonic: a higher index never normalizes lower", () => {
    expect(normalizeIntelligence(50)).toBeGreaterThan(normalizeIntelligence(30));
  });
});

describe("blendModelQuality — driven by Intelligence Index alone", () => {
  it("returns null when intelligenceIndex is absent, even with coding/agentic present (honest absence)", () => {
    expect(blendModelQuality(input({ intelligenceIndex: null }))).toBeNull();
  });

  it("returns null for a fully empty input", () => {
    expect(blendModelQuality({ intelligenceIndex: null, codingIndex: null, agenticIndex: null })).toBeNull();
  });

  it("scores from intelligenceIndex alone when coding/agentic are absent", () => {
    const r = blendModelQuality(input({ codingIndex: null, agenticIndex: null }))!;
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(MODEL_QUALITY_CAP);
    expect(r.contributions).toHaveLength(1);
    expect(r.contributions[0].category).toBe("intelligence");
  });

  it("never exceeds the E4 cap even at an extreme index", () => {
    const r = blendModelQuality(input({ intelligenceIndex: 9999 }))!;
    expect(r.score).toBeLessThanOrEqual(MODEL_QUALITY_CAP);
    expect(r.score).toBeCloseTo(MODEL_QUALITY_CAP, 5);
  });

  it("is deterministic", () => {
    expect(blendModelQuality(input())).toEqual(blendModelQuality(input()));
  });

  it("a higher Intelligence Index outranks a lower one", () => {
    const strong = blendModelQuality(input({ intelligenceIndex: 56 }))!;
    const weak = blendModelQuality(input({ intelligenceIndex: 44 }))!;
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("coding/agentic never change the score — informational only (would double-count Intelligence Index's own weighting)", () => {
    const withExtras = blendModelQuality(input({ codingIndex: 90, agenticIndex: 90 }))!;
    const withoutExtras = blendModelQuality(input({ codingIndex: null, agenticIndex: null }))!;
    expect(withExtras.score).toBe(withoutExtras.score);
    expect(withExtras.contributions.find((c) => c.category === "coding")?.weight).toBe(0);
    expect(withExtras.contributions.find((c) => c.category === "agentic")?.weight).toBe(0);
  });

  it("full 3-index coverage yields higher confidence than intelligence alone", () => {
    const full = blendModelQuality(input())!;
    const partial = blendModelQuality(input({ codingIndex: null, agenticIndex: null }))!;
    expect(full.coverage).toBe(1);
    expect(partial.coverage).toBeCloseTo(1 / 3, 5);
    expect(full.confidence).toBeGreaterThan(partial.confidence);
  });

  it("confidence never exceeds 95 (benchmark composite, not an independent audit)", () => {
    expect(blendModelQuality(input())!.confidence).toBeLessThanOrEqual(95);
  });

  it("contributions carry the real model name + source url for citation", () => {
    const r = blendModelQuality(input())!;
    expect(r.contributions.every((c) => c.modelName === "claude-opus-4-8")).toBe(true);
    expect(r.contributions.every((c) => c.sourceUrl === "https://artificialanalysis.ai/models")).toBe(true);
  });

  it("intelligence contribution is always first", () => {
    const r = blendModelQuality(input())!;
    expect(r.contributions[0].category).toBe("intelligence");
  });
});
