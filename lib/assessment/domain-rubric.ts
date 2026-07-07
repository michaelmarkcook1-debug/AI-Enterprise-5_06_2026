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

// ── The 13 framework assessment domains (canonical order = framework weight
//    table). `market_position` is category-scoped (a market-share dimension,
//    see market-position-rubric.ts) — deliberately excluded here.
//    `sovereignty_residency` (added 2026-07-08) IS a full framework domain —
//    universal, scored from real EvidenceRecord rows via the SAME rubric as
//    every other domain below (scoreDomainFromEvidence), so it needs no
//    special-cased synthesis path the way model_quality/dev_sentiment/
//    market_position do.
export const ASSESSMENT_DOMAINS: DomainId[] = [
  "strategic_value",
  "data_security_privacy",
  "identity_access",
  "model_reliability",
  "governance_compliance",
  "sovereignty_residency", // grouped with the other enterprise_control domains — same position as RANKABLE_DOMAIN_ORDER
  "security_threat",
  "integration_architecture",
  "agentic_autonomy",
  "cost_finops",
  "workforce_adoption",
  "vendor_maturity_lockin",
  "capital_resilience",
];

// Framework default domain weights. The 12 original domains sum to 1.00 by
// design (static reference data from the framework doc). sovereignty_residency
// is added RAW on top (0.08, ~"an 8th-ish share" before renormalization) —
// same additive-then-renormalize mechanism as market_position/dev_sentiment
// (composite.ts normalizeWeights renormalizes the ACTIVE set at every point of
// use), so this hand-designed base object keeps its original, readable values
// rather than being manually rescaled into odd decimals.
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
  market_position: 0.0, // category-scoped — activated via category profiles (frontier_model_api, developer_coding_agent)
  dev_sentiment: 0.0, // category-scoped (coding models) — 0 in the framework default,
  //                     activated only by the coding category profiles when DEV_SENTIMENT_IN_RANKING
  // Universal — every category, every vendor. Renormalized proportionally
  // against the 12 above wherever weights are actually used (normalizeWeights).
  sovereignty_residency: 0.08,
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
 * Sovereignty & Data Residency — purpose-built rubric, NOT scoreDomainFromEvidence.
 * ─────────────────────────────────────────────────────────────────────────────
 * A RISK-shaped domain: every OTHER domain is "more/stronger evidence of a
 * capability → higher score." This one is different by nature — real, cited
 * evidence of an ADVERSE jurisdiction fact (e.g. a government-confirmed
 * compelled-disclosure regime) must score LOW, not high, no matter how
 * well-verified that fact is. scoreDomainFromEvidence() cannot be reused: its
 * grade-caps-a-band formula always floors the score at (grade_cap − 1), so a
 * well-evidenced BAD fact would score erroneously HIGH — exactly backwards.
 * This function decouples the two dimensions cleanly:
 *   • evidenceGrade (E0–E5) — ONLY how well-verified/citable the fact is.
 *   • rawScore (0–100) — ONLY how safe/controlled the fact makes the vendor,
 *     per the published tiers below. Higher = safer, same "higher is better"
 *     convention as every other domain, so it composes correctly into the
 *     weighted-sum composite with no special-casing downstream.
 * Grade still bounds CONFIDENCE (weak evidence → lower confidence either way,
 * same discipline as every other domain) — just not the score's direction.
 *
 * Published tiers (documented rationale, SAME criteria for every vendor —
 * never tuned to a target):
 *   HIGH (75–100): home/hosting jurisdiction requires judicial or legal
 *                  process for state data-access requests; no documented
 *                  third-party government restriction tied to data-security
 *                  or sovereignty concerns; a genuine sovereign/in-region
 *                  hosting option is a bonus toward the top of this band.
 *   MID  (40–74):  due-process-gated jurisdiction, but no dedicated
 *                  sovereign/in-region hosting guarantee (a baseline
 *                  hyperscaler-style default).
 *   LOW  (0–39):   credible, cited reporting that the vendor's data is
 *                  processed under a legal regime with broad, non-recourse
 *                  compelled state-disclosure authority, and/or a documented
 *                  pattern of adverse third-party government action
 *                  specifically citing data-security/sovereignty concerns.
 * NOT a blanket nationality penalty: every vendor is scored against the SAME
 * three criteria (due process, documented restrictions, sovereign-hosting
 * option) regardless of country. A due-process-gated jurisdiction with no
 * adverse action scores HIGH whether that's the US, EU, Canada, or elsewhere;
 * the US's own CLOUD Act / FISA 702 reach is a real, citable fact reflected in
 * the tier, not waved away.
 */
