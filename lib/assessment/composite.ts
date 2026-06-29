// Phase 3 Assessment — Wave 2 weighted composite (deterministic, pure).
// ──────────────────────────────────────────────────────────────────────
// Combines Wave 1's per-domain 0–5 scores with the viewing user's domain
// weights into a single 0–5 composite + within-category re-rank. PURE: no DB,
// no LLM, no network, no mutation of the input scorecard — it is run CLIENT-SIDE
// on already-computed scores, so re-weighting is instant and a user's weights
// can NEVER touch a canonical/stored score or another user's view.
//
// Coverage-discount + honesty (mirrors lib/ranking/composite-engine.ts): an
// insufficient-evidence domain contributes 0 but its weight still counts in the
// denominator, so re-weighting can never conjure a score or hide thin coverage.

import { DOMAIN_TO_PILLAR, type DomainId, type PillarId } from "../types";
import { ASSESSMENT_DOMAINS, DOMAIN_WEIGHT, type DomainScore } from "./domain-rubric";

export type DomainWeights = Record<DomainId, number>;

/** Framework default weights over the 12 assessment domains (sum = 1). */
export const DEFAULT_DOMAIN_WEIGHTS: DomainWeights = ASSESSMENT_DOMAINS.reduce((acc, d) => {
  acc[d] = DOMAIN_WEIGHT[d];
  return acc;
}, {} as DomainWeights);

/** A vendor below this share of weight-on-scored-domains is "held" rather than
 *  ranked — you cannot re-weight your way out of thin coverage. Matches the
 *  rankings engine's COVERAGE_FLOOR. */
export const ASSESSMENT_COVERAGE_FLOOR = 0.6;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Score trusted 70% baseline + up to 30% scaled by confidence (same shape as
 *  the rankings engine + derive-scores). */
function confidenceBlend(confidence: number): number {
  return 0.7 + 0.3 * (clamp(confidence, 0, 100) / 100);
}

/**
 * Clamp weights non-negative and renormalize the 12 assessment domains to sum 1
 * (sliders express RELATIVE importance). All-zero → equal weights (no div-by-0).
 */
export function normalizeWeights(weights: Partial<DomainWeights>): DomainWeights {
  const raw = ASSESSMENT_DOMAINS.map((d) => Math.max(0, weights[d] ?? 0));
  const sum = raw.reduce((s, w) => s + w, 0);
  const out = {} as DomainWeights;
  ASSESSMENT_DOMAINS.forEach((d, i) => {
    out[d] = sum > 0 ? raw[i] / sum : 1 / ASSESSMENT_DOMAINS.length;
  });
  return out;
}

export interface DomainContribution {
  domain: DomainId;
  pillar: PillarId;
  weight: number; // normalized 0–1
  score: number | null; // 0–5 (null when insufficient)
  contribution: number | null; // score × weight × confidenceBlend (null when insufficient)
  confidence: number | null;
  state: "scored" | "insufficient_evidence";
}

export interface WeightedComposite {
  composite: number; // 0–5, coverage-discounted
  /** Weight-relative coverage: share of normalized weight on scored domains.
   *  Used INTERNALLY for the composite/confidence discount only. */
  coverage: number; // 0–1
  /** RAW coverage: evidenced domains / 12 — weight-INDEPENDENT. This is the
   *  honesty metric: it gates eligibility and is what the UI shows, so a user
   *  can never re-weight their way out of thin coverage (concentrating weight on
   *  a thin vendor's few evidenced domains can't lift this). */
  rawCoverage: number; // 0–1
  confidence: number; // 0–99
  scoredCount: number;
  insufficientCount: number;
  contributions: DomainContribution[]; // all 12, canonical order
}

/**
 * Weighted 0–5 composite for one vendor's scorecard under `weights`. Deterministic
 * and side-effect-free. `domains` is the Wave-1 scorecard (12 entries, canonical
 * order); it is read, never mutated.
 */
