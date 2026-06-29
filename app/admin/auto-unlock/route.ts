// Auto-unlock admin session. Visited by the admin layout when no cookie is
// present. Sets the ae_admin cookie derived from CRON_SECRET (or
// ADMIN_API_TOKEN if set), then redirects back. No form, no manual token.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminCookieValue, ADMIN_COOKIE, getAdminToken } from "@/lib/admin-page-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = getAdminToken();
  if (!token) {
    // No secret configured at all — can't unlock. Send to home.
    return NextResponse.redirect(new URL("/", new URL(request.url).origin));
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminCookieValue(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return") ?? "/admin";
  return NextResponse.redirect(new URL(returnTo, url.origin));
}
