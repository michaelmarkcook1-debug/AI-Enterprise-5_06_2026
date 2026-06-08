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
import { COMPETITIVE_CORE } from "../intelligence/competitive-targets";
import { fetchFinancialsForProviders } from "../investing/financials-live";
import { fetchValuationForProviders } from "../investing/valuation-live";
import { estimateAllIpoForecasts } from "../investing/ipo-estimator";
import { fetchAnalystCoverageForAllProviders } from "../investing/analyst-coverage";
import {
  saveAnalystCoverage,
  saveFinancials,
  saveIpoForecasts,
  saveValuations,
} from "../investing/live-cache";
import { INVESTMENT_PROVIDERS } from "../investing/seed";
import { fetchLiveGitHubSignals } from "../reputation/live-github";
import { fetchAllMacroSignals } from "../market-signals/live-macro";
import { deriveVendorScores } from "./derive-scores";
import {
  persistRefreshReport,
  getLastRefreshRun,
  beginRun,
  updateRunProgress,
  finaliseRun,
  isRunActive,
} from "./daily-refresh-store";
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
  totalTokensIn: number;
  totalTokensOut: number;
  estimatedCostUsd: number;
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

/**
 * Thrown when a concurrent pipeline run is detected. The cron route catches
 * this and returns 409 so the caller knows to back off rather than retry.
 */
export class DuplicateRunError extends Error {
  constructor() {
    super("A daily-refresh pipeline run is already in progress. Skipping to prevent duplicate spend.");
    this.name = "DuplicateRunError";
  }
}

