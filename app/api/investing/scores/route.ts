import { INVESTING_WARNING, listInvestmentProviderScores } from "@/lib/investing/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ scores: listInvestmentProviderScores(), warning: INVESTING_WARNING, dataStatus: "seed" });
}
