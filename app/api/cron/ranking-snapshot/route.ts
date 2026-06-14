// Ranking-snapshot cron.
// ──────────────────────
// Captures one daily point-in-time snapshot of every vendor's ranking
// metrics (overall score, momentum, confidence, rank) into the
// vendor_ranking_snapshots table. This is what gives the dashboard
// "Who's winning / losing" trend graphs real tracked history over time.
//
// On the first run against an empty table it also backfills
// reconstructed history so the graphs have depth from day one; once
// real snapshots accumulate they progressively replace the backfill.
//
// Idempotent: re-running for the same day updates that day's rows
// rather than duplicating them.

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { hasDatabase, getPrisma } from "@/lib/prisma";
import { captureRankingSnapshots, backfillRankingSnapshots } from "@/lib/intelligence/ranking-snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: Request): Promise<Response> {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();

  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  if (!hasDatabase()) {
    return Response.json({
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      skipped: true,
      reason: "no DATABASE_URL — snapshot history is unavailable; dashboard uses reconstruction",
    });
  }

  // Backfill first, but only when the table is empty — otherwise the
  // daily capture is all that's needed.
  let backfill = { inserted: 0, vendors: 0, ran: false };
  try {
    const existing = await getPrisma().vendorRankingSnapshot.count();
    if (existing === 0) {
      const r = await backfillRankingSnapshots();
      backfill = { inserted: r.inserted, vendors: r.vendors, ran: true };
    }
  } catch (err) {
    errors.push(`backfill: ${(err as Error).message}`);
  }

  let capture = { captured: 0, snapshotDate: "" };
  try {
    const r = await captureRankingSnapshots();
    capture = { captured: r.captured, snapshotDate: r.snapshotDate };
  } catch (err) {
    errors.push(`capture: ${(err as Error).message}`);
  }

  return Response.json({
    ok: errors.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    backfill,
    capture,
    errors,
  });
}

export const GET = handle;
export const POST = handle;
