// Within-category multi-pillar composite ranking — deterministic engine.
// ───────────────────────────────────────────────────────────────────────────
// Replaces the single market-share proxy with a transparent, weighted composite
// over the FULL pillar framework (lib/types.ts PILLARS). Every rule below is a
// named constant; every operation is arithmetic on stored values → same DB
// state always yields the same ranking. No randomness, no seed/default fill.

import { PILLARS, type PillarId } from "../types";
import type { VendorPillarScore, Vendor, MarketShareEstimate } from "../intelligence/types";
import { isSeedSignedSource } from "../intelligence/provenance";
import type {
  CategoryRankedVendor,
  EvidenceCompleteness,
  PillarContribution,
} from "./composite-types";

// ── Tunable rules (one place, auditable) ─────────────────────────────────────
/** A pillar's evidence must be at least this confident to count. 40 = the
 *  low/medium tier boundary used elsewhere in the trust layer. */
export const MIN_PILLAR_CONFIDENCE = 40;
/** A vendor must have this fraction of total pillar weight evidenced to be
 *  RANKED. Below it, the vendor is "incomplete / insufficient evidence". */
export const COVERAGE_FLOOR = 0.6;
/** Pillars that MUST be evidenced for a vendor to rank, regardless of coverage.
 *  Enterprise Control is the heaviest pillar + the gate for regulated buyers. */
export const MANDATORY_PILLARS: PillarId[] = ["enterprise_control"];

/** Canonical weights — the product's stated rubric (lib/types.ts), NOT the
 *  personalized DEFAULT_WEIGHTS in repository.ts. Single source of truth. */
export const PILLAR_WEIGHTS: Record<PillarId, number> = Object.fromEntries(
  PILLARS.map((p) => [p.id, p.defaultWeight]),
) as Record<PillarId, number>;

const PILLAR_LABEL: Record<PillarId, string> = Object.fromEntries(
  PILLARS.map((p) => [p.id, p.label]),
) as Record<PillarId, string>;

/** Human-readable methodology line shown on every ranked surface. */
export const METHODOLOGY_NOTE =
  `Weighted composite of ${PILLARS.length} evidence-graded pillars (` +
  PILLARS.map((p) => `${p.label} ${Math.round(p.defaultWeight * 100)}%`).join(", ") +
  `), ranked within category. Only pillars with admissible evidence (grade E2+ and ≥` +
  `${MIN_PILLAR_CONFIDENCE}% confidence) count; each contributes its score × rubric weight × a ` +
  `confidence blend (0.7 + 0.3×confidence), and a missing pillar contributes zero — so coverage ` +
  `directly discounts the composite (selective evidence can never out-rank comprehensive evidence). ` +
  `A vendor needs ≥${Math.round(COVERAGE_FLOOR * 100)}% of pillar weight evidenced and a verified ` +
  `Enterprise Control pillar to be ranked — otherwise it is shown as “insufficient evidence”, never ` +
  `floated on a default. The shown confidence is the evidenced-pillar average, discounted for ` +
  `coverage (capped at 99%). Market share is context, not the rank.`;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Confidence blend — same shape used by the assessment engine / derive-scores:
 *  a pillar's score is trusted 70% baseline + up to 30% scaled by its confidence. */
function confidenceBlend(confidence: number): number {
  return 0.7 + 0.3 * (clamp(confidence, 0, 100) / 100);
}

/** A pillar counts ONLY when backed by real, admissible evidence: grade E2+
 *  (E0=none, E1=unverified vendor claim) AND confidence ≥ floor. */
export function pillarHasEvidence(p: VendorPillarScore | undefined): boolean {
  if (!p) return false;
  if (p.evidenceGrade === "E0" || p.evidenceGrade === "E1") return false;
  return p.confidence >= MIN_PILLAR_CONFIDENCE;
}

/** Coverage → completeness band (describes how much pillar weight is evidenced). */
export function evidenceCompletenessBand(coverage: number): EvidenceCompleteness {
  if (coverage >= 0.95) return "full";
  if (coverage >= 0.8) return "substantial";
  if (coverage >= COVERAGE_FLOOR) return "partial";
  return "insufficient";
}

/**
 * Score ONE vendor's composite from its pillar evidence. Pure + deterministic.
 * `rank` is assigned later by the category layer after sorting. Returns a fully
 * explainable CategoryRankedVendor (all pillars listed; dark ones honest).
 */
