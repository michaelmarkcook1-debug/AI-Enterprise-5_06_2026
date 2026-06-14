import { listClaims, listTruthRecords } from "@/lib/truthfulness/registry";
import { renderClaim } from "@/lib/truthfulness/render-claim";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const claim = listClaims().find((item) => item.id === id);
  if (!claim) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({
    claim,
    renderedClaim: renderClaim(claim),
    truthRecord: listTruthRecords().find((record) => record.id === `truth_${id}`) ?? null,
  });
}
