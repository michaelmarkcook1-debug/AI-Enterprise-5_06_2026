// AIE-08 — Seeding the pool: the early-contributor incentive.
// ─────────────────────────────────────────────────────────────────────────────
// The SPECIFIC incentive is a go-to-market call, not engineering's to invent
// (per the ticket). The owner's direction was to build the mechanism
// generically so either flag (or both) can be live without more engineering
// work — so a contribution grants BOTH: immediate early access, and a free
// window. The window's LENGTH is deliberately env-overridable (not hardcoded
// and un-tunable), same convention as the cost caps in lib/system/spend-
// ledger.ts, so the actual business number can change without a redeploy.
//
// Columns are added to the EXISTING ai_organization table (owned by
// lib/interrogation/session-store.ts) via an idempotent, additive ALTER — this
// module never re-creates that table, only extends it.

import { getPrisma, hasDatabase } from "../prisma";
import type { PrismaClient } from "../../generated/prisma/client";

/** The subset of the Prisma client needed for raw SQL — satisfied by both
 *  getPrisma() and a $transaction(...) callback's `tx` client. */
type DbClient = Pick<PrismaClient, "$executeRaw" | "$queryRaw">;

const ALTER_SQL = `
ALTER TABLE "ai_organization" ADD COLUMN IF NOT EXISTS "early_access_granted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ai_organization" ADD COLUMN IF NOT EXISTS "free_window_until" TIMESTAMP(3);
`;

let columnsEnsured = false;
async function ensureColumns(): Promise<void> {
  if (columnsEnsured) return;
  await getPrisma().$executeRawUnsafe(ALTER_SQL);
  columnsEnsured = true;
}

function requireDb(): void {
  if (!hasDatabase()) throw new Error("pool/incentive: no database configured");
}

/** Exported for tests — the placeholder-but-tunable free-window length. */
export function freeWindowDays(): number {
  const raw = process.env.POOL_FREE_WINDOW_DAYS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 30; // placeholder default — owner-tunable, see header
}

/** Pure: the free_window_until value a grant WOULD write, before the DB-side
 *  GREATEST clamp ensures a later existing window is never shortened.
 *  Exported for tests — the clamp itself needs a live UPDATE to verify, but
 *  this is the actual date arithmetic it guards. */
export function computeWindowUntil(now: Date, days: number = freeWindowDays()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Grant the contributor incentive on a successful contribution (AIE-06's
 *  consent=true path). Idempotent-ish: re-granting only extends the window
 *  forward, never shortens an already-granted one (the DB-side GREATEST).
 *  Accepts an optional transaction client so it can commit atomically
 *  alongside the pool insert (see app/api/pool/contribute/route.ts) — a
 *  session can only reach this once, since it's only called after
 *  claimConsentSlot's atomic gate says THIS call won the race. */
export async function grantContributorIncentive(orgId: string, now: Date = new Date(), db: DbClient = getPrisma()): Promise<void> {
  requireDb();
  await ensureColumns();
  const until = computeWindowUntil(now);
  await db.$executeRaw`
    UPDATE "ai_organization"
      SET "early_access_granted" = true,
          "free_window_until" = GREATEST(COALESCE("free_window_until", ${until}), ${until})
      WHERE "id" = ${orgId}`;
}

export interface IncentiveStatus {
  earlyAccessGranted: boolean;
  freeWindowUntil: string | null; // ISO date, or null if never granted/expired check is separate
}

export async function getIncentiveStatus(orgId: string): Promise<IncentiveStatus> {
  requireDb();
  await ensureColumns();
  const rows = await getPrisma().$queryRaw<Array<{ early_access_granted: boolean; free_window_until: Date | null }>>`
    SELECT "early_access_granted", "free_window_until" FROM "ai_organization" WHERE "id" = ${orgId}`;
  const r = rows[0];
  return {
    earlyAccessGranted: r?.early_access_granted ?? false,
    freeWindowUntil: r?.free_window_until ? r.free_window_until.toISOString() : null,
  };
}

export async function hasEarlyAccess(orgId: string): Promise<boolean> {
  return (await getIncentiveStatus(orgId)).earlyAccessGranted;
}

export async function isInFreeWindow(orgId: string, now: Date = new Date()): Promise<boolean> {
  const status = await getIncentiveStatus(orgId);
  return status.freeWindowUntil !== null && new Date(status.freeWindowUntil) > now;
}
