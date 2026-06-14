// Cron-route auth.
// Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to
// scheduled invocations. We accept that OR the existing admin-token
// header so the same endpoints are still callable manually for testing.

export function isCronOrAdminRequest(request: Request): boolean {
  // 1. Vercel Cron — `Authorization: Bearer <CRON_SECRET>`
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth === `Bearer ${cronSecret}`) return true;
  }
  // 2. Local dev / manual trigger — same as the rest of /api/admin/*
  if (process.env.ADMIN_API_OPEN === "1") return true;
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return false;
  const got = request.headers.get("x-admin-token");
  return got === expected;
}

export function cronUnauthorized() {
  return Response.json(
    {
      error: "unauthorized",
      hint: "Pass Authorization: Bearer $CRON_SECRET (Vercel Cron auto-sets this) or x-admin-token header.",
    },
    { status: 401 },
  );
}
