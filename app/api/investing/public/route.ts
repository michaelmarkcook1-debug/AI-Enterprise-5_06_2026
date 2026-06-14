import { INVESTING_WARNING, listFinancialMetrics, listInvestmentProviderScores, listPublicInvestmentProviders, listValuationMetrics } from "@/lib/investing/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const providers = listPublicInvestmentProviders();
  const providerIds = new Set(providers.map((provider) => provider.id));
  const scores = listInvestmentProviderScores().filter((row) => providerIds.has(row.provider.id));
  return Response.json({
    count: providers.length,
    providers,
    scores,
    financialMetrics: listFinancialMetrics(),
    valuationMetrics: listValuationMetrics(),
    warning: INVESTING_WARNING,
    dataStatus: "seed",
  });
}
