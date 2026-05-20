// Daily-refresh orchestrator.
// ──────────────────────────
// One function that runs the entire data-refresh pipeline in order:
//
//   1. Sourcing         — fetch + extract proposals from the manifest.
//   2. Safe linkage     — auto-attach product scope to high-confidence
//                         proposals.
//   3. Triage           — auto-approve proposals that pass the strict
//                         gate (E2+, ≥0.85 confidence, etc.).
//   4. Projection       — fold verified evidence into the read tables
//                         the dashboard / news / capabilities pages
//                         render from.
//   5. Ranking snapshot — capture today's overall + momentum scores
//                         for the trend graphs.
//   6. Competitive intel— refresh the 13-vendor news monitor.
//
// Every step is independently failure-tolerant: a failure in one step
// records its error and the next step still runs. The function returns
// a structured summary the cron route serialises to JSON for logging.
//
// All 38 page routes in /app are `export const dynamic = "force-dynamic"`
// so any change written to the DB by this pipeline is immediately
// visible to a refresh — no cache invalidation step is needed.

import { runSourcing } from "../sourcing/runner";
import { runSafeLinkageApply } from "../services/safe-linkage-runner";
import { runTriage } from "../services/triage-runner";
import { projectEvidenceToIntelligence } from "../services/intelligence-projector";
import {
  captureRankingSnapshots,
  backfillRankingSnapshots,
} from "../intelligence/ranking-snapshots";
import { runCompetitiveIntelMonitor } from "../intelligence/competitive-monitor";
import { getPrisma, hasDatabase } from "../prisma";

interface StepReport {
  step: string;
  ok: boolean;
  durationMs: number;
  summary: Record<string, unknown>;
  error?: string;
}

export interface DailyRefreshReport {
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  databaseConfigured: boolean;
  steps: StepReport[];
  errors: string[];
}

async function timed<T>(step: string, fn: () => Promise<T>): Promise<StepReport> {
  const t0 = Date.now();
  try {
    const summary = await fn();
    return {
      step,
      ok: true,
      durationMs: Date.now() - t0,
      summary: (summary as Record<string, unknown>) ?? {},
    };
  } catch (err) {
    return {
      step,
      ok: false,
      durationMs: Date.now() - t0,
      summary: {},
      error: (err as Error).message,
    };
  }
}

export async function runDailyRefresh(now: Date = new Date()): Promise<DailyRefreshReport> {
  const startedAt = now.toISOString();
  const steps: StepReport[] = [];
  const dbConfigured = hasDatabase();

  // ── 1. Sourcing ────────────────────────────────────────────
  steps.push(await timed("sourcing", async () => {
    const r = await runSourcing({ persist: dbConfigured });
    return {
      runId: r.runId,
      sources: r.totals.sources,
      ok: r.totals.ok,
      failed: r.totals.failed,
      proposalsExtracted: r.totals.proposalsExtracted,
      proposalsPersisted: r.totals.proposalsPersisted,
      llmSource: r.llmSource,
    };
  }));

  // ── 2. Safe linkage ────────────────────────────────────────
  steps.push(await timed("safe_linkage", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    const r = await runSafeLinkageApply({ dryRun: false });
    return r as unknown as Record<string, unknown>;
  }));

  // ── 3. Triage (auto-approve strict-gate proposals) ─────────
  steps.push(await timed("triage", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    const r = await runTriage({ dryRun: false });
    return r as unknown as Record<string, unknown>;
  }));

  // ── 4. Projection — verified evidence → read tables ────────
  steps.push(await timed("projection", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    const r = await projectEvidenceToIntelligence(getPrisma());
    return {
      scannedEvidenceRows: r.scannedEvidenceRows,
      capabilitiesUpserted: r.capabilitiesUpserted,
      newsUpserted: r.newsUpserted,
      vendorsSkipped: r.vendorsSkipped.length,
    };
  }));

  // ── 5. Ranking snapshot (incl. one-time backfill) ──────────
  steps.push(await timed("ranking_snapshot", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    // Backfill only if the snapshot table is empty.
    const existing = await getPrisma().vendorRankingSnapshot.count();
    let backfill: { inserted: number; vendors: number; ran: boolean } = { inserted: 0, vendors: 0, ran: false };
    if (existing === 0) {
      const r = await backfillRankingSnapshots(now);
      backfill = { inserted: r.inserted, vendors: r.vendors, ran: true };
    }
    const capture = await captureRankingSnapshots(now);
    return { backfill, captured: capture.captured, snapshotDate: capture.snapshotDate };
  }));

  // ── 6. Competitive-intel monitor ───────────────────────────
  steps.push(await timed("competitive_intel", async () => {
    const r = await runCompetitiveIntelMonitor(now);
    return {
      vendorsAttempted: r.vendorsAttempted,
      vendorsWithFindings: r.vendorsWithFindings,
      itemsUpserted: r.itemsUpserted,
      totalSearches: r.totalSearches,
      errorCount: r.errors.length,
      source: r.source,
    };
  }));

  const errors = steps.flatMap((s) => (s.error ? [`${s.step}: ${s.error}`] : []));
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: errors.length === 0,
    databaseConfigured: dbConfigured,
    steps,
    errors,
  };
}

/**
 * Returns the timestamp of the most-recent ranking-snapshot capture,
 * used by the TopNav "Data refreshed" badge as a proxy for "when did
 * the daily pipeline last successfully run". Returns null when the
 * database isn't configured or no snapshot has been taken yet.
 */
export async function getLastRefreshedAt(): Promise<Date | null> {
  if (!hasDatabase()) return null;
  try {
    const row = await getPrisma().vendorRankingSnapshot.findFirst({
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    });
    return row?.capturedAt ?? null;
  } catch {
    return null;
  }
}
