import { listVendorEvidence } from "@/lib/repositories/vendor-profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<unknown> }) {
  const id = getId(await ctx.params);
  if (!id) {
    return Response.json({ error: "invalid_vendor_id" }, { status: 400 });
  }

  const evidence = await listVendorEvidence(id);

  return Response.json({ vendorId: id, evidence });
}

function getId(params: unknown): string | null {
  return typeof params === "object" && params !== null && "id" in params && typeof params.id === "string"
    ? params.id
    : null;
}
