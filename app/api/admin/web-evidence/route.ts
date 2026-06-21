// Roster-driven web_search evidence sourcing — admin trigger.
// ───────────────────────────────────────────────────────────
// POST { vendorId }            → run for ONE vendor (smoke test; recommended first).
// POST { gaps: true, limit? }  → source ONLY vendors with limited/no evidence
//                                (depth < threshold) — the ones showing the
//                                "seed / limited evidence" alerts. Targeted +
//                                cost-controlled; this is how you fill the gaps.
// POST { all: true }           → sweep the whole live roster (the weekly cron
//                                does this automatically).
//
// Discovers real, cited sources via web_search and writes pending evidence
// proposals; the existing triage → projection path promotes E2+ to pillars.

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { hasDatabase } from "@/lib/prisma";
import { listIntelligenceVendors, getEvidenceDepthByVendor } from "@/lib/intelligence/repository";
import { runWebEvidenceSourcing, runWebEvidenceSweep } from "@/lib/sourcing/web-evidence-runner";

// A vendor is "verified" at >=10 analyst_verified rows (matches evidenceDepthBand).
const VERIFIED_THRESHOLD = 10;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  if (!isAdminRequest(request)) return unauthorized();
  if (!hasDatabase()) return Response.json({ ok: false, error: "DATABASE_URL not configured" }, { status: 503 });

  let body: { vendorId?: string; all?: boolean; gaps?: boolean; limit?: number } = {};
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

    if (body.gaps === true) {
      // Source ONLY the vendors with limited/no verified evidence — the ones
      // carrying the "seed / limited evidence" alerts. Optional `limit` caps how
      // many are sourced in one call (least-evidence first) to control cost.
      const [vendors, depthByVendor] = await Promise.all([
        listIntelligenceVendors(),
        getEvidenceDepthByVendor(),
      ]);
      let gapVendors = vendors
        .map((v) => ({ id: v.id, name: v.name, depth: depthByVendor.get(v.id) ?? 0 }))
        .filter((v) => v.depth < VERIFIED_THRESHOLD)
        .sort((a, b) => a.depth - b.depth);
      const totalGaps = gapVendors.length;
      if (typeof body.limit === "number" && body.limit > 0) gapVendors = gapVendors.slice(0, body.limit);
      const sweep = await runWebEvidenceSweep(gapVendors.map((v) => ({ id: v.id, name: v.name })));
      return Response.json({ ok: true, mode: "gaps", threshold: VERIFIED_THRESHOLD, totalGaps, sourced: gapVendors.length, ...sweep });
    }

    if (body.all === true) {
      const vendors = (await listIntelligenceVendors()).map((v) => ({ id: v.id, name: v.name }));
      const sweep = await runWebEvidenceSweep(vendors);
      return Response.json({ ok: true, mode: "sweep", ...sweep });
    }

    return Response.json(
      { ok: false, error: "Specify { vendorId } (one vendor), { gaps: true, limit? } (limited/no-evidence vendors only), or { all: true } (full sweep)." },
      { status: 400 },
    );
  } catch (err) {
    console.error("[admin/web-evidence] failed", err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
