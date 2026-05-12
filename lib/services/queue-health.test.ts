import { describe, expect, it } from "vitest";
import { summarisePendingRows, STALE_PENDING_THRESHOLD_DAYS } from "./queue-health";

const NOW = new Date("2026-05-12T00:00:00Z");
const stale = new Date(NOW.getTime() - (STALE_PENDING_THRESHOLD_DAYS + 1) * 24 * 60 * 60 * 1000);
const fresh = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);

describe("summarisePendingRows", () => {
  it("buckets fresh / deferred / stale into mutually-exclusive counts", () => {
    const s = summarisePendingRows([
      { capturedAt: fresh, reviewNotes: null },
      { capturedAt: fresh, reviewNotes: null },
      { capturedAt: fresh, reviewNotes: "DEFERRED: reviewer=mike at=2026-05-12" },
      { capturedAt: stale, reviewNotes: null },
      { capturedAt: stale, reviewNotes: null },
      { capturedAt: stale, reviewNotes: null },
    ], NOW);
    expect(s.totalPending).toBe(6);
    expect(s.deferredCount).toBe(1);
    expect(s.staleCount).toBe(3);
    expect(s.freshActionableCount).toBe(2);
  });

  it("deferred always wins over stale (a row is counted in only one bucket)", () => {
    // Stale-AND-deferred row counts as deferred, not stale.
    const s = summarisePendingRows([
      { capturedAt: stale, reviewNotes: "DEFERRED: reviewer=mike at=2026-04-01" },
    ], NOW);
    expect(s.totalPending).toBe(1);
    expect(s.deferredCount).toBe(1);
    expect(s.staleCount).toBe(0);
    expect(s.freshActionableCount).toBe(0);
  });

  it("returns all zeros for an empty queue", () => {
    expect(summarisePendingRows([], NOW)).toEqual({
      totalPending: 0,
      deferredCount: 0,
      staleCount: 0,
      freshActionableCount: 0,
    });
  });

  it("boundary: row captured EXACTLY at the threshold is fresh, not stale", () => {
    const exactlyAt = new Date(NOW.getTime() - STALE_PENDING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    // Strict less-than means equal is NOT stale.
    const s = summarisePendingRows([{ capturedAt: exactlyAt, reviewNotes: null }], NOW);
    expect(s.staleCount).toBe(0);
    expect(s.freshActionableCount).toBe(1);
  });

  it("STALE_PENDING_THRESHOLD_DAYS is sane (between 14 and 60)", () => {
    expect(STALE_PENDING_THRESHOLD_DAYS).toBeGreaterThanOrEqual(14);
    expect(STALE_PENDING_THRESHOLD_DAYS).toBeLessThanOrEqual(60);
  });
});