export async function runDailyRefresh(
  now: Date = new Date(),
  opts: { force?: boolean } = {},
): Promise<DailyRefreshReport> {
  // ── Deduplication lock ─────────────────────────────────────────────────
  // Prevents two concurrent pipeline runs (e.g. Vercel cron + manual trigger
  // firing simultaneously) from both burning Anthropic credits. The lock is
  // DB-based: a live run keeps its `finished_at` updated every step, so a
  // recent `finished_at` with ok=false is a reliable "still running" signal.
  // `force=true` bypasses the lock for emergency admin re-runs.
  if (!opts.force && await isRunActive()) {
    throw new DuplicateRunError();
  }

  const startedAt = now.toISOString();
  const steps: StepReport[] = [];
  const dbConfigured = hasDatabase();

  // Progressive persistence — write a row NOW so even a mid-run crash
  // leaves an audit trail. Each step updates the row incrementally.
  const progressId = await beginRun(startedAt);

  /** Helper: run a step, push to `steps`, persist progress. */
  async function trackedStep(stepName: string, fn: () => Promise<Record<string, unknown>>): Promise<void> {
    steps.push(await timed(stepName, fn));
    if (progressId) {
      await updateRunProgress(progressId, steps).catch(() => {});
    }
  }
  // Cost control (cadence tiering): the expensive web-search steps —
  // full-universe competitive news, analyst coverage, IPO estimates — run only
  // on the weekly day (Monday UTC). Daily runs cover the core vendor news plus
  // all the deterministic/cheap steps (SEC financials, valuations, GitHub, macro).
  // A manual/forced run (the admin "Run full ingestion" button) executes
  // everything regardless of weekday.
  const isWeekly = opts.force === true || now.getUTCDay() === 1;

  // ── 1. Sourcing ────────────────────────────────────────────
  await trackedStep("sourcing", async () => {
    const r = await runSourcing({ persist: dbConfigured });
    return {
      runId: r.runId,
      sources: r.totals.sources,
      ok: r.totals.ok,
      failed: r.totals.failed,
      proposalsExtracted: r.totals.proposalsExtracted,
      proposalsPersisted: r.totals.proposalsPersisted,
      llmSource: r.llmSource,
      tokensIn: r.totals.tokensIn,
      tokensOut: r.totals.tokensOut,
      estimatedCostUsd: r.totals.estimatedCostUsd,
    };
  });

  // ── 2. Safe linkage ────────────────────────────────────────
  await trackedStep("safe_linkage", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    const r = await runSafeLinkageApply({ dryRun: false });
    return r as unknown as Record<string, unknown>;
  });

  // ── 3. Triage (auto-approve strict-gate proposals) ─────────
  await trackedStep("triage", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    const r = await runTriage({ dryRun: false });
    return r as unknown as Record<string, unknown>;
  });

  // ── 4. Projection — verified evidence → read tables ────────
  await trackedStep("projection", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    const r = await projectEvidenceToIntelligence(getPrisma());
    return {
      scannedEvidenceRows: r.scannedEvidenceRows,
      capabilitiesUpserted: r.capabilitiesUpserted,
      newsUpserted: r.newsUpserted,
      vendorsSkipped: r.vendorsSkipped.length,
    };
  });

  // ── 5. Derive headline scores from fresh evidence ──────────
  //     Recomputes IntelligenceVendor.overallScore + confidenceScore
  //     and VendorMomentum.{news,product}Velocity + momentumScore so
  //     the ranking algorithms and dashboard lists track the latest
  //     projected data. Must run AFTER projection.
  await trackedStep("derive_scores", async () => {
    const r = await deriveVendorScores(now);
    return r as unknown as Record<string, unknown>;
  });

  // ── 6. Ranking snapshot (incl. one-time backfill) ──────────
  await trackedStep("ranking_snapshot", async () => {
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
  });

  // ── 7. Competitive-intel monitor ───────────────────────────
  await trackedStep("competitive_intel", async () => {
    // Daily: core vendors only. Weekly (Monday): full universe.
    const r = await runCompetitiveIntelMonitor(now, isWeekly ? {} : { targets: COMPETITIVE_CORE });
    return {
      cadence: isWeekly ? "weekly_full" : "daily_core",
      vendorsAttempted: r.vendorsAttempted,
      vendorsWithFindings: r.vendorsWithFindings,
      itemsUpserted: r.itemsUpserted,
      totalSearches: r.totalSearches,
      errorCount: r.errors.length,
      source: r.source,
      modelUsed: r.modelUsed,
      tokensIn: r.totalTokensIn,
      tokensOut: r.totalTokensOut,
      estimatedCostUsd: r.estimatedCostUsd,
    };
  });

  // ── 8. Investor-tools live refresh ─────────────────────────
  //     SEC XBRL financials → Stooq+SEC valuations → IPO estimator
  //     (LLM + news, deterministic fallback) → analyst coverage scrape.
  //     Each sub-step records its own success/error count so the
  //     /admin/pipeline-health panel can surface which source failed.
  await trackedStep("investor_tools_refresh", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    const targets = INVESTMENT_PROVIDERS.filter((p) => p.exposureType !== "cash");

    // 8a. Financials — SEC XBRL primary, vendor IR fallback via Claude.
    const fin = await fetchFinancialsForProviders(targets);
    await saveFinancials(fin.metrics);
    const finFromSec = fin.reports.filter((r) => r.source === "sec_xbrl").length;
    const finFromIr = fin.reports.filter((r) => r.source === "ir_page_llm").length;
    const finErrors = fin.reports.filter((r) => r.error !== null).length;

    // 8b. Valuations — Stooq close × SEC shares outstanding.
    const val = await fetchValuationForProviders(targets, fin.metrics);
    await saveValuations(val.metrics);
    const valOk = val.reports.filter((r) => r.source !== "none").length;
    const valErrors = val.reports.filter((r) => r.error !== null).length;

    // 8c + 8d are web-search-heavy (LLM + web_search) and don't move daily —
    // run them only on the weekly day. SEC financials + valuations (8a/8b above)
    // stay daily because they're deterministic/cheap.
    let ipoFromLlm = 0, ipoFromDeterministic = 0, acItems = 0, acVendorsWithCoverage = 0, acErrors = 0;
    if (isWeekly) {
      // 8c. IPO forecasts — LLM + news, deterministic fallback.
      const ipo = await estimateAllIpoForecasts();
      await saveIpoForecasts(ipo.forecasts);
      ipoFromLlm = ipo.reports.filter((r) => r.source === "llm").length;
      ipoFromDeterministic = ipo.reports.filter((r) => r.source === "deterministic").length;

      // 8d. Analyst coverage — curated web scrape via Claude.
      const ac = await fetchAnalystCoverageForAllProviders();
      await saveAnalystCoverage(ac.items);
      acItems = ac.items.length;
      acVendorsWithCoverage = new Set(ac.items.map((i) => i.providerId)).size;
      acErrors = ac.reports.filter((r) => r.error !== null).length;
    }

    return {
      cadence: isWeekly ? "weekly_full" : "daily_financials_only",
      financialsFromSec: finFromSec,
      financialsFromIrFallback: finFromIr,
      financialsErrors: finErrors,
      financialsRows: fin.metrics.length,
      valuationsComputed: valOk,
      valuationsErrors: valErrors,
      ipoForecastsLlm: ipoFromLlm,
      ipoForecastsDeterministic: ipoFromDeterministic,
      analystCoverageItems: acItems,
      analystCoverageVendors: acVendorsWithCoverage,
      analystCoverageErrors: acErrors,
    };
  });

  // ── 9. Live reputation (GitHub API — no Anthropic needed) ────
  await trackedStep("reputation_github", async () => {
    const signals = await fetchLiveGitHubSignals();
    return {
      vendorsFetched: signals.length,
      source: "github_api",
    };
  });

  // ── 10. Live macro signals (FRED + GDELT — no Anthropic needed) ─
  await trackedStep("macro_signals", async () => {
    const signals = await fetchAllMacroSignals();
    return {
      signalsFetched: signals.length,
      sources: [...new Set(signals.map((s) => s.source))],
    };
  });

  const errors = steps.flatMap((s) => (s.error ? [`${s.step}: ${s.error}`] : []));

  // Roll up token usage + cost across all LLM-backed steps.
  const totalTokensIn  = steps.reduce((s, step) => s + (Number((step.summary as Record<string, unknown>).tokensIn)  || 0), 0);
  const totalTokensOut = steps.reduce((s, step) => s + (Number((step.summary as Record<string, unknown>).tokensOut) || 0), 0);
  const estimatedCostUsd = parseFloat(
    steps.reduce((s, step) => s + (Number((step.summary as Record<string, unknown>).estimatedCostUsd) || 0), 0).toFixed(4),
  );

  const report: DailyRefreshReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: errors.length === 0,
    databaseConfigured: dbConfigured,
    steps,
    errors,
    totalTokensIn,
    totalTokensOut,
    estimatedCostUsd,
  };

  // Finalise the progressive-persistence row (marks ok + final errors).
  // Also persist the legacy full-report row for backward compat.
  if (progressId) {
    await finaliseRun(progressId, report.ok, errors);
  } else {
    // Fallback: progressive row wasn't created (DB was down at start?).
    await persistRefreshReport(report);
  }

  return report;
}

/**
 * Returns the timestamp of the most-recent daily-refresh run, used by
 * the TopNav "Data refreshed" badge. Reads directly from the persistent
 * daily_refresh_runs log; falls back to the most-recent ranking-snapshot
 * capture for the period before the first persisted run lands. Returns
 * null when the database isn't configured.
 */
export async function getLastRefreshedAt(): Promise<Date | null> {
  if (!hasDatabase()) return null;
  try {
    const run = await getLastRefreshRun();
    if (run) return new Date(run.finishedAt);
  } catch {}
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
