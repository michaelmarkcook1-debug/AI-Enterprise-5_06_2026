import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { approveProposal, rejectProposal } from "@/lib/services/proposal-service";

export const runtime = "nodejs";

const Body = z.object({
  action: z.enum(["approve", "reject"]),
  reviewerId: z.string().min(1),
  reviewNotes: z.string().max(2000).optional(),
  finalGrade: z.enum(["E0", "E1", "E2", "E3", "E4", "E5"]).optional(),
  finalRawScore: z.number().min(0).max(100).optional(),
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
        finalGrade: parsed.data.finalGrade,
        finalRawScore: parsed.data.finalRawScore,
      });
      return Response.json(result);
    } else {
      const result = await rejectProposal({
        proposalId: id,
        reviewerId: parsed.data.reviewerId,
        reviewNotes: parsed.data.reviewNotes,
      });
      return Response.json(result);
    }
  } catch (err) {
    console.error("[admin/proposals/:id] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
