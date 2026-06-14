import { eligibleUniverseFor } from "@/lib/investing/simulator";
import type { SimulationInput } from "@/lib/investing/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const investmentUniverse = (url.searchParams.get("investmentUniverse") ?? "public_and_indirect") as SimulationInput["investmentUniverse"];
  const riskProfile = (url.searchParams.get("riskProfile") ?? "balanced") as SimulationInput["riskProfile"];
  return Response.json({
    eligibleUniverse: eligibleUniverseFor({ investmentUniverse, riskProfile }),
    dataStatus: "seed",
  });
}
