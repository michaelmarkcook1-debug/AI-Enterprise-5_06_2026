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

import { DOMAIN_TO_PILLAR, PILLARS, type DomainId, type PillarId, type EvidenceGrade } from "../types";
import { ASSESSMENT_DOMAINS, DOMAIN_WEIGHT, type DomainScore } from "./domain-rubric";

export type DomainWeights = Record<DomainId, number>;

/** Framework default weights over the 12 assessment domains (sum = 1). */
export const DEFAULT_DOMAIN_WEIGHTS: DomainWeights = ASSESSMENT_DOMAINS.reduce((acc, d) => {
  acc[d] = DOMAIN_WEIGHT[d];
  return acc;
}, {} as DomainWeights);

/**
 * Canonical iteration/display order across ALL rankable domains — the 12 framework
 * domains in framework order, plus category-scoped domains (model_quality) inserted
 * in a sensible slot. The composite never iterates this directly; it iterates the
 * ACTIVE subset for a given weight profile (see activeDomains). For the framework
 * default profile the active subset is byte-identical to ASSESSMENT_DOMAINS — so
 * every category that does NOT opt into a category-scoped domain behaves exactly
 * as before (same domains, same order, same /12 coverage).
 */
export const RANKABLE_DOMAIN_ORDER: DomainId[] = [
  "strategic_value",
  "data_security_privacy",
  "identity_access",
  "model_reliability",
  "model_quality", // category-scoped — only active where the profile weights it
  "governance_compliance",
  "sovereignty_residency", // universal (13th framework domain) — grouped with the other enterprise_control domains
  "security_threat",
  "integration_architecture",
  "agentic_autonomy",
  "cost_finops",
  "workforce_adoption",
  "vendor_maturity_lockin",
  "capital_resilience",
  "dev_sentiment", // category-scoped — only active where a coding profile weights it
];

/**
 * The domains a weight profile ACTIVATES: those PRESENT as keys in the profile,
 * in canonical order. Membership is by key presence, NOT by value — so a user who
 * drags a slider to 0 keeps that domain in scope (it stays in the coverage
 * denominator and contributes 0), and cannot re-weight their way out of thin
 * coverage. To genuinely exclude a domain from a category, OMIT its key. For
 * DEFAULT_DOMAIN_WEIGHTS this returns exactly the 12 framework domains
 * (model_quality / market_position are absent keys → excluded).
 */
export function activeDomains(weights: Partial<DomainWeights>): DomainId[] {
  return RANKABLE_DOMAIN_ORDER.filter((d) => weights[d] !== undefined);
}

/**
 * A vendor's domain set for a given weight profile: the 12 framework domains
 * plus the category-scoped model_quality/dev_sentiment scores ONLY when the
 * profile activates them (weight > 0) AND the vendor actually has that score —
 * else the framework 12 alone. Single source of truth for this merge so the
 * static ranking, the interactive re-rank, and any export/derived view can
 * never quietly disagree about which domains are in scope for a vendor.
 */
