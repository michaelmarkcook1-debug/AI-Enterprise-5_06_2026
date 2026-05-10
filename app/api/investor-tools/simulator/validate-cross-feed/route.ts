import { createSimulationState } from "@/lib/investing/simulator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const state = createSimulationState(body?.input ?? body ?? {});
  const validation = {
    isValid: state.errors.length === 0,
    stateHash: state.stateHash,
    dependentOutputs: state.chartData.map((chart) => chart.chartId),
    errors: state.errors,
  };

  return Response.json({ validation, state, dataStatus: "seed" }, { status: validation.isValid ? 200 : 422 });
}
