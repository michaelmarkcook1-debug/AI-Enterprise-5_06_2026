// Roster-driven web_search evidence sourcing — admin trigger.
// ───────────────────────────────────────────────────────────
// POST { vendorId }      → run for ONE vendor (smoke test; recommended first).
// POST { all: true }     → sweep the whole live roster (may be long; the weekly
//                          cron does this automatically — use for an on-demand run).
//
// Discovers real, cited sources via web_search and writes pending evidence
// proposals; the existing triage → projection path promotes E2+ to pillars.

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { hasDatabase } from "@/lib/prisma";
import { listIntelligenceVendors } from "@/lib/intelligence/repository";
import { runWebEvidenceSourcing, runWebEvidenceSweep } from "@/lib/sourcing/web-evidence-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  if (!isAdminRequest(request)) return unauthorized();
  if (!hasDatabase()) return Response.json({ ok: false, error: "DATABASE_URL not configured" }, { status: 503 });

  let body: { vendorId?: string; all?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }

  try {
    if (body.vendorId) {
      const vendors = await listIntelligenceVendors();
      const v = vendors.find((x) => x.id === body.vendorId || x.slug === body.vendorId);
      if (!v) return Response.json({ ok: false, error: `vendor not found: ${body.vendorId}` }, { status: 404 });
      const result = await runWebEvidenceSourcing(v.id, v.name);
      return Response.json({ ok: true, mode: "single", result });
    }

    if (body.all === true) {
      const vendors = (await listIntelligenceVendors()).map((v) => ({ id: v.id, name: v.name }));
      const sweep = await runWebEvidenceSweep(vendors);
      return Response.json({ ok: true, mode: "sweep", ...sweep });
    }

    return Response.json(
      { ok: false, error: "Specify { vendorId } for a single vendor or { all: true } for a full sweep." },
      { status: 400 },
    );
  } catch (err) {
    console.error("[admin/web-evidence] failed", err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
