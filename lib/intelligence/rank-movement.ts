// Rankings movement — per-vendor rank delta from real snapshot history.
// ─────────────────────────────────────────────────────────────────────
// VendorRankingSnapshot stores the daily OVERALL leaderboard rank per vendor.
// This reads the two most recent snapshot dates and returns each vendor's rank
// change, so the UI can show a ▲/▼ movement indicator backed by real history —
// never a fabricated trend. delta > 0 = climbed; null = no prior snapshot (new /
// first run). Read-only; empty map on no DB / read failure (honest "no data").

import { getPrisma, hasDatabase } from "../prisma";

export interface RankMovement {
  currentRank: number;
  previousRank: number | null;
  /** previousRank − currentRank: positive = moved UP, negative = down, 0 = held. */
  delta: number | null;
  /** No prior snapshot for this vendor (new entrant or first capture). */
  isNew: boolean;
  /** ISO dates the delta is measured between (for an honest tooltip). */
  fromDate: string | null;
  toDate: string | null;
}

/**
 * Per-vendor overall-rank movement between the two most recent snapshot dates.
 * Returns a map vendorId → RankMovement (empty when there's no history yet).
 */
export async function getRankMovements(): Promise<Map<string, RankMovement>> {
  const out = new Map<string, RankMovement>();
  if (!hasDatabase()) return out;
  try {
    const prisma = getPrisma();
    const dates = await prisma.vendorRankingSnapshot.findMany({
      distinct: ["snapshotDate"],
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true },
      take: 2,
    });
    if (dates.length === 0) return out;
    const current = dates[0].snapshotDate;
    const previous = dates[1]?.snapshotDate ?? null;
    const toDate = current.toISOString().slice(0, 10);
    const fromDate = previous ? previous.toISOString().slice(0, 10) : null;

    const currentRows = await prisma.vendorRankingSnapshot.findMany({
      where: { snapshotDate: current },
      select: { vendorId: true, rank: true },
    });
    const prevRank = new Map<string, number>();
    if (previous) {
      const prevRows = await prisma.vendorRankingSnapshot.findMany({
        where: { snapshotDate: previous },
        select: { vendorId: true, rank: true },
      });
      for (const r of prevRows) prevRank.set(r.vendorId, r.rank);
    }

    for (const r of currentRows) {
      const prev = prevRank.get(r.vendorId) ?? null;
      out.set(r.vendorId, {
        currentRank: r.rank,
        previousRank: prev,
        delta: prev != null ? prev - r.rank : null,
        isNew: prev == null,
        fromDate,
        toDate,
      });
    }
    return out;
  } catch {
    return out;
  }
}
