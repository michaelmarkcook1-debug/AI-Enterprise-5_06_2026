// Backfill ranking snapshots for all vendors.
// ────────────────────────────────────────────
// Reconstructs historical score data from VendorMomentum + IntelligenceVendor
// for dates before the live capture pipeline started. Safe to re-run —
// existing snapshots are untouched; only gaps are filled.
//
// POST /api/admin/backfill-snapshots   (requires admin token)

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { backfillRankingSnapshots, captureRankingSnapshots } from "@/lib/intelligence/ranking-snapshots";
import { getPrisma, hasDatabase } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();

  if (!hasDatabase()) {
    return Response.json({ ok: false, error: "DATABASE_URL not configured" }, { status: 503 });
  }

  try {
    // Capture today's snapshot first so there's always a current data point.
    const today = new Date();
    const capture = await captureRankingSnapshots(today);

    // Backfill only if the table had no prior history.
    const existing = await getPrisma().vendorRankingSnapshot.count();
    let backfill: { inserted: number; vendors: number; ran: boolean } = { inserted: 0, vendors: 0, ran: false };
    if (existing <= capture.captured) {
      // Only today's snapshots exist — run the full backfill.
      const r = await backfillRankingSnapshots(today);
      backfill = { inserted: r.inserted, vendors: r.vendors, ran: true };
    }

    return Response.json({
      ok: true,
      todayCaptured: capture.captured,
      backfill,
      totalSnapshots: await getPrisma().vendorRankingSnapshot.count(),
    });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
