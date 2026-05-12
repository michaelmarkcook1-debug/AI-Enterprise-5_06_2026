// Batch review — pure filter + row-enrichment helpers for the
// recommend_approve cohort.
// ─────────────────────────────────────────────────────────────
// Used by `/admin/evidence/batch` to paginate 20 rows at a time
// with filter-aware narrowing. No DB, no I/O — pure functions for
// reusability and testability.

import type { TriageDecision } from "./triage";
import type { ProposalLinkageResult } from "./product-linkage";

export interface BatchReviewRow {
  proposalId: string;
  vendorId: string;
  domain: string;
  subfactor: string;
  excerpt: string;
  sourceUrl: string | null;
  proposedGrade: string;
  classifierConfidence: number;
  dataStatus: "unknown" | "deferred" | "pending";
  triageLane: TriageDecision["lane"];
  triageReasons: string[];
  linkageStatus: ProposalLinkageResult["status"] | "linked";
  linkedProductIds: string[];
  /** Vendor's full product catalogue — used by the inline picker so
   * operators can attach products without leaving the batch screen. */
  availableProducts?: { id: string; name: string; category: string }[];
  /** Top-3 ranked suggestions from the linkage suggester. Shown
   * pinned at the top of the picker with a "safe" tag where eligible. */
  linkageSuggestions?: { productScopeId: string; productName: string; confidence: number; reason: string; safeToApply: boolean }[];
  /** Whether the row's existing linkage was operator-marked vendor-wide. */
  isVendorWide?: boolean;
  /** Set when the proposal carries the DEFERRED sentinel in reviewNotes. */
  isDeferred: boolean;
}

export interface BatchReviewFilters {
  vendorId?: string;
  /** Confidence band filter: "high" = ≥0.8, "medium" = 0.6–0.8, "low" = <0.6 */
  confidenceBand?: "high" | "medium" | "low";
  grade?: "E0" | "E1" | "E2" | "E3" | "E4" | "E5";
  /** Filter by linkage status from the suggester, OR "linked" for rows
   * that already carry productScopeIds. */
  linkageStatus?:
    | "ok"
    | "ok_uncertain"
    | "multiple_competing"
    | "no_match"
    | "no_vendor_products"
    | "uncertain_top_match"
    | "linked";
  /** Substring match on the source URL (case-insensitive). */
  sourceUrlContains?: string;
  /** Whether to include rows that have been deferred. Default false. */
  includeDeferred?: boolean;
}

export interface BatchReviewPaging {
  offset: number;
  limit: number;
}

export const DEFAULT_BATCH_LIMIT = 20;
export const DEFERRED_PREFIX = "DEFERRED: ";

/** Map a numeric classifier confidence to one of three bands. */
export function confidenceBand(c: number): "high" | "medium" | "low" {
  if (c >= 0.8) return "high";
  if (c >= 0.6) return "medium";
  return "low";
}

/** True iff a proposal's review notes flag it as deferred. */
export function isDeferred(reviewNotes: string | null | undefined): boolean {
  return Boolean(reviewNotes && reviewNotes.startsWith(DEFERRED_PREFIX));
}

/** Build the deferred-notes sentinel. Embeds reviewer id + timestamp +
 * optional free-text reason. */
export function buildDeferredNotes(args: {
  reviewerId: string;
  reason?: string;
  now?: Date;
}): string {
  const ts = (args.now ?? new Date()).toISOString();
  const tail = args.reason ? ` — ${args.reason}` : "";
  return `${DEFERRED_PREFIX}reviewer=${args.reviewerId} at=${ts}${tail}`;
}

/** Apply the filter predicate to a single row. Returns true iff the
 * row should be included in the batch. */
export function matchesFilters(row: BatchReviewRow, filters: BatchReviewFilters): boolean {
  if (filters.vendorId && row.vendorId !== filters.vendorId) return false;
  if (filters.confidenceBand && confidenceBand(row.classifierConfidence) !== filters.confidenceBand) return false;
  if (filters.grade && row.proposedGrade !== filters.grade) return false;
  if (filters.linkageStatus && row.linkageStatus !== filters.linkageStatus) return false;
  if (filters.sourceUrlContains) {
    const needle = filters.sourceUrlContains.toLowerCase();
    if (!row.sourceUrl || !row.sourceUrl.toLowerCase().includes(needle)) return false;
  }
  if (!filters.includeDeferred && row.isDeferred) return false;
  return true;
}

export interface BatchReviewResult {
  total: number;
  totalAfterFilter: number;
  page: BatchReviewRow[];
  /** Counts per filter dimension, computed over the unfiltered set —
   * used to populate the filter sidebar with row counts. */
  facets: {
    byVendor: { vendorId: string; count: number }[];
    byConfidenceBand: { band: "high" | "medium" | "low"; count: number }[];
    byGrade: { grade: string; count: number }[];
    byLinkageStatus: { status: string; count: number }[];
    deferredCount: number;
  };
}

/** Build the paginated, filtered batch result. */
export function buildBatchReviewResult(
  rows: BatchReviewRow[],
  filters: BatchReviewFilters,
  paging: BatchReviewPaging = { offset: 0, limit: DEFAULT_BATCH_LIMIT },
): BatchReviewResult {
  const filtered = rows.filter((r) => matchesFilters(r, filters));
  const page = filtered.slice(paging.offset, paging.offset + paging.limit);
  return {
    total: rows.length,
    totalAfterFilter: filtered.length,
    page,
    facets: computeFacets(rows),
  };
}

function computeFacets(rows: BatchReviewRow[]): BatchReviewResult["facets"] {
  const byVendor = new Map<string, number>();
  const byBand: Record<"high" | "medium" | "low", number> = { high: 0, medium: 0, low: 0 };
  const byGrade = new Map<string, number>();
  const byLinkage = new Map<string, number>();
  let deferredCount = 0;
  for (const r of rows) {
    byVendor.set(r.vendorId, (byVendor.get(r.vendorId) ?? 0) + 1);
    byBand[confidenceBand(r.classifierConfidence)] += 1;
    byGrade.set(r.proposedGrade, (byGrade.get(r.proposedGrade) ?? 0) + 1);
    byLinkage.set(r.linkageStatus, (byLinkage.get(r.linkageStatus) ?? 0) + 1);
    if (r.isDeferred) deferredCount += 1;
  }
  const sortByCount = <T>(m: Map<T, number>): { key: T; count: number }[] =>
    [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  return {
    byVendor: sortByCount(byVendor).map((e) => ({ vendorId: e.key, count: e.count })),
    byConfidenceBand: (["high", "medium", "low"] as const).map((band) => ({ band, count: byBand[band] })),
    byGrade: sortByCount(byGrade).map((e) => ({ grade: e.key, count: e.count })),
    byLinkageStatus: sortByCount(byLinkage).map((e) => ({ status: e.key, count: e.count })),
    deferredCount,
  };
}