export function scoreVendorComposite(
  vendor: Pick<Vendor, "id" | "slug" | "name">,
  scores: VendorPillarScore[],
  share?: MarketShareEstimate,
): CategoryRankedVendor {
  const byPillar = new Map(scores.map((s) => [s.pillar, s]));

  // Covered weight = sum of base weights for pillars with admissible evidence.
  let coveredWeight = 0;
  for (const pillar of PILLARS) {
    if (pillarHasEvidence(byPillar.get(pillar.id))) coveredWeight += pillar.defaultWeight;
  }

  const missingMandatory = MANDATORY_PILLARS.filter(
    (mp) => !pillarHasEvidence(byPillar.get(mp)),
  );
  const incomplete = coveredWeight < COVERAGE_FLOOR || missingMandatory.length > 0;

  // Build per-pillar contributions for ALL pillars, in canonical order.
  const pillars: PillarContribution[] = PILLARS.map((pillar) => {
    const s = byPillar.get(pillar.id);
    const has = pillarHasEvidence(s);
    const base: PillarContribution = {
      pillar: pillar.id,
      label: pillar.label,
      baseWeight: pillar.defaultWeight,
      capabilityScore: null,
      confidence: null,
      evidenceGrade: s?.evidenceGrade ?? "E0",
      contribution: null,
      state: has ? "scored" : "insufficient_evidence",
      strengths: s?.strengths ?? [],
      risks: s?.risks ?? [],
      missingEvidence: s?.missingEvidence ?? [],
    };
    if (!has || !s) return base;
    // Evidenced pillar: always surface its score/confidence/grade. Contribution
    // uses the RUBRIC weight directly (NOT renormalized) — a missing pillar
    // contributes 0, so coverage discounts the composite and thin, selective
    // evidence can never out-rank comprehensive evidence.
    base.capabilityScore = s.capabilityScore;
    base.confidence = s.confidence;
    if (!incomplete) {
      base.contribution = s.capabilityScore * pillar.defaultWeight * confidenceBlend(s.confidence);
    }
    return base;
  });

  const marketContext = {
    estimatedShare: share?.estimatedShare ?? null,
    confidence: share?.confidence ?? null,
    source: share?.source ?? null,
    isSeedSource: isSeedSignedSource(share?.source),
  };

  if (incomplete) {
    const reason =
      missingMandatory.length > 0
        ? `${missingMandatory.map((m) => PILLAR_LABEL[m]).join(", ")} has no admissible (E2+) evidence`
        : `Only ${Math.round(coveredWeight * 100)}% of pillar weight is evidenced (need ${Math.round(
            COVERAGE_FLOOR * 100,
          )}%)`;
    return {
      vendorId: vendor.id,
      vendorSlug: vendor.slug,
      vendorName: vendor.name,
      rank: null,
      state: "incomplete",
      composite: null,
      compositeConfidence: null,
      evidenceCompleteness: evidenceCompletenessBand(coveredWeight),
      coverage: coveredWeight,
      pillars,
      marketContext,
      excludedReason: reason,
    };
  }

  // Ranked: composite = Σ(score × rubric-weight × confidence-blend) over covered
  // pillars. Missing pillars contribute 0 → coverage discounts the composite.
  const composite = clamp(
    pillars.reduce((sum, p) => sum + (p.contribution ?? 0), 0),
    0,
    100,
  );
  // Confidence = confidence-weighted average over EVIDENCED pillars, then
  // discounted for coverage (thinner evidence ⇒ lower confidence; capped < 100).
  const confNumerator = pillars.reduce(
    (sum, p) => sum + (p.state === "scored" ? p.baseWeight * (p.confidence ?? 0) : 0),
    0,
  );
  const avgConf = coveredWeight > 0 ? confNumerator / coveredWeight : 0;
  const coveragePenalty = 0.5 + 0.5 * coveredWeight;
  const compositeConfidence = clamp(Math.round(avgConf * coveragePenalty), 0, 99);

  return {
    vendorId: vendor.id,
    vendorSlug: vendor.slug,
    vendorName: vendor.name,
    rank: null, // assigned by the category layer after sorting
    state: "ranked",
    composite,
    compositeConfidence,
    evidenceCompleteness: evidenceCompletenessBand(coveredWeight),
    coverage: coveredWeight,
    pillars,
    marketContext,
  };
}

/** Deterministic comparator for ranked vendors (highest first). Tie-breaks:
 *  composite → compositeConfidence → coverage → estimatedShare → vendorId. */
export function compareRanked(a: CategoryRankedVendor, b: CategoryRankedVendor): number {
  const byComposite = (b.composite ?? 0) - (a.composite ?? 0);
  if (Math.abs(byComposite) > 1e-9) return byComposite;
  const byConf = (b.compositeConfidence ?? 0) - (a.compositeConfidence ?? 0);
  if (byConf !== 0) return byConf;
  const byCov = b.coverage - a.coverage;
  if (Math.abs(byCov) > 1e-9) return byCov;
  const byShare = (b.marketContext.estimatedShare ?? 0) - (a.marketContext.estimatedShare ?? 0);
  if (Math.abs(byShare) > 1e-9) return byShare;
  return a.vendorId.localeCompare(b.vendorId);
}
