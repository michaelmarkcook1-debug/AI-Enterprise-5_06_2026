// POST /api/admin/routine-inbox-pull — manual trigger for the GitHub inbox pull.
// ─────────────────────────────────────────────────────────────────────────────
// Ad-hoc/test path for lib/ingest/github-inbox.ts (also run automatically as a
// daily-refresh step). Admin/cron-token gated, same as every other admin route.

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { pullRoutineInbox } from "@/lib/ingest/github-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();
  const result = await pullRoutineInbox();
  return Response.json(result, { status: result.error ? 502 : 200 });
}

export async function GET(request: Request): Promise<Response> {
  return POST(request);
}
