// Live market-share movement.
// ───────────────────────────
// Market share has no free authoritative real-time feed, so absolute shares
// stay analyst-estimate baselines (the curated, dated MARKET_SHARE_ESTIMATES).
// What this step makes LIVE is the MOVEMENT: each run it tilts each vendor's
// share around its baseline by that vendor's momentum (which is itself driven
// by ingested news + verified evidence), then recomputes changePct so the
// "weekly movers" surfaces actually move with new data.
//
// The tilt is BOUNDED and NON-COMPOUNDING — it's always computed from the
// curated baseline, never from the previous tilted value, so shares respond to
// momentum without ever drifting away from the analyst anchor. Per category the
// tilted shares are renormalised to preserve the baseline category total.

import { getPrisma, hasDatabase } from "../prisma";
import { MARKET_SHARE_ESTIMATES } from "../intelligence/seed";
import { marketShareChangePct } from "../intelligence/metrics";

/** Per-momentum-point tilt and the hard clamp on total relative movement. */
const TILT_PER_POINT = 0.012; // 20-pt momentum lead vs category avg → +24%
const TILT_CLAMP = 0.25; // never move a share more than ±25% of its baseline

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Bounded, non-compounding momentum tilt of a baseline share. momentum and
 * catAvgMomentum are 0-100 momentum scores. Returns the tilted (pre-renormalise)
 * share. Exported for testing. */
export function momentumTiltedShare(baselineShare: number, momentum: number, catAvgMomentum: number): number {
  const factor = 1 + clamp(TILT_PER_POINT * (momentum - catAvgMomentum), -TILT_CLAMP, TILT_CLAMP);
  return Math.max(0, baselineShare * factor);
}

export interface MarketShareMovementResult {
  skipped: boolean;
  reason?: string;
  rowsUpdated: number;
  topMovers: { vendorId: string; categoryId: string; from: number; to: number; changePct: number }[];
}

export async function deriveMarketShareMovement(now: Date = new Date()): Promise<MarketShareMovementResult> {
  if (!hasDatabase()) {
    return { skipped: true, reason: "no_database", rowsUpdated: 0, topMovers: [] };
  }
  const prisma = getPrisma();

  // Live momentum per vendor (written by deriveVendorScores — run this AFTER it).
  const momRows = await prisma.vendorMomentum.findMany({
    where: { period: "rolling_30d" },
    select: { vendorId: true, momentumScore: true },
  });
  const momentum = new Map(momRows.map((r) => [r.vendorId, r.momentumScore]));

  // Group the curated baseline by category.
  const byCategory = new Map<string, typeof MARKET_SHARE_ESTIMATES>();
  for (const s of MARKET_SHARE_ESTIMATES) {
    const arr = byCategory.get(s.categoryId) ?? [];
    arr.push(s);
    byCategory.set(s.categoryId, arr);
  }

  const movers: MarketShareMovementResult["topMovers"] = [];
  let rowsUpdated = 0;

  for (const [, rows] of byCategory) {
    const moms = rows.map((r) => momentum.get(r.vendorId) ?? 50);
    const catAvg = moms.reduce((s, m) => s + m, 0) / (moms.length || 1);
    const baselineTotal = rows.reduce((s, r) => s + r.estimatedShare, 0);

    const tilted = rows.map((r) => momentumTiltedShare(r.estimatedShare, momentum.get(r.vendorId) ?? 50, catAvg));
    const tiltedTotal = tilted.reduce((s, t) => s + t, 0) || 1;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const baseline = r.estimatedShare;
      // Renormalise so the category total is preserved (a tilt up for one
      // vendor is a tilt down for the rest).
      const newShare = Math.round((tilted[i] / tiltedTotal) * baselineTotal * 10) / 10;
      const changePct = marketShareChangePct(newShare, baseline);

      try {
        await prisma.marketShareEstimate.upsert({
          where: { vendorId_categoryId: { vendorId: r.vendorId, categoryId: r.categoryId } },
          create: {
            vendorId: r.vendorId,
            categoryId: r.categoryId,
            estimatedShare: newShare,
            previousEstimate: baseline,
            changePct,
            confidence: r.confidence,
            source: r.source,
            sourceDate: now,
            methodology: `${r.methodology} Movement is momentum-adjusted each run (bounded ±${TILT_CLAMP * 100}% around the analyst baseline).`,
          },
          update: {
            estimatedShare: newShare,
            previousEstimate: baseline,
            changePct,
            sourceDate: now,
          },
        });
        rowsUpdated += 1;
        if (Math.abs(changePct) >= 1) {
          movers.push({ vendorId: r.vendorId, categoryId: r.categoryId, from: baseline, to: newShare, changePct });
        }
      } catch {
        // Skip a single row (e.g. missing IntelligenceVendor FK) rather than abort.
      }
    }
  }

  movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  return { skipped: false, rowsUpdated, topMovers: movers.slice(0, 15) };
}
