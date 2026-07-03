// C16 — Entitlement resolver. SCAFFOLD ONLY (billing OFF by default).
// ─────────────────────────────────────────────────────────────────────────────
// Answers "what is this member entitled to?" — their plan + which paywalled
// features they may use. The FREE FUNNEL (news / rankings / dependency graph /
// use-case front door) is NEVER routed through here: it has no entitlement and
// is open to everyone, signed-out included. Only assessment DEPTH + the two
// premium LLM actions are gated.
//
// Persistence uses the self-migrating raw-SQL pattern (lib/system/spend-ledger.ts,
// daily-refresh-store.ts): CREATE TABLE IF NOT EXISTS on first touch, never
// throws, no Prisma migration required — so this scaffold ships at zero schema
// risk and is completely inert until the owner assigns tiers + flips billing.
//
// FIREWALL: nothing here reads or writes a vendor score. Tier assignment is
// owner-set (an admin action at switch-on), not self-serve — no purchase path
// exists until BILLING_ENABLED and a payment processor are wired by the owner.

import { getPrisma, hasDatabase } from "../prisma";
import { BILLING_ENABLED } from "../availability";
import { type Feature, type Plan, type PlanId, planById, FREE_PLAN } from "./plans";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "member_entitlements" (
  "subscriber_id" TEXT PRIMARY KEY,
  "plan_id"       TEXT NOT NULL DEFAULT 'free',
  "status"        TEXT NOT NULL DEFAULT 'active',
  "period_start"  TIMESTAMP(3),
  "period_end"    TIMESTAMP(3),
  "assigned_by"   TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

export interface Entitlement {
  subscriberId: string | null;
  plan: Plan;
  /** True only when the pricing scaffold is live AND this feature is in-plan.
   *  With BILLING_ENABLED off, `has()` returns true for every feature (scaffold
   *  is inert — the app behaves exactly as it does today). */
  has: (feature: Feature) => boolean;
}

/** Build the Entitlement view object for a resolved plan. When billing is OFF
 *  the scaffold must not change any live behaviour, so `has()` is permissive;
 *  when ON, it enforces the plan's feature set. Pure. */
function toEntitlement(subscriberId: string | null, plan: Plan): Entitlement {
  const granted = new Set<Feature>(plan.features);
  return {
    subscriberId,
    plan,
    has: (feature: Feature) => (BILLING_ENABLED ? granted.has(feature) : true),
  };
}

/**
 * Resolve a member's entitlement. Signed-out or unknown → Free (never a locked
 * state). Reads the owner-assigned tier from member_entitlements; absence = Free.
 * Never throws — a DB hiccup degrades to Free, the honest under-claim.
 */
export async function getEntitlement(subscriberId: string | null | undefined): Promise<Entitlement> {
  if (!subscriberId || !hasDatabase()) return toEntitlement(subscriberId ?? null, FREE_PLAN);
  try {
    await ensureTable();
    const rows = (await getPrisma().$queryRaw`
      SELECT "plan_id", "status", "period_end"
      FROM "member_entitlements"
      WHERE "subscriber_id" = ${subscriberId}
      LIMIT 1
    `) as Array<{ plan_id: string; status: string; period_end: Date | null }>;
    const row = rows[0];
    if (!row || row.status !== "active") return toEntitlement(subscriberId, FREE_PLAN);
    // An expired period lapses to Free (honest — no silent grace).
    if (row.period_end && row.period_end.getTime() < Date.now()) {
      return toEntitlement(subscriberId, FREE_PLAN);
    }
    return toEntitlement(subscriberId, planById(row.plan_id));
  } catch {
    return toEntitlement(subscriberId, FREE_PLAN);
  }
}

/**
 * Owner-set tier assignment (admin action / switch-on). NOT a purchase path —
 * there is no self-serve upgrade until the owner wires a payment processor and
 * flips BILLING_ENABLED. Idempotent upsert. Returns false on any failure.
 */
export async function assignTier(
  subscriberId: string,
  planId: PlanId,
  opts: { assignedBy?: string; periodEnd?: Date } = {},
): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    await ensureTable();
    const now = new Date();
    await getPrisma().$executeRaw`
      INSERT INTO "member_entitlements"
        ("subscriber_id", "plan_id", "status", "period_start", "period_end", "assigned_by", "created_at", "updated_at")
      VALUES (${subscriberId}, ${planId}, 'active', ${now}, ${opts.periodEnd ?? null}, ${opts.assignedBy ?? null}, ${now}, ${now})
      ON CONFLICT ("subscriber_id") DO UPDATE SET
        "plan_id" = EXCLUDED."plan_id",
        "status" = 'active',
        "period_start" = EXCLUDED."period_start",
        "period_end" = EXCLUDED."period_end",
        "assigned_by" = EXCLUDED."assigned_by",
        "updated_at" = EXCLUDED."updated_at"
    `;
    return true;
  } catch {
    return false;
  }
}
