// GET /api/auth/callback?token=… — consume a magic link, start a session, redirect.

import { NextResponse } from "next/server";
import {
  consumeMagicLink,
  createSessionToken,
  MEMBER_COOKIE,
  MEMBER_SESSION_MAX_AGE_S,
  memberCookieOptions,
} from "@/lib/member/auth";
import { rateLimit } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;

  const rl = rateLimit(`auth-callback:${anonSessionHash(request)}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.redirect(`${origin}/signin?error=rate`, 303);

  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await consumeMagicLink(token);
  if (!result.ok || !result.subscriberId) {
    return NextResponse.redirect(`${origin}/signin?error=expired`, 303);
  }

  const sessionToken = await createSessionToken(result.subscriberId);
  if (!sessionToken) return NextResponse.redirect(`${origin}/signin?error=server`, 303);

  const res = NextResponse.redirect(`${origin}/watchlist`, 303);
  res.cookies.set(MEMBER_COOKIE, sessionToken, memberCookieOptions(MEMBER_SESSION_MAX_AGE_S));
  return res;
}
