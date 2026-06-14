// Admin-gated, read-only product linkage assist endpoint.
// GET  → aggregate report
// GET ?batch=20&offset=0 → batch slice with full per-row detail

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { buildLinkageReport } from "@/lib/services/product-linkage-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const url = new URL(request.url);
  const vendorId = url.searchParams.get("vendor") ?? undefined;
  const batch = Number(url.searchParams.get("batch") ?? "0");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  try {
    const report = await buildLinkageReport({ vendorId });
    if (batch > 0) {
      return Response.json({
        ok: true,
        total: report.rows.length,
        batch,
        offset,
        rows: report.rows.slice(offset, offset + batch),
      });
    }
    return Response.json({
      ok: true,
      totalRecommendApprove: report.totalRecommendApprove,
      blockedOnLinkage: report.blockedOnLinkage,
      byVendor: report.byVendor,
      byDomainSubfactor: report.byDomainSubfactor.slice(0, 50),
      bySourceUrl: report.bySourceUrl.slice(0, 50),
      byLinkageStatus: report.byLinkageStatus,
    });
  } catch (err) {
    console.error("[admin/evidence/linkage] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
