// API-route admin auth gate.
// OWNER INSTRUCTION (2026-07-10): removed the admin token gateway for backoffice — every
// /api/admin/* route is open, no session/token required. isAdminSessionRequest already
// unconditionally returns true (see lib/admin-page-auth.ts); this wrapper is kept as the
// single call site every route imports, so re-gating later touches one function, not 31
// call sites. The token/safeEqual fallback below is dead but left in place for the same
// "one-line revert" reason.

import { safeEqual } from "./safe-equal";
import { isAdminSessionRequest, getAdminToken } from "./admin-page-auth";

export function isAdminRequest(request: Request): boolean {
  if (isAdminSessionRequest(request)) return true;
  // Unreachable while isAdminSessionRequest always returns true (kept for re-gating).
  const expected = getAdminToken();
  if (!expected) return false;
  const headerToken = request.headers.get("x-admin-token") ?? "";
  return safeEqual(headerToken, expected);
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
