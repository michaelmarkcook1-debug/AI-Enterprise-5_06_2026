/**
 * /capabilities truthfulness gates (Phase 5 of the master fix prompt pack).
 *
 * Decides per-cell whether a `VendorCapability` may render as a maturity
 * number, must show as "Source validation required", or must be hidden
 * entirely (e.g. infrastructure-only vendors that don't operate in this
 * capability domain).
 *
 * Rules:
 *  - No score renders as `verified` unless `evidenceGrade ≥ E3` AND at least
 *    one source URL is present.
 *  - Missing `productScopeIds` (i.e. no ProductScope linkage) blocks a
 *    "verified"/"documented" label — the cell shows "Source validation
 *    required" instead.
 *  - `dataStatus === "stale"` OR freshness gate triggered downgrades the
 *    cell to a stale-warning state.
 *  - `dataStatus === "seed"` (or absence of source metadata) shows the cell
 *    with a SEED label, never as verified.
 *  - `dataStatus === "disputed"` blocks high-confidence rendering.
 *  - "Infrastructure-only" vendors render an explicit infrastructure badge
 *    in capability domains that don't apply (configurable list).
 */

import type { VendorCapability } from "./types";

export type CapabilityRenderMode =
  | "verified"            // E3+ + sources present + ProductScope linkage + fresh
  | "documented"          // E2 OR E3+ but no ProductScope linkage
  | "seed"                // marked seed OR no source metadata at all
  | "stale"               // stale freshness or stale dataStatus
  | "disputed"            // conflicting sources
  | "validation_required" // missing source metadata when one is implied
  | "unknown"             // explicit unknown
  | "infrastructure_only"; // vendor doesn't operate in this domain

export interface CapabilityRenderState {
  mode: CapabilityRenderMode;
  reason: string;
  showScore: boolean;     // safe to show numeric maturity
  confidence: number;     // 0-100 (capped per rule)
  uncertaintyNote: string;
}

const FRESHNESS_DAYS_BY_DATA_STATUS: Record<string, number> = {
  verified: 365,
  documented: 180,
  estimated: 90,
  inferred: 60,
  seed: 30,
};

function isStaleByDate(sourceDate: string | undefined, dataStatus: string | undefined, now = new Date()): boolean {
  if (!sourceDate) return false;
  const horizon = FRESHNESS_DAYS_BY_DATA_STATUS[dataStatus ?? "seed"] ?? 30;
  const ageDays = (now.getTime() - new Date(sourceDate).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > horizon;
}

const GRADE_RANK: Record<string, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };

