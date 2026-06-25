// POST /api/admin/unlock — exchange the admin token for an httpOnly session
// cookie that gates admin PAGES (app/admin/layout.tsx). The /api/admin/* routes
// remain independently gated by their x-admin-token header.

import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminCookieValue } from "@/lib/admin-page-auth";
import { safeEqual } from "@/lib/safe-equal";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EIGHT_HOURS = 60 * 60 * 8;

export async function POST(request: Request): Promise<Response> {
  // Rate-limit by IP: max 5 unlock attempts per hour to slow brute-force.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`admin-unlock:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return Response.json(
      { error: "too_many_requests" },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const token = typeof (body as { token?: unknown })?.token === "string" ? (body as { token: string }).token : "";

  const open = process.env.ADMIN_API_OPEN === "1";
  const expected = process.env.ADMIN_API_TOKEN;

  if (!open) {
    if (!expected) return Response.json({ error: "not_configured" }, { status: 503 });
    if (!safeEqual(token, expected)) return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Store the HASH of the token, not the raw secret — cookie leak doesn't expose the key.
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminCookieValue(expected ?? "open"), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: EIGHT_HOURS,
  });
  return Response.json({ ok: true });
}
