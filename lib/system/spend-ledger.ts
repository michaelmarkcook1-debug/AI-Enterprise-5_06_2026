// Refresh spend ledger + cap guard.
// ─────────────────────────────────
// The cost guardrail for the shared market refresh. A "flood of free users"
// must never translate into runaway Anthropic spend, so the daily-refresh
// pipeline (the ONLY thing that calls the LLM) is bounded by two hard caps:
//
//   • per-cycle cap  — the most one refresh run may spend  (default $5)
//   • per-day cap    — the most all runs in a UTC day may   (default $25)
//
// Both are env-overridable (REFRESH_CYCLE_CAP_USD / REFRESH_DAY_CAP_USD) so the
// ceiling can be tightened in Vercel without a redeploy of code.
//
// Semantics — a *pre-step tripwire*, not a mid-call abort: each LLM-heavy step
// asks the guard `exhausted()` BEFORE it starts. Once projected spend
// (today's prior spend + this cycle so far) reaches a cap, no further LLM step
// begins. The deterministic DB steps always run (they cost nothing). Worst case
// we overshoot by a single step's cost — with a $5 cycle cap and cent-to-dollar
// steps that's a tight, honest bound, and it is logged on the skipped step.
//
// Storage follows the self-migrating raw-SQL pattern used across lib/system.

import { getPrisma, hasDatabase } from "../prisma";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "refresh_spend_ledger" (
  "id"         TEXT PRIMARY KEY,
  "cycle_id"   TEXT,
  "spend_date" DATE NOT NULL,
  "cost_usd"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tokens_in"  BIGINT NOT NULL DEFAULT 0,
  "tokens_out" BIGINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "refresh_spend_ledger_spend_date_idx"
  ON "refresh_spend_ledger" ("spend_date");
`;

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

function randomId(): string {
  return `spend_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** UTC yyyy-mm-dd for the ledger's day bucket. */
function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function readCapEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export interface SpendCaps {
  cycleUsd: number;
  dayUsd: number;
}

/** Resolve the active caps (env override → $5 cycle / $25 day default). */
export function getSpendCaps(): SpendCaps {
  return {
    cycleUsd: readCapEnv("REFRESH_CYCLE_CAP_USD", 5),
    dayUsd: readCapEnv("REFRESH_DAY_CAP_USD", 25),
  };
}

/** Sum of recorded spend for the given UTC day. 0 when no DB / on error. */
export async function getDaySpendUsd(now: Date = new Date()): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    await ensureTable();
    const rows = await getPrisma().$queryRaw<Array<{ total: number | null }>>`
      SELECT COALESCE(SUM("cost_usd"), 0)::double precision AS total
      FROM "refresh_spend_ledger"
      WHERE "spend_date" = ${utcDateKey(now)}::date
    `;
    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

/** Record one refresh cycle's actual spend. Best-effort; never throws. */
export async function recordCycleSpend(input: {
  cycleId: string | null;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  now?: Date;
}): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureTable();
    const id = randomId();
    const now = input.now ?? new Date();
    await getPrisma().$executeRaw`
      INSERT INTO "refresh_spend_ledger"
        ("id", "cycle_id", "spend_date", "cost_usd", "tokens_in", "tokens_out")
      VALUES (
        ${id},
        ${input.cycleId},
        ${utcDateKey(now)}::date,
        ${input.costUsd},
        ${Math.round(input.tokensIn)},
        ${Math.round(input.tokensOut)}
      )
    `;
    return id;
  } catch (err) {
    console.error("[spend-ledger] recordCycleSpend failed:", (err as Error).message);
    return null;
  }
}

export interface SpendGuard {
  caps: SpendCaps;
  /** Spend already recorded for today BEFORE this cycle started. */
  priorTodayUsd: number;
  /** Cost accumulated by this cycle's completed steps so far. */
  cycleUsd(): number;
  /** Add a completed step's estimated cost to the running cycle total. */
  record(costUsd: number): void;
  /** True once a further LLM step would breach the cycle or day cap. */
  exhausted(): boolean;
  /** Machine-readable reason for the current exhausted() verdict. */
  status(): { exhausted: boolean; reason: string | null; cycleUsd: number; dayProjectedUsd: number; caps: SpendCaps };
}

/**
 * Build a spend guard for one refresh cycle. Reads today's prior spend once at
 * construction, then tracks this cycle's accumulating cost in memory.
 */
export async function makeSpendGuard(now: Date = new Date()): Promise<SpendGuard> {
  const caps = getSpendCaps();
  const priorTodayUsd = await getDaySpendUsd(now);
  let cycle = 0;

  const exhausted = (): boolean =>
    cycle >= caps.cycleUsd || priorTodayUsd + cycle >= caps.dayUsd;

  return {
    caps,
    priorTodayUsd,
    cycleUsd: () => cycle,
    record: (costUsd: number) => {
      if (Number.isFinite(costUsd) && costUsd > 0) cycle += costUsd;
    },
    exhausted,
    status: () => {
      const dayProjectedUsd = priorTodayUsd + cycle;
      let reason: string | null = null;
      if (cycle >= caps.cycleUsd) {
        reason = `cycle cap reached ($${cycle.toFixed(2)} ≥ $${caps.cycleUsd.toFixed(2)})`;
      } else if (dayProjectedUsd >= caps.dayUsd) {
        reason = `daily cap reached ($${dayProjectedUsd.toFixed(2)} ≥ $${caps.dayUsd.toFixed(2)})`;
      }
      return { exhausted: exhausted(), reason, cycleUsd: cycle, dayProjectedUsd, caps };
    },
  };
}
