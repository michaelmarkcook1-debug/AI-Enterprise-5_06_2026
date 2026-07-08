// Broadened model_quality DomainScore — from real Artificial Analysis rows.
// ─────────────────────────────────────────────────────────────────────────────
// Reads the cited ModelQualityBenchmark rows (Artificial Analysis Intelligence/
// Coding/Agentic Index) and runs the PURE blend (model-quality-blend.ts) → a
// single 0–5 model_quality DomainScore plus the index breakdown for the UI.
// Deterministic, read-time, no writes. A vendor with NO benchmark rows yields
// nothing here → the caller falls back to the legacy single-Elo pillar (so
// nothing regresses before the first seed runs).
//
// All three indices MUST come from the SAME model (never mix a vendor's
// different models' indices — that would misattribute a score), so this picks
// each vendor's FLAGSHIP model — the one with the highest Intelligence Index —
// and reads only that model's rows, mirroring lib/model-inventory/frontier.ts's
// flagship-pick logic.

import { getPrisma, hasDatabase } from "../prisma";
import { DOMAIN_TO_PILLAR } from "../types";
import {
  DOMAIN_BAND_LABEL,
  LOW_CONFIDENCE_FLOOR,
  type DomainCitation,
  type ScoredDomainScore,
} from "./domain-rubric";
import { blendModelQuality, MODEL_QUALITY_CAP, type MqBlendResult, type MqModelInput } from "../system/model-quality-blend";

export interface ModelQualityDetail {
  score: ScoredDomainScore; // the 0–5 model_quality domain score
  blend: MqBlendResult; // the per-category breakdown (for the UI "why")
}

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
    // Evidence standard achieved: E4 (community-preference benchmark, not an audit)
    // — the capability tier is the numeric score; this label is the evidence grade.
    bandLabel: DOMAIN_BAND_LABEL[4],
    confidence: blend.confidence,
    // coverage < 1 here means coding/agentic are missing, not intelligence
    // (blendModelQuality already returns null without it) — a real signal of
    // thinner corroboration, still worth flagging low-confidence on.
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
      where: { vendorId: { in: vendorIds }, source: "artificial_analysis" },
      select: { vendorId: true, category: true, rating: true, modelName: true, sourceUrl: true },
    });
    // Group by (vendor, model) first — a vendor's indices must all come from
    // ONE model's row set, never mixed across its different tracked models.
    const byVendorModel = new Map<string, Map<string, MqModelInput>>();
    for (const r of rows) {
      const models = byVendorModel.get(r.vendorId) ?? new Map<string, MqModelInput>();
      const m = models.get(r.modelName) ?? {
        intelligenceIndex: null,
        codingIndex: null,
        agenticIndex: null,
        modelName: r.modelName,
        sourceUrl: r.sourceUrl,
      };
      if (r.category === "intelligence") m.intelligenceIndex = r.rating;
      else if (r.category === "coding") m.codingIndex = r.rating;
      else if (r.category === "agentic") m.agenticIndex = r.rating;
      models.set(r.modelName, m);
      byVendorModel.set(r.vendorId, models);
    }
    for (const [vendorId, models] of byVendorModel) {
      // Flagship = highest Intelligence Index among the vendor's tracked
      // models (mirrors frontier.ts's flagshipFor()) — models with no
      // intelligence row can't be the flagship (blendModelQuality requires it).
      const flagship = [...models.values()]
        .filter((m) => m.intelligenceIndex != null)
        .sort((a, b) => (b.intelligenceIndex ?? 0) - (a.intelligenceIndex ?? 0))[0];
      if (!flagship) continue;
      const blend = blendModelQuality(flagship);
      if (!blend) continue;
      out.set(vendorId, { score: blendToDomainScore(blend, now), blend });
    }
  } catch {
    // honest absence — caller falls back to the legacy single-Elo pillar
  }
  return out;
}

export { MODEL_QUALITY_CAP };
