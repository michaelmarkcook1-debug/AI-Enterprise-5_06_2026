// Admin/debug status route: counts of pending proposals grouped by
// classifier failure cause. Truthful diagnostic output — surfaces the
// real reason why the queue isn't auto-approving without changing any
// public UI.

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { getClassifierFailureCounts } from "@/lib/services/triage-runner";
import { hasDatabase } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  if (!hasDatabase()) {
    return Response.json({ ok: true, hasDatabase: false, totals: [] });
  }
  try {
    const totals = await getClassifierFailureCounts();
    return Response.json({
      ok: true,
      hasDatabase: true,
      totals,
      grandTotal: totals.reduce((s, t) => s + t.count, 0),
    });
  } catch (err) {
    console.error("[admin/evidence/failures] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
