import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { listProposals } from "@/lib/services/proposal-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const vendorId = url.searchParams.get("vendorId") ?? undefined;
  const status = statusParam && ["pending", "approved", "rejected", "superseded"].includes(statusParam)
    ? (statusParam as "pending" | "approved" | "rejected" | "superseded")
    : undefined;
  const proposals = await listProposals({ status, vendorId });
  return Response.json({ proposals });
}
