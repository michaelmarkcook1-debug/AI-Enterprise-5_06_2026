import { INVESTING_WARNING, listInvestmentProviderScores } from "@/lib/investing/intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  const scores = listInvestmentProviderScores();
  return Response.json({
    providers: scores.map((row) => row.provider),
    scores,
    warning: INVESTING_WARNING,
    dataStatus: "seed",
  });
}
