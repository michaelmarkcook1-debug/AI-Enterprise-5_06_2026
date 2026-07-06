// GET /api/interrogate/finding/[sessionId] — fetch a completed finding + the
// exact evidence it was grounded in (so every claim is auditable to its basis).
// Read-only, no LLM, no spend guard needed.

import { getFinding, getSessionCost } from "@/lib/interrogation/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSessionId(params: unknown): string | null {
  return typeof params === "object" && params !== null && "sessionId" in params && typeof params.sessionId === "string"
    ? params.sessionId
    : null;
}

export async function GET(_request: Request, ctx: { params: Promise<unknown> }): Promise<Response> {
  const sessionId = getSessionId(await ctx.params);
  if (!sessionId) return Response.json({ error: "invalid_session" }, { status: 400 });

  try {
    const finding = await getFinding(sessionId);
    if (!finding) return Response.json({ error: "not_found" }, { status: 404 });
    // Per-session inference cost — the Phase-2 per-customer attribution, exposed
    // read-only (an admin/reporting view later; harmless to surface now).
    const costUsd = await getSessionCost(sessionId);
    return Response.json({
      markdown: finding.markdown,
      citedSourceUrls: finding.citedSourceUrls,
      evidenceRefs: finding.evidenceRefs,
      costUsd,
    });
  } catch (err) {
    return Response.json({ error: "read_error", message: (err as Error)?.message ?? String(err) }, { status: 500 });
  }
}
