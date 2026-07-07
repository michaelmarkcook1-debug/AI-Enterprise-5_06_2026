// Read-only decision sharing (Piece C-share). PUBLIC surface — security is the
// acceptance criteria here, not a nice-to-have.
// ────────────────────────────────────────────────────────────────────────────
// Token shape deliberately mirrors lib/member/auth.ts's magic-link/session
// tokens: a 256-bit CSPRNG raw token, sha256-hashed at rest, looked up by
// unique index. NOT the admin gate's HMAC pattern (lib/admin-page-auth.ts) —
// that's a single stateless shared-secret with no notion of per-resource
// ownership or revocation, the wrong shape for "one specific share, one
// owner, independently revocable."
//
// TWO deliberately separate read paths:
//   - Owner-side (listShares/createShare/revokeShare): scoped by subscriberId
//     in the WHERE clause, exactly like every other MemberDecision mutation —
//     reuses getMemberDecision's ownership check before ever creating a share.
//   - Visitor-side (getSharedDecisionView): takes ONLY a raw token, never a
//     subscriberId or a decisionId from the caller. The token is resolved to
//     a decisionId internally; there is no code path by which a visitor can
//     supply a decisionId and have it used. Every failure — not found,
//     revoked, expired, forged/garbage token — returns the identical `null`,
//     so the caller can only ever render one uniform "not found" response.
//
// The raw token is returned ONLY once, at creation (createShare) — like the
// admin gate's "paste-once" token, it cannot be recovered afterward; only its
// hash is ever persisted. Losing it means revoking and creating a new share.

import { randomBytes, createHash } from "node:crypto";
import { getPrisma, hasDatabase } from "../prisma";
import { trustedOrigin } from "../site";
import { getMemberDecision, toView as toDecisionView, type MemberDecisionView } from "./decisions";

const MAX_DISPLAY_NAME_LENGTH = 80;
const VALID_EXPIRY_DAYS = [7, 30, 90] as const;
const DEFAULT_EXPIRY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 64-char hex, 256 bits of CSPRNG — same primitive as auth.ts's newRawToken. */
function newRawToken(): string {
  return randomBytes(32).toString("hex");
}
/** Same primitive as auth.ts's sha256() — unsalted is fine: the input is
 *  already 256 bits of CSPRNG, not a low-entropy secret. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type ShareStatus = "active" | "expired" | "revoked";

export interface ShareView {
  id: string;
  decisionId: string;
  displayName: string | null;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
  status: ShareStatus;
}

export interface CreatedShare extends ShareView {
  /** Shown ONCE — never retrievable again after this response. */
  rawToken: string;
  url: string;
}

function computeStatus(row: { expiresAt: Date; revokedAt: Date | null }, now: Date): ShareStatus {
  if (row.revokedAt) return "revoked";
  if (row.expiresAt.getTime() < now.getTime()) return "expired";
  return "active";
}

function toShareView(
  row: {
    id: string;
    decisionId: string;
    displayName: string | null;
    expiresAt: Date;
    revokedAt: Date | null;
    viewCount: number;
    lastAccessedAt: Date | null;
    createdAt: Date;
  },
  now: Date = new Date(),
): ShareView {
  return {
    id: row.id,
    decisionId: row.decisionId,
    displayName: row.displayName,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    viewCount: row.viewCount,
    lastAccessedAt: row.lastAccessedAt ? row.lastAccessedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    status: computeStatus(row, now),
  };
}

/** Pure. Exported for tests. Unknown/missing → the documented default. */
export function sanitizeExpiryDays(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  return (VALID_EXPIRY_DAYS as readonly number[]).includes(n) ? n : DEFAULT_EXPIRY_DAYS;
}

/** Pure. Trims/caps; blank or non-string → null (never shown, not "Anonymous"). */
export function sanitizeDisplayName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

// ── Owner-side: list / create / revoke — all scoped to subscriberId ─────────

export async function listShares(subscriberId: string, decisionId: string): Promise<ShareView[]> {
  if (!hasDatabase()) return [];
  const rows = await getPrisma().memberDecisionShare.findMany({
    where: { subscriberId, decisionId },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return rows.map((r) => toShareView(r, now));
}

export type CreateShareResult = { ok: true; data: CreatedShare } | { ok: false; error: string };

/**
 * Creates a share for `decisionId`, but ONLY if `subscriberId` actually owns
 * it — reuses getMemberDecision's existing ownership-scoped lookup rather
 * than re-deriving that check, so a non-owned decisionId can never get a
 * share minted for it (fails "not_found", indistinguishable from a
 * nonexistent decision — same non-confirming shape as every other decision
 * read in this codebase).
 */
export async function createShare(subscriberId: string, decisionId: string, input: unknown): Promise<CreateShareResult> {
  const decision = await getMemberDecision(subscriberId, decisionId);
  if (!decision) return { ok: false, error: "not_found" };
  if (!hasDatabase()) return { ok: false, error: "no_database" };

  const i = (input ?? {}) as Record<string, unknown>;
  const days = sanitizeExpiryDays(i.expiresInDays);
  const displayName = sanitizeDisplayName(i.displayName);
  const raw = newRawToken();
  const tokenHash = hashToken(raw);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * DAY_MS);

  const row = await getPrisma().memberDecisionShare.create({
    data: { decisionId, subscriberId, tokenHash, displayName, expiresAt },
  });

  return {
    ok: true,
    data: { ...toShareView(row, now), rawToken: raw, url: `${trustedOrigin()}/shared/${raw}` },
  };
}

/** Soft-revoke (revokedAt timestamp, never hard-deleted) — scoped by owner AND
 *  decision, matching decisions.ts's updateMany-by-owner ownership pattern.
 *  `revokedAt: null` in the WHERE clause makes this idempotent (revoking an
 *  already-revoked share matches zero rows rather than double-touching it). */
export async function revokeShare(subscriberId: string, decisionId: string, shareId: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  const res = await getPrisma().memberDecisionShare.updateMany({
    where: { id: shareId, decisionId, subscriberId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

// ── Visitor-side: the ONLY entry point a public /shared/[token] route may
//    call. Takes nothing but the raw token — see file header. ──────────────

export interface SharedDecisionView {
  decision: MemberDecisionView;
  displayName: string | null;
}

/**
 * Resolves a raw share token to the decision it grants read access to, or
 * null for EVERY failure mode (garbage token, real-but-unknown hash, revoked,
 * expired, or a decision that no longer exists) — deliberately collapsed to
 * one shape so the calling route can only ever render one uniform "not
 * found," never a response that lets a caller distinguish "wrong token" from
 * "right token, expired" from "right token, revoked."
 */
export async function getSharedDecisionView(rawToken: string, db = getPrisma()): Promise<SharedDecisionView | null> {
  if (!hasDatabase() || !rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const share = await db.memberDecisionShare.findUnique({ where: { tokenHash } });
  if (!share) return null;
  if (share.revokedAt) return null;
  if (share.expiresAt.getTime() < Date.now()) return null;

  const row = await db.memberDecision.findUnique({ where: { id: share.decisionId } });
  if (!row) return null;

  // Best-effort access bump — no PII (no IP/UA/referrer), never blocks or
  // fails the read if it errors.
  await db.memberDecisionShare
    .update({ where: { id: share.id }, data: { viewCount: { increment: 1 }, lastAccessedAt: new Date() } })
    .catch(() => {});

  return { decision: toDecisionView(row), displayName: share.displayName };
}
