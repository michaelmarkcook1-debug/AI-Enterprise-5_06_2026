// Admin-gated vendorDocs verification route.
//   GET /api/data-sources/vendor-docs                       → list every manifest entry grouped by vendor
//   GET /api/data-sources/vendor-docs?vendorId=vendor_msft  → scope to one vendor
//
// This is the "what would we ingest?" preview. The actual fetch + LLM
// extract + DB persist happens via runSourcing() (npm run ingest or
// POST /api/admin/sourcing/run).

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { vendorDocsConnector } from "@/lib/connectors/vendorDocs";
import { normaliseFetchResult } from "@/lib/evidence/normalise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const url = new URL(request.url);
  const vendorId = url.searchParams.get("vendorId") ?? undefined;
  try {
    const result = await vendorDocsConnector.fetch({ vendorId });
    const evidence = result.ok ? normaliseFetchResult(vendorDocsConnector.health(), result) : null;
    return Response.json({
      ok: result.ok,
      status: result.status,
      error: result.error,
      recordCount: result.recordCount,
      evidence,
      // Cap each vendor's URL list at 30 to keep the response readable.
      vendors: result.records.map((r) => ({
        vendorId: r.vendorId,
        totalSources: r.totalSources,
        manifestUrls: r.manifestUrls.slice(0, 30),
      })),
    });
  } catch (err) {
    console.error("[api/data-sources/vendor-docs] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
