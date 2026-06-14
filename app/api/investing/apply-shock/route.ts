import { applyRiskShock, getSeedPortfolio } from "@/lib/investing/simulator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const input = body?.input ?? {};
  const shock = body?.shock ?? {};
  return Response.json({ portfolio: getSeedPortfolio(input), result: applyRiskShock(input, shock), dataStatus: "seed" });
}
