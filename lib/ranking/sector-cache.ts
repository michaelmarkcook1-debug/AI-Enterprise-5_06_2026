// C15 — per-sector materialised ranking cache.
// ─────────────────────────────────────────────────────────────────────────────
// The within-category composite (getCategoryComposites) is deterministic given
// the DB state, which only changes during the nightly refresh — yet today every
// page load recomputes all 13 categories from scratch. This module materialises
// that compute ONCE per refresh cycle into `sector_ranking_cache` (one row per
// category) and serves it to every subscriber covering that sector.
//
// HONESTY (C15 guardrails):
//  • Cached data carries its real as-of (`capturedAt`) — never presented as "live".
//  • The cache is READ-THROUGH only; it never writes canonical scores and a live
//    compute is always the fallback, so the cache can never be MORE stale than a
//    live read and can never introduce seed (it stores exactly what the live
//    compute — already isLiveData-gated — produced, with its isLive flag).
//  • A missing or stale cache falls back to a live compute rather than a silent
//    stale serve.
//
// To avoid an import cycle with category-composite.ts, the live compute is passed
// IN as a function (this module imports nothing from category-composite).

import { getPrisma, hasDatabase } from "../prisma";
import type { CategoryComposite } from "./composite-types";

// Serve the cache within this window; older than this and we recompute live so a
// served page is never more stale than a live read. The batch runs every ~24h,
// so 48h tolerates one missed cycle before falling back to live.
const CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export interface CachedComposites {
  composites: CategoryComposite[];
  /** Honest as-of: when the batch materialised this cache. null ⇒ computed live now. */
  asOf: Date | null;
  source: "cache" | "live";
}

type ComputeFn = () => Promise<CategoryComposite[]>;

/** Materialise the per-sector cache — one upserted row per category. Called once
 *  per refresh cycle from the daily-refresh batch. No-op (never throws) when the
 *  DB/table is absent, so the refresh never fails on the cache. */
export async function materializeSectorCache(compute: ComputeFn): Promise<{ written: number }> {
  if (!hasDatabase()) return { written: 0 };
  try {
    const composites = await compute();
    const prisma = getPrisma();
    const now = new Date();
    let written = 0;
    for (const c of composites) {
      const payload = c as unknown as object;
      await prisma.sectorRankingCache.upsert({
        where: { categoryId: c.category.id },
        create: { categoryId: c.category.id, payload, isLive: c.isLive, capturedAt: now },
        update: { payload, isLive: c.isLive, capturedAt: now },
      });
      written++;
    }
    return { written };
  } catch (err) {
    console.warn(`[sector-cache] materialise failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    return { written: 0 };
  }
}

/** Read-through: serve the cached composites when present and fresh; otherwise
 *  compute live. Never throws — any cache miss/error falls back to a live compute. */
export async function readSectorCache(compute: ComputeFn): Promise<CachedComposites> {
  if (hasDatabase()) {
    try {
      const rows = await getPrisma().sectorRankingCache.findMany();
      if (rows.length > 0) {
        const newest = rows.reduce((max, r) => (r.capturedAt > max ? r.capturedAt : max), rows[0].capturedAt);
        if (Date.now() - newest.getTime() <= CACHE_MAX_AGE_MS) {
          return {
            composites: rows.map((r) => r.payload as unknown as CategoryComposite),
            asOf: newest,
            source: "cache",
          };
        }
      }
    } catch {
      // fall through to a live compute
    }
  }
  return { composites: await compute(), asOf: null, source: "live" };
}
