import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { runSourcing } from "@/lib/sourcing/runner";
import { runNewsSourcing } from "@/lib/sourcing/news-runner";

export const runtime = "nodejs";
// A standard sourcing pass or news discovery can each take 1-4 min.
export const maxDuration = 300;

const Body = z.object({
  vendorId: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  persist: z.boolean().optional(),
  // Manual per-vendor debug: run the press-release news pipeline instead of
  // standard evidence sourcing. (The scheduled side runs BOTH inside the single
  // daily-refresh pipeline; this endpoint is just the admin "run one vendor now".)
  news: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }
  try {
    if (parsed.data.news) {
      if (!parsed.data.vendorId) {
        return Response.json({ error: "vendorId required for news sourcing" }, { status: 422 });
      }
      const result = await runNewsSourcing(parsed.data.vendorId);
      return Response.json(result);
    }
    const result = await runSourcing(parsed.data);
    return Response.json(result);
  } catch (err) {
    console.error("[admin/sourcing/run] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
