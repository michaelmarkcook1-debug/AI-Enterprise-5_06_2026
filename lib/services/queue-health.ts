// Pending-queue health summary.
// ─────────────────────────────
// Surfaced in the /admin/evidence header so operators see queue size +
// deferred count + stale-pending count at a glance. Pure helpers
// shaped for unit testing; the DB-backed wrapper lives in
// getQueueHealthSummary().

import type { EvidenceProposal, PrismaClient } from "../../generated/prisma/client";
import { isDeferred, DEFERRED_PREFIX } from "./batch-review";

/** A pending proposal is "stale" when its captured_at is more than
 * this many days in the past — operator attention overdue. */
export const STALE_PENDING_THRESHOLD_DAYS = 30;

export interface QueueHealthSummary {
  totalPending: number;
  deferredCount: number;
  /** Pending rows captured > STALE_PENDING_THRESHOLD_DAYS ago. */
  staleCount: number;
  /** Pending rows that are NEITHER deferred NOR stale — the active
   * working set the operator should be looking at next. */
  freshActionableCount: number;
}

/** Pure shape — returns counts from a row array. Easier to test than
 * the DB-backed version below. */
export function summarisePendingRows(
  rows: { capturedAt: Date; reviewNotes: string | null }[],
  now: Date = new Date(),
): QueueHealthSummary {
  const staleCutoff = new Date(now.getTime() - STALE_PENDING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  let deferred = 0;
  let stale = 0;
  let freshActionable = 0;
  for (const r of rows) {
    const isDef = isDeferred(r.reviewNotes);
    const isStale = r.capturedAt < staleCutoff;
    if (isDef) {
      deferred += 1;
    } else if (isStale) {
      stale += 1;
    } else {
      freshActionable += 1;
    }
  }
  return {
    totalPending: rows.length,
    deferredCount: deferred,
    staleCount: stale,
    freshActionableCount: freshActionable,
  };
}

/** DB-backed wrapper — runs three count queries in parallel for speed.
 * Pure-counts version of summarisePendingRows() that doesn't need to
 * load every row's data into memory. */
export async function getQueueHealthSummary(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<QueueHealthSummary> {
  const staleCutoff = new Date(now.getTime() - STALE_PENDING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const [totalPending, deferredCount, staleNotDeferredCount] = await Promise.all([
    prisma.evidenceProposal.count({ where: { status: "pending" } }),
    prisma.evidenceProposal.count({
      where: { status: "pending", reviewNotes: { startsWith: DEFERRED_PREFIX } },
    }),
    prisma.evidenceProposal.count({
      where: {
        status: "pending",
        capturedAt: { lt: staleCutoff },
        // Exclude deferred so the three buckets are mutually exclusive.
        NOT: { reviewNotes: { startsWith: DEFERRED_PREFIX } },
      },
    }),
  ]);
  return {
    totalPending,
    deferredCount,
    staleCount: staleNotDeferredCount,
    freshActionableCount: Math.max(0, totalPending - deferredCount - staleNotDeferredCount),
  };
}

/** Empty shape for the no-DB code path. */
export const EMPTY_QUEUE_HEALTH: QueueHealthSummary = {
  totalPending: 0,
  deferredCount: 0,
  staleCount: 0,
  freshActionableCount: 0,
};

// Re-export for convenience.
export type { EvidenceProposal };
