// Admin-only endpoint to recompute the IntelligenceVendor read-tables
// from verified EvidenceRecord rows. Same projector the safe-actions cron
// uses, exposed so an operator can fire it on demand from the UI.

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { hasDatabase, getPrisma } from "@/lib/prisma";
import { projectEvidenceToIntelligence } from "@/lib/services/intelligence-projector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: Request) {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();
  if (!hasDatabase()) {
    return Response.json({ skipped: "no_database" }, { status: 200 });
  }
  try {
    const result = await projectEvidenceToIntelligence(getPrisma());
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
