import { getInvestmentDashboard } from "@/lib/investing/intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    dashboard: getInvestmentDashboard(),
    dataStatus: "seed",
  });
}
