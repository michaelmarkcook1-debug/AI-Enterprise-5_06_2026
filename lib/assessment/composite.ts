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
  coverage: number; // 0–1 (share of normalized weight on scored domains)
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
