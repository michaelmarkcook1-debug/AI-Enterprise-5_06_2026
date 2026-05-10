import { listIntelligenceVendors } from "@/lib/intelligence/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const vendors = await listIntelligenceVendors();
  return Response.json({ vendors });
}
