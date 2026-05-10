import { calculateScatterDomain } from "@/lib/investing/simulator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const points = Array.isArray(body?.points) ? body.points : [];
  return Response.json({
    xDomain: calculateScatterDomain(points, "x", body?.options ?? {}),
    yDomain: calculateScatterDomain(points, "y", body?.options ?? {}),
    dataStatus: "seed",
  });
}
