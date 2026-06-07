// Evidence Object Model — Pack 03.
// ─────────────────────────────────
// The truth layer. Every externally visible intelligence claim should
// be traceable via: Claim → Evidence → Source → Date → Confidence →
// Freshness → Methodology → Publishability Status.

export type EvidenceGrade = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";

export const EVIDENCE_GRADE_LABEL: Record<EvidenceGrade, { label: string; multiplier: number }> = {
  E0: { label: "No evidence", multiplier: 0.0 },
  E1: { label: "Vendor claim only", multiplier: 0.4 },
  E2: { label: "Public documentation", multiplier: 0.6 },
  E3: { label: "Public test / sandbox / API verification", multiplier: 0.75 },
  E4: { label: "Production customer evidence", multiplier: 0.9 },
  E5: { label: "Independent audit / verified benchmark", multiplier: 1.0 },
};

export type SourceType =
  | "official_vendor_docs"
  | "pricing_page"
  | "model_card"
  | "trust_security_page"
  | "financial_filing"
  | "press_release"
  | "regulatory_publication"
  | "reputable_news"
  | "benchmark"
  | "customer_review"
  | "developer_platform"
  | "status_page"
  | "analyst_report"
  | "internal_research"
  | "seed"
  | "unknown";

export type LicenceStatus =
  | "approved"
  | "restricted"
  | "unknown"
  | "internal_only"
  | "do_not_display";

export type DataFreshness =
  | "fresh"
  | "acceptable"
  | "stale"
  | "expired"
  | "unknown";

export type PublishabilityStatus =
  | "publishable"
  | "publishable_with_caveat"
  | "internal_only"
  | "needs_review"
  | "blocked";

export type ReviewerStatus = "proposed" | "approved" | "rejected" | "needs_review";

export type ConflictResolution =
  | "unresolved"
  | "resolved_by_quality"
  | "resolved_by_recency"
  | "requires_human_review";

/* ─── Source Registry ────────────────────────────────────── */

export interface IntelligenceSource {
  id: string;
  name: string;
  url?: string;
  sourceType: SourceType;
  reliability: number; // 0–100
  licenceStatus: LicenceStatus;
  displayAllowed: boolean;
  refreshCadenceDays: number;
  owner: string;
  notes?: string;
}

/* ─── Evidence Item ──────────────────────────────────────── */

export interface EvidenceItem {
  id: string;
  claim: string;
  normalizedClaim: string;
  sourceId: string;
  sourceUrl?: string;
  sourceName: string;
  sourceType: SourceType;
  vendorIds: string[];
  capabilityIds?: string[];
  datePublished?: string;
  dateAccessed: string;
  evidenceGrade: EvidenceGrade;
  confidence: number;
  freshness: DataFreshness;
  licenceStatus: LicenceStatus;
  displayAllowed: boolean;
  extractedValue?: string | number | boolean;
  quote?: string;
  summary: string;
  reviewerStatus: ReviewerStatus;
  reviewerNotes?: string;
  publishabilityStatus: PublishabilityStatus;
}

/* ─── Source Conflict ─────────────────────────────────────── */

export interface SourceConflict {
  id: string;
  claim: string;
  evidenceA: EvidenceItem;
  evidenceB: EvidenceItem;
  resolution: ConflictResolution;
  analystNote?: string;
  resolvedAt?: string;
}

/* ─── Freshness Configuration ────────────────────────────── */

export const FRESHNESS_WINDOWS: Record<SourceType, number> = {
  pricing_page: 30,
  model_card: 90,
  official_vendor_docs: 120,
  trust_security_page: 180,
  financial_filing: 120,
  benchmark: 180,
  customer_review: 90,
  reputable_news: 30,
  press_release: 60,
  regulatory_publication: 365,
  developer_platform: 60,
  status_page: 7,
  analyst_report: 180,
  internal_research: 90,
  seed: 365,
  unknown: 30,
};
