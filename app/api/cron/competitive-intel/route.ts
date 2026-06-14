// Competitive-intelligence cron.
// ──────────────────────────────
// Runs the AI-vendor news monitor (13 frontier-model + AI-platform companies,
// six event dimensions, 14-day lookback) and upserts findings into
// IntelligenceNewsItem so they surface on /news and the dashboard.
//
// Idempotent: each finding is keyed by sha1(vendorId|url|publishedAt) so
// re-running for the same window updates rather than duplicating.

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { runCompetitiveIntelMonitor } from "@/lib/intelligence/competitive-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();

  const startedAt = new Date().toISOString();
  try {
    const result = await runCompetitiveIntelMonitor();
    return Response.json({
      ok: result.errors.length === 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      result,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: (err as Error).message,
    }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
