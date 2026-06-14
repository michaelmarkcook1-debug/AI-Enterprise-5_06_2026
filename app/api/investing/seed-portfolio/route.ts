import { getSeedPortfolio, simulatePortfolio } from "@/lib/investing/simulator";

export const dynamic = "force-dynamic";

export async function GET() {
  const portfolio = getSeedPortfolio();
  return Response.json({ portfolio, result: simulatePortfolio(portfolio), dataStatus: "seed" });
}
