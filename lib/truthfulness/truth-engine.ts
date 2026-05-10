/**
 * Truth Engine — minimum contract.
 *
 * Spec: Stage 1 prompt pack, Task 04
 *   `04_TASK_3_TRUTH_ENGINE_MINIMUM_CONTRACT.md`
 *
 * One module, one set of unified helpers any consumer can rely on:
 *
 *   canRenderAsVerified(record) — strict gate; E0/seed/missing-source all
 *                                 forbidden; freshness gate enforced.
 *   truthDisplayStatus(record)  — short label for UI badges.
 *   truthBadgeProps(record)     — { label, tone, title } for inline badges.
 *   requiresValidation(record)  — boolean: source-validation must be shown.
 *
 * The TruthRecord type below is the canonical claim shape across the app.
 * Consumers (capabilities cell, dashboard widgets, simulator overlays) wrap
 * their own data into a TruthRecord-shaped value before asking these
 * helpers — no per-consumer copy of the rules.
 *
 * Truthfulness rules (locked by tests):
 *   1. E0 cannot render as verified — ever.
 *   2. dataStatus "seed" cannot render as verified.
 *   3. dataStatus "stale" downgrades; not verified.
 *   4. dataStatus "disputed" requires validation; not verified.
 *   5. dataStatus "unsupported" / "unknown" → render as Unknown.
 *   6. confidence < 60 → low-confidence badge; not verified.
 *   7. sourceIds.length === 0 → requires validation; not verified.
 *   8. Verified requires E3+ AND ≥1 sourceId AND status in
 *      {verified, documented, tested}.
 */

import type { EvidenceGrade } from "../types";

export type TruthDataStatus =
  | "verified"
  | "documented"
  | "tested"
  | "estimated"
  | "inferred"
  | "seed"
  | "stale"
  | "disputed"
  | "unknown"
  | "unsupported";

export type TruthFreshnessStatus = "fresh" | "aging" | "stale" | "unknown";

/** Minimum surface needed for the truth-engine helpers. Intentionally narrow
 *  so any module can construct one without dragging in DB types. */
export interface TruthRecord {
  /** Stable identifier so React keys + audit logs round-trip. */
  id: string;
  entityType: string;
  entityId: string;
  claimType: string;
  claimText: string;
  numericValue?: number;
  unit?: string;
  period?: string;
  geography?: string;

  /** Ids of supporting EvidenceSource rows. Empty array → validation required. */
  sourceIds: string[];

  evidenceGrade: EvidenceGrade;
  /** 0–100 — caller computes via lib/evidence/confidence.confidenceFor(). */
  confidenceScore: number;
  dataStatus: TruthDataStatus;
  freshnessStatus: TruthFreshnessStatus;

  uncertaintyNote?: string;
  createdAt: string;
  updatedAt?: string;
  lastVerifiedAt?: string;
  expiryDate?: string;
}

export interface TruthBadgeProps {
  label: string;
  tone: "ok" | "info" | "warn" | "bad" | "neutral";
  title: string;
}

const GRADE_RANK: Record<EvidenceGrade, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };

const VERIFIED_DATA_STATUSES = new Set<TruthDataStatus>(["verified", "documented", "tested"]);

const LOW_CONFIDENCE_THRESHOLD = 60;

// ────────────────────────── Helpers ──────────────────────────

/**
 * Strict verified gate. Returns true ONLY when every rule is satisfied.
 * Any failure elsewhere routes the caller into a non-verified rendering path.
 */
export function canRenderAsVerified(record: TruthRecord): boolean {
  if ((GRADE_RANK[record.evidenceGrade] ?? 0) < 3) return false;
  if (record.sourceIds.length === 0) return false;
  if (!VERIFIED_DATA_STATUSES.has(record.dataStatus)) return false;
  if (record.confidenceScore < LOW_CONFIDENCE_THRESHOLD) return false;
  if (record.freshnessStatus === "stale") return false;
  return true;
}

/**
 * Short, render-ready status label for UI badges.
 * Output values map 1:1 to the dataStatus enum, except `unsupported`
 * → "Unknown" so the UI never claims a fact we can't back.
 */
