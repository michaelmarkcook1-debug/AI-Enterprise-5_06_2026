// Phase 3 Assessment — deterministic, firewalled domain rubric.
// ────────────────────────────────────────────────────────────
// PURE: no DB, no LLM, no writes. Maps a vendor's analyst_verified evidence
// rows for one domain → a single 0–5 score (or an explicit insufficient-evidence
// sentinel), with calibrated confidence, a low-confidence flag, and citations.
//
// The 0–5 scale is defined by EVIDENCE STANDARD (per Enterprise_AI_Assessment_
// Framework_v2.docx), NOT a linear rescale of the 0–100 rawScore:
//   0 not available/failed · 1 claimed, unevidenced · 2 basic, weak proof ·
//   3 pilot with limitations · 4 enterprise-ready, evidenced ·
//   5 enterprise-grade, independently verified/audit-ready.
// The grade present CAPS the band (you cannot reach 4–5 without E4/E5 audit-grade
// evidence); rawScore/confidence/recency only POSITION the score within the cap.
// Absence of evidence is "insufficient evidence" — never a guessed number or 0
// (the under-claim rule). This module never writes a stored score, so no
// commercial/vendor process can move these numbers.

import { DOMAIN_TO_PILLAR, EVIDENCE_MODIFIER, type DomainId, type EvidenceGrade, type PillarId } from "../types";
import { freshnessFactor } from "../engine";

// ── The 12 framework assessment domains (canonical order = framework weight
//    table). `market_position` is the 13th DomainId — a market-share dimension,
//    NOT a framework assessment domain — so it is deliberately excluded here.
export const ASSESSMENT_DOMAINS: DomainId[] = [
  "strategic_value",
  "data_security_privacy",
  "identity_access",
  "model_reliability",
  "governance_compliance",
  "security_threat",
  "integration_architecture",
  "agentic_autonomy",
  "cost_finops",
  "workforce_adoption",
  "vendor_maturity_lockin",
  "capital_resilience",
];

// Framework default domain weights (sum = 1.0). Static reference data from the
// framework doc — shown for context now; the live re-weighting UI is Wave 2.
export const DOMAIN_WEIGHT: Record<DomainId, number> = {
  strategic_value: 0.09,
  data_security_privacy: 0.11,
  identity_access: 0.09,
  model_reliability: 0.08,
  governance_compliance: 0.11,
  security_threat: 0.08,
  integration_architecture: 0.08,
  agentic_autonomy: 0.08,
  cost_finops: 0.07,
  workforce_adoption: 0.07,
  vendor_maturity_lockin: 0.07,
  capital_resilience: 0.07,
  model_quality: 0.0, // category-scoped capability domain — 0 in the framework default,
  //                     activated only by category weight profiles (e.g. frontier_model_api)
  market_position: 0.0, // not an assessment domain
};

// Best evidence grade present → maximum achievable 0–5 band. This is the
// under-claim core: a domain's score can never exceed the standard its evidence
// actually demonstrates.
export const GRADE_BAND_CAP: Record<EvidenceGrade, 1 | 2 | 3 | 4 | 5> = {
  E0: 1, // no real evidence behind it → at most "claimed, unevidenced"
  E1: 1, // vendor claim only
  E2: 2, // public documentation → "basic capability, weak proof"
  E3: 3, // public test / sandbox / API verification → "pilot with limitations"
  E4: 4, // production customer evidence → "enterprise-ready with evidence"
  E5: 5, // independent audit / verified benchmark → "enterprise-grade, verified"
};

const GRADE_RANK: Record<EvidenceGrade, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };

export const LOW_CONFIDENCE_FLOOR = 50;

export type DomainBand = 0 | 1 | 2 | 3 | 4 | 5;
export type DomainBandLabel =
  | "not_available"
  | "claimed_unevidenced"
  | "basic_weak_proof"
  | "pilot_with_limits"
  | "enterprise_ready"
  | "enterprise_grade";

export const DOMAIN_BAND_LABEL: Record<DomainBand, DomainBandLabel> = {
  0: "not_available",
  1: "claimed_unevidenced",
  2: "basic_weak_proof",
  3: "pilot_with_limits",
  4: "enterprise_ready",
  5: "enterprise_grade",
};

export const DOMAIN_BAND_TEXT: Record<DomainBandLabel, string> = {
  not_available: "Not available / failed",
  claimed_unevidenced: "Claimed, not evidenced",
  basic_weak_proof: "Basic capability, weak proof",
  pilot_with_limits: "Works in pilot, with limitations",
  enterprise_ready: "Enterprise-ready, evidenced",
  enterprise_grade: "Enterprise-grade, independently verified",
};

/** One analyst_verified evidence row, narrowed to what the rubric needs. */
export interface RubricEvidenceRow {
  evidenceGrade: EvidenceGrade;
  rawScore: number; // 0..100
  confidence: number | null; // 0..100 | null
  capturedAt: Date;
  sourceUrl: string | null;
}

