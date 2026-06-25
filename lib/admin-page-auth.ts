// Admin PAGE auth gate (cookie-based, server-only).
// ──────────────────────────────────────────────────
// The /api/admin/* ROUTES are gated by isAdminRequest (x-admin-token header).
// Browser page navigations can't send that header, so admin PAGES were
// previously ungated. This closes that gap: app/admin/layout.tsx requires a
// signed-in cookie (set by /api/admin/unlock after the operator enters the
// ADMIN_API_TOKEN). Safe default: with no token configured, admin is LOCKED.

import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { safeEqual } from "./safe-equal";

export const ADMIN_COOKIE = "ae_admin";

/** One-way derived cookie value — the raw ADMIN_API_TOKEN is never stored in
 * the cookie, so a cookie leak (logs, XSS on a sibling app) doesn't expose the
 * secret. Stateless (no session store) so it works across serverless instances. */
export function adminCookieValue(token: string): string {
  return createHash("sha256").update(`ae-admin:v1:${token}`).digest("hex");
}

/** True when the current request may view admin pages. */
export async function isAdminPageAuthed(): Promise<boolean> {
  // Dev convenience — mirrors isAdminRequest. Never set in production.
  if (process.env.ADMIN_API_OPEN === "1") return true;
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return false; // no token configured → locked (safe default)
  const jar = await cookies();
  const got = jar.get(ADMIN_COOKIE)?.value ?? "";
  return safeEqual(got, adminCookieValue(expected));
}
