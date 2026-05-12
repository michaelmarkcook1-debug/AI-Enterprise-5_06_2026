// Example EIA usage — exposes the retail-sales fetch via an admin-gated
// route. Read-only; useful for verifying the connector locally:
//   curl -H "x-admin-token: $T" "$BASE/api/data-sources/eia/retail-sales?length=5"

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { getRetailSalesData, getRetailSalesMetadata } from "@/lib/services/eia-retail-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "data";
  try {
    if (mode === "metadata") {
      const result = await getRetailSalesMetadata();
      return Response.json({
        mode: "metadata",
        ok: result.ok,
        status: result.status,
        error: result.error,
        records: result.records,
      });
    }
    const result = await getRetailSalesData({
      frequency: (url.searchParams.get("frequency") as "monthly" | "annual" | null) ?? undefined,
      stateId: url.searchParams.get("stateId") ?? undefined,
      sectorId: url.searchParams.get("sectorId") ?? undefined,
      start: url.searchParams.get("start") ?? undefined,
      end: url.searchParams.get("end") ?? undefined,
      length: url.searchParams.get("length") ? Number(url.searchParams.get("length")) : undefined,
    });
    return Response.json({
      mode: "data",
      ok: result.fetch.ok,
      status: result.fetch.status,
      error: result.fetch.error,
      recordCount: result.fetch.recordCount,
      evidence: result.evidence,
      points: result.points,
    });
  } catch (err) {
    console.error("[api/data-sources/eia/retail-sales] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
