// Broadened model_quality DomainScore — from real benchmark rows, blended.
// ─────────────────────────────────────────────────────────────────────────────
// Reads the cited ModelQualityBenchmark rows (LMArena per-category Elos) and runs
// the PURE blend (model-quality-blend.ts) → a single 0–5 model_quality DomainScore
// plus the per-category breakdown for the UI. Deterministic, read-time, no writes.
// A vendor with NO benchmark rows yields nothing here → the caller falls back to
// the legacy single-Elo pillar (so nothing regresses before the first seed runs).

import { getPrisma, hasDatabase } from "../prisma";
import { DOMAIN_TO_PILLAR } from "../types";
import {
  DOMAIN_BAND_LABEL,
  LOW_CONFIDENCE_FLOOR,
  type DomainCitation,
  type ScoredDomainScore,
} from "./domain-rubric";
import {
  blendModelQuality,
  MODEL_QUALITY_CAP,
  type MqBlendResult,
  type MqCategory,
  type MqCategoryInput,
} from "../system/model-quality-blend";

export interface ModelQualityDetail {
  score: ScoredDomainScore; // the 0–5 model_quality domain score
  blend: MqBlendResult; // the per-category breakdown (for the UI "why")
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Map a blend result → the model_quality DomainScore (E4-capped, cited). */
export function blendToDomainScore(blend: MqBlendResult, now: Date): ScoredDomainScore {
  const score = blend.score; // already 0..CAP, 2dp
  const band = clamp(Math.round(score), 0, 5) as ScoredDomainScore["band"];
  // Citations: the LMArena leaderboard source(s) behind the category rows, deduped.
  const seen = new Set<string>();
  const citations: DomainCitation[] = [];
  for (const c of blend.contributions) {
    if (!c.sourceUrl || seen.has(c.sourceUrl)) continue;
    seen.add(c.sourceUrl);
    citations.push({ sourceUrl: c.sourceUrl, evidenceGrade: "E4", capturedAt: now.toISOString() });
  }
  return {
    domain: "model_quality",
    pillar: DOMAIN_TO_PILLAR["model_quality"],
    state: "scored",
    score,
    band,
    // Evidence standard achieved: E4 (community-preference benchmark, not an audit)
    // — the capability tier is the numeric score; this label is the evidence grade.
    bandLabel: DOMAIN_BAND_LABEL[4],
    confidence: blend.confidence,
    lowConfidence: blend.confidence < LOW_CONFIDENCE_FLOOR || blend.coverage < 0.5,
    bestGrade: "E4",
    evidenceCount: blend.contributions.length,
    citations,
  };
}

/**
 * Load broadened model_quality details for a set of vendors from their cited
 * benchmark rows. Returns only vendors that HAVE at least one benchmark row
 * (others are absent → caller falls back / stays insufficient). Read-time, pure
 * after the DB read.
 */
export async function loadModelQualityDetails(
  vendorIds: string[],
  now: Date = new Date(),
): Promise<Map<string, ModelQualityDetail>> {
  const out = new Map<string, ModelQualityDetail>();
  if (!hasDatabase() || vendorIds.length === 0) return out;
  try {
    const rows = await getPrisma().modelQualityBenchmark.findMany({
      where: { vendorId: { in: vendorIds }, source: "lmarena" },
      select: { vendorId: true, category: true, rating: true, modelName: true, sourceUrl: true },
    });
    const byVendor = new Map<string, MqCategoryInput[]>();
    for (const r of rows) {
      const list = byVendor.get(r.vendorId) ?? [];
      list.push({
        category: r.category as MqCategory,
        rating: r.rating,
        modelName: r.modelName,
        sourceUrl: r.sourceUrl,
      });
      byVendor.set(r.vendorId, list);
    }
    for (const [vendorId, inputs] of byVendor) {
      const blend = blendModelQuality(inputs);
      if (!blend) continue;
      out.set(vendorId, { score: blendToDomainScore(blend, now), blend });
    }
  } catch {
    // honest absence — caller falls back to the legacy single-Elo pillar
  }
  return out;
}

export { MODEL_QUALITY_CAP };
