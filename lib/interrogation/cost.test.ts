import { describe, it, expect } from "vitest";
import { priceForModel, costOfUsage, costColumns } from "./cost";
import { PRICES } from "../ingestion/cost-model";

describe("interrogation cost — real rates, fail loud, never silent $0", () => {
  it("resolves a model id exactly, else by tier keyword", () => {
    expect(priceForModel("claude-opus-4-8").id).toBe(PRICES.opus.id);
    expect(priceForModel("claude-sonnet-4-6").id).toBe(PRICES.sonnet.id);
    expect(priceForModel("claude-haiku-4-5").id).toBe(PRICES.haiku.id);
    // a future minor bump still resolves to the right tier by keyword
    expect(priceForModel("claude-opus-9-9-future").id).toBe(PRICES.opus.id);
  });

  it("THROWS on an unknown model rather than silently costing $0 (would under-report spend)", () => {
    expect(() => priceForModel("gpt-4o")).toThrow(/no price/i);
    expect(() => costOfUsage({ inputTokens: 1000, outputTokens: 1000, model: "mystery" })).toThrow();
  });

  it("a stub result (no real API call) is a true $0 — the only zero allowed", () => {
    expect(costOfUsage({ inputTokens: 0, outputTokens: 0, model: "stub" })).toBe(0);
  });

  it("computes USD from published per-MTok rates", () => {
    // Opus $5/MTok in, $25/MTok out → 1M in + 1M out = 5 + 25 = $30
    expect(costOfUsage({ inputTokens: 1_000_000, outputTokens: 1_000_000, model: "claude-opus-4-8" })).toBeCloseTo(30, 6);
  });

  it("a sub-cent call does NOT round to $0 and vanish from rollups", () => {
    const usd = costOfUsage({ inputTokens: 100, outputTokens: 50, model: "claude-haiku-4-5" });
    expect(usd).toBeGreaterThan(0);
  });

  it("costColumns carries model + tokens + cost through", () => {
    const c = costColumns({ inputTokens: 2000, outputTokens: 500, model: "claude-sonnet-4-6" });
    expect(c.model).toBe("claude-sonnet-4-6");
    expect(c.inputTokens).toBe(2000);
    expect(c.outputTokens).toBe(500);
    expect(c.costUsd).toBeGreaterThan(0);
  });
});
