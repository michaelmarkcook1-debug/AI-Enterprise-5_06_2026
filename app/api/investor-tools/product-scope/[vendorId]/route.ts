import { productScopesForVendor } from "@/lib/investor-tools/product-scope";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await ctx.params;
  return Response.json({
    vendorId,
    productScope: productScopesForVendor(vendorId),
    dataStatus: "seed",
    warning: "Product scope entries are seed inventory and require source refresh before verified use.",
  });
}
