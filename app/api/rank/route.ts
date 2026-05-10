import { z } from "zod";
import { rankIntelligenceVendors } from "@/lib/intelligence/repository";
import type { RankInput } from "@/lib/intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  industry: z.string().optional(),
  useCase: z.string().optional(),
  categoryId: z.string().optional(),
  riskTolerance: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  vendorIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }

  // Zod returns plain string unions for industry / categoryId; we narrow to the
  // intelligence-layer enum types at the boundary. The repository defensively
  // matches on substring so the runtime is safe even if a wider value sneaks in.
  const ranking = await rankIntelligenceVendors(parsed.data as RankInput);
  return Response.json({
    ranking,
    confidenceNote: "Estimated market and fit ranking. Market strength does not override enterprise control, security, permissioning, or governance risks.",
  });
}
