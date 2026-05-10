import { getSeedPortfolio, simulatePortfolio } from "@/lib/investing/simulator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const portfolio = getSeedPortfolio(body?.input ?? body ?? {});
  return Response.json({ portfolio, result: simulatePortfolio(portfolio), dataStatus: "seed" });
}
