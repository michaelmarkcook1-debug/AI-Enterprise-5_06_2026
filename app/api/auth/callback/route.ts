// GET /api/auth/callback?token=… — consume a magic link, start a session, redirect.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  consumeMagicLink,
  createSessionToken,
  MEMBER_COOKIE,
  MEMBER_SESSION_MAX_AGE_S,
  memberCookieOptions,
  SIGNIN_NONCE_COOKIE,
} from "@/lib/member/auth";
import { rateLimit } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { trustedOrigin } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  // Redirect targets use a TRUSTED origin, never the client Host header.
  const origin = trustedOrigin();

  const rl = rateLimit(`auth-callback:${anonSessionHash(request)}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.redirect(`${origin}/signin?error=rate`, 303);

  const token = new URL(request.url).searchParams.get("token") ?? "";
  // Requester-binding nonce from the httpOnly cookie set at request time. The
  // token only completes a sign-in in the browser that requested it.
  const jar = await cookies();
  const nonce = jar.get(SIGNIN_NONCE_COOKIE)?.value;

  const result = await consumeMagicLink(token, nonce);
  if (!result.ok || !result.subscriberId) {
    return NextResponse.redirect(`${origin}/signin?error=expired`, 303);
  }

  const sessionToken = await createSessionToken(result.subscriberId);
  if (!sessionToken) return NextResponse.redirect(`${origin}/signin?error=server`, 303);

  const res = NextResponse.redirect(`${origin}/watchlist`, 303);
  res.cookies.set(MEMBER_COOKIE, sessionToken, memberCookieOptions(MEMBER_SESSION_MAX_AGE_S));
  // Clear the one-time nonce — it has done its job.
  res.cookies.set(SIGNIN_NONCE_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
