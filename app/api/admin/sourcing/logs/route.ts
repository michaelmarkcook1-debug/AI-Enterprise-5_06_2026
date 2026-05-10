import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { tailEvents } from "@/lib/sourcing/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const runId = url.searchParams.get("runId") ?? undefined;
  const vendorId = url.searchParams.get("vendorId") ?? undefined;
  const limit = limitParam ? Math.min(500, Math.max(1, Number(limitParam))) : 100;
  const events = tailEvents(limit, { runId, vendorId });
  return Response.json({ count: events.length, events });
}
