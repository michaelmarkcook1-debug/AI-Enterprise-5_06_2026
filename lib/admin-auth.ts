// Lightweight admin auth gate. Replace with real SSO/role check in prod.
// Accepts the `x-admin-token` header matching ADMIN_API_TOKEN, or
// allows all admin calls when ADMIN_API_OPEN=1 (dev convenience).

import { safeEqual } from "./safe-equal";

export function isAdminRequest(request: Request): boolean {
  if (process.env.ADMIN_API_OPEN === "1") return true;
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return false;
  const got = request.headers.get("x-admin-token") ?? "";
  return safeEqual(got, expected);
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
