// Persist real Artificial Analysis indices → model_quality_benchmarks.
// ─────────────────────────────────────────────────────────────────────────────
// Fetches the live per-model indices (artificial-analysis-fetch.ts) and, for
// each roster vendor, upserts one cited row per index category (intelligence /
// coding / agentic) — each from the vendor's BEST model on THAT index, with
// that model's own name on the row. Per-index best is the honest leaderboard
// read (verified live: Cohere's best coding model is not its best overall
// model), and because every row names its own model, a rating is never
// attributed to a model that didn't earn it. Idempotent; BARE vendor ids;
// skips vendors absent from the DB. On fetch failure or missing API key,
// writes NOTHING (keeps the last good rows) — never a fabricated value.
// Wired into the daily refresh in place of the former LMArena-category seed.

import { getPrisma, hasDatabase } from "../prisma";
import { fetchArtificialAnalysisModels, type AaModel } from "./artificial-analysis-fetch";
import { writePillarScore } from "../scores/score-writer";
import { blendModelQuality, type MqCategory } from "./model-quality-blend";
import type { EvidenceGrade } from "../../generated/prisma/client";

export interface ModelQualityBenchmarkSeedResult {
  source: "live" | "not_configured" | "unavailable";
  rowsUpserted: number;
  vendorsCovered: number;
  /** vendorId → number of index rows written this run. */
  perVendor: Record<string, number>;
  /** Model-creator names Artificial Analysis ranks that map to no roster vendor. */
  unmappedCreators: string[];
  notFound: string[];
}

const EMPTY: ModelQualityBenchmarkSeedResult = {
  source: "unavailable",
  rowsUpserted: 0,
  vendorsCovered: 0,
  perVendor: {},
  unmappedCreators: [],
  notFound: [],
};

type IndexCategory = "intelligence" | "coding" | "agentic";
const INDEX_OF: Record<IndexCategory, (m: AaModel) => number | null> = {
  intelligence: (m) => m.intelligenceIndex,
  coding: (m) => m.codingIndex,
  agentic: (m) => m.agenticIndex,
};

/** The vendor's best model ON THIS INDEX (its own name goes on the row). */
function bestOn(models: AaModel[], category: IndexCategory): AaModel | null {
  const read = INDEX_OF[category];
  const withIndex = models.filter((m) => read(m) != null);
  if (withIndex.length === 0) return null;
  return withIndex.sort((a, b) => (read(b) ?? 0) - (read(a) ?? 0))[0];
}

export async function seedModelQualityBenchmarks(
  now: Date = new Date(),
): Promise<ModelQualityBenchmarkSeedResult> {
  if (!hasDatabase()) return EMPTY;
  const outcome = await fetchArtificialAnalysisModels();
  if (outcome.status === "not_configured") return { ...EMPTY, source: "not_configured" };
  if (outcome.status === "error") return EMPTY; // keeps the last good rows, never invents

  const prisma = getPrisma();
  const result: ModelQualityBenchmarkSeedResult = {
    source: "live",
    rowsUpserted: 0,
    vendorsCovered: 0,
    perVendor: {},
    unmappedCreators: outcome.result.unmappedCreators,
    notFound: [],
  };

  const byVendor = new Map<string, AaModel[]>();
  for (const m of outcome.result.models) {
    const arr = byVendor.get(m.vendorId) ?? [];
    arr.push(m);
    byVendor.set(m.vendorId, arr);
  }

  for (const [vendorId, models] of byVendor) {
    const perIndexBest = (["intelligence", "coding", "agentic"] as const)
      .map((category) => ({ category, model: bestOn(models, category) }))
      .filter((x): x is { category: IndexCategory; model: AaModel } => x.model !== null);
    if (perIndexBest.length === 0) continue;

    const existing = await prisma.intelligenceVendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!existing) {
      result.notFound.push(vendorId);
      continue;
    }

    let n = 0;
    for (const { category, model } of perIndexBest) {
      const rating = INDEX_OF[category](model);
      if (rating == null) continue; // unreachable after bestOn, kept as a guard
      await prisma.modelQualityBenchmark.upsert({
        where: { vendorId_source_category: { vendorId, source: "artificial_analysis", category } },
        create: {
          vendorId,
          source: "artificial_analysis",
          category,
          rating,
          modelName: model.modelName,
          voteCount: null,
          publishDate: model.releaseDate,
          sourceUrl: outcome.result.sourceUrl,
          capturedAt: now,
        },
        update: {
          rating,
          modelName: model.modelName,
          publishDate: model.releaseDate,
          sourceUrl: outcome.result.sourceUrl,
          capturedAt: now,
        },
      });
      n += 1;
    }
    if (n > 0) {
      result.rowsUpserted += n;
      result.vendorsCovered += 1;
      result.perVendor[vendorId] = n;
    }
  }

  if (result.unmappedCreators.length > 0) {
    console.warn(
      `[model-quality] ${result.unmappedCreators.length} Artificial-Analysis-ranked creator(s) map to no roster vendor: ${result.unmappedCreators.join(", ")}`,
    );
  }
  return result;
}

