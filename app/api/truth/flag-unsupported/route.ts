export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return Response.json({
    flag: {
      entityType: body?.entityType ?? "unknown",
      entityId: body?.entityId ?? "unknown",
      claim: body?.claim ?? "Unknown claim",
      dataStatus: "unsupported",
      blockingStatus: "blocked",
      message: "Unsupported claim flagged. Do not render this claim as verified fact.",
    },
  }, { status: 202 });
}
