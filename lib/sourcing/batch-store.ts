// Sourcing batch-job store.
// ─────────────────────────
// Tracks Anthropic Message Batches submitted by the two-phase sourcing flow
// (lib/sourcing/batch-runner.ts). The Batches API is ~50% cheaper but async
// (up to a 24h SLA), so it cannot complete inside one 600s cron run. Instead:
//
//   cron run N    → submit a batch of extraction requests, store its id here
//   cron run N+1  → find ended batches here, fetch results, classify + persist
//
// One row per submitted batch. `request_map` is the custom_id → source-context
// map needed to classify + persist each result (results come back unordered and
// keyed only by custom_id). Follows the self-migrating raw-SQL store pattern
// used across lib/system (admin-run-log.ts): CREATE TABLE IF NOT EXISTS on first
// touch, parameterised writes, hasDatabase() guard, best-effort.

import { getPrisma, hasDatabase } from "../prisma";

/** Per-request context captured at submit time, keyed by custom_id. */
export interface BatchRequestContext {
  vendorId: string;
  category: string;
  sourceUrl: string;
}

export type BatchJobStatus = "submitted" | "collected" | "failed";

export interface SourcingBatchJob {
  id: string;
  batchId: string;
  runId: string;
  status: BatchJobStatus;
  sourceCount: number;
  requestMap: Record<string, BatchRequestContext>;
  submittedAt: string;
  collectedAt: string | null;
  costUsd: number | null;
  error: string | null;
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "sourcing_batch_jobs" (
  "id"           TEXT PRIMARY KEY,
  "batch_id"     TEXT NOT NULL,
  "run_id"       TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'submitted',
  "source_count" INTEGER NOT NULL DEFAULT 0,
  "request_map"  JSONB NOT NULL DEFAULT '{}',
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "collected_at" TIMESTAMP(3),
  "cost_usd"     DOUBLE PRECISION,
  "error"        TEXT
);
CREATE INDEX IF NOT EXISTS "sourcing_batch_jobs_status_idx"
  ON "sourcing_batch_jobs" ("status", "submitted_at");
`;

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

function randomId(): string {
  return `sbatch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

interface RawRow {
  id: string;
  batch_id: string;
  run_id: string;
  status: string;
  source_count: number;
  request_map: unknown;
  submitted_at: Date;
  collected_at: Date | null;
  cost_usd: number | null;
  error: string | null;
}

function mapRow(r: RawRow): SourcingBatchJob {
  return {
    id: r.id,
    batchId: r.batch_id,
    runId: r.run_id,
    status: r.status as BatchJobStatus,
    sourceCount: r.source_count,
    requestMap: (r.request_map ?? {}) as Record<string, BatchRequestContext>,
    submittedAt: r.submitted_at.toISOString(),
    collectedAt: r.collected_at ? r.collected_at.toISOString() : null,
    costUsd: r.cost_usd,
    error: r.error,
  };
}

/** Record a freshly-submitted batch. Best-effort; returns null without a DB. */
export async function recordSubmittedBatch(input: {
  batchId: string;
  runId: string;
  sourceCount: number;
  requestMap: Record<string, BatchRequestContext>;
}): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureTable();
    const id = randomId();
    await getPrisma().$executeRaw`
      INSERT INTO "sourcing_batch_jobs"
        ("id", "batch_id", "run_id", "status", "source_count", "request_map")
      VALUES (
        ${id}, ${input.batchId}, ${input.runId}, ${"submitted"},
        ${input.sourceCount}, ${JSON.stringify(input.requestMap)}::jsonb
      )
    `;
    return id;
  } catch (err) {
    console.error("[batch-store] recordSubmittedBatch failed:", (err as Error).message);
    return null;
  }
}

/** Batches still awaiting collection (oldest first). Empty without a DB. */
export async function listPendingBatches(): Promise<SourcingBatchJob[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureTable();
    const rows = await getPrisma().$queryRaw<RawRow[]>`
      SELECT * FROM "sourcing_batch_jobs"
      WHERE "status" = ${"submitted"}
      ORDER BY "submitted_at" ASC
    `;
    return rows.map(mapRow);
  } catch (err) {
    console.error("[batch-store] listPendingBatches failed:", (err as Error).message);
    return [];
  }
}

/** Mark a batch collected with its realised (batch-discounted) cost. */
export async function markBatchCollected(id: string, costUsd: number): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await ensureTable();
    await getPrisma().$executeRaw`
      UPDATE "sourcing_batch_jobs"
      SET "status" = ${"collected"}, "collected_at" = CURRENT_TIMESTAMP, "cost_usd" = ${costUsd}
      WHERE "id" = ${id}
    `;
  } catch (err) {
    console.error("[batch-store] markBatchCollected failed:", (err as Error).message);
  }
}

/** Mark a batch failed (e.g. results unretrievable / expired). */
export async function markBatchFailed(id: string, error: string): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await ensureTable();
    await getPrisma().$executeRaw`
      UPDATE "sourcing_batch_jobs"
      SET "status" = ${"failed"}, "collected_at" = CURRENT_TIMESTAMP, "error" = ${error.slice(0, 500)}
      WHERE "id" = ${id}
    `;
  } catch (err) {
    console.error("[batch-store] markBatchFailed failed:", (err as Error).message);
  }
}
