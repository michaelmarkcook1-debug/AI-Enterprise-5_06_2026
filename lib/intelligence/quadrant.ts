// Quadrant-view server data layer.
// ───────────────────────────────
// SERVER-ONLY module — imports Prisma transitively via the repository
// and lib/prisma. Pure types + helpers live in ./quadrant-shared so
// the client `QuadrantChart` component can import them without
// pulling Node modules (dns, fs, net, tls) into the browser bundle.

import {
  listIntelligenceVendors,
  listVendorMomentum,
  listMarketShareEstimates,
  listVendorPillarScores,
} from "./repository";
import { getPrisma, hasDatabase } from "../prisma";
import { quadrantOf, type QuadrantData, type QuadrantPoint } from "./quadrant-shared";
import { computeVendorHealth, computeQuadrantAxes } from "./vendor-health";
import type { PillarId } from "../types";
import type { VendorPillarScore } from "./types";

export {
  quadrantOf,
  QUADRANT_LABELS,
  type QuadrantId,
  type QuadrantPoint,
  type QuadrantData,
} from "./quadrant-shared";

export interface BuildQuadrantOptions {
  windowDays?: number;
  /** Threshold for "in the top row" (Leaders / Challengers). Default 60. */
  executeCut?: number;
  /** Threshold for "in the right column" (Leaders / Visionaries). Default 60. */
  visionCut?: number;
  now?: Date;
}

/** Find the snapshot for each vendor closest to `windowDays` ago. */
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
  const executeCut = opts.executeCut ?? 60;
  const visionCut = opts.visionCut ?? 60;

  const [vendors, momenta, shares, pillarScores] = await Promise.all([
    listIntelligenceVendors(),
    listVendorMomentum(),
    listMarketShareEstimates(),
    listVendorPillarScores(),
  ]);

  const momentumByVendor = new Map(momenta.map((m) => [m.vendorId, m.momentumScore]));

  const pillarsByVendor = new Map<string, Map<PillarId, VendorPillarScore>>();
  for (const p of pillarScores) {
    const bucket = pillarsByVendor.get(p.vendorId) ?? new Map<PillarId, VendorPillarScore>();
    bucket.set(p.pillar, p);
    pillarsByVendor.set(p.vendorId, bucket);
  }

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
    const pillarByPillar = pillarsByVendor.get(vendor.id) ?? new Map<PillarId, VendorPillarScore>();

    const { isLosing } = computeVendorHealth({
      vendor,
      momentumScore: momentum,
      negativeShareDelta: negShare,
    });

    const axes = computeQuadrantAxes({
      vendor,
      momentumScore: momentum,
      negativeShareDelta: negShare,
      pillarByPillar,
    });

    // For the prior snapshot we re-run the axis math with TODAY's
    // pillar + risk + share inputs (those move slowly) and the
    // SNAPSHOTTED momentum + score. Gives a directionally honest
    // arrow without needing per-day pillar history.
    const priorRaw = priors.get(vendor.id) ?? null;
    const prevAxes = priorRaw
      ? computeQuadrantAxes({
          vendor: { ...vendor, overallScore: priorRaw.score },
          momentumScore: priorRaw.momentum,
          negativeShareDelta: negShare,
          pillarByPillar,
        })
      : null;
    const prev = priorRaw && prevAxes
      ? {
          score: priorRaw.score,
          momentum: priorRaw.momentum,
          execute: prevAxes.execute,
          vision: prevAxes.vision,
        }
      : null;

    const delta = prev
      ? {
          score: Math.round((score - prev.score) * 10) / 10,
          momentum: Math.round((momentum - prev.momentum) * 10) / 10,
          execute: Math.round((axes.execute - prev.execute) * 10) / 10,
          vision: Math.round((axes.vision - prev.vision) * 10) / 10,
        }
      : null;

    const crossedQuadrant = prev
      ? quadrantOf(axes.execute, axes.vision, executeCut, visionCut)
        !== quadrantOf(prev.execute, prev.vision, executeCut, visionCut)
      : false;

    return {
      vendor,
      now: { execute: axes.execute, vision: axes.vision, score, momentum },
      prev,
      delta,
      isLosing,
      crossedQuadrant,
      components: axes.components,
    };
  });

  return {
    generatedAt: now.toISOString(),
    windowDays,
    executeCut,
    visionCut,
    points,
  };
}
