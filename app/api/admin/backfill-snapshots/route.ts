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

    // Backfill reconstructed pre-history for any vendor that LACKS it — not just
    // when the whole table is empty. Vendors added after the original table-wide
    // backfill never got reconstructed history, leaving their hover-trend lines
    // flat and stubby. Target exactly those. Idempotent: skipDuplicates protects
    // existing backfill rows and real captures.
    const prisma = getPrisma();
    const [haveBackfillRows, allVendors] = await Promise.all([
      prisma.vendorRankingSnapshot.findMany({
        where: { source: "backfill" },
        select: { vendorId: true },
        distinct: ["vendorId"],
      }),
      prisma.intelligenceVendor.findMany({ select: { id: true } }),
    ]);
    const haveBackfill = new Set(haveBackfillRows.map((r) => r.vendorId));
    const needBackfill = allVendors.map((v) => v.id).filter((id) => !haveBackfill.has(id));

    let backfill: { inserted: number; vendors: number; ran: boolean } = { inserted: 0, vendors: 0, ran: false };
    if (needBackfill.length > 0) {
      const r = await backfillRankingSnapshots(today, { vendorIds: needBackfill });
      backfill = { inserted: r.inserted, vendors: r.vendors, ran: true };
    }

    return Response.json({
      ok: true,
      todayCaptured: capture.captured,
      vendorsNeedingBackfill: needBackfill.length,
      backfill,
      totalSnapshots: await prisma.vendorRankingSnapshot.count(),
    });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
