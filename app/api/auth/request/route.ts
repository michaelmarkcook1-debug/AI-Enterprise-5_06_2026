// POST /api/auth/request — request a passwordless magic-link sign-in.
// Enumeration-safe (identical 202 regardless of whether the email exists),
// rate-limited per IP AND per email, explicit-consent gated.

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requestMagicLink, SIGNIN_NONCE_COOKIE, SIGNIN_NONCE_MAX_AGE_S } from "@/lib/member/auth";
import { parseTrackItem, safeReturnTo } from "@/lib/member/track";
import { sendEmail, emailConfigured } from "@/lib/email/mailer";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { SITE_NAME, trustedOrigin } from "@/lib/site";
import { MEMBER_AUTH_ENABLED } from "@/lib/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
}

function magicLinkHtml(url: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#15263c">
      <h2 style="margin:0 0 12px">Sign in to ${SITE_NAME}</h2>
      <p>Click below to sign in and open your watchlist. This link is single-use and expires in 15 minutes.</p>
      <p style="margin:24px 0">
        <a href="${url}" style="background:#15263c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Sign in</a>
      </p>
      <p style="font-size:12px;color:#4c5d75">Or paste this link: ${url}</p>
      <p style="font-size:12px;color:#4c5d75">If you didn't request this, you can safely ignore this email.</p>
    </div>`;
}

export async function POST(request: Request): Promise<Response> {
  // Sign-in disabled (MEMBER_AUTH_ENABLED) → no new magic links can be minted.
  if (!MEMBER_AUTH_ENABLED) return Response.json({ error: "signin_disabled" }, { status: 404 });

  // Rate-limit per anon session (IP-derived) first.
  const ipRl = rateLimit(`auth-request:${anonSessionHash(request)}`, { limit: 5, windowMs: HOUR });
  if (!ipRl.allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(ipRl) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { email?: unknown; consent?: unknown; track?: unknown; returnTo?: unknown };
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const consent = b.consent === true;
  if (!isValidEmail(email)) return Response.json({ error: "invalid_email" }, { status: 422 });
  if (!consent) return Response.json({ error: "consent_required" }, { status: 422 });

  // Also rate-limit per email so one address can't be flooded with links.
  const emailRl = rateLimit(`auth-request-email:${email.toLowerCase()}`, { limit: 5, windowMs: HOUR });
  if (!emailRl.allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(emailRl) });
  }

  // Per-request browser nonce — bound to the token, held in an httpOnly cookie,
  // so the link can only complete a sign-in in THIS browser (login-CSRF defence).
  const nonce = randomBytes(32).toString("hex");
  const result = await requestMagicLink(email, "signin", nonce);
  if (result.outcome === "sent" && result.rawToken) {
    // Build the link from a TRUSTED origin, never the client Host header
    // (host-header injection would otherwise steal the token).
    const url = `${trustedOrigin()}/api/auth/callback?token=${encodeURIComponent(result.rawToken)}`;
    if (emailConfigured()) {
      await sendEmail({ to: result.email, subject: `Sign in to ${SITE_NAME}`, html: magicLinkHtml(url) });
    } else {
      // Dev/preview without Resend — log the link so the flow is testable.
      console.info(`[auth] magic link for ${result.email}: ${url}`);
    }
  }

  // Enumeration-safe: identical response (and nonce cookie) no matter what.
  const res = NextResponse.json(
    { ok: true, message: "If that email is valid, a sign-in link is on its way." },
    { status: 202, headers: rateLimitHeaders(ipRl) },
  );
  // The nonce cookie also carries the validated sign-in intent (a thing to track +
  // where to return), so it survives the email round-trip in this browser only.
  const intent = {
    n: nonce,
    t: parseTrackItem(b.track) ? String(b.track) : null,
    r: typeof b.returnTo === "string" ? safeReturnTo(b.returnTo) : null,
  };
  res.cookies.set(SIGNIN_NONCE_COOKIE, JSON.stringify(intent), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SIGNIN_NONCE_MAX_AGE_S,
  });
  return res;
}
