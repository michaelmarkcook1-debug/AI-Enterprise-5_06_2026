// Board Pack Export API — Pack 04.
// ─────────────────────────────────
// POST /api/exports/board-pack
// Accepts a BoardPackPayload and returns rendered Markdown.
// Future: add format=pdf|pptx query param.

import { renderBoardPackMarkdown, type BoardPackPayload } from "@/lib/exports/board-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as BoardPackPayload;

    if (!payload.title || !payload.recommendation) {
      return Response.json({ error: "title and recommendation are required" }, { status: 400 });
    }

    const markdown = renderBoardPackMarkdown(payload);

    return new Response(markdown, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="board-pack-${Date.now()}.md"`,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 },
    );
  }
}
