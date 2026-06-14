import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { runSourcing } from "@/lib/sourcing/runner";

export const runtime = "nodejs";

const Body = z.object({
  vendorId: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  persist: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }
  try {
    const result = await runSourcing(parsed.data);
    return Response.json(result);
  } catch (err) {
    console.error("[admin/sourcing/run] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
