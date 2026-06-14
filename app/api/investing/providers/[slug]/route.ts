import {
  INVESTING_WARNING,
  calculateAiProviderQualityScore,
  calculateConsumerInvestmentPotential,
  calculateHypePenalty,
  calculateInvestmentAttractivenessScore,
  calculatePrivateIpoInvestmentPotential,
  calculateRetailAccessPenalty,
  doNotRankReason,
  getInvestmentProvider,
  listFinancialMetrics,
  listIndirectExposureScores,
  listValuationMetrics,
} from "@/lib/investing/intelligence";
import { IPO_PROFILES } from "@/lib/investing/seed";
import { productScopesForVendor } from "@/lib/investor-tools/product-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const provider = getInvestmentProvider(slug);
  if (!provider) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({
    provider,
    scores: {
      aiProviderQuality: calculateAiProviderQualityScore(provider),
      investmentAttractiveness: calculateInvestmentAttractivenessScore(provider),
      consumerInvestmentPotential: calculateConsumerInvestmentPotential(provider),
      privateIpoInvestmentPotential: calculatePrivateIpoInvestmentPotential(provider),
      retailAccessPenalty: calculateRetailAccessPenalty(provider),
      hypePenalty: calculateHypePenalty(provider),
    },
    financialMetrics: listFinancialMetrics().filter((metric) => metric.providerId === provider.id),
    valuationMetric: listValuationMetrics().find((metric) => metric.providerId === provider.id) ?? null,
    ipoProfile: IPO_PROFILES.find((profile) => profile.providerId === provider.id) ?? null,
    indirectExposures: listIndirectExposureScores().filter((edge) => edge.privateProviderId === provider.id || edge.publicTicker === provider.ticker),
    productScopes: productScopesForVendor(provider.id),
    doNotRankReason: doNotRankReason(provider),
    warning: INVESTING_WARNING,
    dataStatus: "seed",
  });
}
