// C16 — Credit meter for the premium LLM actions. SCAFFOLD ONLY.
// ─────────────────────────────────────────────────────────────────────────────
// The two metered actions (Interrogate re-run, prep-kit generation) each consume
// one credit PER REAL SPEND. Metering is:
//   • transparent  — getBalance() always returns { used, remaining, cap }
//   • hard-capped   — reaching creditsHardCap blocks further metered actions
//   • reserve→commit — a credit is committed only when a REAL LLM call happened
//     (source === "anthropic"); a stub result (no API key) consumes nothing
//   • inert when off — with BILLING_ENABLED false, reserve() always allows and
//     records nothing, so the app behaves exactly as it does today
//
// Storage is the self-migrating raw-SQL pattern (spend-ledger.ts / daily-refresh-
// store.ts) — CREATE TABLE IF NOT EXISTS, never-throw, no Prisma migration. The
// ledger is append-only: one row per committed credit, bucketed by billing
// period, so used/remaining is a COUNT — no mutable balance to corrupt.
//
// FIREWALL: no vendor score is read or written here. Pure usage accounting.

import { getPrisma, hasDatabase } from "../prisma";
import { BILLING_ENABLED } from "../availability";
import { type MeteredAction } from "./plans";
import { getEntitlement } from "./entitlement";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "member_credit_ledger" (
  "id"            TEXT PRIMARY KEY,
  "subscriber_id" TEXT NOT NULL,
  "action"        TEXT NOT NULL,
  "period"        TEXT NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "member_credit_ledger_sub_period_idx"
  ON "member_credit_ledger" ("subscriber_id", "period");
`;

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

function ledgerId(): string {
  return `cred_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Billing period bucket: UTC year-month (YYYY-MM). Credits reset monthly. */
function periodKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export interface CreditBalance {
  /** Credits committed this period. */
  used: number;
  /** Included allotment for the member's plan. */
  included: number;
  /** Hard ceiling (allotment + any overage) — actions blocked at/after this. */
  cap: number;
  /** max(0, cap - used). */
  remaining: number;
  /** True once `used` has consumed the included allotment (into overage/cap). */
  inOverage: boolean;
}

/** How many credits this subscriber has used in the current period. */
async function usedThisPeriod(subscriberId: string, now: Date): Promise<number> {
  await ensureTable();
  const rows = (await getPrisma().$queryRaw`
    SELECT COUNT(*)::int AS n
    FROM "member_credit_ledger"
    WHERE "subscriber_id" = ${subscriberId} AND "period" = ${periodKey(now)}
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

/**
 * The member's transparent credit balance for the current period. Never throws
 * — on any failure returns a zero-usage balance for the resolved plan (honest:
 * we never over-report usage against the member). Reads plan from entitlement.
 */
export async function getBalance(
  subscriberId: string | null | undefined,
  now: Date = new Date(),
): Promise<CreditBalance> {
  const { plan } = await getEntitlement(subscriberId);
  const included = plan.creditsIncluded;
  const cap = plan.creditsHardCap;
  if (!subscriberId || !hasDatabase()) {
    return { used: 0, included, cap, remaining: cap, inOverage: false };
  }
  try {
    const used = await usedThisPeriod(subscriberId, now);
    return { used, included, cap, remaining: Math.max(0, cap - used), inOverage: used >= included };
  } catch {
    return { used: 0, included, cap, remaining: cap, inOverage: false };
  }
}

export interface Reservation {
  /** Whether the metered action may proceed. */
  allowed: boolean;
  /** Present when blocked: why. "cap_reached" | "no_plan_access". */
  reason?: "cap_reached" | "no_plan_access";
  balance: CreditBalance;
  /** Call after a REAL spend to commit one credit. No-op when billing is off,
   *  when the action was a stub (no real LLM call), or when not allowed. */
  commit: (didRealSpend: boolean) => Promise<void>;
}

/**
 * Reserve a credit for a metered action BEFORE the LLM call.
 *
 * Billing OFF (default): always allowed, `commit` is a no-op — the scaffold is
 * completely inert and the live app is unchanged.
 *
 * Billing ON: blocks with reason "no_plan_access" if the plan doesn't include
 * the action, or "cap_reached" if the hard cap is hit; otherwise allows and
 * returns a `commit` that appends ONE ledger row iff a real spend occurred.
 */
export async function reserveCredit(
  subscriberId: string | null | undefined,
  action: MeteredAction,
  now: Date = new Date(),
): Promise<Reservation> {
  const balance = await getBalance(subscriberId, now);

  // Inert when billing is off — no gating, no accounting.
  if (!BILLING_ENABLED) {
    return { allowed: true, balance, commit: async () => {} };
  }

  const ent = await getEntitlement(subscriberId);
  if (!subscriberId || !ent.has(action)) {
    return { allowed: false, reason: "no_plan_access", balance, commit: async () => {} };
  }
  if (balance.remaining <= 0) {
    return { allowed: false, reason: "cap_reached", balance, commit: async () => {} };
  }

  let committed = false;
  return {
    allowed: true,
    balance,
    commit: async (didRealSpend: boolean) => {
      // Only a genuine LLM spend consumes a credit — a stub result (no API key)
      // must be free. Double-commit guarded.
      if (!didRealSpend || committed || !hasDatabase()) return;
      committed = true;
      try {
        await ensureTable();
        await getPrisma().$executeRaw`
          INSERT INTO "member_credit_ledger" ("id", "subscriber_id", "action", "period", "created_at")
          VALUES (${ledgerId()}, ${subscriberId}, ${action}, ${periodKey(now)}, ${now})
        `;
      } catch {
        // Never fail the user's action on a metering write hiccup — under-count
        // rather than block. (Honest under-claim on the billing side.)
      }
    },
  };
}
