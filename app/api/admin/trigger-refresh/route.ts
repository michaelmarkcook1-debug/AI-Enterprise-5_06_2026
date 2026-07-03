// POST /api/admin/trigger-refresh — admin-session-gated endpoint that fires the
// daily-refresh pipeline. Decoupled from the CRON_SECRET path so the scheduled
// cron remains header-authenticated while the admin panel uses the session cookie.

import { after } from "next/server";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { runDailyRefresh, DuplicateRunError } from "@/lib/system/daily-refresh";
import { isRunActive } from "@/lib/system/daily-refresh-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The pipeline runs in after() AFTER the 202 response, but the function must
// stay alive for the WHOLE run — after() is bounded by maxDuration, not by the
// response. The full refresh takes ~8 min (good runs: 467–576s), so a 30s cap
// killed it mid-`sourcing` (step 3), leaving the pipeline-health row frozen at
// 2 steps / ok=false. Match the cron route's generous budget so the admin
// "Run daily refresh now" button can actually complete a run. (2026-07-03 fix.)
export const maxDuration = 800;

export async function POST(request: Request): Promise<Response> {
  if (!isAdminRequest(request)) return unauthorized();

  const active = await isRunActive();
  if (active) {
    return Response.json(
      { error: "already_running", message: "A refresh is already in progress. Check /admin/pipeline-health for status." },
      { status: 409 },
    );
  }

  after(async () => {
    try {
      await runDailyRefresh(new Date());
    } catch (e) {
      if (!(e instanceof DuplicateRunError)) console.error("[trigger-refresh]", e);
    }
  });

  return Response.json({
    ok: true,
    message: "Daily refresh started. Check /admin/pipeline-health for live status.",
  });
}
