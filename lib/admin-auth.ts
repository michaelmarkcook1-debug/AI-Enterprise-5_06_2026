// API-route admin auth gate.
// Accepts: ADMIN_API_OPEN=1 (dev only) | ae_admin session cookie | x-admin-token header.
// The session cookie is HMAC-signed (ADMIN_SESSION_SECRET) — see lib/admin-page-auth.ts.

import { safeEqual } from "./safe-equal";
import { isAdminSessionRequest, getAdminToken } from "./admin-page-auth";

export function isAdminRequest(request: Request): boolean {
  if (process.env.ADMIN_API_OPEN === "1") return true;
  // Valid session cookie (browser → admin panel)
  if (isAdminSessionRequest(request)) return true;
  // x-admin-token header (automation / CLI)
  const expected = getAdminToken();
  if (!expected) return false;
  const headerToken = request.headers.get("x-admin-token") ?? "";
  return safeEqual(headerToken, expected);
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
