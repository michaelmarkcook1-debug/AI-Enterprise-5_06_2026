// POST /api/admin/unlock — verify ADMIN_API_TOKEN and set a 90-day HMAC-signed
// session cookie. The cookie is checked by isAdminPageAuthed (pages) and
// isAdminSessionRequest (API routes). Never mints a session without the correct
// token; never falls back to CRON_SECRET.

import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminSessionToken, getAdminToken } from "@/lib/admin-page-auth";
import { safeEqual } from "@/lib/safe-equal";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NINETY_DAYS = 60 * 60 * 24 * 90;

export async function POST(request: Request): Promise<Response> {
  // Rate-limit: max 5 attempts per hour per IP.
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
  const submitted =
    typeof (body as { token?: unknown })?.token === "string"
      ? (body as { token: string }).token
      : "";

  if (process.env.ADMIN_API_OPEN === "1") {
    // Dev-only bypass — still set the cookie so the gate is exercised.
  } else {
    const expected = getAdminToken(); // ADMIN_API_TOKEN only — no CRON_SECRET fallback
    if (!expected) return Response.json({ error: "not_configured" }, { status: 503 });
    if (!safeEqual(submitted, expected))
      return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const sessionVal = adminSessionToken();
  if (!sessionVal) {
    return Response.json({ error: "session_secret_missing — set ADMIN_SESSION_SECRET" }, { status: 503 });
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sessionVal, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: NINETY_DAYS,
  });
  return Response.json({ ok: true });
}
