// Within-category multi-pillar composite ranking — shared types.
// ───────────────────────────────────────────────────────────────────────────
// Public rankings are computed from the FULL pillar framework (the 6 user-facing
// pillars over the 12-domain backend, lib/types.ts), weighted + within-category +
// explainable — NOT the single market-share proxy they replaced. Every input is
// real, source-backed, confidence-tiered; pillars without admissible evidence
// render "insufficient evidence", never a default/seed value.

import type { EvidenceGrade, PillarId } from "../types";
import type { MarketCategory } from "../intelligence/types";

/** How completely a vendor's pillars are evidenced (by covered weight). */
export type EvidenceCompleteness = "full" | "substantial" | "partial" | "insufficient";

/** One pillar's contribution to (or exclusion from) a vendor's composite —
 *  the unit of explainability: score × weight × confidence-blend, with grade +
 *  source, or an explicit "insufficient_evidence" state. */
export interface PillarContribution {
  pillar: PillarId;
  label: string;
  /** Canonical weight from PILLARS (e.g. 0.25 for enterprise_control). */
  baseWeight: number;
  /** Renormalized weight over covered pillars; null when excluded. */
  effectiveWeight: number | null;
  /** 0–100; null when the pillar has insufficient evidence. */
  capabilityScore: number | null;
  /** 0–100; null when insufficient. */
  confidence: number | null;
  evidenceGrade: EvidenceGrade;
  /** capabilityScore × effectiveWeight × confidenceBlend; null when excluded. */
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
  /** Fraction of total pillar weight that is evidenced (0–1). */
  coverage: number;
  /** ALL pillars in canonical order; dark ones state="insufficient_evidence". */
  pillars: PillarContribution[];
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
  /** Deterministic, human-readable methodology (weights, floor, E2+ rule). */
  methodologyNote: string;
}
