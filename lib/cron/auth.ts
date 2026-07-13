// Cron-route auth — header-only, never the human admin session cookie.
// Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to
// scheduled invocations. x-admin-token is accepted for CLI/manual calls.
// The human ae_admin cookie is intentionally NOT accepted here — use
// /api/admin/trigger-refresh (session-gated) to fire the pipeline from a browser.

import { safeEqual } from "@/lib/safe-equal";
import { ADMIN_OPEN } from "@/lib/availability";

export function isCronOrAdminRequest(request: Request): boolean {
  // 0. Owner TEST-OPEN (ADMIN_OPEN) — no token required from anywhere. Hardcoded
  //    so it can't silently revert like the ADMIN_API_OPEN env var did. The cron
  //    secret / token paths below still work when ADMIN_OPEN is flipped back off.
  if (ADMIN_OPEN) return true;
  // 1. Vercel Cron — `Authorization: Bearer <CRON_SECRET>`
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth === `Bearer ${cronSecret}`) return true;
  }
  // 2. Local dev convenience
  if (process.env.ADMIN_API_OPEN === "1") return true;
  // 3. x-admin-token header (CLI / service-to-service)
  const adminToken = process.env.ADMIN_API_TOKEN ?? "";
  if (!adminToken) return false;
  const headerToken = request.headers.get("x-admin-token") ?? "";
  return safeEqual(headerToken, adminToken);
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
