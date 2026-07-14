// Capture today's evidence-composite score-history snapshot on demand.
// ────────────────────────────────────────────────────────────────────
// The daily refresh captures this nightly; this lets us seed today's REAL
// baseline immediately (and kick the span-guarded reconstruction) so the ranking
// hover trend charts have their first tracked point now. Safe to re-run —
// idempotent on (vendor, category, date).
//
// POST /api/admin/capture-score-history   (admin/cron auth)

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { hasDatabase } from "@/lib/prisma";
import { getCategoryComposites } from "@/lib/ranking/category-composite";
import { captureScoreHistory, reconstructScoreHistory } from "@/lib/ranking/score-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();
  if (!hasDatabase()) return Response.json({ ok: false, error: "DATABASE_URL not configured" }, { status: 503 });

  const now = new Date();
  const composites = await getCategoryComposites();
  const cap = await captureScoreHistory(composites, now);

  // Span-guarded reconstruction for every ranked vendor (emits points only where
  // evidence genuinely spans time — clustered imports yield nothing).
  let reconstructed = 0;
  for (const c of composites) {
    for (const v of c.ranked) {
      if (v.rank == null) continue;
      reconstructed += await reconstructScoreHistory(v.vendorId, c.category.id, now);
    }
  }

  return Response.json({ ok: true, ...cap, reconstructed });
}
