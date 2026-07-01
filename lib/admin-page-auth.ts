// Admin session auth — cookie gate for /admin/* pages and /api/admin/* routes.
// Session token is HMAC-SHA256 signed with ADMIN_SESSION_SECRET (never CRON_SECRET).
// Rotating ADMIN_SESSION_SECRET instantly invalidates all existing sessions.

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "ae_admin";
const SESSION_LABEL = "ae:admin:session:v2";

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

/** The admin unlock password — ADMIN_API_TOKEN only; no CRON_SECRET fallback. */
export function getAdminToken(): string {
  return process.env.ADMIN_API_TOKEN ?? "";
}

/** HMAC-SHA256 session token derived from ADMIN_SESSION_SECRET.
 *  Stateless — validity is proven by re-computing the HMAC on each request.
 *  Returns "" when ADMIN_SESSION_SECRET is not configured. */
export function adminSessionToken(): string {
  const secret = getSessionSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(SESSION_LABEL).digest("hex");
}

/** Timing-safe comparison of two hex strings. */
function hexEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length === 0 || ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/** True when the current request carries a valid admin session cookie (Server Component). */
export async function isAdminPageAuthed(): Promise<boolean> {
  if (process.env.ADMIN_API_OPEN === "1") return true;
  const expected = adminSessionToken();
  if (!expected) return false;
  const jar = await cookies();
  const got = jar.get(ADMIN_COOKIE)?.value ?? "";
  return hexEqual(got, expected);
}

/** True when the Request carries a valid admin session cookie (Route Handler). */
export function isAdminSessionRequest(request: Request): boolean {
  if (process.env.ADMIN_API_OPEN === "1") return true;
  const expected = adminSessionToken();
  if (!expected) return false;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  const got = match?.[1] ?? "";
  return hexEqual(got, expected);
}
