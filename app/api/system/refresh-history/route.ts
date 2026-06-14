// Returns the last N daily-refresh runs from the persistent log,
// including per-step JSON summaries and errors. Used by the admin
// surface that needs to audit "what happened on day X".
//
// Default limit: 30 (≈ one month). Cap: 200.

import { listRefreshRuns } from "@/lib/system/daily-refresh-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitParam) ? limitParam : 30;
  const runs = await listRefreshRuns(limit);
  return Response.json({ runs });
}
