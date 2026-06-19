import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import {
  approveCategoryChangeProposal,
  rejectCategoryChangeProposal,
} from "@/lib/services/category-change";

export const runtime = "nodejs";

const Body = z.object({
  action: z.enum(["approve", "reject"]),
  reviewerId: z.string().min(1),
  reviewNotes: z.string().max(2000).optional(),
});

// PATCH /api/admin/category-changes/:id — approve (applies roleTags/category to
// the vendor) or reject a category-change proposal. Human-in-the-loop only.
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await ctx.params;
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }
  try {
    const result =
      parsed.data.action === "approve"
        ? await approveCategoryChangeProposal({
            proposalId: id,
            reviewerId: parsed.data.reviewerId,
            reviewNotes: parsed.data.reviewNotes,
          })
        : await rejectCategoryChangeProposal({
            proposalId: id,
            reviewerId: parsed.data.reviewerId,
            reviewNotes: parsed.data.reviewNotes,
          });
    return Response.json(result);
  } catch (err) {
    console.error("[admin/category-changes/:id] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
