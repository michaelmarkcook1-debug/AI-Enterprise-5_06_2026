import { AssessmentInputSchema } from "@/lib/schema";
import { scoreAndPersistAssessment } from "@/lib/services/assessment-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = AssessmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }
  try {
    const result = await scoreAndPersistAssessment(parsed.data);
    return Response.json(result);
  } catch (err) {
    console.error("[assessment/score] engine failure", err);
    return Response.json({ error: "engine_failure" }, { status: 500 });
  }
}
