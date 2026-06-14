// Ranking-snapshot data layer.
// ────────────────────────────
// Persists and reads point-in-time vendor ranking metrics so the dashboard
// "Who's winning / losing" trend graphs are backed by real tracked history
// rather than a purely synthetic reconstruction.
//
// Three entry points:
//   - captureRankingSnapshots()  — write today's metrics (daily cron).
//   - backfillRankingSnapshots() — seed reconstructed history for dates
//                                  that predate snapshot capture, so the
//                                  graphs have depth from day one.
//   - getRankingHistories()      — read history for the dashboard; uses
//                                  stored snapshots where they exist and
//                                  falls back to deterministic
//                                  reconstruction for any vendor without
//                                  enough stored points.
//
// The seed/no-DB path degrades gracefully: with no DATABASE_URL the read
// path simply returns the reconstruction and the write paths are no-ops.

import { getPrisma, hasDatabase } from "../prisma";
import { listIntelligenceVendors, listVendorMomentum } from "./repository";
import { buildRankingHistories, type VendorRankingHistory } from "./ranking-history";
import type { Vendor, VendorMomentum } from "./types";

/** yyyy-mm-dd for a Date, in UTC. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Rank vendors by overall score (1 = top). Stable: ties are broken by
 * vendor id so a re-run produces an identical ordering.
 */
function rankVendors(vendors: Vendor[]): Map<string, number> {
  const ordered = [...vendors].sort((a, b) =>
    b.overallScore - a.overallScore || a.id.localeCompare(b.id),
  );
  const ranks = new Map<string, number>();
  ordered.forEach((v, i) => ranks.set(v.id, i + 1));
  return ranks;
}

export interface CaptureResult {
  captured: number;
  snapshotDate: string;
  skipped: boolean;
  reason?: string;
}

/**
 * Capture one daily ranking snapshot per vendor.
 *
 * Idempotent: re-running for the same date updates the existing rows
 * (via the (vendorId, snapshotDate) unique key) rather than duplicating.
 */
export async function captureRankingSnapshots(now: Date = new Date()): Promise<CaptureResult> {
  const snapshotDate = toUtcMidnight(now);
  const dateLabel = isoDate(snapshotDate);

  if (!hasDatabase()) {
    return { captured: 0, snapshotDate: dateLabel, skipped: true, reason: "no DATABASE_URL" };
  }

  const [vendors, momentum] = await Promise.all([
    listIntelligenceVendors(),
    listVendorMomentum(),
  ]);
  const ranks = rankVendors(vendors);
  const momentumByVendor = new Map(momentum.map((m) => [m.vendorId, m.momentumScore]));
  const prisma = getPrisma();

  let captured = 0;
  for (const vendor of vendors) {
    await prisma.vendorRankingSnapshot.upsert({
      where: { vendorId_snapshotDate: { vendorId: vendor.id, snapshotDate } },
      create: {
        vendorId: vendor.id,
        snapshotDate,
        overallScore: vendor.overallScore,
        momentumScore: momentumByVendor.get(vendor.id) ?? 50,
        confidenceScore: vendor.confidenceScore,
        rank: ranks.get(vendor.id) ?? vendors.length,
        trackedVendors: vendors.length,
        source: "snapshot",
      },
      update: {
        overallScore: vendor.overallScore,
        momentumScore: momentumByVendor.get(vendor.id) ?? 50,
        confidenceScore: vendor.confidenceScore,
        rank: ranks.get(vendor.id) ?? vendors.length,
        trackedVendors: vendors.length,
        source: "snapshot",
        capturedAt: new Date(),
      },
    });
    captured += 1;
  }

  return { captured, snapshotDate: dateLabel, skipped: false };
}

