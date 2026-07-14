// Evidence-composite score history for a single vendor within a category.
// Powers the ranking hover trend chart. Real snapshots only (never synthetic):
// an empty list means "no tracked history yet" and the chart shows an honest
// "tracking since …" baseline rather than a fabricated line.

import { getScoreHistory } from "@/lib/ranking/score-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<unknown> }) {
  const id = getId(await ctx.params);
  if (!id) return Response.json({ error: "invalid_vendor_id" }, { status: 400 });

  const categoryId = new URL(request.url).searchParams.get("category");
  if (!categoryId) return Response.json({ error: "missing_category" }, { status: 400 });

  const points = await getScoreHistory(id, categoryId);
  return Response.json({
    vendorId: id,
    categoryId,
    points, // oldest → newest; [] when nothing tracked yet
    trackingSince: points[0]?.date ?? null,
    hasReconstructed: points.some((p) => p.source === "reconstructed"),
  });
}

function getId(params: unknown): string | null {
  return typeof params === "object" && params !== null && "id" in params && typeof (params as { id: unknown }).id === "string"
    ? (params as { id: string }).id
    : null;
}
