import { z } from "zod";
import { createWatchlist, listWatchlists } from "@/lib/intelligence/repository";
import type { Watchlist } from "@/lib/intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1).max(120),
  vendors: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  alertRules: z.object({
    riskThreshold: z.number().min(0).max(100).optional(),
    momentumChangePct: z.number().optional(),
    categories: z.array(z.string()).optional(),
  }).default({}),
});

export async function GET() {
  return Response.json({ watchlists: await listWatchlists() });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }

  // Zod widens the alertRules.categories union; we narrow at the boundary.
  const watchlist = await createWatchlist(parsed.data as Omit<Watchlist, "id" | "createdAt">);
  return Response.json({ watchlist }, { status: 201 });
}
