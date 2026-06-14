// Ranking snapshot history for a single vendor.
// Returns all VendorRankingSnapshot rows ordered by date ascending,
// used by the Query page hover-card sparkline.

import { getPrisma, hasDatabase } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<unknown> }) {
  const id = getId(await ctx.params);
  if (!id) return Response.json({ error: "invalid_vendor_id" }, { status: 400 });

  if (!hasDatabase()) {
    return Response.json({ snapshots: [] });
  }

  try {
    const snapshots = await getPrisma().vendorRankingSnapshot.findMany({
      where: { vendorId: id },
      orderBy: { snapshotDate: "asc" },
      select: {
        snapshotDate: true,
        overallScore: true,
        momentumScore: true,
        confidenceScore: true,
        rank: true,
        trackedVendors: true,
      },
    });

    return Response.json({
      vendorId: id,
      snapshots: snapshots.map((s) => ({
        date: s.snapshotDate.toISOString().slice(0, 10),
        overallScore: s.overallScore,
        momentumScore: s.momentumScore,
        confidenceScore: s.confidenceScore,
        rank: s.rank,
        trackedVendors: s.trackedVendors,
      })),
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

function getId(params: unknown): string | null {
  return typeof params === "object" && params !== null && "id" in params && typeof params.id === "string"
    ? params.id
    : null;
}
