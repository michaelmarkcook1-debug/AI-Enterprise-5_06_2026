import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getSpendCaps, makeSpendGuard } from "./spend-ledger";

// No DATABASE_URL in test → getDaySpendUsd() returns 0, so the guard tests the
// per-cycle tripwire from a clean day. (Day-cap accumulation across runs is
// exercised against a real DB, not in unit tests.)

describe("spend caps", () => {
  const origCycle = process.env.REFRESH_CYCLE_CAP_USD;
  const origDay = process.env.REFRESH_DAY_CAP_USD;
  beforeEach(() => {
    delete process.env.REFRESH_CYCLE_CAP_USD;
    delete process.env.REFRESH_DAY_CAP_USD;
  });
  afterEach(() => {
    if (origCycle === undefined) delete process.env.REFRESH_CYCLE_CAP_USD;
    else process.env.REFRESH_CYCLE_CAP_USD = origCycle;
    if (origDay === undefined) delete process.env.REFRESH_DAY_CAP_USD;
    else process.env.REFRESH_DAY_CAP_USD = origDay;
  });

  it("defaults to $5 / $25", () => {
    expect(getSpendCaps()).toEqual({ cycleUsd: 5, dayUsd: 25 });
  });

  it("honours env overrides", () => {
    process.env.REFRESH_CYCLE_CAP_USD = "2";
    process.env.REFRESH_DAY_CAP_USD = "10";
    expect(getSpendCaps()).toEqual({ cycleUsd: 2, dayUsd: 10 });
  });

  it("ignores a garbage override and falls back to default", () => {
    process.env.REFRESH_CYCLE_CAP_USD = "not-a-number";
    expect(getSpendCaps().cycleUsd).toBe(5);
  });

  it("trips once accumulated cycle cost reaches the cap", async () => {
    const guard = await makeSpendGuard(new Date("2026-06-25T03:05:00Z"));
    expect(guard.exhausted()).toBe(false);
    guard.record(4);
    expect(guard.exhausted()).toBe(false);
    guard.record(1.5); // 5.5 ≥ 5
    expect(guard.exhausted()).toBe(true);
    expect(guard.status().reason).toMatch(/cycle cap/);
  });

  it("ignores non-positive / non-finite step costs", async () => {
    const guard = await makeSpendGuard(new Date("2026-06-25T03:05:00Z"));
    guard.record(-3);
    guard.record(Number.NaN);
    expect(guard.cycleUsd()).toBe(0);
    expect(guard.exhausted()).toBe(false);
  });
});
