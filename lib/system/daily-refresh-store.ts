// Persistent log of daily-refresh runs.
// ─────────────────────────────────────
// The orchestrator writes one row per run here so the operator can:
//   - verify when the pipeline last succeeded (TopNav freshness badge)
//   - browse history + per-step JSON summaries (admin refresh-history view)
//
// Self-migrating: the table is created with CREATE TABLE IF NOT EXISTS
// on first write, so we don't need a separate `prisma migrate deploy`
// step to bring this online. Schema is intentionally simple — no
// foreign keys, jsonb for the per-step payload, text[] for errors.
//
// Raw SQL (not Prisma model) by design: the local prisma client is
// already wired and we want to avoid forcing a `prisma generate` on
// every contributor. The table shape is small enough that raw SQL is
// safer than fighting the generator.

import { getPrisma, hasDatabase } from "../prisma";
import type { DailyRefreshReport } from "./daily-refresh";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "daily_refresh_runs" (
  "id"          TEXT PRIMARY KEY,
  "started_at"  TIMESTAMP(3) NOT NULL,
  "finished_at" TIMESTAMP(3) NOT NULL,
  "ok"          BOOLEAN NOT NULL,
  "steps"       JSONB NOT NULL,
  "errors"      TEXT[] NOT NULL DEFAULT '{}',
  "duration_ms" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "daily_refresh_runs_started_at_idx"
  ON "daily_refresh_runs" ("started_at" DESC);
`;

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

function randomId(): string {
  // 22-char base36 — collision-resistant enough for a daily log table.
  return `dr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Lightweight "touch" that records a refresh-run entry from any
 * ingestion path (admin single-vendor, sourcing-rolling, etc.)
 * so the TopNav freshness badge stays accurate even when the full
 * daily-refresh orchestrator isn't the caller.
 */
export async function touchRefreshTimestamp(
  source: string,
  summary: Record<string, unknown> = {},
): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureTable();
    const id = randomId();
    const now = new Date();
    await getPrisma().$executeRaw`
      INSERT INTO "daily_refresh_runs"
        ("id", "started_at", "finished_at", "ok", "steps", "errors", "duration_ms")
      VALUES (
        ${id},
        ${now},
        ${now},
        ${true},
        ${JSON.stringify([{ step: source, ok: true, durationMs: 0, summary }])}::jsonb,
        ${{}}::text[],
        ${0}
      )
    `;
    return id;
  } catch (err) {
    console.error("[daily-refresh] touch failed:", (err as Error).message);
    return null;
  }
}

export async function persistRefreshReport(report: DailyRefreshReport): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureTable();
    const id = randomId();
    const durationMs = new Date(report.finishedAt).getTime() - new Date(report.startedAt).getTime();
    await getPrisma().$executeRaw`
      INSERT INTO "daily_refresh_runs"
        ("id", "started_at", "finished_at", "ok", "steps", "errors", "duration_ms")
      VALUES (
        ${id},
        ${new Date(report.startedAt)},
        ${new Date(report.finishedAt)},
        ${report.ok},
        ${JSON.stringify(report.steps)}::jsonb,
        ${report.errors}::text[],
        ${durationMs}
      )
    `;
    return id;
  } catch (err) {
    // Never let a logging failure break the refresh — surface in
    // server logs and continue.
    console.error("[daily-refresh] persist failed:", (err as Error).message);
    return null;
  }
}

export interface StoredRefreshRun {
  id: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  durationMs: number;
  steps: unknown;
  errors: string[];
}

export async function getLastRefreshRun(): Promise<StoredRefreshRun | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureTable();
    const rows = await getPrisma().$queryRaw<Array<{
      id: string;
      started_at: Date;
      finished_at: Date;
      ok: boolean;
      duration_ms: number;
      steps: unknown;
      errors: string[];
    }>>`
      SELECT "id", "started_at", "finished_at", "ok", "duration_ms", "steps", "errors"
      FROM "daily_refresh_runs"
      ORDER BY "started_at" DESC
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      startedAt: r.started_at.toISOString(),
      finishedAt: r.finished_at.toISOString(),
      ok: r.ok,
      durationMs: r.duration_ms,
      steps: r.steps,
      errors: r.errors,
    };
  } catch {
    return null;
  }
}

export async function listRefreshRuns(limit = 30): Promise<StoredRefreshRun[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureTable();
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const rows = await getPrisma().$queryRaw<Array<{
      id: string;
      started_at: Date;
      finished_at: Date;
      ok: boolean;
      duration_ms: number;
      steps: unknown;
      errors: string[];
    }>>`
      SELECT "id", "started_at", "finished_at", "ok", "duration_ms", "steps", "errors"
      FROM "daily_refresh_runs"
      ORDER BY "started_at" DESC
      LIMIT ${safeLimit}
    `;
    return rows.map((r) => ({
      id: r.id,
      startedAt: r.started_at.toISOString(),
      finishedAt: r.finished_at.toISOString(),
      ok: r.ok,
      durationMs: r.duration_ms,
      steps: r.steps,
      errors: r.errors,
    }));
  } catch {
    return [];
  }
}
