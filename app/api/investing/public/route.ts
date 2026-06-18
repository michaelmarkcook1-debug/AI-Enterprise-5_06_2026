import { INVESTING_WARNING, listFinancialMetrics, listInvestmentProviderScores, listPublicInvestmentProviders, listValuationMetricsLive } from "@/lib/investing/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const providers = listPublicInvestmentProviders();
  const providerIds = new Set(providers.map((provider) => provider.id));
  const scores = listInvestmentProviderScores().filter((row) => providerIds.has(row.provider.id));
  const valuationMetrics = await listValuationMetricsLive();
  return Response.json({
    count: providers.length,
    providers,
    scores,
    financialMetrics: listFinancialMetrics(),
    valuationMetrics,
    warning: INVESTING_WARNING,
    dataStatus: "seed",
  });
}
