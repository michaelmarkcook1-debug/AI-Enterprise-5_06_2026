import { validateSimulationAllocation } from "@/lib/investing/simulator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const allocationValidation = validateSimulationAllocation(body?.input ?? body ?? {});
  return Response.json({ allocationValidation, dataStatus: "seed" }, { status: allocationValidation.isValid ? 200 : 400 });
}