export interface BackfillResult {
  inserted: number;
  vendors: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Seed reconstructed history into the snapshot table for any dates not
 * already stored. Rows are written with source="backfill" so they can be
 * told apart from — and later superseded by — real captured snapshots.
 *
 * Safe to run repeatedly: existing (vendorId, snapshotDate) rows are
 * never overwritten (skipDuplicates), so a real "snapshot" row always
 * wins over a "backfill" row for the same day.
 */
export async function backfillRankingSnapshots(now: Date = new Date()): Promise<BackfillResult> {
  if (!hasDatabase()) {
    return { inserted: 0, vendors: 0, skipped: true, reason: "no DATABASE_URL" };
  }

  const [vendors, momentum] = await Promise.all([
    listIntelligenceVendors(),
    listVendorMomentum(),
  ]);
  const histories = buildRankingHistories(vendors, momentum, now);
  const prisma = getPrisma();

  const rows = [];
  for (const history of histories.values()) {
    for (const point of history.points) {
      rows.push({
        vendorId: history.vendorId,
        snapshotDate: new Date(`${point.date}T00:00:00.000Z`),
        overallScore: point.score,
        momentumScore: point.momentum,
        confidenceScore: vendors.find((v) => v.id === history.vendorId)?.confidenceScore ?? 60,
        rank: point.rank,
        trackedVendors: vendors.length,
        source: "backfill",
      });
    }
  }

  const result = await prisma.vendorRankingSnapshot.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return { inserted: result.count, vendors: histories.size, skipped: false };
}

interface SnapshotRow {
  vendorId: string;
  snapshotDate: Date;
  overallScore: number;
  momentumScore: number;
  rank: number;
  source: string;
}

/** Build a VendorRankingHistory from stored snapshot rows (oldest first). */
function historyFromRows(vendorId: string, rows: SnapshotRow[]): VendorRankingHistory {
  const points = rows.map((r) => ({
    date: isoDate(r.snapshotDate),
    score: r.overallScore,
    momentum: r.momentumScore,
    rank: r.rank,
  }));
  const first = points[0];
  const last = points[points.length - 1];

  const hasSnapshot = rows.some((r) => r.source === "snapshot");
  const hasBackfill = rows.some((r) => r.source !== "snapshot");
  const source: VendorRankingHistory["source"] =
    hasSnapshot && hasBackfill ? "mixed" : hasSnapshot ? "snapshot" : "reconstructed";

  return {
    vendorId,
    trackingStart: first.date,
    points,
    scoreDelta: Math.round((last.score - first.score) * 10) / 10,
    rankDelta: first.rank - last.rank,
    source,
  };
}

/**
 * Ranking history for every vendor, for the dashboard trend graphs.
 *
 * Per vendor: if the snapshot table holds ≥2 days of stored history, that
 * real series is used; otherwise the deterministic reconstruction fills in
 * so the graph is never empty. With no database, the whole result is the
 * reconstruction.
 */
export async function getRankingHistories(
  vendors: Vendor[],
  momentum: VendorMomentum[],
  now: Date = new Date(),
): Promise<Map<string, VendorRankingHistory>> {
  const reconstructed = buildRankingHistories(vendors, momentum, now);

  if (!hasDatabase()) return reconstructed;

  try {
    const rows = await getPrisma().vendorRankingSnapshot.findMany({
      orderBy: [{ vendorId: "asc" }, { snapshotDate: "asc" }],
      select: {
        vendorId: true,
        snapshotDate: true,
        overallScore: true,
        momentumScore: true,
        rank: true,
        source: true,
      },
    });

    const byVendor = new Map<string, SnapshotRow[]>();
    for (const row of rows) {
      const bucket = byVendor.get(row.vendorId) ?? [];
      bucket.push(row);
      byVendor.set(row.vendorId, bucket);
    }

    const merged = new Map(reconstructed);
    for (const [vendorId, vendorRows] of byVendor) {
      if (vendorRows.length >= 2) {
        merged.set(vendorId, historyFromRows(vendorId, vendorRows));
      }
    }
    return merged;
  } catch {
    // DB unreachable — degrade to the reconstruction rather than failing
    // the dashboard render.
    return reconstructed;
  }
}
