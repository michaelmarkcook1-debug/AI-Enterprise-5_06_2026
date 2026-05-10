import {
  calculateAiProviderQualityScore,
  calculateConsumerInvestmentPotential,
  calculateHypePenalty,
  calculateInvestmentAttractivenessScore,
  calculatePrivateIpoInvestmentPotential,
  calculateRetailAccessPenalty,
  getInvestmentProvider,
  listInvestmentProviderScores,
} from "@/lib/investing/intelligence";
import type { InvestmentProviderProfile } from "@/lib/investing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const providerId = typeof body?.providerId === "string" ? body.providerId : null;

  if (!providerId) {
    return Response.json({ scores: listInvestmentProviderScores(), dataStatus: "seed" });
  }

  const provider = getInvestmentProvider(providerId);
  if (!provider) return Response.json({ error: "not_found" }, { status: 404 });

  const overrides = typeof body?.overrides === "object" && body.overrides !== null ? body.overrides : {};
  const adjusted = { ...provider, ...overrides } as InvestmentProviderProfile;

  return Response.json({
    provider: adjusted,
    score: {
      aiProviderQualityScore: calculateAiProviderQualityScore(adjusted),
      investmentAttractivenessScore: calculateInvestmentAttractivenessScore(adjusted),
      consumerInvestmentPotential: calculateConsumerInvestmentPotential(adjusted),
      privateIpoInvestmentPotential: calculatePrivateIpoInvestmentPotential(adjusted),
      retailAccessPenalty: calculateRetailAccessPenalty(adjusted),
      hypePenalty: calculateHypePenalty(adjusted),
    },
    dataStatus: "seed",
  });
}
