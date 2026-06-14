import { getIpoForecastRow, ipoForecastWarning } from "@/lib/investing/intelligence";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ providerSlug: string }> }) {
  const { providerSlug } = await ctx.params;
  const row = getIpoForecastRow(providerSlug);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({
    ipoForecast: row,
    warning: ipoForecastWarning(),
    dataStatus: row.forecast.dataStatus,
  });
}
