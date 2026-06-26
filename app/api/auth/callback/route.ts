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
import { toggleTrack, safeReturnTo } from "@/lib/member/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  // Redirect targets use a TRUSTED origin, never the client Host header.
  const origin = trustedOrigin();

  const rl = rateLimit(`auth-callback:${anonSessionHash(request)}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.redirect(`${origin}/signin?error=rate`, 303);

  const token = new URL(request.url).searchParams.get("token") ?? "";
  // The httpOnly cookie carries the requester-binding nonce AND the sign-in intent
  // (a thing to track + where to return). The token only completes a sign-in in
  // the browser that requested it.
  const jar = await cookies();
  const rawCookie = jar.get(SIGNIN_NONCE_COOKIE)?.value;
  let nonce: string | undefined;
  let intendedTrack: string | null = null;
  let returnTo: string | null = null;
  if (rawCookie) {
    try {
      const parsed = JSON.parse(rawCookie) as { n?: unknown; t?: unknown; r?: unknown };
      nonce = typeof parsed.n === "string" ? parsed.n : undefined;
      intendedTrack = typeof parsed.t === "string" ? parsed.t : null;
      returnTo = typeof parsed.r === "string" ? parsed.r : null;
    } catch {
      nonce = rawCookie; // legacy plain-nonce cookie
    }
  }

  const result = await consumeMagicLink(token, nonce);
  if (!result.ok || !result.subscriberId) {
    return NextResponse.redirect(`${origin}/signin?error=expired`, 303);
  }

  const sessionToken = await createSessionToken(result.subscriberId);
  if (!sessionToken) return NextResponse.redirect(`${origin}/signin?error=server`, 303);

  // Apply the intended track (if any), then land back where the user started.
  let dest = safeReturnTo(returnTo);
  if (intendedTrack) {
    const added = await toggleTrack(result.subscriberId, intendedTrack, "add").catch(() => null);
    if (added) {
      dest += `${dest.includes("?") ? "&" : "?"}tracked=${encodeURIComponent(intendedTrack)}`;
    }
  }

  const res = NextResponse.redirect(`${origin}${dest}`, 303);
  res.cookies.set(MEMBER_COOKIE, sessionToken, memberCookieOptions(MEMBER_SESSION_MAX_AGE_S));
  // Clear the one-time nonce/intent cookie — it has done its job.
  res.cookies.set(SIGNIN_NONCE_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
