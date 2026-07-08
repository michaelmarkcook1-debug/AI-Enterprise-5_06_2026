// Admin-gated promotion for EvidenceRecord rows that were inserted directly
// (analyst curation, not the EvidenceProposal auto-extraction queue — that
// queue is promoted separately via batch-action/[id]). This is the missing
// "curated → analyst_verified" gate for those directly-curated rows: before
// this route, no code path could ever flip that flag, so curated evidence
// was permanently invisible to scoring.
//
// Strictly curated → analyst_verified. Rows already analyst_verified,
// rejected, or agent_extracted are left untouched and reported as skipped —
// this route never re-decides a status some other path already set.

import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { hasDatabase, getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  reviewerId: z.string().min(1),
  reviewNotes: z.string().max(2000).optional(),
});

export async function POST(request: Request): Promise<Response> {
  if (!isAdminRequest(request)) return unauthorized();
  if (!hasDatabase()) return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 });

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }
  const { ids, reviewerId, reviewNotes } = parsed.data;

  try {
    const prisma = getPrisma();
    const rows = await prisma.evidenceRecord.findMany({
      where: { id: { in: ids } },
      select: { id: true, reviewStatus: true },
    });
    const foundIds = new Set(rows.map((r) => r.id));
    const notFound = ids.filter((id) => !foundIds.has(id));
    const eligible = rows.filter((r) => r.reviewStatus === "curated").map((r) => r.id);
    const skipped = rows
      .filter((r) => r.reviewStatus !== "curated")
      .map((r) => ({ id: r.id, reason: `already ${r.reviewStatus}` }));

    let promotedCount = 0;
    if (eligible.length > 0) {
      const result = await prisma.evidenceRecord.updateMany({
        where: { id: { in: eligible }, reviewStatus: "curated" },
        data: { reviewStatus: "analyst_verified" },
      });
      promotedCount = result.count;
    }

    console.info(
      `[admin/evidence/promote] reviewer=${reviewerId} promoted=${promotedCount}/${ids.length}` +
        (reviewNotes ? ` notes="${reviewNotes}"` : ""),
    );

    return Response.json({
      promoted: eligible,
      promotedCount,
      skipped,
      notFound,
    });
  } catch (err) {
    console.error("[admin/evidence/promote] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