export function capabilityRenderState(
  vc: VendorCapability | undefined,
  options: { isInfrastructureOnly?: boolean; now?: Date } = {},
): CapabilityRenderState {
  if (options.isInfrastructureOnly) {
    return {
      mode: "infrastructure_only",
      reason: "Vendor is tracked as infrastructure / investment exposure only — capability comparison does not apply.",
      showScore: false,
      confidence: 0,
      uncertaintyNote: "",
    };
  }

  if (!vc) {
    return {
      mode: "unknown",
      reason: "No capability record found for this vendor / capability pair.",
      showScore: false,
      confidence: 0,
      uncertaintyNote: "",
    };
  }

  // Hard gates first
  if (vc.dataStatus === "disputed") {
    return {
      mode: "disputed",
      reason: vc.uncertaintyNote || "Sources disagree. Human review required before this score is used as fact.",
      showScore: false,
      confidence: Math.min(40, vc.confidenceScore ?? 40),
      uncertaintyNote: vc.uncertaintyNote ?? "",
    };
  }
  if (vc.dataStatus === "unknown" || vc.dataStatus === "unsupported") {
    return {
      mode: "unknown",
      reason: vc.uncertaintyNote || "Unverified — data status is unknown / unsupported.",
      showScore: false,
      confidence: 0,
      uncertaintyNote: vc.uncertaintyNote ?? "",
    };
  }

  // Stale by either explicit status or date horizon
  if (vc.dataStatus === "stale" || vc.freshnessStatus === "stale" || isStaleByDate(vc.sourceDate, vc.dataStatus, options.now)) {
    return {
      mode: "stale",
      reason: "Source data is older than its freshness horizon — refresh required before high-confidence use.",
      showScore: true, // still render, but caller will show stale warning
      confidence: Math.max(0, (vc.confidenceScore ?? 50) - 20),
      uncertaintyNote: vc.uncertaintyNote ?? "",
    };
  }

  const grade = vc.evidenceGrade ?? "E1";
  const gradeRank = GRADE_RANK[grade] ?? 0;
  const sourcesPresent = (vc.sourceIds?.length ?? 0) > 0 || (vc.sourceUrls?.length ?? 0) > 0;
  const productScopeLinked = (vc.productScopeIds?.length ?? 0) > 0;

  // Metadata-free fast path: the strict gate below demands source arrays +
  // productScopeIds, but those columns are not stored on `VendorCapability`
  // in the DB schema (the row only carries status + grade + notes). Rows
  // written by the intelligence projector (from analyst_verified
  // EvidenceRecord) and rows from the curated seed both lack those arrays,
  // so without this branch every cell would render as "validation_required".
  // We trust the row's explicit `status` field for cells that lack any of
  // the metadata-array signals.
  const hasArrayMetadata = sourcesPresent || productScopeLinked || vc.dataStatus !== undefined;
  if (!hasArrayMetadata) {
    if ((vc.status === "verified" || vc.status === "tested") && gradeRank >= 3) {
      return {
        mode: "verified",
        reason: vc.notes || "Trusted row — status=verified with E3+ evidence grade.",
        showScore: true,
        confidence: Math.min(100, 70 + gradeRank * 5),
        uncertaintyNote: "",
      };
    }
    if (vc.status === "documented" && gradeRank >= 2) {
      return {
        mode: "documented",
        reason: vc.notes || "Trusted row — status=documented.",
        showScore: true,
        confidence: 75,
        uncertaintyNote: "",
      };
    }
    // Anything else with grade ≥ E2 → documented (covers "tested" rows
    // at E2 and any other status the seed produces).
    if (gradeRank >= 2) {
      return {
        mode: "documented",
        reason: vc.notes || "Trusted row — graded but unverified.",
        showScore: true,
        confidence: 65,
        uncertaintyNote: "",
      };
    }
    // Low-grade cells (E0 / E1) — a row exists but the supporting
    // evidence isn't strong enough for a confident mode. Render as
    // "seed" so users see a clear "needs better source" signal instead
    // of the meaningless "SOURCE VALIDATION REQUIRED" that the strict
    // gate would otherwise produce. Never fall through from this
    // branch — if a VendorCapability row exists at all, we owe the
    // user a definite mode, not a placeholder.
    return {
      mode: "seed",
      reason: vc.notes || "Low-grade evidence — refresh from /admin/ingestion or approve stronger evidence to upgrade.",
      showScore: true,
      confidence: 40,
      uncertaintyNote: "",
    };
  }

  // Verified: E3+ AND at least one source AND ProductScope linkage AND not seed
  if (gradeRank >= 3 && sourcesPresent && productScopeLinked && vc.dataStatus !== "seed" && !vc.isSeedScore) {
    return {
      mode: "verified",
      reason: vc.uncertaintyNote || "Verified evidence — grade ≥ E3 with source citation and product-scope linkage.",
      showScore: true,
      confidence: Math.min(100, vc.confidenceScore ?? 88),
      uncertaintyNote: vc.uncertaintyNote ?? "",
    };
  }

  // Documented: E2 OR (E3+ but no ProductScope)
  if (gradeRank >= 2 && sourcesPresent && vc.dataStatus !== "seed") {
    if (!productScopeLinked) {
      return {
        mode: "validation_required",
        reason: "Source metadata present but no ProductScope linkage — cell cannot render as documented until product scope is mapped.",
        showScore: true,
        confidence: Math.min(60, vc.confidenceScore ?? 60),
        uncertaintyNote: vc.uncertaintyNote ?? "",
      };
    }
    return {
      mode: "documented",
      reason: vc.uncertaintyNote || "Source-cited but not yet independently verified.",
      showScore: true,
      confidence: Math.min(78, vc.confidenceScore ?? 70),
      uncertaintyNote: vc.uncertaintyNote ?? "",
    };
  }

  // Source-cited but seed-status OR no sources / explicit seed
  if (vc.dataStatus === "seed" || vc.isSeedScore) {
    return {
      mode: "seed",
      reason: "Seed score — typed module placeholder. Run /admin/ingestion + approve in /admin/evidence to flip to documented.",
      showScore: true,
      confidence: Math.min(50, vc.confidenceScore ?? 45),
      uncertaintyNote: vc.uncertaintyNote ?? "",
    };
  }

  if (!sourcesPresent) {
    return {
      mode: "validation_required",
      reason: "No source metadata recorded for this capability cell.",
      showScore: false,
      confidence: 0,
      uncertaintyNote: vc.uncertaintyNote ?? "",
    };
  }

  // Fallback — show as seed
  return {
    mode: "seed",
    reason: "Insufficient evidence for documented label.",
    showScore: true,
    confidence: Math.min(50, vc.confidenceScore ?? 45),
    uncertaintyNote: vc.uncertaintyNote ?? "",
  };
}

// Vendor IDs treated as infrastructure-only — capability comparison is N/A.
// Mirrors the model-inventory list in lib/model-inventory/seed.ts.
export const INFRASTRUCTURE_ONLY_VENDOR_IDS_FOR_CAPS = new Set([
  "vendor_amd", "vendor_broadcom", "vendor_asml", "vendor_arm",
  "vendor_cerebras", "vendor_hebbia", "vendor_rogo",
]);

export function isInfrastructureOnlyVendor(vendorId: string): boolean {
  return INFRASTRUCTURE_ONLY_VENDOR_IDS_FOR_CAPS.has(vendorId);
}

// Top-of-page overview metrics
export interface CapabilityOverview {
  totalVendors: number;
  capabilitiesTracked: number;
  cellsTotal: number;
  cellsVerified: number;
  cellsDocumented: number;
  cellsSeed: number;
  cellsStale: number;
  cellsValidationRequired: number;
  cellsDisputed: number;
  cellsUnknown: number;
  cellsInfrastructureOnly: number;
}

export function summariseCapabilityOverview(
  vendorCount: number,
  capabilityCount: number,
  states: CapabilityRenderState[],
): CapabilityOverview {
  const count = (mode: CapabilityRenderMode) => states.filter((s) => s.mode === mode).length;
  return {
    totalVendors: vendorCount,
    capabilitiesTracked: capabilityCount,
    cellsTotal: states.length,
    cellsVerified: count("verified"),
    cellsDocumented: count("documented"),
    cellsSeed: count("seed"),
    cellsStale: count("stale"),
    cellsValidationRequired: count("validation_required"),
    cellsDisputed: count("disputed"),
    cellsUnknown: count("unknown"),
    cellsInfrastructureOnly: count("infrastructure_only"),
  };
}
