// Display calibration — a within-category STANDING band shown beside the raw
// composite.
// ─────────────────────────────────────────────────────────────────────────────
// The 0–5 composite is evidence-CAPPED (only E4/E5 evidence reaches 4–5), so it
// measures evidenced quality, not competitive standing — a category #1 can sit
// anywhere from ~1.6 to ~3.4/5, and reads "mediocre" to a buyer who takes it as a
// grade. This layer restores the missing context: a qualitative band + the
// factual within-category standing, DERIVED FROM the already-computed rank +
// coverage + confidence. It is DISPLAY ONLY — it never changes a score, a
// composite, or the ordering (those are byte-identical before/after).
//
// Honesty gate (the "no over-claim" rule, CLAUDE.md): the top "Leader" badge
// requires BOTH a top within-category rank AND real evidence depth. A vendor that
// leads a thinly-evidenced field (low coverage/confidence) is shown as an
// "Emerging leader" with a "limited evidence" qualifier — never a confident
// "Leader". Grounded in the live distribution: every category #1 clears the bar
// except ai_silicon's leader (67% coverage / 60 confidence), whose #1 rests on
// genuinely thin evidence.
//
// NB: the existing assignTiers() (credibility.ts) is deliberately NOT reused as
// the band source — its natural-break rule collapses a statistically
// inseparable field to all-"Leaders" (its own doc comment), so an entire
// compressed, thin-evidence category would read "Leaders". That is exactly the
// over-claim this layer must prevent, so the band is rank + evidence here.

export type CalibrationBand = "Leader" | "Emerging leader" | "Strong" | "Contender" | "Emerging";

export interface Calibration {
  band: CalibrationBand;
  /** Within-category percentile from rank (1 = top of field, 0 = bottom). */
  percentile: number;
  /** Coverage/confidence below the strong-evidence bar → the badge is hedged
   *  ("Emerging leader" not "Leader") and a "limited evidence" qualifier shows. */
  limitedEvidence: boolean;
  /** Factual standing string, e.g. "#1 of 14" — never an inferred claim. */
  standingLabel: string;
}

/** Strong-evidence bar — BOTH must hold. Coverage is a fraction (0–1); confidence
 *  is 0–100, matching CategoryRankedVendor.domainCoverage / compositeConfidence. */
export const STRONG_COVERAGE = 0.85;
export const STRONG_CONFIDENCE = 70;

/** Percentile cut-points for the standing bands. Top band is additionally
 *  evidence-gated (see calibrationBand). */
export const LEADER_PERCENTILE = 0.85;
export const STRONG_PERCENTILE = 0.55;
export const CONTENDER_PERCENTILE = 0.3;

/**
 * Pure. Given a vendor's already-computed within-category rank + evidence
 * figures, return the display band. Only meaningful for RANKED vendors (a held /
 * insufficient-evidence vendor has no composite and gets no band — callers must
 * not invoke this for them).
 */
export function calibrationBand(
  rank: number,
  rankedCount: number,
  coverage: number, // 0–1 (domainCoverage)
  confidence: number, // 0–100 (compositeConfidence)
): Calibration {
  // Defensive: a nonsensical field size can't yield a standing — treat as bottom.
  const safeCount = Math.max(1, rankedCount);
  const safeRank = Math.min(Math.max(1, rank), safeCount);
  // #1 → 1, last → 0. A sole ranked vendor is trivially top of its field.
  const percentile = safeCount <= 1 ? 1 : (safeCount - safeRank) / (safeCount - 1);

  const strongEvidence = coverage >= STRONG_COVERAGE && confidence >= STRONG_CONFIDENCE;
  const limitedEvidence = !strongEvidence;

  let band: CalibrationBand;
  if (percentile >= LEADER_PERCENTILE) {
    // Leads the field — but only a well-evidenced lead earns the confident badge.
    band = strongEvidence ? "Leader" : "Emerging leader";
  } else if (percentile >= STRONG_PERCENTILE) {
    band = "Strong";
  } else if (percentile >= CONTENDER_PERCENTILE) {
    band = "Contender";
  } else {
    band = "Emerging";
  }

  return { band, percentile, limitedEvidence, standingLabel: `#${safeRank} of ${safeCount}` };
}