export function computeWeightedComposite(domains: DomainScore[], weights: Partial<DomainWeights>): WeightedComposite {
  const norm = normalizeWeights(weights);
  const byDomain = new Map<DomainId, DomainScore>(domains.map((d) => [d.domain, d]));

  let composite = 0;
  let coverage = 0;
  let confNumerator = 0;
  let scoredCount = 0;

  const contributions: DomainContribution[] = ASSESSMENT_DOMAINS.map((domain) => {
    const weight = norm[domain];
    const d = byDomain.get(domain);
    if (d && d.state === "scored") {
      const contribution = d.score * weight * confidenceBlend(d.confidence);
      composite += contribution;
      coverage += weight;
      confNumerator += weight * d.confidence;
      scoredCount += 1;
      return {
        domain,
        pillar: DOMAIN_TO_PILLAR[domain],
        weight,
        score: d.score,
        contribution,
        confidence: d.confidence,
        state: "scored",
      };
    }
    return {
      domain,
      pillar: DOMAIN_TO_PILLAR[domain],
      weight,
      score: null,
      contribution: null,
      confidence: null,
      state: "insufficient_evidence",
    };
  });

  // Confidence: weight-avg over scored domains, discounted for coverage, capped 99.
  const avgConf = coverage > 0 ? confNumerator / coverage : 0;
  const coveragePenalty = 0.5 + 0.5 * coverage;
  const confidence = clamp(Math.round(avgConf * coveragePenalty), 0, 99);

  return {
    composite: clamp(Math.round(composite * 100) / 100, 0, 5),
    coverage,
    rawCoverage: ASSESSMENT_DOMAINS.length > 0 ? scoredCount / ASSESSMENT_DOMAINS.length : 0,
    confidence,
    scoredCount,
    insufficientCount: ASSESSMENT_DOMAINS.length - scoredCount,
    contributions,
  };
}

export interface RankableComposite {
  composite: number;
  coverage: number;
  confidence: number;
  vendorId: string;
}

/** Deterministic comparator (highest first): composite → coverage → confidence
 *  → vendorId. Mirrors the rankings engine's tie-break discipline. */
export function compareWeighted(a: RankableComposite, b: RankableComposite): number {
  const byComposite = b.composite - a.composite;
  if (Math.abs(byComposite) > 1e-9) return byComposite;
  const byCoverage = b.coverage - a.coverage;
  if (Math.abs(byCoverage) > 1e-9) return byCoverage;
  const byConf = b.confidence - a.confidence;
  if (byConf !== 0) return byConf;
  return a.vendorId.localeCompare(b.vendorId);
}

// ── Single source of ranking truth ───────────────────────────────────────────

export interface RankedVendor {
  vendorId: string;
  composite: number; // 0–5 weighted composite
  coverage: number; // RAW coverage 0–1 (evidenced domains / 12)
  confidence: number; // 0–99
  scoredCount: number;
  /** Meets the coverage floor → ranked; otherwise held (shown, not ranked). */
  ranked: boolean;
}

export interface VendorDomains {
  vendorId: string;
  domains: DomainScore[];
}

/**
 * THE ranking function — the ONE source of truth both the static category
 * ranking (category-composite) and the interactive re-rank (CategoryRerank)
 * call. Identical inputs + weights ⇒ identical order, by construction (no
 * parallel composite that can disagree). Ranked vendors (RAW coverage ≥ floor)
 * sort by compareWeighted; held vendors trail, ordered by coverage then id.
 * Pure; never mutates inputs.
 */
