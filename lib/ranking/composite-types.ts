// Within-category multi-pillar composite ranking — shared types.
// ───────────────────────────────────────────────────────────────────────────
// Public rankings are computed from the FULL pillar framework (the 6 user-facing
// pillars over the 12-domain backend, lib/types.ts), weighted + within-category +
// explainable — NOT the single market-share proxy they replaced. Every input is
// real, source-backed, confidence-tiered; pillars without admissible evidence
// render "insufficient evidence", never a default/seed value.

import type { EvidenceGrade, PillarId } from "../types";
import type { MarketCategory } from "../intelligence/types";
import type { DomainWeights, RankPillar } from "../assessment/composite";

/** How completely a vendor's pillars are evidenced (by covered weight). */
export type EvidenceCompleteness = "full" | "substantial" | "partial" | "insufficient";

/** One pillar's contribution to (or exclusion from) a vendor's composite —
 *  the unit of explainability: score × weight × confidence-blend, with grade +
 *  source, or an explicit "insufficient_evidence" state. */
export interface PillarContribution {
  pillar: PillarId;
  label: string;
  /** Canonical rubric weight from PILLARS (e.g. 0.25 for enterprise_control).
   *  Contributions use this weight directly — a missing pillar contributes 0, so
   *  coverage discounts the composite (no renormalization). */
  baseWeight: number;
  /** 0–100; null when the pillar has insufficient evidence. */
  capabilityScore: number | null;
  /** 0–100; null when insufficient. */
  confidence: number | null;
  evidenceGrade: EvidenceGrade;
  /** capabilityScore × rubric weight × confidenceBlend; null when excluded. */
  contribution: number | null;
  state: "scored" | "insufficient_evidence";
  /** Why this pillar is dark / what would lift it (from VendorPillarScore). */
  strengths: string[];
  risks: string[];
  missingEvidence: string[];
}

/** A vendor's standing within ONE category: either ranked (enough evidenced
 *  pillars) or incomplete (held as "insufficient evidence"). */
export interface CategoryRankedVendor {
  vendorId: string;
  vendorSlug: string;
  vendorName: string;
  /** 1-based rank within the category; null when incomplete. */
  rank: number | null;
  state: "ranked" | "incomplete";
  /** Weighted composite 0–100; null when incomplete. */
  composite: number | null;
  /** Coverage-aware confidence 0–99; null when incomplete. */
  compositeConfidence: number | null;
  evidenceCompleteness: EvidenceCompleteness;
  /** Fraction of total pillar weight that is evidenced (0–1). NB: pillar-level —
   *  a pillar counts as covered with one admissible score, so this can read ~1.0
   *  while DOMAIN coverage is partial. The user-facing coverage label uses the
   *  domain figures below (RANK-FIX: label-truth). */
  coverage: number;
  /** RANK-FIX — TRUE domain coverage: evidenced (non-insufficient) assessment
   *  domains out of 12. This is what the scorecard strip shows, so labels read
   *  off it and never contradict the strip. */
  domainScored: number;
  domainTotal: number;
  domainCoverage: number; // domainScored / domainTotal (0–1)
  /** UNIFIED ranking metric — the 12-domain assessment composite (0–5,
   *  coverage-discounted), the SAME computeWeightedComposite the interactive
   *  re-rank uses. The ranking SORTS and DISPLAYS by this, so the static order
   *  and the live re-rank (CategoryRerank at default weights) are identical by
   *  construction — no surprise reshuffle. null when held. */
  assessmentComposite: number | null;
  /** RANK-FIX — tier band (Leaders / Contenders / Emerging) for honest
   *  presentation when composites are within the noise band; null when incomplete. */
  tier: string | null;
  /** ALL pillars in canonical order; dark ones state="insufficient_evidence".
   *  LEGACY (separate pillar-score composite) — retained for non-ranking uses;
   *  the "Why this rank" table uses `rankPillars` below, which is derived from
   *  the actual ranking composite and therefore consistent with the rank. */
  pillars: PillarContribution[];
  /** UNIFIED "Why this rank" breakdown — the 6 pillars rolled up from the SAME
   *  per-domain contributions that produce `assessmentComposite`, so summing the
   *  contributions reproduces the composite and matches the rank order. */
  rankPillars: RankPillar[];
  /** Market share shown as CONTEXT only — never the rank. */
  marketContext: {
    estimatedShare: number | null;
    confidence: number | null;
    source: string | null;
    isSeedSource: boolean;
  };
  /** Set when state="incomplete" — e.g. "Enterprise Control has no E2+ evidence". */
  excludedReason?: string;
}

/** A category's full within-category composite ranking. */
export interface CategoryComposite {
  category: MarketCategory;
  ranked: CategoryRankedVendor[];
  incomplete: CategoryRankedVendor[];
  /** Whole block gates on this (provenance live + real evidence). */
  isLive: boolean;
  /** Deterministic, human-readable methodology (per-category weighting + rationale,
   *  coverage-discount, floor, tiers). */
  methodologyNote: string;
  /** The resolved per-category DEFAULT domain weights driving BOTH the static
   *  order above and the interactive re-rank — so they are identical at the
   *  category default by construction. Serializable (raw; renormalized on use). */
  resolvedDomainWeights: DomainWeights;
  /** RANK-FIX — true when the ranked vendors' adjusted composites sit inside the
   *  noise band (not statistically separable): the UI then leads with tier bands
   *  + a "thin evidence — limited discrimination" note instead of false-precision
   *  1-N order. */
  lowDiscrimination: boolean;
  /** RANK-FIX — sanity-check: human-readable notes where a materially thinner /
   *  lower-confidence vendor still out-ranks a fuller / higher-confidence one
   *  (logged for review; surfaced subtly). Empty when the order is clean. */
  anomalies: string[];
}
