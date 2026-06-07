// Evidence scoring + freshness + publishability helpers.
// ──────────────────────────────────────────────────────

import type {
  DataFreshness,
  EvidenceGrade,
  EvidenceItem,
  PublishabilityStatus,
  SourceType,
} from "./types";
import { FRESHNESS_WINDOWS, EVIDENCE_GRADE_LABEL } from "./types";

/** Compute freshness status from source type and access date. */
export function computeFreshness(
  sourceType: SourceType,
  dateAccessed: string,
  now: Date = new Date(),
): DataFreshness {
  const windowDays = FRESHNESS_WINDOWS[sourceType] ?? 30;
  const accessed = new Date(dateAccessed);
  const ageDays = Math.round((now.getTime() - accessed.getTime()) / 86_400_000);
  if (ageDays <= windowDays) return "fresh";
  if (ageDays <= windowDays * 1.5) return "acceptable";
  if (ageDays <= windowDays * 3) return "stale";
  return "expired";
}

/** Compute confidence from evidence grade + freshness + source reliability. */
export function computeConfidence(
  grade: EvidenceGrade,
  freshness: DataFreshness,
  sourceReliability: number,
): number {
  const gradeMultiplier = EVIDENCE_GRADE_LABEL[grade].multiplier;
  const freshnessMultiplier =
    freshness === "fresh" ? 1.0
    : freshness === "acceptable" ? 0.9
    : freshness === "stale" ? 0.7
    : freshness === "expired" ? 0.4
    : 0.5;
  const reliabilityNorm = Math.min(100, Math.max(0, sourceReliability)) / 100;
  return Math.round(gradeMultiplier * freshnessMultiplier * reliabilityNorm * 100);
}

/** Determine publishability from evidence item properties. */
export function computePublishability(item: EvidenceItem): PublishabilityStatus {
  if (item.reviewerStatus === "rejected") return "blocked";
  if (!item.displayAllowed) return "internal_only";
  if (item.licenceStatus === "do_not_display") return "blocked";
  if (item.licenceStatus === "internal_only") return "internal_only";
  if (item.freshness === "expired") return "needs_review";
  if (item.freshness === "stale") return "publishable_with_caveat";
  if (item.evidenceGrade === "E0" || item.evidenceGrade === "E1") return "publishable_with_caveat";
  if (item.reviewerStatus !== "approved") return "needs_review";
  if (item.confidence < 50) return "publishable_with_caveat";
  return "publishable";
}

/** Check if a claim meets minimum publishability requirements. */
export function isPublishable(item: EvidenceItem): boolean {
  const status = computePublishability(item);
  return status === "publishable" || status === "publishable_with_caveat";
}

/** Badge color for publishability status. */
export function publishabilityColor(status: PublishabilityStatus): string {
  switch (status) {
    case "publishable": return "text-emerald-700 dark:text-emerald-300";
    case "publishable_with_caveat": return "text-amber-700 dark:text-amber-300";
    case "internal_only": return "text-sky-700 dark:text-sky-300";
    case "needs_review": return "text-amber-700 dark:text-amber-300";
    case "blocked": return "text-rose-700 dark:text-rose-300";
  }
}

/** Badge color for freshness. */
export function freshnessColor(freshness: DataFreshness): string {
  switch (freshness) {
    case "fresh": return "text-emerald-700 dark:text-emerald-300";
    case "acceptable": return "text-emerald-600 dark:text-emerald-400";
    case "stale": return "text-amber-700 dark:text-amber-300";
    case "expired": return "text-rose-700 dark:text-rose-300";
    case "unknown": return "text-zinc-500";
  }
}
