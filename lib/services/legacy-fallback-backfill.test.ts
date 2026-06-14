import { describe, expect, it } from "vitest";
import { isLegacyFallbackRow, type LegacyFallbackCandidate } from "./legacy-fallback-backfill";

function row(over: Partial<LegacyFallbackCandidate> = {}): LegacyFallbackCandidate {
  return {
    status: "pending",
    classifierConfidence: 0.5,
    classificationFailed: false,
    confidenceIsFallback: false,
    classificationFailureCode: null,
    ...over,
  };
}

describe("isLegacyFallbackRow", () => {
  it("matches the documented heuristic — pending + 0.5 + no metadata yet", () => {
    expect(isLegacyFallbackRow(row())).toBe(true);
  });

  it("requires classificationFailed === false (NOT NULL post-migration)", () => {
    expect(isLegacyFallbackRow(row({ classificationFailed: false }))).toBe(true);
    expect(isLegacyFallbackRow(row({ classificationFailed: true }))).toBe(false);
  });

  it("requires confidenceIsFallback === false (NOT NULL post-migration)", () => {
    expect(isLegacyFallbackRow(row({ confidenceIsFallback: false }))).toBe(true);
    expect(isLegacyFallbackRow(row({ confidenceIsFallback: true }))).toBe(false);
  });

  it("does NOT match real-classifier rows (0.91)", () => {
    expect(isLegacyFallbackRow(row({ classifierConfidence: 0.91 }))).toBe(false);
  });

  it("does NOT match real-classifier rows (0.92)", () => {
    expect(isLegacyFallbackRow(row({ classifierConfidence: 0.92 }))).toBe(false);
  });

  it("does NOT match a row that's already been backfilled (classificationFailed=true)", () => {
    expect(isLegacyFallbackRow(row({ classificationFailed: true }))).toBe(false);
  });

  it("does NOT match a row that's already been backfilled (confidenceIsFallback=true)", () => {
    expect(isLegacyFallbackRow(row({ confidenceIsFallback: true }))).toBe(false);
  });

  it("does NOT match a row that already has a failure code", () => {
    expect(isLegacyFallbackRow(row({ classificationFailureCode: "schema_validation" }))).toBe(false);
  });

  it("does NOT match approved / rejected / superseded rows", () => {
    expect(isLegacyFallbackRow(row({ status: "approved" }))).toBe(false);
    expect(isLegacyFallbackRow(row({ status: "rejected" }))).toBe(false);
    expect(isLegacyFallbackRow(row({ status: "superseded" }))).toBe(false);
  });

  it("does NOT match a confidence near 0.5 (e.g. 0.50001)", () => {
    expect(isLegacyFallbackRow(row({ classifierConfidence: 0.50001 }))).toBe(false);
    expect(isLegacyFallbackRow(row({ classifierConfidence: 0.49999 }))).toBe(false);
  });

  it("simulated batch — counts only legacy fallbacks", () => {
    const batch: LegacyFallbackCandidate[] = [
      row({ classifierConfidence: 0.5 }),                     // legacy ✓
      row({ classifierConfidence: 0.5 }),                     // legacy ✓
      row({ classifierConfidence: 0.5, status: "approved" }),  // not pending ✗
      row({ classifierConfidence: 0.91 }),                    // real ✗
      row({ classifierConfidence: 0.92 }),                    // real ✗
      row({ classifierConfidence: 0.5, classificationFailed: true }),     // already backfilled ✗
      row({ classifierConfidence: 0.5, confidenceIsFallback: true }),     // already backfilled ✗
      row({ classifierConfidence: 0.5, classificationFailureCode: "schema_validation" }), // already coded ✗
    ];
    const matches = batch.filter(isLegacyFallbackRow).length;
    expect(matches).toBe(2);
  });
});