export function scoreSovereigntyDomain(rows: RubricEvidenceRow[], now: Date = new Date()): DomainScore {
  const domain: DomainId = "sovereignty_residency";
  const pillar = DOMAIN_TO_PILLAR[domain];

  if (rows.length === 0) {
    return { domain, pillar, state: "insufficient_evidence" };
  }

  const bestGrade = rows.reduce<EvidenceGrade>(
    (best, r) => (GRADE_RANK[r.evidenceGrade] > GRADE_RANK[best] ? r.evidenceGrade : best),
    "E0",
  );

  // Weighted position, 0–1 — same weighting (grade × freshness) as every other
  // domain, but mapped DIRECTLY to the final score, with no grade-band floor.
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
  const positionFrac = clamp((weightSum > 0 ? weightedRaw / weightSum : rawMean) / 100, 0, 1);

  const score = Math.round(positionFrac * 5 * 10) / 10;
  const band = clamp(Math.round(score), 0, 5) as DomainBand;
  // bandLabel is derived from the SCORE's own band, not the grade's cap — for
  // this domain a high evidence grade does not imply a favorable outcome, so
  // anchoring the label to grade would misleadingly read as positive next to
  // a low number (e.g. a well-evidenced compelled-disclosure finding showing
  // "enterprise-grade, independently verified").
  const bandLabel = DOMAIN_BAND_LABEL[band];

  const depthConf = 40 + 45 * (1 - Math.exp(-rows.length / 5));
  const rowConfs = rows.map((r) =>
    r.confidence != null
      ? r.confidence
      : EVIDENCE_MODIFIER[r.evidenceGrade] * freshnessFactor(r.capturedAt.toISOString(), now) * 100,
  );
  const avgRowConf = rowConfs.reduce((s, c) => s + c, 0) / rowConfs.length;
  const confidence = Math.round(clamp(0.6 * depthConf + 0.4 * avgRowConf, 0, 99));
  const lowConfidence = confidence < LOW_CONFIDENCE_FLOOR || GRADE_BAND_CAP[bestGrade] <= 2 || rows.length === 1;

  const citations: DomainCitation[] = [];
  const seen = new Set<string>();
  for (const r of [...rows].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())) {
    if (!r.sourceUrl || seen.has(r.sourceUrl)) continue;
    seen.add(r.sourceUrl);
    citations.push({ sourceUrl: r.sourceUrl, evidenceGrade: r.evidenceGrade, capturedAt: r.capturedAt.toISOString() });
  }

  return { domain, pillar, state: "scored", score, band, bandLabel, confidence, lowConfidence, bestGrade, evidenceCount: rows.length, citations };
}

/**
 * Score all 13 framework domains. Always returns one entry per ASSESSMENT_DOMAIN
 * in canonical order (scored or insufficient) — the scorecard never hides a gap.
 * sovereignty_residency uses its own purpose-built rubric above (see comment
 * there); every other domain uses the standard scoreDomainFromEvidence.
 */
export function scoreAllDomains(
  rowsByDomain: Map<DomainId, RubricEvidenceRow[]>,
  now: Date = new Date(),
): DomainScore[] {
  return ASSESSMENT_DOMAINS.map((domain) =>
    domain === "sovereignty_residency"
      ? scoreSovereigntyDomain(rowsByDomain.get(domain) ?? [], now)
      : scoreDomainFromEvidence(domain, rowsByDomain.get(domain) ?? [], now),
  );
}
