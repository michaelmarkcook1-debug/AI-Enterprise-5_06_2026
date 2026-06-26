// Member identity — passwordless magic-link auth (Phase 2 Wave 1).
// ────────────────────────────────────────────────────────────────
// Modelled on the admin cookie gate (lib/admin-page-auth.ts): the httpOnly
// cookie holds a RAW token; we persist only its sha256 hash, so a DB leak can't
// reconstruct a usable session. DB-backed (unlike the admin gate) so sessions are
// revocable + multi-device. Identity reuses the existing Subscriber row.
//
// NO per-user LLM, no polling — pure DB. Buyer data here never touches scores.

import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { getPrisma, hasDatabase } from "../prisma";
import { captureSubscriber } from "../subscribers/service";

export const MEMBER_COOKIE = "ae_member";
const TOKEN_TTL_MS = 15 * 60 * 1000; // magic-link: 15 minutes
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // session: 30 days
export const MEMBER_SESSION_MAX_AGE_S = Math.floor(SESSION_TTL_MS / 1000);

/** Cookie options shared by set (maxAge>0) + clear (maxAge=0). The route sets
 *  this on its NextResponse so the cookie reliably rides a redirect. */
export function memberCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** 64-char hex — 32 bytes of CSPRNG. */
function newRawToken(): string {
  return randomBytes(32).toString("hex");
}

export interface MagicLinkResult {
  outcome: "sent" | "no_database";
  /** Raw token — ONLY so the API route can build + email the link (and log it
   *  in dev). Never returned to the browser. */
  rawToken?: string;
  email: string;
}

/** Create a single-use magic-link token for an email. Reuses captureSubscriber
 *  so the person exists + is opted in. Enumeration-safety is the caller's job
 *  (return an identical response regardless of outcome). */
export async function requestMagicLink(emailRaw: string, source = "signin"): Promise<MagicLinkResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!hasDatabase()) return { outcome: "no_database", email };

  await captureSubscriber({ email, source });
  const prisma = getPrisma();
  const subscriber = await prisma.subscriber.findUnique({ where: { email } });
  if (!subscriber) return { outcome: "no_database", email };

  const rawToken = newRawToken();
  await prisma.authToken.create({
    data: {
      subscriberId: subscriber.id,
      tokenHash: sha256(rawToken),
      purpose: "signin",
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return { outcome: "sent", rawToken, email };
}

/** Validate + single-use-consume a magic link. Confirms the subscriber on success. */
export async function consumeMagicLink(rawToken: string): Promise<{ ok: boolean; subscriberId?: string }> {
  if (!hasDatabase() || !rawToken) return { ok: false };
  const prisma = getPrisma();
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
  if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) return { ok: false };

  await prisma.authToken.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  await prisma.subscriber
    .update({ where: { id: row.subscriberId }, data: { status: "confirmed", confirmedAt: new Date() } })
    .catch(() => {});
  return { ok: true, subscriberId: row.subscriberId };
}

/** Mint a session row and return the RAW token. The caller sets it as the
 *  `ae_member` cookie on its NextResponse (see memberCookieOptions). */
export async function createSessionToken(subscriberId: string): Promise<string | null> {
  if (!hasDatabase()) return null;
  const rawToken = newRawToken();
  await getPrisma().memberSession.create({
    data: {
      subscriberId,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return rawToken;
}

export interface Member {
  subscriberId: string;
  email: string;
}

/** Resolve the current member from the session cookie. Pure read (safe to call
 *  during a server-component render). Returns null when signed out / expired. */
export async function getMember(): Promise<Member | null> {
  if (!hasDatabase()) return null;
  const jar = await cookies();
  const raw = jar.get(MEMBER_COOKIE)?.value;
  if (!raw) return null;

  const session = await getPrisma().memberSession.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { subscriber: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return { subscriberId: session.subscriberId, email: session.subscriber.email };
}

/** Revoke a session by its raw cookie token (DB only). The caller clears the
 *  cookie on its NextResponse. */
export async function revokeSessionByToken(rawToken: string): Promise<void> {
  if (!rawToken || !hasDatabase()) return;
  await getPrisma().memberSession.deleteMany({ where: { tokenHash: sha256(rawToken) } }).catch(() => {});
}
