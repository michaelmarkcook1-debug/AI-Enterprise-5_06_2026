import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { runTriage } from "@/lib/services/triage-runner";

export const runtime = "nodejs";
// Triage runs read-only by default; the live path may write to the DB so
// don't cache.
export const dynamic = "force-dynamic";

const Body = z.object({
  // Dry-run is the explicit default. Callers must opt into live mode.
  dryRun: z.boolean().optional().default(true),
  autoApproveConfidence: z.number().min(0).max(1).optional(),
  vendorId: z.string().optional(),
  limit: z.number().int().positive().max(2000).optional(),
  decidedBy: z.string().min(1).optional(),
  knownProductNames: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const report = await runTriage(parsed.data);
    return Response.json({
      ok: true,
      dryRun: report.dryRun,
      total: report.total,
      laneCounts: report.laneCounts,
      reasonCounts: report.reasonCounts,
      classifierFallbackCount: report.classifierFallbackCount,
      appliedCount: report.appliedCount,
      auditWritten: report.auditWritten,
      applicationErrors: report.applicationErrors,
      // Echo first 50 decisions so the admin UI can preview before going live.
      decisions: report.decisions.slice(0, 50).map((d) => ({
        proposalId: d.proposalId,
        lane: d.lane,
        confidence: d.confidence,
        unsafeCategory: d.unsafeCategory,
        reasons: d.reasons,
        sourceIds: d.sourceIds,
      })),
    });
  } catch (err) {
    console.error("[admin/evidence/triage] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // GET = dry-run preview, no body needed.
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const report = await runTriage({ dryRun: true });
    return Response.json({
      ok: true,
      dryRun: true,
      total: report.total,
      laneCounts: report.laneCounts,
    });
  } catch (err) {
    console.error("[admin/evidence/triage] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
