// Competitive-intel batch-job store.
// ──────────────────────────────────
// Tracks Anthropic Message Batches submitted by the two-phase competitive-intel
// analyst flow (lib/intelligence/competitive-monitor-batch.ts). The Batches API
// is ~50% cheaper but async (up to a 24h SLA), so it cannot complete inside one
// cron run. Instead:
//
//   cron run N    → run Stage 1/2 (web search + classify) synchronously, submit
//                   ONE batch of Stage-3 (Opus analyst) requests, store its id here
//   cron run N+1  → find ended batches here, fetch results, assemble + upsert
//                   IntelligenceNewsItem exactly as the synchronous monitor does
//
// One row per submitted batch. `request_map` is the custom_id (= vendorId) →
// analyst-context map needed to assemble + persist each result (results come
// back unordered and keyed only by custom_id). Mirrors the sourcing batch-store
// (lib/sourcing/batch-store.ts): self-migrating CREATE TABLE IF NOT EXISTS on
// first touch, parameterised writes, hasDatabase() guard, best-effort.

import { getPrisma, hasDatabase } from "../prisma";
import type { ClassifiedFinding, RawFinding } from "./competitive-monitor";

/** Per-vendor Stage-1/2 output captured at submit time, keyed by custom_id
 *  (= vendorId). Everything the collector needs to turn the batched analyst
 *  response into final findings and upsert them. */
export interface IntelBatchVendorContext {
  vendorName: string;
  classified: ClassifiedFinding[];
  rawItems: RawFinding[];
}

export type IntelBatchJobStatus = "submitted" | "collected" | "failed";

export interface IntelBatchJob {
  id: string;
  batchId: string;
  runId: string;
  status: IntelBatchJobStatus;
  vendorCount: number;
  requestMap: Record<string, IntelBatchVendorContext>;
  submittedAt: string;
  collectedAt: string | null;
  costUsd: number | null;
  error: string | null;
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "intel_batch_jobs" (
  "id"           TEXT PRIMARY KEY,
  "batch_id"     TEXT NOT NULL,
  "run_id"       TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'submitted',
  "vendor_count" INTEGER NOT NULL DEFAULT 0,
  "request_map"  JSONB NOT NULL DEFAULT '{}',
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "collected_at" TIMESTAMP(3),
  "cost_usd"     DOUBLE PRECISION,
  "error"        TEXT
);
CREATE INDEX IF NOT EXISTS "intel_batch_jobs_status_idx"
  ON "intel_batch_jobs" ("status", "submitted_at");
`;

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

function randomId(): string {
  return `ibatch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

interface RawRow {
  id: string;
  batch_id: string;
  run_id: string;
  status: string;
  vendor_count: number;
  request_map: unknown;
  submitted_at: Date;
  collected_at: Date | null;
  cost_usd: number | null;
  error: string | null;
}

function mapRow(r: RawRow): IntelBatchJob {
  return {
    id: r.id,
    batchId: r.batch_id,
    runId: r.run_id,
    status: r.status as IntelBatchJobStatus,
    vendorCount: r.vendor_count,
    requestMap: (r.request_map ?? {}) as Record<string, IntelBatchVendorContext>,
    submittedAt: r.submitted_at.toISOString(),
    collectedAt: r.collected_at ? r.collected_at.toISOString() : null,
    costUsd: r.cost_usd,
    error: r.error,
  };
}

/** Record a freshly-submitted batch. Best-effort; returns null without a DB. */
export async function recordSubmittedIntelBatch(input: {
  batchId: string;
  runId: string;
  vendorCount: number;
  requestMap: Record<string, IntelBatchVendorContext>;
}): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureTable();
    const id = randomId();
    await getPrisma().$executeRaw`
      INSERT INTO "intel_batch_jobs"
        ("id", "batch_id", "run_id", "status", "vendor_count", "request_map")
      VALUES (
        ${id}, ${input.batchId}, ${input.runId}, ${"submitted"},
        ${input.vendorCount}, ${JSON.stringify(input.requestMap)}::jsonb
      )
    `;
    return id;
  } catch (err) {
    console.error("[intel-batch-store] recordSubmittedIntelBatch failed:", (err as Error).message);
    return null;
  }
}

/** Batches still awaiting collection (oldest first). Empty without a DB. */
export async function listPendingIntelBatches(): Promise<IntelBatchJob[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureTable();
    const rows = await getPrisma().$queryRaw<RawRow[]>`
      SELECT * FROM "intel_batch_jobs"
      WHERE "status" = ${"submitted"}
      ORDER BY "submitted_at" ASC
    `;
    return rows.map(mapRow);
  } catch (err) {
    console.error("[intel-batch-store] listPendingIntelBatches failed:", (err as Error).message);
    return [];
  }
}

/** Mark a batch collected with its realised (batch-discounted) analyst cost. */
export async function markIntelBatchCollected(id: string, costUsd: number): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await ensureTable();
    await getPrisma().$executeRaw`
      UPDATE "intel_batch_jobs"
      SET "status" = ${"collected"}, "collected_at" = CURRENT_TIMESTAMP, "cost_usd" = ${costUsd}
      WHERE "id" = ${id}
    `;
  } catch (err) {
    console.error("[intel-batch-store] markIntelBatchCollected failed:", (err as Error).message);
  }
}

/** Mark a batch failed (e.g. results unretrievable / expired / stuck past SLA). */
export async function markIntelBatchFailed(id: string, error: string): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await ensureTable();
    await getPrisma().$executeRaw`
      UPDATE "intel_batch_jobs"
      SET "status" = ${"failed"}, "collected_at" = CURRENT_TIMESTAMP, "error" = ${error.slice(0, 500)}
      WHERE "id" = ${id}
    `;
  } catch (err) {
    console.error("[intel-batch-store] markIntelBatchFailed failed:", (err as Error).message);
  }
}
