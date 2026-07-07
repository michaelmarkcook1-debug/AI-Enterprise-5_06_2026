import { describe, it, expect, afterEach } from "vitest";
import { freeWindowDays, computeWindowUntil } from "./incentive";

describe("freeWindowDays — owner-tunable via env, never a silently-hardcoded business number", () => {
  const ORIGINAL = process.env.POOL_FREE_WINDOW_DAYS;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.POOL_FREE_WINDOW_DAYS;
    else process.env.POOL_FREE_WINDOW_DAYS = ORIGINAL;
  });

  it("defaults to 30 when unset", () => {
    delete process.env.POOL_FREE_WINDOW_DAYS;
    expect(freeWindowDays()).toBe(30);
  });

  it("respects a valid env override", () => {
    process.env.POOL_FREE_WINDOW_DAYS = "14";
    expect(freeWindowDays()).toBe(14);
  });

  it("falls back to the default on a garbage/non-positive value (never NaN or 0)", () => {
    process.env.POOL_FREE_WINDOW_DAYS = "not-a-number";
    expect(freeWindowDays()).toBe(30);
    process.env.POOL_FREE_WINDOW_DAYS = "-5";
    expect(freeWindowDays()).toBe(30);
    process.env.POOL_FREE_WINDOW_DAYS = "0";
    expect(freeWindowDays()).toBe(30);
  });
});

describe("computeWindowUntil — the actual date math grantContributorIncentive writes", () => {
  it("adds the given number of days to `now`, exactly", () => {
    const now = new Date("2026-07-06T00:00:00.000Z");
    const until = computeWindowUntil(now, 30);
    expect(until.toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("defaults to freeWindowDays() when no explicit day count is passed", () => {
    const now = new Date("2026-07-06T00:00:00.000Z");
    const withDefault = computeWindowUntil(now);
    const withExplicit = computeWindowUntil(now, freeWindowDays());
    expect(withDefault.getTime()).toBe(withExplicit.getTime());
  });

  it("a 0-day-equivalent-safe case: 1 day is a real, non-collapsing window", () => {
    const now = new Date("2026-07-06T00:00:00.000Z");
    const until = computeWindowUntil(now, 1);
    expect(until.getTime()).toBeGreaterThan(now.getTime());
  });
});
