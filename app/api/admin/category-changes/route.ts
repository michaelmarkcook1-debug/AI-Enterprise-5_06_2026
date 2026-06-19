import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { listCategoryChangeProposals } from "@/lib/services/category-change";

export const runtime = "nodejs";

// GET /api/admin/category-changes?status=pending — list vendor category/role
// change proposals for admin review.
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const status = new URL(request.url).searchParams.get("status") ?? undefined;
  try {
    const proposals = await listCategoryChangeProposals(status);
    return Response.json({ proposals });
  } catch (err) {
    console.error("[admin/category-changes] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