export interface ModelQualityPillarResult {
  /** Vendors given a model_quality pillar this run. */
  updated: number;
  /** Vendors with benchmark rows but NO intelligence index → no pillar (honest absence). */
  skipped: number;
  /** Stale model_quality pillar rows retired (had no fresh AA source this run — e.g. leftover Arena-ELO rows). */
  cleared: number;
}

/**
 * Bridge: turn the persisted Artificial Analysis benchmark rows into the
 * `model_quality` PILLAR (IntelligencePillarScore) that derive-scores folds into
 * a vendor's overallScore. This REPLACES the retired Arena-ELO pillar (2026-07-19):
 * the score that feeds the dashboard / profile / compare overallScore now comes
 * from Artificial Analysis too, so ELO is gone from EVERY scoring path — not just
 * the read-time composite — and the pillar and the composite's model_quality now
 * derive from the SAME AA normalization (previously they diverged, ELO vs AA).
 *
 * capabilityScore = the intelligence-driver's normalized value on the 0–100 scale
 * the six canonical pillars (and the old ELO pillar) use — blend.normalized × 100.
 * Grade E4 (AA mixes third-party benchmarks with its own runs — never a 5.0
 * "audit-grade" pillar). Confidence from the blend. A vendor with no intelligence
 * index gets NOTHING — honest absence, never a default (matches the composite).
 *
 * Idempotent; routed through the sanctioned writePillarScore firewall (provenance
 * rubric_derive — a benchmark→rubric path, never commercial). Must run AFTER
 * seedModelQualityBenchmarks (reads its rows) and BEFORE derive_scores.
 */
export async function seedModelQualityPillar(): Promise<ModelQualityPillarResult> {
  if (!hasDatabase()) return { updated: 0, skipped: 0, cleared: 0 };
  const prisma = getPrisma();

  const rows = await prisma.modelQualityBenchmark.findMany({
    where: { source: "artificial_analysis" },
    select: { vendorId: true, category: true, rating: true, modelName: true, sourceUrl: true },
  });

  const byVendor = new Map<string, { category: MqCategory; rating: number; modelName?: string; sourceUrl?: string }[]>();
  for (const r of rows) {
    const arr = byVendor.get(r.vendorId) ?? [];
    arr.push({
      category: r.category as MqCategory,
      rating: r.rating,
      modelName: r.modelName ?? undefined,
      sourceUrl: r.sourceUrl ?? undefined,
    });
    byVendor.set(r.vendorId, arr);
  }

  let updated = 0;
  let skipped = 0;
  const written: string[] = [];
  for (const [vendorId, idxRows] of byVendor) {
    // Intelligence drives the pillar (the general model-quality axis) — the same
    // driver the frontier composite uses. No intelligence index → no pillar.
    const blend = blendModelQuality(idxRows, "intelligence");
    if (!blend) {
      skipped += 1;
      continue;
    }
    await writePillarScore(
      prisma,
      {
        vendorId,
        pillar: "model_quality",
        capabilityScore: Math.round(blend.normalized * 100 * 100) / 100, // 0–100, same scale as the canonical pillars
        evidenceGrade: "E4" as EvidenceGrade,
        confidence: blend.confidence,
      },
      { provenance: "rubric_derive" },
    );
    written.push(vendorId);
    updated += 1;
  }

  // Retire stale model_quality pillar rows. derive-scores reads EVERY pillar row
  // (no freshness/provenance filter) and folds it into overallScore, so a vendor
  // that once had an Arena-ELO model_quality row but has NO fresh Artificial
  // Analysis source this run would keep floating on that retired ELO backfill —
  // exactly the "optimistic default" the brief forbids. Deleting the orphaned row
  // drops the vendor to honest absence (derive-scores coverage-discounts the
  // missing pillar over its remaining base pillars). `deleteMany` is intentionally
  // NOT a sanctioned "score write" (it removes, never asserts a value), so it sits
  // outside the score-writer firewall. GUARD: only prune when we actually wrote an
  // AA set this run — never wipe every row on an empty/degraded benchmark read
  // (seedModelQualityBenchmarks keeps the last-good rows on fetch failure, so an
  // empty `written` means AA is not yet populated, not that everyone lost coverage).
  let cleared = 0;
  if (written.length > 0) {
    const del = await prisma.intelligencePillarScore.deleteMany({
      where: { pillar: "model_quality", vendorId: { notIn: written } },
    });
    cleared = del.count;
  }

  return { updated, skipped, cleared };
}
