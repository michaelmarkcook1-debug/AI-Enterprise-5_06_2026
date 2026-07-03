// Live model inventory — from REAL cited benchmark evidence, not seed.
// ─────────────────────────────────────────────────────────────────────────────
// The /models page used to read the hardcoded SEED inventory
// (lib/model-inventory/seed.ts), so the no-fabrication gate
// (HARDCODED_SURFACES_WIRED) correctly held it dark. This reads the LIVE,
// analyst-cited ModelQualityBenchmark rows (LMArena per-category Elo, each with
// a real source_url + publish date) and shapes them into an evidence-backed
// model inventory. Nothing here is invented: a model appears ONLY if it has a
// real benchmark row with a citation. Read-time, deterministic, no writes.
//
// FIREWALL: reads benchmark + vendor-name rows only; writes nothing; touches no
// vendor score. Every rendered rating traces to its LMArena source_url.

import { getPrisma, hasDatabase } from "../prisma";

/** One benchmark category's cited rating for a model. */
export interface LiveModelCategory {
  category: string; // "overall" | "coding" | "hard_prompts" | "vision" | …
  rating: number; // LMArena Elo
  voteCount: number | null;
}

/** A single real model, aggregated across its cited benchmark categories. */
export interface LiveModel {
  modelName: string;
  vendorId: string;
  vendorName: string;
  /** The "overall" category rating when present, else the highest category. */
  headlineRating: number;
  /** Which category headlineRating came from (so we never mislabel it). */
  headlineCategory: string;
  categories: LiveModelCategory[];
  /** Freshness — the leaderboard publish date (YYYY-MM-DD) if the source gave one. */
  publishDate: string | null;
  /** When we captured it (freshness fallback). */
  capturedAt: string;
  /** The cited LMArena leaderboard URL. */
  sourceUrl: string;
  source: string; // "lmarena"
}

export interface LiveModelInventory {
  models: LiveModel[];
  totalModels: number;
  totalVendors: number;
  /** Most recent leaderboard publish date across all rows (freshness headline). */
  freshestPublishDate: string | null;
  /** Distinct cited sources (e.g. "lmarena"). */
  sources: string[];
}

const EMPTY: LiveModelInventory = {
  models: [],
  totalModels: 0,
  totalVendors: 0,
  freshestPublishDate: null,
  sources: [],
};

interface BenchmarkRow {
  vendorId: string;
  source: string;
  category: string;
  rating: number;
  modelName: string;
  voteCount: number | null;
  publishDate: string | null;
  sourceUrl: string;
  capturedAt: Date;
}

/**
 * Build the live model inventory from cited ModelQualityBenchmark rows.
 * Returns EMPTY (honest "no data") when there is no database or no benchmark
 * evidence — never a seed fallback. Never throws.
 */
export async function getLiveModelInventory(now: Date = new Date()): Promise<LiveModelInventory> {
  if (!hasDatabase()) return EMPTY;
  try {
    const rows = (await getPrisma().modelQualityBenchmark.findMany({
      select: {
        vendorId: true,
        source: true,
        category: true,
        rating: true,
        modelName: true,
        voteCount: true,
        publishDate: true,
        sourceUrl: true,
        capturedAt: true,
      },
    })) as BenchmarkRow[];
    if (rows.length === 0) return EMPTY;

    // Resolve vendor display names (id → name). Absent name → the id (honest).
    const vendorIds = [...new Set(rows.map((r) => r.vendorId))];
    const vendors = await getPrisma().intelligenceVendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(vendors.map((v) => [v.id, v.name]));

    // Aggregate by (vendorId, modelName): one entry per real model.
    const byModel = new Map<string, LiveModel>();
    for (const r of rows) {
      const key = `${r.vendorId}::${r.modelName}`;
      let m = byModel.get(key);
      if (!m) {
        m = {
          modelName: r.modelName,
          vendorId: r.vendorId,
          vendorName: nameById.get(r.vendorId) ?? r.vendorId,
          headlineRating: 0,
          headlineCategory: "",
          categories: [],
          publishDate: r.publishDate ?? null,
          capturedAt: r.capturedAt.toISOString(),
          sourceUrl: r.sourceUrl,
          source: r.source,
        };
        byModel.set(key, m);
      }
      m.categories.push({ category: r.category, rating: r.rating, voteCount: r.voteCount });
      // Keep the freshest publish date + its source for the model.
      if (r.publishDate && (!m.publishDate || r.publishDate > m.publishDate)) {
        m.publishDate = r.publishDate;
        m.sourceUrl = r.sourceUrl;
      }
    }

    // Headline rating: prefer the "overall" category, else the highest-rated one.
    for (const m of byModel.values()) {
      const overall = m.categories.find((c) => c.category === "overall");
      const pick = overall ?? [...m.categories].sort((a, b) => b.rating - a.rating)[0];
      m.headlineRating = pick.rating;
      m.headlineCategory = pick.category;
      m.categories.sort((a, b) => b.rating - a.rating);
    }

    const models = [...byModel.values()].sort(
      (a, b) => b.headlineRating - a.headlineRating || a.modelName.localeCompare(b.modelName),
    );
    const publishDates = rows.map((r) => r.publishDate).filter((d): d is string => !!d);
    const freshestPublishDate = publishDates.length ? publishDates.sort().at(-1)! : null;

    return {
      models,
      totalModels: models.length,
      totalVendors: new Set(models.map((m) => m.vendorId)).size,
      freshestPublishDate,
      sources: [...new Set(rows.map((r) => r.source))],
    };
  } catch {
    return EMPTY;
  }
}