export function rankVendorsByComposite(vendors: VendorDomains[], weights: Partial<DomainWeights>): RankedVendor[] {
  const rows: RankedVendor[] = vendors.map((v) => {
    const r = computeWeightedComposite(v.domains, weights);
    return {
      vendorId: v.vendorId,
      composite: r.composite,
      coverage: r.rawCoverage,
      confidence: r.confidence,
      scoredCount: r.scoredCount,
      ranked: r.scoredCount > 0 && r.rawCoverage >= ASSESSMENT_COVERAGE_FLOOR,
    };
  });
  const ranked = rows.filter((r) => r.ranked).sort(compareWeighted);
  const held = rows
    .filter((r) => !r.ranked)
    .sort((a, b) => {
      const byCov = b.coverage - a.coverage;
      return Math.abs(byCov) > 1e-9 ? byCov : a.vendorId.localeCompare(b.vendorId);
    });
  return [...ranked, ...held];
}

// ── W2-3 — "why this / why not the runner-up" (deterministic delta) ───────────

export interface GapDriver {
  domain: DomainId;
  pillar: PillarId;
  leaderScore: number | null; // 0–5, null when insufficient
  runnerScore: number | null;
  weight: number; // normalized 0–1
  /** leaderContribution − runnerContribution (insufficient = 0). Positive = the
   *  leader is ahead on this domain; the per-domain deltas sum to compositeDelta. */
  weightedDelta: number;
  /** Honesty flag when a driver is coverage-driven or unevidenced for one side. */
  note: "both_scored" | "leader_only" | "runner_only" | "both_insufficient";
  /** The leader's freshest citation for this domain (evidence behind the score). */
  citation?: { sourceUrl: string; evidenceGrade: string; capturedAt: string };
}

export interface VendorGap {
  compositeDelta: number; // leader.composite − runner.composite (≥0 when leader truly leads)
  drivers: GapDriver[]; // ALL 12, sorted by weightedDelta desc (top = why leader leads)
}

/**
 * Deterministic decomposition of WHY `leader` out-ranks `runner` under `weights`:
 * the per-domain contribution difference (leaderScore·w·blend − runnerScore·w·blend,
 * insufficient = 0). The deltas SUM to the composite gap — it's the real arithmetic,
 * not an invented narrative. Honesty flags mark coverage-driven / unevidenced
 * domains so the UI can say "leader has evidence here, runner-up doesn't" rather
 * than fabricate a reason. Pure; never mutates inputs.
 */
export function computeGap(leader: DomainScore[], runner: DomainScore[], weights: Partial<DomainWeights>): VendorGap {
  const norm = normalizeWeights(weights);
  const leaderBy = new Map<DomainId, DomainScore>(leader.map((d) => [d.domain, d]));
  const runnerBy = new Map<DomainId, DomainScore>(runner.map((d) => [d.domain, d]));

  let compositeDelta = 0;
  const drivers: GapDriver[] = ASSESSMENT_DOMAINS.map((domain) => {
    const w = norm[domain];
    const l = leaderBy.get(domain);
    const r = runnerBy.get(domain);
    const lScored = l?.state === "scored";
    const rScored = r?.state === "scored";
    const lContribution = lScored ? l!.score * w * confidenceBlend(l!.confidence) : 0;
    const rContribution = rScored ? r!.score * w * confidenceBlend(r!.confidence) : 0;
    const weightedDelta = lContribution - rContribution;
    compositeDelta += weightedDelta;
    const note: GapDriver["note"] = lScored && rScored
      ? "both_scored"
      : lScored
        ? "leader_only"
        : rScored
          ? "runner_only"
          : "both_insufficient";
    const cite = lScored ? l!.citations[0] : undefined;
    return {
      domain,
      pillar: DOMAIN_TO_PILLAR[domain],
      leaderScore: lScored ? l!.score : null,
      runnerScore: rScored ? r!.score : null,
      weight: w,
      weightedDelta,
      note,
      citation: cite ? { sourceUrl: cite.sourceUrl, evidenceGrade: cite.evidenceGrade, capturedAt: cite.capturedAt } : undefined,
    };
  }).sort((a, b) => b.weightedDelta - a.weightedDelta);

  return { compositeDelta: Math.round(compositeDelta * 100) / 100, drivers };
}
