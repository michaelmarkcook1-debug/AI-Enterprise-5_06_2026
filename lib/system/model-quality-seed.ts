// Persist real Artificial Analysis indices → model_quality_benchmarks.
// ─────────────────────────────────────────────────────────────────────────────
// Fetches the live per-model indices (artificial-analysis-fetch.ts) and, for
// each roster vendor, upserts one cited row per index category (intelligence /
// coding / agentic) from that vendor's FLAGSHIP model only — the highest
// Intelligence Index among its tracked models. All three rows for a vendor
// always come from the same model (never mixed — that would misattribute a
// score), and a model with no Intelligence Index is never eligible as
// flagship. Idempotent; BARE vendor ids; skips vendors absent from the DB. On
// fetch failure or missing API key, writes NOTHING (keeps the last good rows)
// — never a fabricated value. Wired into the daily refresh in place of the
// former LMArena-category seed.

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

/** This vendor's flagship: the model with the highest Intelligence Index.
 *  A model with no Intelligence Index can never be picked (nothing to score). */
function flagshipFor(models: AaModel[]): AaModel | null {
  const withIndex = models.filter((m) => m.intelligenceIndex != null);
  if (withIndex.length === 0) return null;
  return withIndex.sort((a, b) => (b.intelligenceIndex ?? 0) - (a.intelligenceIndex ?? 0))[0];
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
    const flagship = flagshipFor(models);
    if (!flagship) continue;

    const existing = await prisma.intelligenceVendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!existing) {
      result.notFound.push(vendorId);
      continue;
    }

    const indices: { category: "intelligence" | "coding" | "agentic"; rating: number | null }[] = [
      { category: "intelligence", rating: flagship.intelligenceIndex },
      { category: "coding", rating: flagship.codingIndex },
      { category: "agentic", rating: flagship.agenticIndex },
    ];
    let n = 0;
    for (const { category, rating } of indices) {
      if (rating == null) continue; // honest absence — never write a fabricated 0
      await prisma.modelQualityBenchmark.upsert({
        where: { vendorId_source_category: { vendorId, source: "artificial_analysis", category } },
        create: {
          vendorId,
          source: "artificial_analysis",
          category,
          rating,
          modelName: flagship.modelName,
          voteCount: null,
          publishDate: flagship.releaseDate,
          sourceUrl: outcome.result.sourceUrl,
          capturedAt: now,
        },
        update: {
          rating,
          modelName: flagship.modelName,
          publishDate: flagship.releaseDate,
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
