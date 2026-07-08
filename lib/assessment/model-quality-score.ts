// Broadened model_quality DomainScore — from real Artificial Analysis rows.
// ─────────────────────────────────────────────────────────────────────────────
// Reads the cited ModelQualityBenchmark rows (Artificial Analysis Intelligence /
// Coding / Agentic Index — each row from the vendor's best model on THAT
// index, named per row) and runs the PURE blend (model-quality-blend.ts) →
// per-DRIVER 0–5 model_quality DomainScores plus the index breakdown for the
// UI. Which index drives is a CATEGORY decision (category-weights.ts):
// frontier model APIs score on the Intelligence Index, the developer-coding
// category on the Coding Index. Deterministic, read-time, no writes. A vendor
// with NO rows for a driver yields nothing for that driver → the caller falls
// back (intelligence only — the legacy Elo pillar has no coding measure, so a
// coding score is never inferred from an overall reading) or stays
// insufficient.

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
  type MqIndexRow,
} from "../system/model-quality-blend";

export interface ModelQualityDetail {
  score: ScoredDomainScore; // the 0–5 model_quality domain score
  blend: MqBlendResult; // the per-index breakdown (for the UI "why")
}

/** One vendor's model-quality details per driver index. A driver key is
 *  absent when the vendor has no row for that index (honest absence). */
export type ModelQualityByDriver = Partial<Record<MqCategory, ModelQualityDetail>>;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Map a blend result → the model_quality DomainScore (E4-capped, cited). */
export function blendToDomainScore(blend: MqBlendResult, now: Date): ScoredDomainScore {
  const score = blend.score; // already 0..CAP, 2dp
  const band = clamp(Math.round(score), 0, 5) as ScoredDomainScore["band"];
  // Citations: the Artificial Analysis source(s) behind the index rows, deduped.
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
    // Evidence standard achieved: E4 (benchmark composite, not an audit)
    // — the capability tier is the numeric score; this label is the evidence grade.
    bandLabel: DOMAIN_BAND_LABEL[4],
    confidence: blend.confidence,
    // coverage < 1 means the non-driver indices are missing (the driver itself
    // is guaranteed — blendModelQuality returns null without it): thinner
    // corroboration, still worth flagging low-confidence on.
    lowConfidence: blend.confidence < LOW_CONFIDENCE_FLOOR || blend.coverage < 0.5,
    bestGrade: "E4",
    evidenceCount: blend.contributions.length,
    citations,
  };
}

/** The drivers a category can score model_quality on. */
export const MODEL_QUALITY_DRIVERS: MqCategory[] = ["intelligence", "coding"];

/**
 * Load model-quality details for a set of vendors from their cited benchmark
 * rows — ONE query, every supported driver computed from the same rows.
 * Returns only vendors that HAVE at least one row for at least one driver
 * (others are absent → caller falls back / stays insufficient). Read-time,
 * pure after the DB read.
 */
export async function loadModelQualityDetails(
  vendorIds: string[],
  now: Date = new Date(),
): Promise<Map<string, ModelQualityByDriver>> {
  const out = new Map<string, ModelQualityByDriver>();
  if (!hasDatabase() || vendorIds.length === 0) return out;
  try {
    const rows = await getPrisma().modelQualityBenchmark.findMany({
      where: { vendorId: { in: vendorIds }, source: "artificial_analysis" },
      select: { vendorId: true, category: true, rating: true, modelName: true, sourceUrl: true },
    });
    const byVendor = new Map<string, MqIndexRow[]>();
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
    for (const [vendorId, indexRows] of byVendor) {
      const detail: ModelQualityByDriver = {};
      for (const driver of MODEL_QUALITY_DRIVERS) {
        const blend = blendModelQuality(indexRows, driver);
        if (blend) detail[driver] = { score: blendToDomainScore(blend, now), blend };
      }
      if (Object.keys(detail).length > 0) out.set(vendorId, detail);
    }
  } catch {
    // honest absence — caller falls back to the legacy single-Elo pillar
  }
  return out;
}

export { MODEL_QUALITY_CAP };
