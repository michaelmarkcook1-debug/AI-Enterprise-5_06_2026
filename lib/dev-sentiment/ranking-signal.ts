// Dev-sentiment → ranking signal (Consumer #2).
// ─────────────────────────────────────────────
// Maps the coverage-gated aggregate into a synthesized `dev_sentiment`
// DomainScore, so it flows through the SAME computeWeightedComposite that both
// the static ranking and the interactive re-rank use (no divergence). Mirrors
// how model_quality is synthesized. Pure — no DB, no writes.
//
// HONESTY / the spec's three locks:
//   • the sentiment TAG sets a 0–5 level by a FIXED table (never per-vendor);
//   • the TIER sets confidence (strong = high, moderate = discounted) — the
//     engine's native coverage/confidence discount, so a thinner signal
//     contributes less;
//   • an INSUFFICIENT aggregate yields NO domain (null) → counted as an unscored
//     domain in the category's coverage denominator (coverage-discounted), never
//     a fabricated score.
// The weight (0.18) and scope (coding categories) live in category-weights.ts,
// gated by DEV_SENTIMENT_IN_RANKING — this module only shapes the score.

import { DOMAIN_BAND_LABEL, type DomainBand, type DomainScore } from "../assessment/domain-rubric";
import { DOMAIN_TO_PILLAR } from "../types";
import { aggregateDevSentiment, type DevSentimentAggregate } from "./aggregate";
import { DEV_SENTIMENT_COMPILED_AT } from "./data";

/** Fixed tag → 0–5 level. Published in the methodology; never tuned per vendor. */
const TAG_TO_SCORE5: Record<string, number> = {
  positive: 5.0,
  leaning_positive: 3.75,
  mixed: 2.5,
  leaning_negative: 1.25,
  negative: 0.0,
};

/** Tier → confidence (0–99). Strong = near-full weight; moderate = discounted
 *  via the engine's confidenceBlend (0.7 + 0.3·conf). */
const TIER_TO_CONFIDENCE: Record<string, number> = {
  strong: 90,
  moderate: 60,
};

/** Synthesize the `dev_sentiment` DomainScore for a vendor, or null when the
 *  aggregate is out-of-scope OR insufficient (→ coverage-discounted, not faked). */
export function synthesizeDevSentimentDomain(
  vendorId: string,
  agg: DevSentimentAggregate | null = aggregateDevSentiment(vendorId),
): DomainScore | null {
  if (!agg || agg.state !== "rated" || !agg.reading || !agg.tier) return null;
  const score = TAG_TO_SCORE5[agg.reading.tag];
  const confidence = TIER_TO_CONFIDENCE[agg.tier] ?? 60;
  if (score === undefined) return null;

  // Real citations from the counting sources (so "why this rank" links out).
  const citations = agg.record.sources
    .flatMap((s) => s.citations)
    .slice(0, 3)
    .map((c) => ({ sourceUrl: c.url, evidenceGrade: "E3" as const, capturedAt: `${DEV_SENTIMENT_COMPILED_AT}T00:00:00.000Z` }));

  const band = Math.round(score) as DomainBand;
  return {
    domain: "dev_sentiment",
    pillar: DOMAIN_TO_PILLAR["dev_sentiment"],
    state: "scored",
    score,
    band,
    bandLabel: DOMAIN_BAND_LABEL[band],
    confidence,
    lowConfidence: agg.tier !== "strong",
    bestGrade: "E3", // curated tri-source community signal — directional, capped
    evidenceCount: agg.countingSources.length,
    citations,
  };
}
