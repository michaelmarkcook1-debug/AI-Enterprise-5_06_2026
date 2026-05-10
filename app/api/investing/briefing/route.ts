import { getInvestmentBriefing } from "@/lib/investing/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ briefing: getInvestmentBriefing(), dataStatus: "seed" });
}
