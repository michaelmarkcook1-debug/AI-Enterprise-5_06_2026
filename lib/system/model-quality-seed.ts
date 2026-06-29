// Persist the real LMArena category leaderboards → model_quality_benchmarks.
// ─────────────────────────────────────────────────────────────────────────────
// Fetches the live per-category Elos (lmarena-categories.ts) and upserts one cited
// row per (vendor, source, category). These are the raw inputs the broadened
// model_quality blends. Idempotent; BARE vendor ids; skips vendors absent from the
// DB. On fetch failure it writes NOTHING (keeps the last good rows) — never a
// fabricated value. Wired into the daily refresh alongside seedEloPillarScores.

import { getPrisma, hasDatabase } from "../prisma";
import { fetchLmarenaCategories } from "./lmarena-categories";

export interface ModelQualityBenchmarkSeedResult {
  source: "live" | "unavailable";
  rowsUpserted: number;
  vendorsCovered: number;
  /** vendorId → number of category rows written this run. */
  perVendor: Record<string, number>;
  /** Arena-ranked orgs that map to no roster vendor — the coverage gap. */
  unmappedOrgs: string[];
  configsLoaded: string[];
  notFound: string[];
}

const EMPTY: ModelQualityBenchmarkSeedResult = {
  source: "unavailable",
  rowsUpserted: 0,
  vendorsCovered: 0,
  perVendor: {},
  unmappedOrgs: [],
  configsLoaded: [],
  notFound: [],
};

export async function seedModelQualityBenchmarks(
  now: Date = new Date(),
): Promise<ModelQualityBenchmarkSeedResult> {
  if (!hasDatabase()) return EMPTY;
  const fetched = await fetchLmarenaCategories();
  if (!fetched) return EMPTY; // honest absence — keep last good rows, never invent

  const prisma = getPrisma();
  const result: ModelQualityBenchmarkSeedResult = {
    source: "live",
    rowsUpserted: 0,
    vendorsCovered: 0,
    perVendor: {},
    unmappedOrgs: fetched.unmappedOrgs,
    configsLoaded: fetched.configsLoaded,
    notFound: [],
  };

  for (const [vendorId, ratings] of fetched.vendors) {
    const existing = await prisma.intelligenceVendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!existing) {
      result.notFound.push(vendorId);
      continue;
    }
    let n = 0;
    for (const r of ratings) {
      await prisma.modelQualityBenchmark.upsert({
        where: { vendorId_source_category: { vendorId, source: "lmarena", category: r.category } },
        create: {
          vendorId,
          source: "lmarena",
          category: r.category,
          rating: r.rating,
          modelName: r.modelName,
          voteCount: r.voteCount ?? null,
          publishDate: r.publishDate ?? null,
          sourceUrl: fetched.sourceUrl,
          capturedAt: now,
        },
        update: {
          rating: r.rating,
          modelName: r.modelName,
          voteCount: r.voteCount ?? null,
          publishDate: r.publishDate ?? null,
          sourceUrl: fetched.sourceUrl,
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

  if (result.unmappedOrgs.length > 0) {
    console.warn(
      `[model-quality] ${result.unmappedOrgs.length} LMArena-ranked org(s) map to no roster vendor: ${result.unmappedOrgs.join(", ")}`,
    );
  }
  return result;
}
