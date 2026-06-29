// Cron-route auth.
// Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to
// scheduled invocations. We accept that OR the admin session cookie so
// the admin panel can trigger cron endpoints without a manual token.

import { safeEqual } from "@/lib/safe-equal";
import { adminCookieValue, ADMIN_COOKIE, getAdminToken } from "@/lib/admin-page-auth";

export function isCronOrAdminRequest(request: Request): boolean {
  // 1. Vercel Cron — `Authorization: Bearer <CRON_SECRET>`
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth === `Bearer ${cronSecret}`) return true;
  }
  // 2. Local dev convenience
  if (process.env.ADMIN_API_OPEN === "1") return true;
  // 3. x-admin-token header (automation / CLI)
  const expected = getAdminToken();
  if (!expected) return false;
  const headerToken = request.headers.get("x-admin-token") ?? "";
  if (safeEqual(headerToken, expected)) return true;
  // 4. ae_admin session cookie — browser sessions from /admin/* work without a manual token
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  const cookieVal = match?.[1] ?? "";
  return safeEqual(cookieVal, adminCookieValue(expected));
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
