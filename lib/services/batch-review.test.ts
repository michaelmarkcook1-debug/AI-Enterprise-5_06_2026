import { describe, expect, it } from "vitest";
import {
  buildBatchReviewResult,
  buildDeferredNotes,
  confidenceBand,
  isDeferred,
  matchesFilters,
  DEFAULT_BATCH_LIMIT,
  DEFERRED_PREFIX,
  type BatchReviewRow,
} from "./batch-review";

function row(over: Partial<BatchReviewRow> = {}): BatchReviewRow {
  return {
    proposalId: "p_default",
    vendorId: "msft",
    domain: "model_reliability",
    subfactor: "documented_evals",
    excerpt: "Microsoft 365 Copilot achieved 97% accuracy on the internal benchmark.",
    sourceUrl: "https://learn.microsoft.com/en-us/copilot/security",
    proposedGrade: "E2",
    classifierConfidence: 0.72,
    dataStatus: "pending",
    triageLane: "recommend_approve",
    triageReasons: ["product linkage missing"],
    linkageStatus: "ok_uncertain",
    linkedProductIds: [],
    isDeferred: false,
    ...over,
  };
}

describe("confidenceBand", () => {
  it.each([
    [0.95, "high"],
    [0.85, "high"],
    [0.8, "high"],
    [0.79, "medium"],
    [0.6, "medium"],
    [0.59, "low"],
    [0.0, "low"],
  ] as const)("confidence %s → %s", (c, expected) => {
    expect(confidenceBand(c)).toBe(expected);
  });
});

describe("isDeferred + buildDeferredNotes", () => {
  it("detects the documented sentinel prefix", () => {
    expect(isDeferred("DEFERRED: reviewer=mike at=2026-05-12T10:00:00Z")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isDeferred(null)).toBe(false);
    expect(isDeferred(undefined)).toBe(false);
    expect(isDeferred("")).toBe(false);
    expect(isDeferred("deferred")).toBe(false);
    expect(isDeferred("approved")).toBe(false);
  });
  it("buildDeferredNotes embeds reviewer + timestamp", () => {
    const notes = buildDeferredNotes({
      reviewerId: "mike@ai.enterprise",
      now: new Date("2026-05-12T10:00:00Z"),
    });
    expect(notes.startsWith(DEFERRED_PREFIX)).toBe(true);
    expect(notes).toContain("reviewer=mike@ai.enterprise");
    expect(notes).toContain("2026-05-12T10:00:00.000Z");
  });
  it("buildDeferredNotes appends optional reason", () => {
    const notes = buildDeferredNotes({
      reviewerId: "mike",
      reason: "waiting for stakeholder approval",
      now: new Date("2026-05-12T10:00:00Z"),
    });
    expect(notes).toMatch(/waiting for stakeholder approval$/);
  });
});

