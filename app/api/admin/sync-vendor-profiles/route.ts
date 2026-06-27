// Ensure every IntelligenceVendor (spine) has a matching VendorProfile.
// ─────────────────────────────────────────────────────────────────────
// Closes the vendor-id coverage gap (spine had more vendors than
// vendor_profiles) so the EvidenceRecord FK + id resolution are consistent for
// EVERY vendor. Idempotent, additive, real identity only — no API cost.
//
// POST /api/admin/sync-vendor-profiles   (admin-gated)

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { getPrisma, hasDatabase } from "@/lib/prisma";
import { ensureVendorProfilesForSpine } from "@/lib/services/vendor-id-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isAdminRequest(request)) return unauthorized();
  if (!hasDatabase()) return Response.json({ ok: false, error: "DATABASE_URL not configured" }, { status: 503 });

  try {
    const result = await ensureVendorProfilesForSpine(getPrisma());
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/sync-vendor-profiles] failed", err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
