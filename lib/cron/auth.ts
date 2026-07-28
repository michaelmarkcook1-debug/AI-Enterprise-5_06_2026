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

/**
 * Auth for requests that SPEND MONEY — deliberately stricter than
 * isCronOrAdminRequest, and the only gate that ignores ADMIN_OPEN.
 *
 * Why a second function: ADMIN_OPEN is hardcoded `true` (owner instruction
 * 2026-07-10, so it cannot silently revert) and short-circuits
 * isCronOrAdminRequest before any token is checked. That is fine for reading
 * admin pages. It is not fine for `/api/cron/daily-refresh`, where the same
 * bypass means ANY anonymous GET runs the full pipeline — a spend endpoint open
 * to the internet, bounded only by the $25/day cap. A crawler following the URL
 * would bill it.
 *
 * So the real trigger requires a real secret: Vercel's CRON_SECRET, or the
 * admin token the back-office button sends. Reads (`?status=1`) keep using the
 * permissive gate, so the admin UI still shows progress without a token.
 */
export function isSpendAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) return true;

  const adminToken = process.env.ADMIN_API_TOKEN ?? "";
  if (!adminToken) return false; // no token configured ⇒ nothing may spend
  return safeEqual(request.headers.get("x-admin-token") ?? "", adminToken);
}

export function spendUnauthorized() {
  return Response.json(
    {
      error: "unauthorized",
      hint: "This action spends money and needs a real secret: Authorization: Bearer $CRON_SECRET (Vercel Cron sets this) or x-admin-token. ADMIN_OPEN does not grant it.",
    },
    { status: 401 },
  );
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
