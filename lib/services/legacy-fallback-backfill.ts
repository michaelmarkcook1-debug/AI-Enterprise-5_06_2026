// Legacy fallback backfill — pure detection rule.
// ────────────────────────────────────────────────
// The original migration only marked rows where classifierConfidence=0.5
// AND classifierRationale IS NULL. That gate was too narrow because the
// pre-fix sourcing runner kept the extractor's rationale on classifier
// failure (`?? proposal.rationale` at lib/sourcing/runner.ts:316 before
// the May-2026 repair). Result: 312 of 314 legacy fallback rows missed
// the backfill.
//
// The correct detector (per requirements):
//   status = pending
//   classifierConfidence = 0.5
//   classificationFailed is null/false  (not yet backfilled)
//   confidenceIsFallback is null/false  (not yet backfilled)
//   classificationFailureCode is null
//
// This MUST NOT match:
//   - rows with real classifier output (e.g. 0.91, 0.92 — non-0.5)
//   - rows already marked classificationFailed=true (idempotent re-run)
//   - rows with a non-pending status (approved/rejected/superseded)
//
// Pure helper — used by the script and the tests.

export interface LegacyFallbackCandidate {
  status: string;
  classifierConfidence: number;
  classificationFailed?: boolean | null;
  confidenceIsFallback?: boolean | null;
  classificationFailureCode?: string | null;
}

export const LEGACY_FALLBACK_CODE = "legacy_fallback_0_5";
export const LEGACY_FALLBACK_REASON =
  "Legacy fallback confidence row created before failure metadata existed";

/** Returns true iff this proposal should be backfilled as a legacy
 * classifier-fallback row.
 *
 * The 0.5 check is exact (`===`) — a real classifier returning 0.5 by
 * coincidence is statistically possible but vanishingly rare given the
 * rest of the gate (the same row would also need to lack failure
 * metadata). The two known real-classifier rows in the May-2026 data
 * sit at 0.91 and 0.92 and are excluded by the exact-0.5 check. */
export function isLegacyFallbackRow(p: LegacyFallbackCandidate): boolean {
  if (p.status !== "pending") return false;
  if (p.classifierConfidence !== 0.5) return false;
  if (p.classificationFailed === true) return false;
  if (p.confidenceIsFallback === true) return false;
  if (p.classificationFailureCode != null) return false;
  return true;
}