export function truthDisplayStatus(record: TruthRecord): string {
  if (record.dataStatus === "unsupported") return "Unknown";
  if (record.sourceIds.length === 0 && record.dataStatus !== "unknown" && record.dataStatus !== "seed") {
    return "Source validation required";
  }
  if (record.freshnessStatus === "stale" && record.dataStatus !== "stale") return "Stale";
  if (canRenderAsVerified(record)) return "Verified";
  if (record.dataStatus === "documented") return "Documented";
  if (record.dataStatus === "tested") return "Tested";
  if (record.dataStatus === "estimated") return "Estimated";
  if (record.dataStatus === "inferred") return "Inferred";
  if (record.dataStatus === "seed") return "Seed";
  if (record.dataStatus === "stale") return "Stale";
  if (record.dataStatus === "disputed") return "Disputed";
  return "Unknown";
}

/**
 * Computes the inline badge props. The tone scale is 5-step so any UI
 * library can map it to its own colour palette without translating.
 */
export function truthBadgeProps(record: TruthRecord): TruthBadgeProps {
  const verified = canRenderAsVerified(record);
  const lowConfidence = record.confidenceScore < LOW_CONFIDENCE_THRESHOLD;
  const noSources = record.sourceIds.length === 0;
  const stale = record.freshnessStatus === "stale" || record.dataStatus === "stale";

  if (verified) {
    return {
      label: "Verified",
      tone: "ok",
      title: `${record.evidenceGrade} · ${record.sourceIds.length} source${record.sourceIds.length === 1 ? "" : "s"} · confidence ${record.confidenceScore}/100`,
    };
  }
  if (record.dataStatus === "disputed") {
    return { label: "Disputed", tone: "bad", title: record.uncertaintyNote ?? "Conflicting sources — human review required." };
  }
  if (record.dataStatus === "unsupported") {
    return { label: "Unknown", tone: "bad", title: "Unsupported claim — not rendered as fact." };
  }
  if (record.dataStatus === "unknown") {
    return { label: "Unknown", tone: "neutral", title: record.uncertaintyNote ?? "No data." };
  }
  if (stale) {
    return { label: "Stale", tone: "warn", title: "Source older than freshness horizon — refresh required." };
  }
  if (noSources) {
    return { label: "Source validation required", tone: "bad", title: "No source citations recorded — claim cannot render as fact." };
  }
  if (record.dataStatus === "seed") {
    return { label: "Seed", tone: "warn", title: "Typed seed module — not source-backed evidence yet." };
  }
  if (record.dataStatus === "documented") {
    return {
      label: lowConfidence ? "Documented (low confidence)" : "Documented",
      tone: lowConfidence ? "warn" : "info",
      title: `${record.evidenceGrade} · ${record.sourceIds.length} source${record.sourceIds.length === 1 ? "" : "s"} · confidence ${record.confidenceScore}/100`,
    };
  }
  if (record.dataStatus === "tested") {
    return {
      label: "Tested",
      tone: lowConfidence ? "warn" : "info",
      title: `${record.evidenceGrade} · sandbox/API verification`,
    };
  }
  if (record.dataStatus === "estimated") {
    return { label: "Estimated", tone: "warn", title: record.uncertaintyNote ?? "Modelled estimate." };
  }
  if (record.dataStatus === "inferred") {
    return { label: "Inferred", tone: "warn", title: record.uncertaintyNote ?? "Inferred from related signals." };
  }
  return { label: "Unknown", tone: "neutral", title: "" };
}

/**
 * Returns true when the UI should explicitly show
 * "Source validation required" (or block the claim entirely).
 */
export function requiresValidation(record: TruthRecord): boolean {
  if (record.dataStatus === "unsupported") return true;
  if (record.dataStatus === "disputed") return true;
  if (record.sourceIds.length === 0 && record.dataStatus !== "unknown" && record.dataStatus !== "seed") return true;
  // Verified-claiming dataStatus without enough evidence to actually render verified
  if (VERIFIED_DATA_STATUSES.has(record.dataStatus) && !canRenderAsVerified(record)) return true;
  return false;
}

/**
 * Convenience: returns `true` only when the claim is safe to use in
 * high-confidence outputs (charts that imply fact, executive summaries).
 * Wraps canRenderAsVerified + a freshness sanity check.
 */
export function isHighConfidence(record: TruthRecord): boolean {
  return canRenderAsVerified(record) && record.freshnessStatus === "fresh" && record.confidenceScore >= 75;
}
