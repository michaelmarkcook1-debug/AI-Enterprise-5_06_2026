// POST /api/data-sources/reingest
// ────────────────────────────────
// One-time reingest / connectivity probe across ALL data-source connectors.
// Admin-gated (it triggers real external fetches that can consume quota).
// Returns honest per-connector results: ok / not_configured / error /
// rate_limited / skipped. Never fakes a successful status.
//
// Body (optional): { onlyUnconfigured?: boolean } — when true, only reports the
// not-configured connectors without spending any quota.

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { reingestAllConnectors } from "@/lib/connectors/reingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  let onlyUnconfigured = false;
  try {
    const body = await request.json();
    onlyUnconfigured = Boolean(body?.onlyUnconfigured);
  } catch {
    /* no body — reingest all */
  }

  try {
    const result = await reingestAllConnectors({ onlyUnconfigured });
    // NB: result already has an `ok` field (count of healthy connectors) — return
    // it directly rather than spreading under a boolean `ok` (which would collide).
    return Response.json(result);
  } catch (err) {
    console.error("[api/data-sources/reingest] failed", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
