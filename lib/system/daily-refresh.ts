// Daily-refresh orchestrator — THE single data pipeline.
// ──────────────────────────────────────────────────────
// One function runs the ENTIRE data refresh in order. There is no other
// scheduled pipeline: one daily cron (/api/cron/daily-refresh) calls this,
// the "Run full ingestion" admin button calls this, and /admin/pipeline-health
// shows every step's pass/fail + reason. Nothing ingests outside this.
//
//   1.  Sourcing          — fetch + extract evidence proposals from the manifest.
//   2.  Safe linkage      — auto-attach product scope to high-confidence proposals.
//   3.  Triage            — auto-approve proposals that pass the strict gate.
//   4.  Projection        — fold verified evidence into the read tables.
//   5.  Derive scores     — recompute overall/confidence/momentum from fresh data.
//   6.  Ranking snapshot  — capture today's scores for the trend graphs.
//   7.  Competitive intel — per-vendor web-search news monitor (Haiku→Sonnet→Opus).
//   7b. Market news       — broad AI press/commentary/benchmark RSS, Haiku-scored.
//   7c. Vendor press RSS  — one rotating vendor's press-release feed.
//   8.  Investor tools    — SEC financials, valuations, (weekly) IPO + analyst coverage.
//   9.  Reputation        — live GitHub signals.
//   10. Macro signals     — FRED + GDELT.
//   11. Watchlist alerts  — notify on triggered watchlist conditions.
//
// Cost tiering: heavy web-search steps (full 43-vendor competitive set, analyst
// coverage, IPO estimates) run weekly (Monday UTC) or on a forced run; daily
// runs cover the core-vendor news + all the cheap deterministic steps.
//
// Every step is independently failure-tolerant: a failure in one step records
// its error and the next step still runs. The function returns a structured
// summary the cron route serialises to JSON for logging.
//
// All 38 page routes in /app are `export const dynamic = "force-dynamic"`
// so any change written to the DB by this pipeline is immediately
// visible to a refresh — no cache invalidation step is needed.

