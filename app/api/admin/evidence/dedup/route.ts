// Admin-gated dedup runner. Defaults to report-only. exact_merge requires
// the caller to pass {"mode":"exact_merge"} explicitly; near-duplicates
// are always report-only regardless of mode.

import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { runDedup } from "@/lib/services/dedup-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  mode: z.enum(["report", "exact_merge"]).optional().default("report"),
  vendorId: z.string().optional(),
  limit: z.number().int().positive().max(20000).optional(),
  nearSimilarityThreshold: z.number().min(0).max(1).optional(),
  decidedBy: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const result = await runDedup({ mode: "report" });
    return Response.json({ ok: true, mode: result.mode, ...summarise(result) });
  } catch (err) {
    console.error("[admin/evidence/dedup] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }
  try {
    const result = await runDedup(parsed.data);
    return Response.json({ ok: true, mode: result.mode, ...summarise(result) });
  } catch (err) {
    console.error("[admin/evidence/dedup] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

function summarise(result: Awaited<ReturnType<typeof runDedup>>) {
  const r = result.report;
  return {
    totalInput: r.totalInput,
    exactClusterCount: r.exactClusterCount,
    exactDuplicateRows: r.exactDuplicateRows,
    nearClusterCount: r.nearClusterCount,
    nearDuplicateRows: r.nearDuplicateRows,
    safeAutoMergeRows: r.safeAutoMergeRows,
    humanReviewRows: r.humanReviewRows,
    mergeActions: result.mergeActions.slice(0, 100),
    mergedCount: result.mergedCount,
    // Top 25 of each cluster type so the admin UI can preview without
    // pulling thousands of rows.
    exactClustersPreview: r.exactClusters.slice(0, 25).map((c) => ({
      vendorId: c.vendorId,
      domain: c.domain,
      subfactor: c.subfactor,
      canonicalSourceUrl: c.canonicalSourceUrl,
      memberIds: c.members.map((m) => m.id),
    })),
    nearClustersPreview: r.nearClusters.slice(0, 25).map((c) => ({
      vendorId: c.vendorId,
      domain: c.domain,
      subfactor: c.subfactor,
      canonicalSourceUrl: c.canonicalSourceUrl,
      captureWeekStart: c.captureWeekStart,
      maxSimilarity: c.maxSimilarity,
      memberIds: c.members.map((m) => m.id),
    })),
  };
}
