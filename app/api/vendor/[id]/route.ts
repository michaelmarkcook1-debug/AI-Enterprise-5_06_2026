import { getVendorProfile } from "@/lib/repositories/vendor-profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<unknown> }) {
  const id = getId(await ctx.params);
  if (!id) {
    return Response.json({ error: "invalid_vendor_id" }, { status: 400 });
  }

  const vendor = await getVendorProfile(id);
  if (!vendor) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(vendor);
}

function getId(params: unknown): string | null {
  return typeof params === "object" && params !== null && "id" in params && typeof params.id === "string"
    ? params.id
    : null;
}
