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

import { after } from "next/server";
import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { runDailyRefresh, DuplicateRunError } from "@/lib/system/daily-refresh";
import { getLastRefreshRun, isRunActive } from "@/lib/system/daily-refresh-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

async function handle(request: Request): Promise<Response> {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();

  const url = new URL(request.url);

  // ── Status poll (no side effects) ──────────────────────────────────────
  // The admin "Run full ingestion" button polls this to render live step
  // progress while the run executes in the background. Returns the latest
  // persisted run (progressive-persistence row) + whether one is active.
  if (url.searchParams.get("status") === "1") {
    const [run, active] = await Promise.all([getLastRefreshRun(), isRunActive()]);
    return Response.json({ run, active });
  }

  // `?full=1` forces every step (full competitive set + analyst + IPO)
  // regardless of weekday — used by the admin "Run full ingestion" button.
  // Scheduled cron invocations omit it and follow the weekly cadence.
  const force = url.searchParams.get("full") === "1";

  // ── Admin full run → BACKGROUND (fire-and-forget) ──────────────────────
  // The full universe (43-vendor competitive intel + analyst coverage + IPO
  // web-search work) runs for many minutes — longer than a single request can
  // stay open, which is why the synchronous version returned HTTP 504. Kick it
  // off with after() (runs post-response, up to this route's 600s maxDuration)
  // and return 202 immediately; the client polls ?status=1. Progressive
  // persistence makes progress durable, and the pre-check guards against a
  // double-spend from a double-click. (Scheduled cron keeps running
  // synchronously below — its core cadence fits within the limit.)
  if (force) {
    if (await isRunActive()) {
      return Response.json(
        { ok: false, started: false, skipped: "duplicate_run", error: "A pipeline run is already in progress." },
        { status: 409 },
      );
    }
    after(async () => {
      try {
        await runDailyRefresh(new Date(), { force: true });
      } catch (err) {
        console.error("[cron/daily-refresh] background full run failed:", err);
      }
    });
    return Response.json({ ok: true, started: true }, { status: 202 });
  }

  // ── Scheduled cron path (non-full) — synchronous, unchanged ────────────
  try {
    const report = await runDailyRefresh(new Date(), { force });
    return Response.json(report, {
      status: report.ok ? 200 : 207,
    });
  } catch (err) {
    if (err instanceof DuplicateRunError) {
      // 409 Conflict — a pipeline is already running. Vercel cron treats
      // non-2xx as a failure to retry, but 409 is a clear signal that this
      // is intentional: do NOT retry automatically.
      console.warn("[cron/daily-refresh] duplicate run blocked:", err.message);
      return Response.json({ ok: false, skipped: "duplicate_run", error: err.message }, { status: 409 });
    }
    return Response.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
