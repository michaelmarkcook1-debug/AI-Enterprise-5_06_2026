import { listClaims, listTruthRecords } from "@/lib/truthfulness/registry";
import { renderClaim } from "@/lib/truthfulness/render-claim";

export const dynamic = "force-dynamic";

export async function GET() {
  const claims = listClaims();
  return Response.json({
    claims,
    renderedClaims: claims.map((claim) => renderClaim(claim)),
    truthRecords: listTruthRecords(),
    dataStatus: "seed",
  });
}
