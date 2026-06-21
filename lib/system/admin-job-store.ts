// Generic in-flight admin-job store.
// ──────────────────────────────────
// Tracks the LIVE state of operator-triggered admin actions (web-evidence
// sweeps, evidence sourcing, manual ingestion, …) so they survive the user
// navigating away from /admin/ingestion: the route schedules the real work via
// after() and records progress here; the console polls /api/admin/jobs/status
// and re-attaches to an in-flight job on mount.
//
// Deliberately SEPARATE from:
//   - admin_run_log  (completion-only; powers the durable "last run" banner)
//   - daily_refresh_runs (the daily-pipeline lock; isRunActive)
// so ad-hoc admin actions never collide with the daily cron lock or pollute
// pipeline-health history.
//
// Self-migrating (CREATE TABLE IF NOT EXISTS — same approach as the other two
// raw-SQL stores, no `prisma migrate deploy` needed). All writes are
// best-effort: a logging failure must never break the actual run.

import { getPrisma, hasDatabase } from "../prisma";

// A job started within this window is "recent"; one whose heartbeat
// (finished_at, bumped on every progress update) is older than HEARTBEAT is
// treated as crashed so a stale 'running' row never permanently locks a kind.
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const HEARTBEAT_MS = 3 * 60 * 1000;

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "admin_jobs" (
  "id"          TEXT PRIMARY KEY,
  "kind"        TEXT NOT NULL,
  "label"       TEXT NOT NULL DEFAULT '',
  "status"      TEXT NOT NULL,
  "progress"    JSONB NOT NULL DEFAULT '{}',
  "result"      JSONB NOT NULL DEFAULT '{}',
  "error"       TEXT,
  "started_at"  TIMESTAMP(3) NOT NULL,
  "finished_at" TIMESTAMP(3) NOT NULL,
  "duration_ms" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "admin_jobs_kind_started_idx"
  ON "admin_jobs" ("kind", "started_at" DESC);
`;

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

function randomId(): string {
  return `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export type AdminJobStatus = "running" | "ok" | "error";

export interface AdminJob {
  id: string;
  kind: string;
  label: string;
  status: AdminJobStatus;
  progress: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

/** Insert a 'running' job row and return its id. Best-effort. */
export async function beginJob(kind: string, label: string): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureTable();
    const id = randomId();
    const now = new Date();
    await getPrisma().$executeRaw`
      INSERT INTO "admin_jobs"
        ("id","kind","label","status","progress","result","error","started_at","finished_at","duration_ms")
      VALUES (${id}, ${kind}, ${label}, 'running', '{}'::jsonb, '{}'::jsonb, NULL, ${now}, ${now}, 0)
    `;
    return id;
  } catch (err) {
    console.error("[admin-job-store] begin failed:", (err as Error).message);
    return null;
  }
}

/** Heartbeat + progress snapshot. Bumps finished_at so isJobActive stays true. */
export async function updateJobProgress(id: string | null, progress: Record<string, unknown>): Promise<void> {
  if (!id || !hasDatabase()) return;
  try {
    await getPrisma().$executeRaw`
      UPDATE "admin_jobs"
      SET "progress" = ${JSON.stringify(progress)}::jsonb, "finished_at" = ${new Date()}
      WHERE "id" = ${id}
    `;
  } catch {
    /* best-effort heartbeat */
  }
}

/** Mark a job complete (ok|error) with a compact result. Best-effort. */
export async function finaliseJob(
  id: string | null,
  status: AdminJobStatus,
  result?: Record<string, unknown>,
  error?: string | null,
): Promise<void> {
  if (!id || !hasDatabase()) return;
  try {
    const now = new Date();
    await getPrisma().$executeRaw`
      UPDATE "admin_jobs"
      SET "status" = ${status},
          "result" = ${JSON.stringify(result ?? {})}::jsonb,
          "error" = ${error ?? null},
          "finished_at" = ${now},
          "duration_ms" = GREATEST(0, (EXTRACT(EPOCH FROM (${now} - "started_at")) * 1000)::int)
      WHERE "id" = ${id}
    `;
  } catch (err) {
    console.error("[admin-job-store] finalise failed:", (err as Error).message);
  }
}

interface JobRow {
  id: string; kind: string; label: string; status: string;
  progress: Record<string, unknown> | null; result: Record<string, unknown> | null;
  error: string | null; started_at: Date | string; finished_at: Date | string; duration_ms: number | null;
}

function mapRow(r: JobRow): AdminJob {
  const toIso = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toISOString();
  return {
    id: r.id, kind: r.kind, label: r.label, status: r.status as AdminJobStatus,
    progress: r.progress ?? {}, result: r.result ?? {}, error: r.error ?? null,
    startedAt: toIso(r.started_at), finishedAt: toIso(r.finished_at), durationMs: r.duration_ms ?? 0,
  };
}

export async function getLatestJob(kind?: string): Promise<AdminJob | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureTable();
    const rows = kind
      ? await getPrisma().$queryRaw<JobRow[]>`SELECT * FROM "admin_jobs" WHERE "kind" = ${kind} ORDER BY "started_at" DESC LIMIT 1`
      : await getPrisma().$queryRaw<JobRow[]>`SELECT * FROM "admin_jobs" ORDER BY "started_at" DESC LIMIT 1`;
    return rows[0] ? mapRow(rows[0]) : null;
  } catch {
    return null;
  }
}

/** A job is active when its latest row is 'running', started recently, and its
 *  heartbeat is warm — so a crashed/torn-down run auto-clears after HEARTBEAT. */
export async function isJobActive(kind?: string): Promise<boolean> {
  const job = await getLatestJob(kind);
  if (!job || job.status !== "running") return false;
  const now = Date.now();
  return now - new Date(job.startedAt).getTime() < LOCK_WINDOW_MS
    && now - new Date(job.finishedAt).getTime() < HEARTBEAT_MS;
}

/** All currently-warm running jobs (for the console to re-attach on mount). */
export async function listActiveJobs(): Promise<AdminJob[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureTable();
    const rows = await getPrisma().$queryRaw<JobRow[]>`
      SELECT * FROM "admin_jobs" WHERE "status" = 'running' ORDER BY "started_at" DESC LIMIT 20
    `;
    const now = Date.now();
    return rows.map(mapRow).filter((j) => now - new Date(j.finishedAt).getTime() < HEARTBEAT_MS);
  } catch {
    return [];
  }
}
