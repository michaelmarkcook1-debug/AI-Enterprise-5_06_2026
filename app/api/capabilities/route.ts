import { listCapabilities, listVendorCapabilities } from "@/lib/intelligence/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [capabilities, vendorCapabilities] = await Promise.all([
    listCapabilities(),
    listVendorCapabilities(),
  ]);

  return Response.json({ capabilities, vendorCapabilities });
}
