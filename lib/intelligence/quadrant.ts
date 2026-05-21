// Quadrant-view data layer.
// ────────────────────────
// For each vendor returns its CURRENT (score, momentum) position plus
// its position N days ago (when a stored snapshot exists). The /quadrant
// page renders this as a 2x2 with arrows showing trajectory.
//
// Both axes come from tables the daily-refresh orchestrator updates:
//   - score    ← IntelligenceVendor.overallScore (recomputed by derive_scores)
//   - momentum ← VendorMomentum.momentumScore   (recomputed by derive_scores)
//   - prior    ← VendorRankingSnapshot rows from N days ago
//
// Quadrant labels (with default cuts at score=60, momentum=50):
//   top-right:    Leaders     (score ≥60, momentum ≥50)
//   top-left:     Established (score ≥60, momentum  <50)
//   bottom-right: Challengers (score  <60, momentum ≥50)
//   bottom-left:  Watch list  (score  <60, momentum  <50)

import { listIntelligenceVendors, listVendorMomentum } from "./repository";
import { getPrisma, hasDatabase } from "../prisma";
import type { Vendor } from "./types";

export interface QuadrantPoint {
  vendor: Vendor;
  now: { score: number; momentum: number };
  prev: { score: number; momentum: number } | null;
  delta: { score: number; momentum: number } | null;
  crossedQuadrant: boolean;
}

export type QuadrantId = "leaders" | "established" | "challengers" | "watchlist";

export function quadrantOf(score: number, momentum: number, scoreCut: number, momentumCut: number): QuadrantId {
  if (score >= scoreCut && momentum >= momentumCut) return "leaders";
  if (score >= scoreCut && momentum < momentumCut) return "established";
  if (score < scoreCut && momentum >= momentumCut) return "challengers";
  return "watchlist";
}

export const QUADRANT_LABELS: Record<QuadrantId, string> = {
  leaders: "Leaders",
  established: "Established",
  challengers: "Challengers",
  watchlist: "Watch list",
};

export interface QuadrantData {
  generatedAt: string;
  windowDays: number;
  scoreCut: number;
  momentumCut: number;
  points: QuadrantPoint[];
}

export interface BuildQuadrantOptions {
  windowDays?: number;
  scoreCut?: number;
  momentumCut?: number;
  now?: Date;
}

/**
 * Find the snapshot for each vendor that's closest to `windowDays` ago.
 * Falls back to the oldest available snapshot if the vendor hasn't been
 * tracked that long.
 */
async function fetchPriorSnapshots(
  vendorIds: string[],
  windowDays: number,
  now: Date,
): Promise<Map<string, { score: number; momentum: number }>> {
  if (!hasDatabase() || vendorIds.length === 0) return new Map();
  const target = new Date(now.getTime() - windowDays * 86400 * 1000);
  const earliestWindow = new Date(target.getTime() - 3 * 86400 * 1000);
  const latestWindow = new Date(target.getTime() + 3 * 86400 * 1000);

  try {
    const rows = await getPrisma().vendorRankingSnapshot.findMany({
      where: {
        vendorId: { in: vendorIds },
        snapshotDate: { gte: earliestWindow, lte: latestWindow },
      },
      orderBy: { snapshotDate: "asc" },
      select: { vendorId: true, snapshotDate: true, overallScore: true, momentumScore: true },
    });

    // Per vendor, pick the row whose date is nearest to the target.
    const best = new Map<string, { dist: number; score: number; momentum: number }>();
    for (const r of rows) {
      const dist = Math.abs(r.snapshotDate.getTime() - target.getTime());
      const cur = best.get(r.vendorId);
      if (!cur || dist < cur.dist) {
        best.set(r.vendorId, { dist, score: r.overallScore, momentum: r.momentumScore });
      }
    }

    // Fall back to the oldest snapshot for vendors with no row in window.
    const missingIds = vendorIds.filter((id) => !best.has(id));
    if (missingIds.length > 0) {
      const fallbackRows = await getPrisma().vendorRankingSnapshot.findMany({
        where: { vendorId: { in: missingIds } },
        orderBy: { snapshotDate: "asc" },
        distinct: ["vendorId"],
        select: { vendorId: true, overallScore: true, momentumScore: true },
      });
      for (const r of fallbackRows) {
        best.set(r.vendorId, { dist: 0, score: r.overallScore, momentum: r.momentumScore });
      }
    }

    return new Map(
      Array.from(best.entries()).map(([id, v]) => [id, { score: v.score, momentum: v.momentum }]),
    );
  } catch {
    return new Map();
  }
}

export async function buildQuadrantData(opts: BuildQuadrantOptions = {}): Promise<QuadrantData> {
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? 14;
  const scoreCut = opts.scoreCut ?? 60;
  const momentumCut = opts.momentumCut ?? 50;

  const [vendors, momenta] = await Promise.all([
    listIntelligenceVendors(),
    listVendorMomentum(),
  ]);
  const momentumByVendor = new Map(momenta.map((m) => [m.vendorId, m.momentumScore]));
  const priors = await fetchPriorSnapshots(vendors.map((v) => v.id), windowDays, now);

  const points: QuadrantPoint[] = vendors.map((vendor) => {
    const score = vendor.overallScore;
    const momentum = momentumByVendor.get(vendor.id) ?? 50;
    const prev = priors.get(vendor.id) ?? null;
    const delta = prev
      ? {
          score: Math.round((score - prev.score) * 10) / 10,
          momentum: Math.round((momentum - prev.momentum) * 10) / 10,
        }
      : null;
    const crossedQuadrant = prev
      ? quadrantOf(score, momentum, scoreCut, momentumCut)
        !== quadrantOf(prev.score, prev.momentum, scoreCut, momentumCut)
      : false;

    return { vendor, now: { score, momentum }, prev, delta, crossedQuadrant };
  });

  return {
    generatedAt: now.toISOString(),
    windowDays,
    scoreCut,
    momentumCut,
    points,
  };
}
