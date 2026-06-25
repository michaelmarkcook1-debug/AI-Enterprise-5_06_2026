// Refresh kill switch.
// ─────────────────────
// A hard stop for the shared market-refresh pipeline. When active, the daily
// refresh (lib/system/daily-refresh.ts) no-ops at entry and spends nothing —
// the lever you pull if a run is misbehaving or spend is running hot.
//
// Two independent sources, EITHER of which halts the pipeline:
//   1. Env flag  REFRESH_KILL_SWITCH=1  — survives redeploys, set in Vercel,
//      cannot be cleared by code (operator-owned).
//   2. DB row    refresh_killswitch.active=true — togglable at runtime via the
//      admin guard route without a redeploy.
//
// Follows the self-migrating raw-SQL store pattern used across lib/system
// (admin-run-log.ts, daily-refresh-store.ts): CREATE TABLE IF NOT EXISTS on
// first touch, parameterised $executeRaw writes, best-effort (never throws into
// the caller), and a hasDatabase() guard so the no-DB path degrades gracefully.

import { getPrisma, hasDatabase } from "../prisma";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "refresh_killswitch" (
  "id"         TEXT PRIMARY KEY,
  "active"     BOOLEAN NOT NULL DEFAULT false,
  "reason"     TEXT,
  "set_by"     TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

// Single-row table — one global switch.
const ROW_ID = "global";

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

/** True when the env flag forces the switch on (operator-owned, redeploy-safe). */
export function killSwitchEnvForced(): boolean {
  return process.env.REFRESH_KILL_SWITCH === "1";
}

export interface KillSwitchState {
  active: boolean;
  source: "env" | "db" | "none";
  reason: string | null;
  setBy: string | null;
  updatedAt: string | null;
}

/** Resolve the current kill-switch state. Env flag wins; then the DB row. */
export async function getKillSwitchState(): Promise<KillSwitchState> {
  if (killSwitchEnvForced()) {
    return { active: true, source: "env", reason: "REFRESH_KILL_SWITCH=1", setBy: "env", updatedAt: null };
  }
  if (!hasDatabase()) {
    return { active: false, source: "none", reason: null, setBy: null, updatedAt: null };
  }
  try {
    await ensureTable();
    const rows = await getPrisma().$queryRaw<
      Array<{ active: boolean; reason: string | null; set_by: string | null; updated_at: Date }>
    >`SELECT "active", "reason", "set_by", "updated_at" FROM "refresh_killswitch" WHERE "id" = ${ROW_ID} LIMIT 1`;
    const row = rows[0];
    if (row?.active) {
      return {
        active: true,
        source: "db",
        reason: row.reason,
        setBy: row.set_by,
        updatedAt: row.updated_at.toISOString(),
      };
    }
    return {
      active: false,
      source: "none",
      reason: row?.reason ?? null,
      setBy: row?.set_by ?? null,
      updatedAt: row ? row.updated_at.toISOString() : null,
    };
  } catch {
    // Fail OPEN is wrong for a kill switch, but a DB read error must not itself
    // wedge the pipeline forever; the env flag remains the durable hard stop.
    return { active: false, source: "none", reason: null, setBy: null, updatedAt: null };
  }
}

/** Convenience: is the pipeline currently halted by either source? */
export async function isKillSwitchActive(): Promise<boolean> {
  return (await getKillSwitchState()).active;
}

/**
 * Toggle the DB kill switch (runtime, no redeploy). The env flag is NOT
 * affected — if REFRESH_KILL_SWITCH=1, the pipeline stays halted regardless.
 * Best-effort: returns false if there's no database.
 */
export async function setKillSwitch(active: boolean, opts: { reason?: string; setBy?: string } = {}): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    await ensureTable();
    await getPrisma().$executeRaw`
      INSERT INTO "refresh_killswitch" ("id", "active", "reason", "set_by", "updated_at")
      VALUES (${ROW_ID}, ${active}, ${opts.reason ?? null}, ${opts.setBy ?? null}, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE
        SET "active" = ${active},
            "reason" = ${opts.reason ?? null},
            "set_by" = ${opts.setBy ?? null},
            "updated_at" = CURRENT_TIMESTAMP
    `;
    return true;
  } catch (err) {
    console.error("[refresh-killswitch] setKillSwitch failed:", (err as Error).message);
    return false;
  }
}
