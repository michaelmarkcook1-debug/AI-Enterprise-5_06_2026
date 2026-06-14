import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { runIngestion } from "@/lib/ingestion/ingest-service";
import { touchRefreshTimestamp } from "@/lib/system/daily-refresh-store";

export const runtime = "nodejs";

const Body = z.object({
  vendorId: z.string().min(1),
  sourceId: z.string().optional(),
  inlineContent: z.object({
    url: z.string().url(),
    rawText: z.string().min(1),
    sourceCategory: z.enum([
      "vendor_docs", "trust_center", "pricing_page", "status_page", "changelog",
      "public_filing", "job_posting", "review_platform", "marketplace",
      "github", "analyst_report", "press_release",
    ]),
  }).optional(),
});

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }
  try {
    const result = await runIngestion(parsed.data);
    await touchRefreshTimestamp("admin_ingestion", {
      vendorId: parsed.data.vendorId,
      sourceId: parsed.data.sourceId ?? null,
    });
    return Response.json(result);
  } catch (err) {
    console.error("[admin/ingestion/run] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
