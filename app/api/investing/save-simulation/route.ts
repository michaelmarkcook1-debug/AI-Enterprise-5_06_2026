import { saveInvestmentSimulation } from "@/lib/investing/simulation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const saved = saveInvestmentSimulation(body?.input ?? {}, body?.shock ?? {});
  return Response.json(saved, { status: 201 });
}
