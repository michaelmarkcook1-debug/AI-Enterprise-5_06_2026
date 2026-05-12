// Admin-gated batch-action endpoint for the recommend_approve cohort.
// Supports: approve · reject · defer.
// Approve/reject delegate to the existing proposal-service helpers
// (so /admin/evidence and /admin/evidence/batch stay consistent).
// Defer writes the DEFERRED sentinel and leaves status=pending.

import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { approveProposal, rejectProposal, deferProposal } from "@/lib/services/proposal-service";

export const runtime = "nodejs";

const Body = z.object({
  action: z.enum(["approve", "reject", "defer"]),
  reviewerId: z.string().min(1),
  reviewNotes: z.string().max(2000).optional(),
  reason: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await ctx.params;
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    if (parsed.data.action === "approve") {
      const result = await approveProposal({
        proposalId: id,
        reviewerId: parsed.data.reviewerId,
        reviewNotes: parsed.data.reviewNotes,
      });
      return Response.json({ action: "approve", ...result });
    }
    if (parsed.data.action === "reject") {
      const result = await rejectProposal({
        proposalId: id,
        reviewerId: parsed.data.reviewerId,
        reviewNotes: parsed.data.reviewNotes,
      });
      return Response.json({ action: "reject", ...result });
    }
    const result = await deferProposal({
      proposalId: id,
      reviewerId: parsed.data.reviewerId,
      reason: parsed.data.reason ?? parsed.data.reviewNotes,
    });
    return Response.json({ action: "defer", ...result });
  } catch (err) {
    console.error("[admin/evidence/batch-action/:id] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
