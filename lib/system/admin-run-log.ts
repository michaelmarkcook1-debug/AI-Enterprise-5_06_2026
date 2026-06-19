// Durable log of operator-triggered admin runs (manual ingestion / news /
// market-feed refreshes from /admin/ingestion).
// ─────────────────────────────────────────────────────────────────────────
// Why this exists: the admin console used to keep a run's result in React
// state only, so the "✓ N extracted · M persisted" banner vanished the moment
// you navigated away or switched tabs — the run looked like it "didn't
// persist". This table records ONE compact row per run so the ingestion page
// can server-render the last completed run on every load, independent of
// client state.
//
// Self-migrating: CREATE TABLE IF NOT EXISTS on first write (same approach as
// daily-refresh-store), so no separate `prisma migrate deploy` is required.
// Kept deliberately SEPARATE from `daily_refresh_runs` so ad-hoc admin runs do
// not pollute the daily-pipeline history on /admin/pipeline-health, and so they
// never interfere with the daily cron's in-progress lock (isRunActive).
//
// All writes are best-effort: a logging failure must never break the actual
// ingestion run, so every function swallows errors and degrades to a no-op.

import { getPrisma, hasDatabase } from "../prisma";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "admin_run_log" (
  "id"          TEXT PRIMARY KEY,
  "kind"        TEXT NOT NULL,
  "label"       TEXT NOT NULL DEFAULT '',
  "status"      TEXT NOT NULL,
  "summary"     JSONB NOT NULL DEFAULT '{}',
  "error"       TEXT,
  "started_at"  TIMESTAMP(3) NOT NULL,
  "finished_at" TIMESTAMP(3) NOT NULL,
  "duration_ms" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "admin_run_log_started_at_idx"
  ON "admin_run_log" ("started_at" DESC);
`;

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

function randomId(): string {
  return `arun_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export type AdminRunStatus = "ok" | "error";

export interface RecordAdminRunInput {
  kind: string;                       // e.g. "sourcing" | "news_sourcing" | "news_feed"
  label: string;                      // human-readable, e.g. "Evidence sourcing — vendor_openai"
  status: AdminRunStatus;
  summary?: Record<string, unknown>;  // compact totals, stored as jsonb
  error?: string | null;
  startedAt: Date;
  finishedAt: Date;
}

/** Record one completed (or failed) admin run. Best-effort — never throws. */
export async function recordAdminRun(input: RecordAdminRunInput): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureTable();
    const id = randomId();
    const durationMs = Math.max(0, input.finishedAt.getTime() - input.startedAt.getTime());
    await getPrisma().$executeRaw`
      INSERT INTO "admin_run_log"
        ("id", "kind", "label", "status", "summary", "error", "started_at", "finished_at", "duration_ms")
      VALUES (
        ${id},
        ${input.kind},
        ${input.label},
        ${input.status},
        ${JSON.stringify(input.summary ?? {})}::jsonb,
        ${input.error ?? null},
        ${input.startedAt},
        ${input.finishedAt},
        ${durationMs}
      )
    `;
    return id;
  } catch (err) {
    console.error("[admin-run-log] record failed:", (err as Error).message);
    return null;
  }
}

export interface StoredAdminRun {
  id: string;
  kind: string;
  label: string;
  status: AdminRunStatus;
  summary: Record<string, unknown>;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

interface AdminRunRow {
  id: string;
  kind: string;
  label: string;
  status: string;
  summary: unknown;
  error: string | null;
  started_at: Date;
  finished_at: Date;
  duration_ms: number;
}

function mapRow(r: AdminRunRow): StoredAdminRun {
  return {
    id: r.id,
    kind: r.kind,
    label: r.label,
    status: r.status === "error" ? "error" : "ok",
    summary: (r.summary && typeof r.summary === "object" ? r.summary : {}) as Record<string, unknown>,
    error: r.error,
    startedAt: r.started_at.toISOString(),
    finishedAt: r.finished_at.toISOString(),
    durationMs: r.duration_ms,
  };
}

export async function getLatestAdminRun(): Promise<StoredAdminRun | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureTable();
    const rows = await getPrisma().$queryRaw<AdminRunRow[]>`
      SELECT "id", "kind", "label", "status", "summary", "error", "started_at", "finished_at", "duration_ms"
      FROM "admin_run_log"
      ORDER BY "started_at" DESC
      LIMIT 1
    `;
    return rows.length ? mapRow(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function listAdminRuns(limit = 10): Promise<StoredAdminRun[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureTable();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = await getPrisma().$queryRaw<AdminRunRow[]>`
      SELECT "id", "kind", "label", "status", "summary", "error", "started_at", "finished_at", "duration_ms"
      FROM "admin_run_log"
      ORDER BY "started_at" DESC
      LIMIT ${safeLimit}
    `;
    return rows.map(mapRow);
  } catch {
    return [];
  }
}
