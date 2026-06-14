import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { SOURCE_MANIFEST, manifestSummary } from "@/lib/sourcing/manifest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  return Response.json({
    summary: manifestSummary(),
    entries: SOURCE_MANIFEST,
  });
}