export interface DomainCitation {
  sourceUrl: string;
  evidenceGrade: EvidenceGrade;
  capturedAt: string; // ISO
}

export interface InsufficientDomainScore {
  domain: DomainId;
  pillar: PillarId;
  state: "insufficient_evidence";
}

export interface ScoredDomainScore {
  domain: DomainId;
  pillar: PillarId;
  state: "scored";
  score: number; // 0..5, one decimal, never above the grade cap
  band: DomainBand; // integer band the score sits in
  bandLabel: DomainBandLabel; // describes the evidence standard achieved (cap)
  confidence: number; // 0..99
  lowConfidence: boolean;
  bestGrade: EvidenceGrade;
  evidenceCount: number;
  citations: DomainCitation[];
}

export type DomainScore = ScoredDomainScore | InsufficientDomainScore;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Score ONE domain from its analyst_verified rows. Empty rows → explicit
 * insufficient-evidence sentinel (no number). Deterministic: same rows + same
 * `now` → same output.
 */
export function scoreDomainFromEvidence(
  domain: DomainId,
  rows: RubricEvidenceRow[],
  now: Date = new Date(),
): DomainScore {
  const pillar = DOMAIN_TO_PILLAR[domain];

  // 1. Under-claim rule: no real evidence → insufficient, never 0.
  if (rows.length === 0) {
    return { domain, pillar, state: "insufficient_evidence" };
  }

  // 2. Best grade → hard band cap.
  const bestGrade = rows.reduce<EvidenceGrade>(
    (best, r) => (GRADE_RANK[r.evidenceGrade] > GRADE_RANK[best] ? r.evidenceGrade : best),
    "E0",
  );
  const cap = GRADE_BAND_CAP[bestGrade];

  // 3. Weighted rawScore position within the capped band.
  let weightSum = 0;
  let weightedRaw = 0;
  let rawMean = 0;
  for (const r of rows) {
    const w = EVIDENCE_MODIFIER[r.evidenceGrade] * freshnessFactor(r.capturedAt.toISOString(), now);
    weightSum += w;
    weightedRaw += r.rawScore * w;
    rawMean += r.rawScore;
  }
  rawMean /= rows.length;
  // Fallback to the simple mean when every row has zero weight (all E0).
  const positionFrac = clamp((weightSum > 0 ? weightedRaw / weightSum : rawMean) / 100, 0, 1);

  // 4. Compose the 0–5 score inside the top achievable band, hard-capped.
  const rawBand = cap - 1 + positionFrac;
  const score = Math.round(Math.min(rawBand, cap) * 10) / 10;
  const band = clamp(Math.round(score), 0, 5) as DomainBand;
  const bandLabel = DOMAIN_BAND_LABEL[cap]; // label = the evidence standard achieved

  // 5. Calibrated confidence: depth term blended with average row confidence.
  const depthConf = 40 + 45 * (1 - Math.exp(-rows.length / 5));
  const rowConfs = rows.map((r) =>
    r.confidence != null
      ? r.confidence
      : EVIDENCE_MODIFIER[r.evidenceGrade] * freshnessFactor(r.capturedAt.toISOString(), now) * 100,
  );
  const avgRowConf = rowConfs.reduce((s, c) => s + c, 0) / rowConfs.length;
  const confidence = Math.round(clamp(0.6 * depthConf + 0.4 * avgRowConf, 0, 99));
  const lowConfidence = confidence < LOW_CONFIDENCE_FLOOR || cap <= 2 || rows.length === 1;

  // 6. Citations: rows with a URL, newest first, deduped by URL.
  const citations: DomainCitation[] = [];
  const seen = new Set<string>();
  for (const r of [...rows].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())) {
    if (!r.sourceUrl || seen.has(r.sourceUrl)) continue;
    seen.add(r.sourceUrl);
    citations.push({ sourceUrl: r.sourceUrl, evidenceGrade: r.evidenceGrade, capturedAt: r.capturedAt.toISOString() });
  }

  return {
    domain,
    pillar,
    state: "scored",
    score,
    band,
    bandLabel,
    confidence,
    lowConfidence,
    bestGrade,
    evidenceCount: rows.length,
    citations,
  };
}

/**
 * Score all 12 framework domains. Always returns one entry per ASSESSMENT_DOMAIN
 * in canonical order (scored or insufficient) — the scorecard never hides a gap.
 */
export function scoreAllDomains(
  rowsByDomain: Map<DomainId, RubricEvidenceRow[]>,
  now: Date = new Date(),
): DomainScore[] {
  return ASSESSMENT_DOMAINS.map((domain) => scoreDomainFromEvidence(domain, rowsByDomain.get(domain) ?? [], now));
}
