import { listProductScopes } from "@/lib/investor-tools/product-scope";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    productScope: listProductScopes(),
    dataStatus: "seed",
    warning: "Product scope entries are seed inventory and require source refresh before verified use.",
  });
}
