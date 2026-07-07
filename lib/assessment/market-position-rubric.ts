// Market Position — real, evidence-graded market-strength rubric.
// ──────────────────────────────────────────────────────────────────────────
// REPLACES developer sentiment as the input to the "Market Strength" pillar.
// dev_sentiment measures what developers say — a real, separately-weighted
// signal in its own right, but not market position, and it must not stand in
// for one. This module scores market_position from what a vendor's REAL
// enterprise adoption footprint actually is:
//   • category-share estimate (lib/system/market-presence.ts, via the
//     vendor's MarketShareEstimate row) — a directional, evidence-derived
//     presence estimate, explicitly NOT measured revenue share. Weaker
//     evidentiary standing (a computed derivation) → capped at E2 ("public
//     documentation, weak proof" — GRADE_BAND_CAP.E2 = 2).
//   • disclosed named enterprise adopters (lib/peer/adopters.ts,
//     disclosedAdoptersOf — reused, not duplicated) — real, cited, named
//     companies that have PUBLICLY disclosed adopting this vendor. This is
//     literally "production customer evidence" per the framework's own E4
//     definition → capped at E4.
//   • revenue / customer-scale: a DOCUMENTED FUTURE INPUT. No live source
//     exists for this vendor set today (checked: SEC/IR data covers public
//     infra companies, not private/foreign frontier-model vendors). It
//     contributes NOTHING until a real source exists — never a placeholder,
//     never estimated from the other two inputs.
//
// Neither input alone is strong enough to ever claim independent-audit-grade
// (E5) evidence, so this domain is architecturally capped below 4.0 unless
// both signals are present — an honest ceiling, not a bug, until a stronger
// evidence stream (e.g. audited revenue) is added.
//
// Uniform, documented, deterministic: same two inputs, same tier tables,
// every vendor. No per-vendor tuning. Absence of adopters/share → insufficient
// (never scored on a guess) — critically, zero disclosed adopters is NOT
// treated as proof of zero real adoption (the curated peer set is a sample,
// not a census); it simply contributes nothing, same as any other
// insufficient-evidence input elsewhere in the framework.

import { DOMAIN_TO_PILLAR, type EvidenceGrade } from "../types";
import { DOMAIN_BAND_LABEL, type DomainBand, type DomainCitation, type DomainScore } from "./domain-rubric";
import type { MarketShareEstimate } from "../intelligence/types";
import type { DisclosedAdopter } from "../peer/adopters";
import { absoluteUrl } from "../site";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Disclosed-adopter count → 0–4 score (E4-capped: real, named production-
 *  customer evidence, but not independently audited). Fixed table, published,
 *  never tuned per vendor. */
function adopterTierScore(count: number): number | null {
  if (count <= 0) return null;
  if (count <= 2) return 2.0;
  if (count <= 5) return 3.0;
  return 4.0;
}

/** Category share, relative to an equal-split baseline (100/N% for an
 *  N-member category) → 0–2 score (E2-capped: a computed, directional
 *  estimate — real signal, weaker evidentiary standing than a named,
 *  disclosed fact). Relative (not an absolute % threshold) so this scales
 *  sanely across categories of very different vendor counts. */
function shareTierScore(estimatedShare: number, equalShareBaseline: number): number | null {
  if (equalShareBaseline <= 0) return null;
  const ratio = estimatedShare / equalShareBaseline;
  if (ratio < 0.25) return 0.5;
  if (ratio < 0.75) return 1.0;
  if (ratio < 1.5) return 1.5;
  return 2.0;
}

const ADOPTER_WEIGHT = 0.6; // named, disclosed evidence weighted above a computed estimate
const SHARE_WEIGHT = 0.4;

export interface MarketPositionInput {
  share: MarketShareEstimate | undefined;
  adopters: DisclosedAdopter[];
  /** Number of vendors in the category (for the share baseline). */
  categoryMemberCount: number;
}

/**
 * Score ONE vendor's market_position domain from real, cited adoption
 * evidence. Pure, deterministic — same inputs, same output. Never writes.
 */
export function scoreMarketPosition({ share, adopters, categoryMemberCount }: MarketPositionInput): DomainScore {
  const pillar = DOMAIN_TO_PILLAR.market_position;
  const equalBaseline = categoryMemberCount > 0 ? 100 / categoryMemberCount : 0;
  const aScore = adopterTierScore(adopters.length);
  const sScore = share ? shareTierScore(share.estimatedShare, equalBaseline) : null;

  // Under-claim rule: no real signal on either input → insufficient, never 0.
  if (aScore === null && sScore === null) {
    return { domain: "market_position", pillar, state: "insufficient_evidence" };
  }

  const hasAdopters = aScore !== null;
  const cap: 2 | 4 = hasAdopters ? 4 : 2;
  const bestGrade: EvidenceGrade = hasAdopters ? "E4" : "E2";

  let raw: number;
  if (aScore !== null && sScore !== null) raw = ADOPTER_WEIGHT * aScore + SHARE_WEIGHT * sScore;
  else raw = (aScore ?? sScore)!;
  const score = clamp(Math.round(raw * 10) / 10, 0, cap);
  const band = clamp(Math.round(score), 0, 5) as DomainBand;

  const confidence = aScore !== null && sScore !== null ? 75 : hasAdopters ? 65 : 45;
  const lowConfidence = !(aScore !== null && sScore !== null);

  // Real, named citations from disclosed adopters (the concrete evidentiary
  // basis). The share estimate has no single-fact URL (it's a computed
  // derivation, not one external source) — link its published methodology
  // instead of inventing a citation for it.
  const citations: DomainCitation[] = adopters
    .flatMap((a) => a.citations)
    .slice(0, 5)
    .map((c) => ({ sourceUrl: c.url, evidenceGrade: "E4" as const, capturedAt: "2026-07-04T00:00:00.000Z" }));
  if (sScore !== null && citations.length < 5) {
    citations.push({
      sourceUrl: absoluteUrl("/insights#market-share-est"),
      evidenceGrade: "E2",
      capturedAt: share!.sourceDate,
    });
  }

  const parts: string[] = [];
  // NOTE: DomainScore.label (dynamic per-vendor source naming, e.g. "Market
  // Position (3 disclosed adopters + category-share estimate)") lands with the
  // dev-sentiment-hf-reddit branch (③), which this branch was built before
  // (per "rebase onto main after ③ merges"). Wire this domain into that same
  // label mechanism as a follow-up once rebased, rather than duplicating the
  // type change here.

  return {
    domain: "market_position",
    pillar,
    state: "scored",
    score,
    band,
    bandLabel: DOMAIN_BAND_LABEL[cap],
    confidence,
    lowConfidence,
    bestGrade,
    evidenceCount: adopters.length + (sScore !== null ? 1 : 0),
    citations,
  };
}
