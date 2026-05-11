// Admin-gated POST to apply safe linkages. Dry-run by default.
// Always returns the plan summary, even on the live path.

import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { runSafeLinkageApply } from "@/lib/services/safe-linkage-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  dryRun: z.boolean().optional().default(true),
  vendorId: z.string().optional(),
  limit: z.number().int().positive().max(20000).optional(),
  decidedBy: z.string().min(1).optional(),
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
    const r = await runSafeLinkageApply(parsed.data);
    return Response.json({
      ok: true,
      dryRun: r.dryRun,
      eligible: r.plan.eligible.length,
      skipped: r.plan.skipped.length,
      skippedByStatus: r.plan.skippedByStatus,
      appliedCount: r.appliedCount,
      auditWritten: r.auditWritten,
      errors: r.errors,
      sample: r.plan.eligible.slice(0, 25),
    });
  } catch (err) {
    console.error("[admin/evidence/apply-linkages] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const r = await runSafeLinkageApply({ dryRun: true });
    return Response.json({
      ok: true,
      dryRun: true,
      eligible: r.plan.eligible.length,
      skipped: r.plan.skipped.length,
      skippedByStatus: r.plan.skippedByStatus,
    });
  } catch (err) {
    console.error("[admin/evidence/apply-linkages] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