export function effectiveDomains(
  domains: DomainScore[],
  extras: { modelQuality?: DomainScore | null; devSentiment?: DomainScore | null },
  resolvedWeights: Partial<DomainWeights>,
): DomainScore[] {
  const extra: DomainScore[] = [];
  if ((resolvedWeights.model_quality ?? 0) > 0 && extras.modelQuality) extra.push(extras.modelQuality);
  if ((resolvedWeights.dev_sentiment ?? 0) > 0 && extras.devSentiment) extra.push(extras.devSentiment);
  return extra.length > 0 ? [...domains, ...extra] : domains;
}

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
  // Normalize over the profile's ACTIVE domains (default = the 12 framework
  // domains). All-zero / empty → equal weights over the 12 (no div-by-0).
  const active = activeDomains(weights);
  const domains = active.length > 0 ? active : ASSESSMENT_DOMAINS;
  const raw = domains.map((d) => Math.max(0, weights[d] ?? 0));
  const sum = raw.reduce((s, w) => s + w, 0);
  const out = {} as DomainWeights;
  domains.forEach((d, i) => {
    out[d] = sum > 0 ? raw[i] / sum : 1 / domains.length;
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
  /** Number of domains ACTIVE for this weight profile (the coverage denominator):
   *  12 for the framework default, 13 for a profile that activates model_quality. */
  domainTotal: number;
  contributions: DomainContribution[]; // all ACTIVE domains, canonical order
}

/**
 * Weighted 0–5 composite for one vendor's scorecard under `weights`. Deterministic
 * and side-effect-free. `domains` is the Wave-1 scorecard (12 entries, canonical
 * order); it is read, never mutated.
 */
export function computeWeightedComposite(domains: DomainScore[], weights: Partial<DomainWeights>): WeightedComposite {
  const norm = normalizeWeights(weights);
  const byDomain = new Map<DomainId, DomainScore>(domains.map((d) => [d.domain, d]));

  // Iterate the ACTIVE domain set for this profile (default = the 12 framework
  // domains). A domain absent from the vendor's scorecard is treated as
  // insufficient — so a profile that activates model_quality counts it in the
  // denominator (/13) and a vendor with no Arena Elo contributes 0 there.
  const active = activeDomains(weights);
  const domainList = active.length > 0 ? active : ASSESSMENT_DOMAINS;

  let composite = 0;
  let coverage = 0;
  let confNumerator = 0;
  let scoredCount = 0;

  const contributions: DomainContribution[] = domainList.map((domain) => {
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
    rawCoverage: domainList.length > 0 ? scoredCount / domainList.length : 0,
    confidence,
    scoredCount,
    insufficientCount: domainList.length - scoredCount,
    domainTotal: domainList.length,
    contributions,
  };
}

// ── Pillar roll-up of the ranking composite ("Why this rank" breakdown) ───────
// The 12/13 assessment domains roll up into the 6 user-facing PILLARS. This
// aggregates the SAME per-domain contributions that drive the rank — so the
// pillar contributions SUM to the composite and their order matches the rank,
// by construction. (Previously the "Why this rank" table showed a SEPARATE
// pillar-score composite that could — and did — disagree with the domain-driven
// rank, e.g. sum-of-contributions putting a lower-ranked vendor above a higher
// one.) `market_position` is excluded from the ranking domains, so the Market
// Strength pillar is honestly "context, not in the score".

export interface RankPillar {
  pillar: PillarId;
  label: string;
  /** Sum of active-domain weights mapped to this pillar (0–1). 0 when the pillar
   *  has no domain in the ranking composite (Market Strength). */
  weight: number;
  /** Weight-avg of scored domain scores (0–5); null when no scored domain. */
  score: number | null;
  confidence: number | null; // 0–99, weight-avg over scored domains
  /** Sum of the pillar's scored-domain contributions (0–5 scale) — across all
   *  pillars these SUM to the composite. null when nothing scored / not in composite. */
  contribution: number | null;
  bestGrade: EvidenceGrade | null; // strongest grade among scored domains
  scoredCount: number;
  activeCount: number; // domains of this pillar active in the profile
  state: "scored" | "insufficient_evidence" | "not_in_composite";
}

const GRADE_RANK: Record<EvidenceGrade, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };

/**
 * Roll a WeightedComposite's per-domain `contributions` up into the 6 pillars,
 * pulling evidence grades from the vendor's `domains` scorecard. Pure. The
 * returned contributions sum to the composite (rounding aside), so the ranking
 * explanation can never contradict the rank it explains.
 */
export function rollUpToPillars(contributions: DomainContribution[], domains: DomainScore[]): RankPillar[] {
  const gradeByDomain = new Map<DomainId, EvidenceGrade>();
  for (const d of domains) if (d.state === "scored") gradeByDomain.set(d.domain, d.bestGrade);

  return PILLARS.map(({ id, label }) => {
    const inPillar = contributions.filter((c) => c.pillar === id);
    if (inPillar.length === 0) {
      return { pillar: id, label, weight: 0, score: null, confidence: null, contribution: null, bestGrade: null, scoredCount: 0, activeCount: 0, state: "not_in_composite" as const };
    }
    const weight = inPillar.reduce((s, c) => s + c.weight, 0);
    const scored = inPillar.filter((c) => c.state === "scored");
    if (scored.length === 0) {
      return { pillar: id, label, weight, score: null, confidence: null, contribution: null, bestGrade: null, scoredCount: 0, activeCount: inPillar.length, state: "insufficient_evidence" as const };
    }
    const scoredWeight = scored.reduce((s, c) => s + c.weight, 0);
    const score = scoredWeight > 0 ? scored.reduce((s, c) => s + (c.score ?? 0) * c.weight, 0) / scoredWeight : null;
    const confidence = scoredWeight > 0 ? Math.round(scored.reduce((s, c) => s + (c.confidence ?? 0) * c.weight, 0) / scoredWeight) : null;
    const contribution = scored.reduce((s, c) => s + (c.contribution ?? 0), 0);
    let bestGrade: EvidenceGrade | null = null;
    for (const c of scored) {
      const g = gradeByDomain.get(c.domain);
      if (g && (bestGrade === null || GRADE_RANK[g] > GRADE_RANK[bestGrade])) bestGrade = g;
    }
    return { pillar: id, label, weight, score, confidence, contribution, bestGrade, scoredCount: scored.length, activeCount: inPillar.length, state: "scored" as const };
  });
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

  const active = activeDomains(weights);
  const domainList = active.length > 0 ? active : ASSESSMENT_DOMAINS;

  let compositeDelta = 0;
  const drivers: GapDriver[] = domainList.map((domain) => {
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
