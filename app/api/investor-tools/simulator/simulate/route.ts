import { createSimulationState } from "@/lib/investing/simulator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const state = createSimulationState(body?.input ?? body ?? {});
  return Response.json({ state, dataStatus: "seed" }, { status: state.errors.length ? 400 : 200 });
}
