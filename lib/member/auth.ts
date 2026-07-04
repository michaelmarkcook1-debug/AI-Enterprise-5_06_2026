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
import { MEMBER_TEST_OPEN } from "../availability";

export const MEMBER_COOKIE = "ae_member";
/** Per-request browser nonce cookie — binds a magic link to the browser that
 *  requested it (login-CSRF / session-fixation defence). httpOnly, 15-min. */
export const SIGNIN_NONCE_COOKIE = "ae_signin";
export const SIGNIN_NONCE_MAX_AGE_S = 15 * 60;
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
export async function requestMagicLink(
  emailRaw: string,
  source = "signin",
  requesterNonce?: string,
): Promise<MagicLinkResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!hasDatabase()) return { outcome: "no_database", email };

  await captureSubscriber({ email, source });
  const prisma = getPrisma();
  const subscriber = await prisma.subscriber.findUnique({ where: { email } });
  if (!subscriber) return { outcome: "no_database", email };

  // Newest-link-wins: invalidate this subscriber's other outstanding signin
  // tokens so a re-request kills the earlier link, collapsing the live-link set
  // to one (consume-side single-use doesn't cover the "first link still live
  // after re-request" window).
  await prisma.authToken.updateMany({
    where: { subscriberId: subscriber.id, purpose: "signin", consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const rawToken = newRawToken();
  await prisma.authToken.create({
    data: {
      subscriberId: subscriber.id,
      tokenHash: sha256(rawToken),
      purpose: "signin",
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      // Bind to the requesting browser (nonce held in an httpOnly cookie) so the
      // token can only complete a sign-in in the same browser that requested it.
      requesterHash: requesterNonce ? sha256(requesterNonce) : null,
    },
  });
  return { outcome: "sent", rawToken, email };
}

/** Validate + single-use-consume a magic link. Confirms the subscriber on success.
 *  `presentedNonce` is the requesting-browser nonce from the httpOnly cookie; when
 *  the token was bound (requesterHash set) it MUST match, else we reject WITHOUT
 *  consuming (so a wrong-browser/forged attempt can't burn the legit link). */
export async function consumeMagicLink(
  rawToken: string,
  presentedNonce?: string,
): Promise<{ ok: boolean; subscriberId?: string }> {
  if (!hasDatabase() || !rawToken) return { ok: false };
  const prisma = getPrisma();
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
  if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) return { ok: false };

  // Requester-binding: the token only works in the browser that requested it.
  if (row.requesterHash && (!presentedNonce || sha256(presentedNonce) !== row.requesterHash)) {
    return { ok: false };
  }

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

// ── TEST-OPEN member (MEMBER_TEST_OPEN) ──────────────────────────────────────
// A single shared, auto-provisioned "test member" so every member-gated feature
// is exercisable without sign-in during testing. Backed by a REAL Subscriber row
// (the watchlist has an FK to it), created once and cached in-module so we don't
// write on every request. NEVER used unless MEMBER_TEST_OPEN is true.
const TEST_MEMBER_EMAIL = "tester@ai-enterprise.local";
let testMemberCache: Member | null = null;

async function ensureTestMember(): Promise<Member | null> {
  if (!MEMBER_TEST_OPEN || !hasDatabase()) return null;
  if (testMemberCache) return testMemberCache;
  try {
    // Idempotent: creates the subscriber if absent, then we read its id.
    await captureSubscriber({ email: TEST_MEMBER_EMAIL, source: "test_open" });
    const sub = await getPrisma().subscriber.findUnique({ where: { email: TEST_MEMBER_EMAIL } });
    if (!sub) return null;
    testMemberCache = { subscriberId: sub.id, email: sub.email };
    return testMemberCache;
  } catch {
    return null;
  }
}

/** Resolve the current member, falling back to the shared TEST member when
 *  MEMBER_TEST_OPEN is on and there's no real session. This is the resolver the
 *  member features use so they work with sign-in disabled but test-open on. A
 *  real session always wins (existing signed-in members are unaffected). */
export async function getMemberOrTest(): Promise<Member | null> {
  const real = await getMember();
  if (real) return real;
  return ensureTestMember();
}

/** Revoke a session by its raw cookie token (DB only). The caller clears the
 *  cookie on its NextResponse. */
export async function revokeSessionByToken(rawToken: string): Promise<void> {
  if (!rawToken || !hasDatabase()) return;
  await getPrisma().memberSession.deleteMany({ where: { tokenHash: sha256(rawToken) } }).catch(() => {});
}

/** Housekeeping: delete consumed/expired magic-link tokens + expired sessions so
 *  the auth tables don't grow unbounded. Pure DB (uses the expires_at indexes);
 *  safe to call from the daily cron. */
export async function sweepMemberAuth(): Promise<{ tokens: number; sessions: number }> {
  if (!hasDatabase()) return { tokens: 0, sessions: 0 };
  const prisma = getPrisma();
  const now = new Date();
  const tokens = await prisma.authToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }] },
  });
  const sessions = await prisma.memberSession.deleteMany({ where: { expiresAt: { lt: now } } });
  return { tokens: tokens.count, sessions: sessions.count };
}
