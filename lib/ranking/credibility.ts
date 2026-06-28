// RANK-FIX — ranking credibility helpers (pure, deterministic, testable).
// ────────────────────────────────────────────────────────────────────────
// Three corrections to the within-category composite, none of which touch a
// pillar score or hand-place a vendor:
//   1. Coverage-discount: composite × TRUE domain coverage, so evidence
//      breadth is honestly rewarded (a missing domain contributes 0).
//   2. Natural-break TIERS: when adjusted composites sit inside the noise band
//      they are not statistically separable, so we present tiers, not a
//      false-precision 1-N order.
//   3. Sanity-check: flag any residual ordering where a materially thinner /
//      lower-confidence vendor still out-ranks a fuller / higher-confidence one.

/** Composite points within which an ordering is not statistically separable.
 *  NOISE_BAND is the 0–100 pillar scale; ASSESSMENT_NOISE_BAND the 0–5 domain
 *  scale (the unified ranking metric). Callers pass the one matching their scale. */
export const NOISE_BAND = 5;
export const ASSESSMENT_NOISE_BAND = 0.25;
/** Domain-coverage gap (fraction of 12 domains) considered "material" for the
 *  sanity-check (≈ 2 domains). */
export const MATERIAL_COVERAGE_GAP = 0.15;
/** Confidence-point gap considered "material" for the sanity-check. */
export const MATERIAL_CONFIDENCE_GAP = 10;

const TIER_LABELS = ["Leaders", "Contenders", "Emerging"] as const;

/** composite × domain coverage (the linear coverage-discount), one decimal. */
export function coverageAdjustedComposite(rawComposite: number, domainCoverage: number): number {
  const f = Math.max(0, Math.min(1, domainCoverage));
  return Math.round(rawComposite * f * 10) / 10;
}

export interface RankRow {
  vendorId: string;
  vendorName: string;
  rawComposite: number;
  adjustedComposite: number;
  domainCoverage: number;
  confidence: number;
}

/** Sort by adjusted composite, then breadth, then confidence, then id. */
export function compareAdjusted(a: RankRow, b: RankRow): number {
  const byAdj = b.adjustedComposite - a.adjustedComposite;
  if (Math.abs(byAdj) > 1e-9) return byAdj;
  const byCov = b.domainCoverage - a.domainCoverage;
  if (Math.abs(byCov) > 1e-9) return byCov;
  const byConf = b.confidence - a.confidence;
  if (byConf !== 0) return byConf;
  return a.vendorId.localeCompare(b.vendorId);
}

/** Whole-category discrimination: low when the adjusted spread is within noise. */
export function assessDiscrimination(adjusted: number[], noiseBand: number = NOISE_BAND): { low: boolean; spread: number } {
  if (adjusted.length < 2) return { low: false, spread: 0 };
  const spread = Math.max(...adjusted) - Math.min(...adjusted);
  return { low: spread < noiseBand, spread: Math.round(spread * 100) / 100 };
}

/**
 * Natural-break tiers over a DESC-sorted list of adjusted composites: a new tier
 * begins only where the gap to the previous vendor exceeds the noise band — so
 * vendors that aren't statistically separable share a tier (when everything is
 * within noise, all are "Leaders": honest about the lack of separation).
 */
export function assignTiers(sortedAdjustedDesc: number[], noiseBand: number = NOISE_BAND): string[] {
  let tierIdx = 0;
  return sortedAdjustedDesc.map((v, i) => {
    if (i > 0 && sortedAdjustedDesc[i - 1] - v > noiseBand) {
      tierIdx = Math.min(tierIdx + 1, TIER_LABELS.length - 1);
    }
    return TIER_LABELS[tierIdx];
  });
}

/**
 * Sanity-check the FINAL order: flag adjacent pairs where the higher-ranked
 * vendor is materially THINNER (lower domain coverage) or LESS confident than the
 * one just below it, while their adjusted composites are within the noise band —
 * i.e. an ordering a reviewer would (rightly) distrust. Returns human-readable
 * notes; empty when the order is clean.
 */
export function detectRankingAnomalies(sortedRows: RankRow[], noiseBand: number = NOISE_BAND): string[] {
  const notes: string[] = [];
  for (let i = 0; i < sortedRows.length - 1; i++) {
    const above = sortedRows[i];
    const below = sortedRows[i + 1];
    const withinNoise = Math.abs(above.adjustedComposite - below.adjustedComposite) < noiseBand;
    if (!withinNoise) continue;
    if (below.domainCoverage - above.domainCoverage > MATERIAL_COVERAGE_GAP) {
      notes.push(
        `${above.vendorName} ranks above ${below.vendorName} on a near-tied composite ` +
          `(${above.adjustedComposite} vs ${below.adjustedComposite}) despite thinner coverage ` +
          `(${Math.round(above.domainCoverage * 100)}% vs ${Math.round(below.domainCoverage * 100)}%).`,
      );
    } else if (below.confidence - above.confidence > MATERIAL_CONFIDENCE_GAP) {
      notes.push(
        `${above.vendorName} ranks above ${below.vendorName} on a near-tied composite ` +
          `(${above.adjustedComposite} vs ${below.adjustedComposite}) despite lower confidence ` +
          `(${above.confidence}% vs ${below.confidence}%).`,
      );
    }
  }
  return notes;
}
