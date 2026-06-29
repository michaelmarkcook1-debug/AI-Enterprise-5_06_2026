// Lightweight admin auth gate. Replace with real SSO/role check in prod.
// Accepts: ADMIN_API_OPEN=1 (dev) | x-admin-token header | ae_admin session cookie.

import { safeEqual } from "./safe-equal";
import { adminCookieValue, ADMIN_COOKIE, getAdminToken } from "./admin-page-auth";

export function isAdminRequest(request: Request): boolean {
  if (process.env.ADMIN_API_OPEN === "1") return true;
  const expected = getAdminToken();
  if (!expected) return false;
  // Token header (automation / CLI)
  const headerToken = request.headers.get("x-admin-token") ?? "";
  if (safeEqual(headerToken, expected)) return true;
  // Session cookie — same gate as the admin page layout, so browser
  // sessions from /admin/* work without a manual token field.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  const cookieVal = match?.[1] ?? "";
  return safeEqual(cookieVal, adminCookieValue(expected));
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
