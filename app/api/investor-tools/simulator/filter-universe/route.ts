import { eligibleUniverseFor } from "@/lib/investing/simulator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const input = body?.input ?? body ?? {};
  return Response.json({
    eligibleUniverse: eligibleUniverseFor(input),
    dataStatus: "seed",
  });
}
