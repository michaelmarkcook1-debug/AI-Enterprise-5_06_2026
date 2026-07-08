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
