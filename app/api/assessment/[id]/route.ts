import { getPersistedAssessmentResult } from "@/lib/services/assessment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<unknown> }) {
  const id = getId(await ctx.params);
  if (!id) {
    return Response.json({ error: "invalid_assessment_id" }, { status: 400 });
  }

  const result = await getPersistedAssessmentResult(id);

  if (!result) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json(result);
}

function getId(params: unknown): string | null {
  return typeof params === "object" && params !== null && "id" in params && typeof params.id === "string"
    ? params.id
    : null;
}
