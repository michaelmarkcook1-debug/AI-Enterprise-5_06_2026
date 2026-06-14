import { createSimulationState, generateRandomShock } from "@/lib/investing/simulator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const input = body?.input ?? {};
  const shock = generateRandomShock(
    input.horizonYears ?? 5,
    input.investmentUniverse ?? "public_and_indirect",
    input.riskProfile ?? "balanced",
    body?.seed ?? "ai-enterprise-shock",
  );
  return Response.json({
    shock,
    state: createSimulationState(input, undefined, shock),
    dataStatus: "seed",
  });
}
