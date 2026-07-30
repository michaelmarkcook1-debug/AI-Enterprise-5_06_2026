// Pipeline health must not report green while a step is broken.
// ─────────────────────────────────────────────────────────────────────────────
// Found 2026-07-30: routine_inbox_pull returned ok:true for weeks with a Prisma
// foreign-key violation sitting in its own summary. `timed()` only caught
// THROWN errors, and that step catches its exception and returns it as a field.
// So the run said "27/27 steps OK" and the health dial said 96% while an
// ingestion path was dead.
//
// These tests pin the rule: if a step's summary admits a hard error, the step is
// not ok — however it chose to return.

import { describe, expect, it } from "vitest";
import { inspectSummary } from "./daily-refresh";

describe("inspectSummary — hard errors", () => {
  it("catches the exact shape that shipped broken (error string in summary)", () => {
    const r = inspectSummary({
      configured: true,
      filesProcessed: 0,
      error:
        "\nInvalid `prisma.evidenceProposal.create()` invocation:\n\nForeign key constraint violated",
    });
    expect(r.hardError).toMatch(/Foreign key constraint/);
  });

  it("treats an Error object as a hard error too", () => {
    expect(inspectSummary({ error: new Error("boom") }).hardError).toBe("boom");
  });

  it.each([
    ["absent", {}],
    ["undefined", { error: undefined }],
    ["null", { error: null }],
    ["empty string", { error: "" }],
    ["whitespace only", { error: "   " }],
  ])("does not invent a failure when error is %s", (_label, summary) => {
    expect(inspectSummary(summary as Record<string, unknown>).hardError).toBeNull();
  });
});

describe("inspectSummary — partial errors", () => {
  it("counts errorCount without calling the whole step failed", () => {
    // A feed sweep where 2 of 30 feeds 404 is degraded, not dead. It must stay
    // ok (so one flaky feed can't red the whole run) but must not vanish.
    const r = inspectSummary({ feedsAttempted: 30, errorCount: 2 });
    expect(r.hardError).toBeNull();
    expect(r.partialErrors).toBe(2);
  });

  it("sums the different names steps use for the same idea", () => {
    expect(inspectSummary({ errorCount: 1, failed: 2, errors: 3 }).partialErrors).toBe(6);
  });

  it("is zero on a clean step, so nothing extra is attached", () => {
    expect(inspectSummary({ upserted: 97, failed: 0 }).partialErrors).toBe(0);
  });

  it("ignores non-numeric junk rather than throwing", () => {
    expect(inspectSummary({ errorCount: "lots", failed: null }).partialErrors).toBe(0);
  });
});