import { runSourcing } from "../sourcing/runner";
import { submitExtractionBatch, collectExtractionBatches } from "../sourcing/batch-runner";
import { runWebEvidenceSweep } from "../sourcing/web-evidence-runner";
import { ensureVendorProfilesForSpine } from "../services/vendor-id-bridge";
import { runNewsSourcing } from "../sourcing/news-runner";
import { runMarketNewsIngestion } from "../sourcing/market-news-runner";
import { SOURCE_MANIFEST } from "../sourcing/manifest";
import { runSafeLinkageApply } from "../services/safe-linkage-runner";
import { runTriage } from "../services/triage-runner";
import { projectEvidenceToIntelligence, projectEvidenceToPillarScores } from "../services/intelligence-projector";
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
import { sweepMemberAuth } from "../member/auth";
import { deriveVendorScores } from "./derive-scores";
import { seedEloPillarScores } from "./elo-scores";
import { deriveMarketShareMovement } from "./derive-market-share";
import { deriveDependencySignals } from "../graph/derive-dependencies";
import { runDeliveryUpdateFromRecentNews } from "../delivery/news-update";
import { detectCategoryChanges } from "../services/category-change";
import { checkAndSendWatchlistAlerts } from "../watchlist/notify";
import { checkAndSendCompetitiveOverlapAlerts } from "../watchlist/competitive-overlap-notify";
import {
  persistRefreshReport,
  getLastRefreshRun,
  beginRun,
  updateRunProgress,
  finaliseRun,
  isRunActive,
} from "./daily-refresh-store";
import { getPrisma, hasDatabase } from "../prisma";
import { checkMigrationDrift } from "../db/migration-drift";
import { notifyMigrationDriftIfNeeded } from "../db/migration-drift-alert";
import { getKillSwitchState } from "./refresh-killswitch";
import { makeSpendGuard, recordCycleSpend } from "./spend-ledger";

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
  // ── Kill switch (hard stop) ─────────────────────────────────────────────
  // The single lever that halts ALL LLM spend. Checked FIRST — before the
  // dedup lock and before any step — and it guards `force` runs too because it
  // lives here in the orchestrator, not in the cron route. Either the
  // operator-owned env flag (REFRESH_KILL_SWITCH=1) or the runtime DB row can
  // trip it. A tripped switch is an intentional no-op (ok=true), not a failure.
  const killState = await getKillSwitchState();
  if (killState.active) {
    const ts = now.toISOString();
    console.warn(
      `[daily-refresh] kill switch active (${killState.source}) — skipping run. reason: ${killState.reason ?? "n/a"}`,
    );
    return {
      startedAt: ts,
      finishedAt: new Date().toISOString(),
      ok: true,
      databaseConfigured: hasDatabase(),
      steps: [
        {
          step: "kill_switch",
          ok: true,
          durationMs: 0,
          summary: { skipped: "kill_switch_active", source: killState.source, reason: killState.reason },
        },
      ],
      errors: [],
      totalTokensIn: 0,
      totalTokensOut: 0,
      estimatedCostUsd: 0,
    };
  }

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

  // ── Spend cap ───────────────────────────────────────────────────────────
  // Reads today's prior spend once, then accumulates this cycle's cost as steps
  // complete. The LLM-heavy steps below ask `spend.exhausted()` BEFORE running;
  // once the per-cycle ($5) or per-day ($25) cap is reached no further LLM step
  // starts. Cheap deterministic steps always run. Caps are env-overridable.
  const spend = await makeSpendGuard(now);

  /** Helper: run a step, push to `steps`, fold its cost into the spend guard,
   * persist progress. */
  async function trackedStep(stepName: string, fn: () => Promise<Record<string, unknown>>): Promise<void> {
    const report = await timed(stepName, fn);
    steps.push(report);
    spend.record(Number((report.summary as Record<string, unknown>).estimatedCostUsd) || 0);
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

  // ── 0. Schema-drift guard ───────────────────────────────────
  //     Runs FIRST, before any data step. Fails LOUD if the live DB is behind
  //     the migrations this code ships with — the exact failure mode where a
  //     preview branch looks migrated but the production DB silently isn't, so
  //     downstream steps write/read tables that don't exist. Non-fatal (every
  //     other step still runs); the result surfaces in /admin/pipeline-health.
  await trackedStep("schema_drift_check", async () => {
    const drift = await checkMigrationDrift();
    if (drift.status === "behind") {
      console.error(`[daily-refresh] ${drift.message}`);
      // Active alert (email), de-duped once/day per missing-set. Non-fatal.
      const alert = await notifyMigrationDriftIfNeeded(drift, { now });
      return { ...drift, alert } as unknown as Record<string, unknown>;
    }
    if (drift.status === "ahead" || drift.status === "check_failed") {
      console.warn(`[daily-refresh] ${drift.message}`);
    }
    return drift as unknown as Record<string, unknown>;
  });

  // ── 0a. Vendor-profile sync ─────────────────────────────────
  //      Ensure every spine vendor has a VendorProfile so EvidenceRecord FKs
  //      resolve for ALL vendors before any approval/projection downstream.
  await trackedStep("sync_vendor_profiles", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    const r = await ensureVendorProfilesForSpine(getPrisma());
    return r as unknown as Record<string, unknown>;
  });

  // ── 1. Sourcing ────────────────────────────────────────────
  await trackedStep("sourcing", async () => {
    if (spend.exhausted()) return { skipped: "spend_cap", ...spend.status() };

    // Two-phase Batch API mode (opt-in via SOURCING_BATCH_MODE=1). Extraction
    // runs ~50% cheaper but async: collect any batches submitted in prior cycles
    // (classify + persist), then submit THIS cycle's batch for collection next
    // cycle. Default OFF → the proven synchronous runner below is used as-is.
    if (process.env.SOURCING_BATCH_MODE === "1") {
      const collected = await collectExtractionBatches();
      const submitted = await submitExtractionBatch({ allVendors: isWeekly });
      return {
        mode: "batch",
        batchSubmitted: submitted.submitted,
        batchId: submitted.batchId,
        submitSkipped: submitted.skipped,
        fetchFailed: submitted.fetchFailed,
        batchesCollected: collected.batchesCollected,
        stillPending: collected.stillPending,
        proposalsPersisted: collected.proposalsPersisted,
        failedExtractions: collected.failedExtractions,
        collectErrors: collected.errors.length,
        tokensIn: collected.tokensIn,
        tokensOut: collected.tokensOut,
        estimatedCostUsd: collected.estimatedCostUsd,
      };
    }

    const r = await runSourcing({ persist: dbConfigured });
    return {
      runId: r.runId,
      sources: r.totals.sources,
      ok: r.totals.ok,
      failed: r.totals.failed,
      failedExtract: r.totals.failedExtract,
      firstError: r.totals.firstError,
      proposalsExtracted: r.totals.proposalsExtracted,
      proposalsPersisted: r.totals.proposalsPersisted,
      llmSource: r.llmSource,
      tokensIn: r.totals.tokensIn,
      tokensOut: r.totals.tokensOut,
      estimatedCostUsd: r.totals.estimatedCostUsd,
    };
  });

  // ── 1b. Roster-driven web_search evidence (weekly; cost-tiered) ──
  //     Discovers REAL, cited sources for EVERY vendor in the live roster across
  //     the pillar domains, so vendors without curated manifest URLs still accrue
  //     real evidence instead of floating at an un-audited seed baseline. Feeds
  //     the same triage → projection → pillar path as manifest sourcing. Weekly
  //     to bound web_search cost (or on a forced run).
  await trackedStep("web_evidence", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    if (!isWeekly) return { skipped: "weekly-only step (skipped on daily run)" };
    const vendors = await getPrisma().intelligenceVendor.findMany({ select: { id: true, name: true } });
    const r = await runWebEvidenceSweep(vendors);
    return {
      vendorsAttempted: r.vendorsAttempted,
      vendorsWithFindings: r.vendorsWithFindings,
      proposalsPersisted: r.proposalsPersisted,
      totalSearches: r.totalSearches,
      errorCount: r.errors.length,
      firstError: r.errors[0]?.error,
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
    // Keystone: fold verified evidence into per-pillar scores BEFORE
    // derive_scores (step 5) reads them, so ingested evidence actually moves
    // the headline overallScore / momentum / quadrant rather than recomputing
    // against frozen seed. Wrapped so a pillar-projection failure can't break
    // the rest of the projection step.
    let pillar = { pillarRowsUpserted: 0, vendorsTouched: 0, shifts: [] as { vendorId: string; pillar: string; from: number; to: number }[] };
    try {
      const p = await projectEvidenceToPillarScores(getPrisma(), now);
      pillar = { pillarRowsUpserted: p.pillarRowsUpserted, vendorsTouched: p.vendorsTouched, shifts: p.shifts };
    } catch (err) {
      console.error("[daily-refresh] pillar-score projection failed (capabilities/news still projected)", err);
    }
    return {
      scannedEvidenceRows: r.scannedEvidenceRows,
      capabilitiesUpserted: r.capabilitiesUpserted,
      newsUpserted: r.newsUpserted,
      vendorsSkipped: r.vendorsSkipped.length,
      pillarRowsUpserted: pillar.pillarRowsUpserted,
      pillarVendorsTouched: pillar.vendorsTouched,
      pillarShifts: pillar.shifts.length,
    };
  });

  // ── 4b. Detect vendor category / role changes from new capabilities ──
  //     Raises admin-review proposals when ingested evidence shows a vendor
  //     gaining a capability that implies a role it doesn't hold. NEVER
  //     auto-applied — an admin approves before the vendor's roleTags change.
  await trackedStep("category_change_detection", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    const r = await detectCategoryChanges();
    return r as unknown as Record<string, unknown>;
  });

  // ── 4c. Model-quality pillar from Arena ELO ────────────────
  //     Writes the model_quality pillar (openlm.ai Arena ELO, bare ids) so the
  //     model-provider ranking reflects raw model capability. Must run BEFORE
  //     derive_scores so overallScore folds it in this run. The evidence
  //     projector never touches model_quality, so this is the only writer.
  await trackedStep("model_quality_elo", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    const r = await seedEloPillarScores();
    return { updated: r.updated, skipped: r.skipped, notFound: r.notFound.length };
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

  // ── 5b. Market-share movement (momentum-adjusted, after derive_scores) ──
  await trackedStep("market_share_movement", async () => {
    const r = await deriveMarketShareMovement(now);
    return { rowsUpdated: r.rowsUpdated, topMovers: r.topMovers.length, skipped: r.skipped, reason: r.reason };
  });

  // ── 6. Ranking snapshot (incl. one-time backfill) ──────────
  await trackedStep("ranking_snapshot", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    // Backfill reconstructed pre-history for any vendor that LACKS it. Originally
    // this ran only when the whole table was empty, so vendors added after the
    // first run never got reconstructed history → flat, stubby hover-trend lines.
    // Now we target exactly the vendors with no backfill rows. Idempotent:
    // createMany(skipDuplicates) protects existing backfill rows and real captures.
    const prisma = getPrisma();
    const [haveBackfillRows, allVendors] = await Promise.all([
      prisma.vendorRankingSnapshot.findMany({
        where: { source: "backfill" },
        select: { vendorId: true },
        distinct: ["vendorId"],
      }),
      prisma.intelligenceVendor.findMany({ select: { id: true } }),
    ]);
    const haveBackfill = new Set(haveBackfillRows.map((r) => r.vendorId));
    const needBackfill = allVendors.map((v) => v.id).filter((id) => !haveBackfill.has(id));

    let backfill: { inserted: number; vendors: number; ran: boolean } = { inserted: 0, vendors: 0, ran: false };
    if (needBackfill.length > 0) {
      const r = await backfillRankingSnapshots(now, { vendorIds: needBackfill });
      backfill = { inserted: r.inserted, vendors: r.vendors, ran: true };
    }
    const capture = await captureRankingSnapshots(now);
    return { backfill, captured: capture.captured, snapshotDate: capture.snapshotDate };
  });

  // ── 6b. Dependency / encroachment graph edges ──────────────
  //     Deterministic projection of the curated, source-backed exposure data
  //     into DependencySignal rows (no LLM, no spend). Powers the /dependencies
  //     hero graph; idempotent via the (from,to,kind,direction) unique key.
  await trackedStep("derive_dependencies", async () => {
    const r = await deriveDependencySignals();
    return r as unknown as Record<string, unknown>;
  });

  // ── 7. Competitive-intel monitor ───────────────────────────
  await trackedStep("competitive_intel", async () => {
    if (spend.exhausted()) return { skipped: "spend_cap", ...spend.status() };
    // Daily: core vendors only. Weekly (Monday): full universe.
    const r = await runCompetitiveIntelMonitor(now, isWeekly ? {} : { targets: COMPETITIVE_CORE });
    return {
      cadence: isWeekly ? "weekly_full" : "daily_core",
      vendorsAttempted: r.vendorsAttempted,
      vendorsWithFindings: r.vendorsWithFindings,
      itemsUpserted: r.itemsUpserted,
      totalSearches: r.totalSearches,
      errorCount: r.errors.length,
      vendorsNoFindings: r.vendorsNoFindings,
      diagnostic: r.diagnostic,
      source: r.source,
      modelUsed: r.modelUsed,
      tokensIn: r.totalTokensIn,
      tokensOut: r.totalTokensOut,
      estimatedCostUsd: r.estimatedCostUsd,
    };
  });

  // ── 7b. Market news — broad AI/tech + commentary + benchmark RSS ──
  //     Haiku-scored, vendor-tagged, written to IntelligenceNewsItem.
  //     (Folded in from the former standalone sourcing-rolling cron.)
  await trackedStep("market_news", async () => {
    if (spend.exhausted()) return { skipped: "spend_cap", ...spend.status() };
    const r = await runMarketNewsIngestion();
    return {
      feedsFetched: r.feedsFetched,
      itemsScored: r.itemsScored,
      itemsUpserted: r.itemsUpserted,
      errorCount: r.errors.length,
      diagnostic: r.errors[0] ?? (r.itemsUpserted > 0 ? `${r.itemsUpserted} items upserted` : "no new relevant items"),
    };
  });

  // ── 7c. Vendor press-release RSS (one rotating vendor) ──────────
  //     (Folded in from the former standalone sourcing-news cron.)
  await trackedStep("sourcing_news", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    if (spend.exhausted()) return { skipped: "spend_cap", ...spend.status() };
    const newsVendors = [...new Set(
      SOURCE_MANIFEST.filter((e) => e.category === "press_release").map((e) => e.vendorId),
    )].sort();
    if (newsVendors.length === 0) return { skipped: "no_news_vendors" };
    const dayOfEpoch = Math.floor(now.getTime() / 86_400_000);
    const vendor = newsVendors[dayOfEpoch % newsVendors.length];
    const r = await runNewsSourcing(vendor);
    return {
      vendor,
      articlesDiscovered: r.totals.articlesDiscovered,
      articlesIngested: r.totals.articlesIngested,
      proposalsPersisted: r.totals.proposalsPersisted,
    };
  });

  // ── 7d. Delivery-partnership self-update (tiered: Haiku classify → Sonnet extract) ──
  //     Reads the news just ingested above and ADDs/UPGRADEs/marks-ended GSI×vendor
  //     delivery partnerships — ONLY from a real cited item, ONLY for known
  //     partner+vendor (no invention). Touches delivery_partnership rows only —
  //     never a vendor score (firewall). Respects the spend cap.
  await trackedStep("delivery_partnership_update", async () => {
    if (!dbConfigured) return { skipped: "no_database" };
    if (spend.exhausted()) return { skipped: "spend_cap", ...spend.status() };
    const r = await runDeliveryUpdateFromRecentNews({ now });
    return r as unknown as Record<string, unknown>;
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
    // The weekly web-search/LLM sub-steps respect the spend cap; the cheap
    // deterministic financials/valuations above always run.
    const runWeeklyLlm = isWeekly && !spend.exhausted();
    if (runWeeklyLlm) {
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
      cadence: runWeeklyLlm ? "weekly_full" : isWeekly ? "weekly_spend_capped" : "daily_financials_only",
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

  // ── 11. Watchlist alerts ───────────────────────────────────────
  await trackedStep("watchlist_alerts", async () => {
    const r = await checkAndSendWatchlistAlerts(now);
    return { sent: r.sent, checked: r.checked, errors: r.errors.length, firstError: r.errors[0] };
  });

  // ── 11b. Shortlist competitive-overlap alerts (email digest) ───
  //     For each watchlist (email + vendors), email a digest when a new entrant
  //     overlaps a tracked vendor. Resend-gated; non-critical.
  await trackedStep("competitive_overlap_alerts", async () => {
    const r = await checkAndSendCompetitiveOverlapAlerts();
    return r as unknown as Record<string, unknown>;
  });

  // ── 11c. Member auth housekeeping (delete consumed/expired tokens + sessions) ─
  //     Pure DB, no LLM/cost. Keeps the Phase-2 auth tables from growing unbounded.
  await trackedStep("member_auth_sweep", async () => {
    const r = await sweepMemberAuth();
    return r as unknown as Record<string, unknown>;
  });

  // Schema drift is a real failure even though the check step didn't throw:
  // promote it to a FAIL + error so the run reads red and the operator acts.
  const driftStep = steps.find((s) => s.step === "schema_drift_check");
  if (driftStep && (driftStep.summary as Record<string, unknown>).status === "behind") {
    driftStep.ok = false;
    driftStep.error = String((driftStep.summary as Record<string, unknown>).message ?? "Live DB is behind the code's migrations.");
  }

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

  // Record this cycle's actual spend to the day ledger so the per-day cap and
  // the next cycle's guard see it. Best-effort; never blocks the report.
  await recordCycleSpend({
    cycleId: progressId,
    costUsd: estimatedCostUsd,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    now,
  });

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
