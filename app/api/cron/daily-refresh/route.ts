// Daily-refresh cron.
// ──────────────────
// Runs the full data-refresh pipeline once a day (sourcing → safe
// linkage → triage → projection → ranking snapshot → competitive
// intel) so every page in the app reads from fresh data on the next
// request. See lib/system/daily-refresh.ts for the orchestrator.
//
// Schedule: 03:00 UTC (vercel.json). Manual trigger:
//   curl -H "x-admin-token: $ADMIN_API_TOKEN" \
//     https://ranking-engine-red.vercel.app/api/cron/daily-refresh
//
// The four individual cron routes (sourcing-rolling, safe-actions,
// ranking-snapshot, competitive-intel) remain available for ad-hoc
// runs but are no longer scheduled — the master route handles the
// daily cadence with consolidated logging.

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { runDailyRefresh } from "@/lib/system/daily-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

async function handle(request: Request): Promise<Response> {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();

  try {
    const report = await runDailyRefresh();
    return Response.json(report, {
      status: report.ok ? 200 : 207,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
