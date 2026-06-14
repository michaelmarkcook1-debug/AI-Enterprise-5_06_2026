import { renderBoardPackHtml } from "@/lib/export/board-pack";
import { getPersistedAssessmentResult } from "@/lib/services/assessment-service";
import { hasDatabase } from "@/lib/prisma";
import type { AssessmentResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const exportType: string = typeof body.exportType === "string" ? body.exportType : "html";

  let result: AssessmentResult | null = null;

  // 1) Caller may inline the result (covers no-DB demo flow + cached client state).
  if (body.result && typeof body.result === "object") {
    result = body.result as AssessmentResult;
  } else if (hasDatabase()) {
    const persisted = await getPersistedAssessmentResult(id);
    if (persisted) result = persisted as unknown as AssessmentResult;
  }

  if (!result) {
    return Response.json({ error: "result_not_found" }, { status: 404 });
  }

  if (exportType === "json") {
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="ranking-${id}.json"`,
      },
    });
  }

  const includeCompliance = exportType === "compliance" || body.includeCompliance === true;
  const html = renderBoardPackHtml(result, {
    includeCompliance,
    reportTitle: typeof body.title === "string" ? body.title : undefined,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `inline; filename="ranking-${id}.html"`,
    },
  });
}