describe("matchesFilters", () => {
  it("no filters → every row matches", () => {
    expect(matchesFilters(row(), {})).toBe(true);
  });

  it("vendor filter narrows to matching vendor only", () => {
    expect(matchesFilters(row({ vendorId: "msft" }), { vendorId: "msft" })).toBe(true);
    expect(matchesFilters(row({ vendorId: "googl" }), { vendorId: "msft" })).toBe(false);
  });

  it("confidence band filter respects band boundaries", () => {
    expect(matchesFilters(row({ classifierConfidence: 0.9 }), { confidenceBand: "high" })).toBe(true);
    expect(matchesFilters(row({ classifierConfidence: 0.7 }), { confidenceBand: "high" })).toBe(false);
    expect(matchesFilters(row({ classifierConfidence: 0.7 }), { confidenceBand: "medium" })).toBe(true);
    expect(matchesFilters(row({ classifierConfidence: 0.4 }), { confidenceBand: "low" })).toBe(true);
  });

  it("grade filter is exact", () => {
    expect(matchesFilters(row({ proposedGrade: "E2" }), { grade: "E2" })).toBe(true);
    expect(matchesFilters(row({ proposedGrade: "E3" }), { grade: "E2" })).toBe(false);
  });

  it("linkage status filter is exact", () => {
    expect(matchesFilters(row({ linkageStatus: "ok" }), { linkageStatus: "ok" })).toBe(true);
    expect(matchesFilters(row({ linkageStatus: "no_match" }), { linkageStatus: "ok" })).toBe(false);
    expect(matchesFilters(row({ linkageStatus: "linked" }), { linkageStatus: "linked" })).toBe(true);
  });

  it("sourceUrlContains is case-insensitive substring", () => {
    const r = row({ sourceUrl: "https://Learn.Microsoft.com/copilot/Security" });
    expect(matchesFilters(r, { sourceUrlContains: "microsoft.com" })).toBe(true);
    expect(matchesFilters(r, { sourceUrlContains: "MICROSOFT" })).toBe(true);
    expect(matchesFilters(r, { sourceUrlContains: "openai" })).toBe(false);
  });

  it("missing sourceUrl never matches a sourceUrlContains filter", () => {
    expect(matchesFilters(row({ sourceUrl: null }), { sourceUrlContains: "anything" })).toBe(false);
  });

  it("deferred rows are excluded by default", () => {
    expect(matchesFilters(row({ isDeferred: true }), {})).toBe(false);
  });

  it("includeDeferred=true surfaces deferred rows", () => {
    expect(matchesFilters(row({ isDeferred: true }), { includeDeferred: true })).toBe(true);
  });
});

describe("buildBatchReviewResult", () => {
  function makeBatch(): BatchReviewRow[] {
    return [
      row({ proposalId: "a", vendorId: "msft", classifierConfidence: 0.9, proposedGrade: "E3" }),
      row({ proposalId: "b", vendorId: "msft", classifierConfidence: 0.7, proposedGrade: "E2" }),
      row({ proposalId: "c", vendorId: "googl", classifierConfidence: 0.5, proposedGrade: "E2" }),
      row({ proposalId: "d", vendorId: "googl", classifierConfidence: 0.7, proposedGrade: "E2", linkageStatus: "ok", isDeferred: false }),
      row({ proposalId: "e", vendorId: "openai", classifierConfidence: 0.85, proposedGrade: "E3", isDeferred: true }),
    ];
  }

  it("default limit is 20 (DEFAULT_BATCH_LIMIT)", () => {
    expect(DEFAULT_BATCH_LIMIT).toBe(20);
  });

  it("returns total, totalAfterFilter, and a page slice", () => {
    const result = buildBatchReviewResult(makeBatch(), {}, { offset: 0, limit: 2 });
    expect(result.total).toBe(5);
    // Default excludes deferred
    expect(result.totalAfterFilter).toBe(4);
    expect(result.page).toHaveLength(2);
  });

  it("offset paginates correctly", () => {
    const page1 = buildBatchReviewResult(makeBatch(), {}, { offset: 0, limit: 2 });
    const page2 = buildBatchReviewResult(makeBatch(), {}, { offset: 2, limit: 2 });
    expect(page1.page.map((r) => r.proposalId)).toEqual(["a", "b"]);
    expect(page2.page.map((r) => r.proposalId)).toEqual(["c", "d"]);
  });

  it("facets count over the UNfiltered set so filter sidebar always shows totals", () => {
    const result = buildBatchReviewResult(makeBatch(), { vendorId: "msft" });
    expect(result.facets.byVendor.find((v) => v.vendorId === "msft")?.count).toBe(2);
    expect(result.facets.byVendor.find((v) => v.vendorId === "googl")?.count).toBe(2);
    expect(result.facets.byVendor.find((v) => v.vendorId === "openai")?.count).toBe(1);
    expect(result.facets.deferredCount).toBe(1);
    expect(result.totalAfterFilter).toBe(2); // only the 2 msft rows
  });

  it("confidence-band facet covers all three buckets even when empty", () => {
    const result = buildBatchReviewResult(makeBatch(), {});
    const bands = result.facets.byConfidenceBand.map((b) => b.band);
    expect(bands).toEqual(["high", "medium", "low"]);
  });
});
