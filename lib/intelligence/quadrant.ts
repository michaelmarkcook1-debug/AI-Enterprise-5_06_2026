// Quadrant-view server data layer.
// ───────────────────────────────
// SERVER-ONLY module — imports Prisma transitively via the repository
// and lib/prisma. Pure types + helpers live in ./quadrant-shared so
// the client `QuadrantChart` component can import them without
// pulling Node modules (dns, fs, net, tls) into the browser bundle.

import { listIntelligenceVendors, listVendorMomentum, listMarketShareEstimates } from "./repository";
import { getPrisma, hasDatabase } from "../prisma";
import { quadrantOf, type QuadrantData, type QuadrantPoint } from "./quadrant-shared";
import { computeVendorHealth } from "./vendor-health";

// Re-export the shared surface so existing imports of ./quadrant
// continue to work for server consumers.
export {
  quadrantOf,
  QUADRANT_LABELS,
  type QuadrantId,
  type QuadrantPoint,
  type QuadrantData,
} from "./quadrant-shared";

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

    const best = new Map<string, { dist: number; score: number; momentum: number }>();
    for (const r of rows) {
      const dist = Math.abs(r.snapshotDate.getTime() - target.getTime());
      const cur = best.get(r.vendorId);
      if (!cur || dist < cur.dist) {
        best.set(r.vendorId, { dist, score: r.overallScore, momentum: r.momentumScore });
      }
    }

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
  // X-axis cut: 60 by design so any vendor flagged as "losing" by the
  // dashboard filter (which is mechanically guaranteed to have
  // healthScore < 60) cannot land in the Leaders quadrant.
  const momentumCut = opts.momentumCut ?? 60;

  const [vendors, momenta, shares] = await Promise.all([
    listIntelligenceVendors(),
    listVendorMomentum(),
    listMarketShareEstimates(),
  ]);
  const momentumByVendor = new Map(momenta.map((m) => [m.vendorId, m.momentumScore]));

  // Negative-share aggregation matches lib/intelligence/repository.ts
  // shareTrendByVendor — sum of negative changePct per vendor across
  // categories, expressed as a positive "drop in points" number.
  const negShareByVendor = new Map<string, number>();
  for (const s of shares) {
    const drag = Math.abs(Math.min(0, s.changePct));
    if (drag > 0) {
      negShareByVendor.set(s.vendorId, (negShareByVendor.get(s.vendorId) ?? 0) + drag);
    }
  }

  const priors = await fetchPriorSnapshots(vendors.map((v) => v.id), windowDays, now);

  const points: QuadrantPoint[] = vendors.map((vendor) => {
    const score = vendor.overallScore;
    const momentum = momentumByVendor.get(vendor.id) ?? 50;
    const negShare = negShareByVendor.get(vendor.id) ?? 0;
    const { healthScore, isLosing } = computeVendorHealth({
      vendor,
      momentumScore: momentum,
      negativeShareDelta: negShare,
    });

    const priorRaw = priors.get(vendor.id) ?? null;
    // Prior snapshots store only score + momentum. Reconstruct prior
    // health using TODAY's risk/share drag (those move slowly) so the
    // arrow direction reflects the momentum component of the change.
    const prev = priorRaw
      ? {
          score: priorRaw.score,
          momentum: priorRaw.momentum,
          health: computeVendorHealth({
            vendor,
            momentumScore: priorRaw.momentum,
            negativeShareDelta: negShare,
          }).healthScore,
        }
      : null;

    const delta = prev
      ? {
          score: Math.round((score - prev.score) * 10) / 10,
          momentum: Math.round((momentum - prev.momentum) * 10) / 10,
          health: Math.round((healthScore - prev.health) * 10) / 10,
        }
      : null;

    const crossedQuadrant = prev
      ? quadrantOf(score, healthScore, scoreCut, momentumCut)
        !== quadrantOf(prev.score, prev.health, scoreCut, momentumCut)
      : false;

    return {
      vendor,
      now: { score, momentum, health: healthScore },
      prev,
      delta,
      isLosing,
      crossedQuadrant,
    };
  });

  return {
    generatedAt: now.toISOString(),
    windowDays,
    scoreCut,
    momentumCut,
    points,
  };
}
