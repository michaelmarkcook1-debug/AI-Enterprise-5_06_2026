import { describe, it, expect, afterEach } from "vitest";
import { computeAggregate, poolAggregateToEvidence, POOL_SOURCE_URL, cacheTtlHours } from "./aggregate";
import type { PoolContribution } from "./types";
import type { Segment } from "../peer/segments";

const segment: Segment = { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" };

const contribution = (goalCategory: PoolContribution["goalCategory"], tags: PoolContribution["constraintTags"] = []): PoolContribution => ({
  vertical: segment.vertical,
  sizeBand: segment.sizeBand,
  region: segment.region,
  goalCategory,
  constraintTags: tags,
  contributedAt: "2026-07-06",
});

describe("computeAggregate — the k-anonymity floor, the single most safety-critical check in AIE-07", () => {
  it("returns NULL below the floor — never a partial aggregate, no matter how close", () => {
    const four = Array.from({ length: 4 }, () => contribution("coding_copilot"));
    expect(computeAggregate(four, 5, segment)).toBeNull();
  });

  it("returns an aggregate at EXACTLY the floor", () => {
    const five = Array.from({ length: 5 }, () => contribution("coding_copilot"));
    const agg = computeAggregate(five, 5, segment);
    expect(agg).not.toBeNull();
    expect(agg!.contributors).toBe(5);
  });

  it("returns an aggregate comfortably above the floor", () => {
    const twenty = Array.from({ length: 20 }, () => contribution("coding_copilot"));
    expect(computeAggregate(twenty, 5, segment)!.contributors).toBe(20);
  });

  it("scales correctly at 2,000 contributors (the ticket's upper scalability bound)", () => {
    const many = Array.from({ length: 2000 }, (_, i) => contribution(i % 2 === 0 ? "coding_copilot" : "cost_reduction"));
    const agg = computeAggregate(many, 5, segment)!;
    expect(agg.contributors).toBe(2000);
    expect(agg.goalShares.find((g) => g.goalCategory === "coding_copilot")!.share).toBeCloseTo(0.5, 2);
  });

  it("computes correct goal shares (must sum to 1 across all present categories)", () => {
    const rows = [
      contribution("coding_copilot"),
      contribution("coding_copilot"),
      contribution("coding_copilot"),
      contribution("cost_reduction"),
      contribution("cost_reduction"),
    ];
    const agg = computeAggregate(rows, 5, segment)!;
    const totalShare = agg.goalShares.reduce((s, g) => s + g.share, 0);
    expect(totalShare).toBeCloseTo(1, 6);
    expect(agg.goalShares[0].goalCategory).toBe("coding_copilot"); // 3/5, sorted first
    expect(agg.goalShares[0].share).toBeCloseTo(0.6, 6);
  });

  it("computes constraint shares independently (a contribution can name 0, 1, or many)", () => {
    const rows = [
      contribution("coding_copilot", ["budget", "timeline"]),
      contribution("coding_copilot", ["budget"]),
      contribution("coding_copilot", []),
      contribution("coding_copilot", ["security"]),
      contribution("coding_copilot", ["budget"]),
    ];
    const agg = computeAggregate(rows, 5, segment)!;
    const budget = agg.constraintShares.find((c) => c.constraintTag === "budget")!;
    expect(budget.share).toBeCloseTo(3 / 5, 6); // 3 of 5 named budget
  });
});

describe("poolAggregateToEvidence — cited but non-navigable (it's our own pool, not a third party)", () => {
  it("marks the source distinctly (POOL_SOURCE_URL), never a fake external link", () => {
    const rows = Array.from({ length: 5 }, () => contribution("coding_copilot", ["budget"]));
    const agg = computeAggregate(rows, 5, segment)!;
    const items = poolAggregateToEvidence(agg);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.sourceUrl === POOL_SOURCE_URL)).toBe(true);
    expect(items.every((i) => i.layer === "peer_pool")).toBe(true);
  });

  it("surfaces the real contributor count in the headline (never omits or inflates it)", () => {
    const rows = Array.from({ length: 7 }, () => contribution("coding_copilot"));
    const agg = computeAggregate(rows, 5, segment)!;
    const items = poolAggregateToEvidence(agg);
    expect(items[0].headline).toContain("7 anonymized contributors");
  });
});

describe("cacheTtlHours — owner-tunable, the actual anti-differencing protection", () => {
  const ORIGINAL = process.env.POOL_AGGREGATE_CACHE_HOURS;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.POOL_AGGREGATE_CACHE_HOURS;
    else process.env.POOL_AGGREGATE_CACHE_HOURS = ORIGINAL;
  });

  it("defaults to 6 hours when unset", () => {
    delete process.env.POOL_AGGREGATE_CACHE_HOURS;
    expect(cacheTtlHours()).toBe(6);
  });

  it("respects a valid env override", () => {
    process.env.POOL_AGGREGATE_CACHE_HOURS = "1";
    expect(cacheTtlHours()).toBe(1);
  });

  it("falls back to the default on garbage/non-positive input (never 0 -- a 0h TTL would be no protection at all)", () => {
    process.env.POOL_AGGREGATE_CACHE_HOURS = "not-a-number";
    expect(cacheTtlHours()).toBe(6);
    process.env.POOL_AGGREGATE_CACHE_HOURS = "0";
    expect(cacheTtlHours()).toBe(6);
    process.env.POOL_AGGREGATE_CACHE_HOURS = "-3";
    expect(cacheTtlHours()).toBe(6);
  });
});
