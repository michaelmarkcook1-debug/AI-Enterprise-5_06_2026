"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { estimateIngestionCost } from "@/lib/ingestion/cost-model";
import { useBackgroundJob, type BackgroundJob } from "./useBackgroundJob";

interface Job {
  id: string;
  vendorId: string;
  status: string;
  proposalsCount: number;
  createdAt: string;
  error?: string;
}

interface LastRun {
  id: string;
  kind: string;
  label: string;
  status: "ok" | "error";
  summary: Record<string, unknown>;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

const SOURCE_CATEGORIES = [
  "vendor_docs", "trust_center", "pricing_page", "status_page", "changelog",
  "public_filing", "job_posting", "review_platform", "marketplace", "github",
  "analyst_report", "press_release",
] as const;

// The projector caps each recompute at 5,000 evidence rows (see
// intelligence-projector rowLimit) — surface that ceiling honestly if a run hits it.
// 2026-07 fix: the recompute now pages through ALL verified rows — this is the
// runaway-safety CEILING only (matches intelligence-projector.ts), not a per-run
// cap. Was 5,000, which silently dropped the oldest rows once the corpus grew.
const RECOMPUTE_ROW_CAP = 50000;

export default function IngestionConsole({
  hasDatabase,
  vendors,
  initialJobs,
  newsVendors,
  lastRun,
  activeJobs,
  verifiedSignals,
}: {
  hasDatabase: boolean;
  vendors: { id: string; name: string }[];
  initialJobs: Job[];
  newsVendors: { id: string; name: string }[];
  lastRun: LastRun | null;
  /** In-flight background jobs at page-load, keyed by kind — lets the console
   *  re-attach to a run that started before the user navigated back. */
  activeJobs?: Record<string, BackgroundJob | null>;
  /** Count of analyst_verified evidence rows a recompute will project (live DB
   *  count; matches scannedEvidenceRows in the result). null when no database. */
  verifiedSignals?: number | null;
}) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [token, setToken] = useState("");

  // ── Rolling ingest + news + market: server-side background jobs ─────────────
  // Each runs via after() (admin_jobs) so it survives navigating away; the hook
  // fires the start endpoint, polls status, and re-attaches to an in-flight run
  // on mount. Standard sourcing (single + batch) shares kind "sourcing"; news
  // shares "news_sourcing"; the market feed is "news_feed".
  const sourcingJob = useBackgroundJob("sourcing", { token, initialActive: activeJobs?.sourcing ?? null });
  const marketJob = useBackgroundJob("news_feed", { token, initialActive: activeJobs?.news_feed ?? null });

  // ── Recompute state (project evidence → scores, no LLM cost) ────────────
  const [busyRecompute, setBusyRecompute] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<string | null>(null);
  const [recomputeError, setRecomputeError] = useState<string | null>(null);

  // ── Arena ELO seed state (openlm.ai/chatbot-arena/) ─────────────────────
  const [busyElo, setBusyElo] = useState(false);
  const [eloResult, setEloResult] = useState<string | null>(null);
  const [eloError, setEloError] = useState<string | null>(null);

  // ── Fill evidence gaps: web_search-source vendors with limited/no evidence ─
  // Web-evidence gap-sourcing runs server-side via after() (admin_jobs), so it
  // survives navigating away from this tab. The hook fires the start endpoint,
  // polls /api/admin/jobs/status, and re-attaches to an in-flight run on mount.
  const gapsJob = useBackgroundJob("web_evidence", { token, initialActive: activeJobs?.web_evidence ?? null });

  // ── News sourcing: server-side background job (kind "news_sourcing") ───────
  const newsJob = useBackgroundJob("news_sourcing", { token, initialActive: activeJobs?.news_sourcing ?? null });

  // ── Multi-vendor selection (batch runs) ─────────────────────────────────
  const [stdSelected, setStdSelected] = useState<string[]>([]);
  const [newsSelected, setNewsSelected] = useState<string[]>([]);

  // Refresh the jobs table while any sourcing/news job is in flight so newly
  // created EvidenceProposal jobs appear without a manual reload.
  const anySourcingBusy = sourcingJob.busy || newsJob.busy;
  useEffect(() => {
    if (!anySourcingBusy) return;
    const t = setInterval(() => { void refreshJobs(); }, 5000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anySourcingBusy]);

  // Derived result/error banners from the completed background jobs.
  const ingestResult = sourcingResultText(sourcingJob);
  const ingestError = sourcingJob.error ?? (sourcingJob.job?.status === "error" ? sourcingJob.job.error : null);
  const newsResult = sourcingResultText(newsJob);
  const newsError = newsJob.error ?? (newsJob.job?.status === "error" ? newsJob.job.error : null);
  const marketResult = sourcingResultText(marketJob);
  const marketError = marketJob.error ?? (marketJob.job?.status === "error" ? marketJob.job.error : null);

  // ── Advanced paste-form state ───────────────────────────────────────────
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [sourceCategory, setSourceCategory] = useState<typeof SOURCE_CATEGORIES[number]>("trust_center");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [busyManual, setBusyManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualResult, setManualResult] = useState<string | null>(null);

  async function refreshJobs() {
    if (!hasDatabase) return;
    const j = await fetch("/api/admin/ingestion/jobs", {
      headers: token ? { "x-admin-token": token } : {},
    }).then((r) => r.json()).catch(() => ({ jobs: [] }));
    if (j.jobs) {
      setJobs(j.jobs.map((row: { id: string; vendorId: string; status: string; proposalsCount: number; createdAt: string; error: string | null }) => ({
        id: row.id, vendorId: row.vendorId, status: row.status,
        proposalsCount: row.proposalsCount, createdAt: row.createdAt, error: row.error ?? undefined,
      })));
    }
  }

  // Today's rotation vendor. Runs server-side via after() — safe to leave the tab.
  function ingestNow() {
    void sourcingJob.fire(`/api/admin/sourcing/run`, { persist: true });
  }

  function ingestNews(vendorOverride?: string) {
    // News sourcing is per-vendor; default to today's rotating news vendor.
    let vendor = vendorOverride;
    if (!vendor && newsVendors.length > 0) {
      const dayOfEpoch = Math.floor(Date.now() / 86_400_000);
      vendor = newsVendors[dayOfEpoch % newsVendors.length].id;
    }
    if (!vendor) return;
    void newsJob.fire(`/api/admin/sourcing/run`, { vendorId: vendor, news: true, persist: true });
  }

  // Standard evidence sourcing for a SET of vendors. The id list is sent ONCE
  // and the loop runs SERVER-SIDE in after() — so closing the tab no longer
  // kills the remaining vendors (each is still saved as it finishes).
  function ingestSelected(ids: string[]) {
    if (ids.length === 0) return;
    const perVendor = estimateIngestionCost().totalUsd / 42;
    if (
      ids.length > 3 &&
      !window.confirm(
        `Run standard ingestion for ${ids.length} vendors?\n\n` +
          `Estimated ~$${(perVendor * ids.length).toFixed(2)} and ~${Math.max(1, Math.ceil(ids.length * 1.5))} min. ` +
          `Runs server-side — safe to leave this page.`,
      )
    ) {
      return;
    }
    void sourcingJob.fire(`/api/admin/sourcing/run`, { vendorIds: ids, persist: true });
  }

  // Same server-side batch for the news / press-release pipeline.
  function ingestNewsSelected(ids: string[]) {
    if (ids.length === 0) return;
    if (
      ids.length > 3 &&
      !window.confirm(
        `Run news & press-release sourcing for ${ids.length} vendors?\n\n` +
          `~${Math.max(1, Math.ceil(ids.length * 2))} min. Runs server-side — safe to leave this page.`,
      )
    ) {
      return;
    }
    void newsJob.fire(`/api/admin/sourcing/run`, { vendorIds: ids, news: true, persist: true });
  }

  async function triggerManual() {
    setBusyManual(true);
    setManualError(null);
    setManualResult(null);
    try {
      const res = await fetch("/api/admin/ingestion/run", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({
          vendorId,
          inlineContent: { url, rawText, sourceCategory },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setManualResult(`job ${body.jobId} → ${body.status} (${body.proposalsCount} proposals)`);
      await refreshJobs();
    } catch (e) {
      setManualError((e as Error).message);
    } finally {
      setBusyManual(false);
    }
  }

  // Writes IntelligenceNewsItem (the /news + Query feed) from the AI-news RSS
  // sources, Haiku-scored. Runs server-side — safe to leave the tab.
  function refreshNewsFeed() {
    void marketJob.fire(`/api/admin/sourcing/run`, { market: true });
  }

  async function recomputeNow() {
    setBusyRecompute(true);
    setRecomputeError(null);
    setRecomputeResult(null);
    try {
      // No sourcing / no LLM — just re-projects existing verified evidence into
      // pillar scores and re-derives overall/momentum/snapshots so the whole app
      // reflects the latest evidence immediately.
      const res = await fetch(`/api/admin/recompute`, {
        method: "POST",
        headers: token ? { "x-admin-token": token } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.skipped) { setRecomputeResult(`Skipped: ${body.skipped}`); return; }
      const shifts = body.scores?.scoreShifts ?? [];
      const topShift = shifts[0] ? ` · e.g. ${shifts[0].vendorId} ${shifts[0].from}→${shifts[0].to}` : "";
      setRecomputeResult(
        `${(body.projection?.scannedEvidenceRows ?? 0).toLocaleString()} signals processed · ${body.pillars?.pillarRowsUpserted ?? 0} pillar scores · ${body.scores?.vendorsUpdated ?? 0} vendors moved${topShift}${body.note ? ` — ${body.note}` : ""}`,
      );
    } catch (e) {
      setRecomputeError((e as Error).message);
    } finally {
      setBusyRecompute(false);
    }
  }

  async function updateEloScores() {
    setBusyElo(true);
    setEloError(null);
    setEloResult(null);
    try {
      const res = await fetch(`/api/admin/elo/seed`, {
        method: "POST",
        headers: token ? { "x-admin-token": token } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setEloResult(
        `${body.updated ?? 0} vendors updated · ${body.notFound?.length ?? 0} not found in DB`,
      );
    } catch (e) {
      setEloError((e as Error).message);
    } finally {
      setBusyElo(false);
    }
  }

  function fillEvidenceGaps() {
    // Batch of up to 10 least-evidenced vendors per click to bound web_search
    // cost + runtime. The work runs server-side; safe to navigate away.
    void gapsJob.fire(`/api/admin/web-evidence`, { gaps: true, limit: 10 });
  }

  // Format the gap-sourcing result from the completed background job.
  const gapsResult = (() => {
    const j = gapsJob.job;
    if (gapsJob.busy || !j || j.status !== "ok") return null;
    const r = j.result as { totalGaps?: number; sourced?: number; vendorsWithFindings?: number; proposalsPersisted?: number };
    if (typeof r.sourced !== "number") return null;
    const remaining = Math.max(0, (r.totalGaps ?? 0) - (r.sourced ?? 0));
    return `Sourced ${r.sourced ?? 0} of ${r.totalGaps ?? 0} gap vendors · ${r.vendorsWithFindings ?? 0} returned evidence · ${r.proposalsPersisted ?? 0} proposals queued for review${remaining > 0 ? ` · ${remaining} still need sourcing — run again` : " · all gaps sourced"}`;
  })();
  const gapsError = gapsJob.error ?? (gapsJob.job?.status === "error" ? gapsJob.job.error : null);

  const anyBusy = sourcingJob.busy || newsJob.busy || busyManual || marketJob.busy || busyRecompute || busyElo || gapsJob.busy;

  return (
    <div className="min-h-screen bg-[#f6f1e3] dark:bg-[#071827] text-[#15263c] dark:text-[#eef3f8]">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/admin" className="text-sm text-[#4c5d75] hover:underline">← Admin</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Ingestion</h1>
        <p className="mt-2 text-sm text-[#3f5068] dark:text-[#a7bacd]">
          Fire the public-data ingestion pipeline against today&apos;s rotation vendor (or pick one). New proposals land in /admin/evidence.
        </p>

        {!hasDatabase && (
          <div className="mt-6 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            DATABASE_URL not set — runs execute in dry-run mode and are not persisted.
          </div>
        )}

        {/* ── Token ───────────────────────────────────────────────────── */}
        <div className="mt-6">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-[#4c5d75]">x-admin-token (only required when ADMIN_API_OPEN is off)</div>
            <input value={token} onChange={(e) => setToken(e.target.value)} type="password"
              className="w-full max-w-sm rounded-lg border border-[#d6c9a8] dark:border-[#2a4a6b] bg-white dark:bg-[#071827] px-3 py-2 text-sm" />
          </label>
        </div>

        {/* ── LAST COMPLETED RUN — durable, server-sourced ───────────────
            Persists across tab switches / navigation because it is read from
            the admin_run_log table on the server, not held in client state. */}
        {lastRun && <LastRunCard run={lastRun} />}

        {/* ── RECOMPUTE: project existing evidence → live scores (no LLM) ─ */}
        <div className="mt-8 rounded-2xl border-2 border-[#d4af37] bg-[#fbf6e4] p-6 shadow-sm dark:border-[#d4af37] dark:bg-[#1a1605]/40">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#a07f1f] dark:text-[#d4af37]">
            Live engine · recompute the whole app from evidence
          </div>
          <h2 className="mt-1 text-xl font-semibold text-[#15263c] dark:text-[#eef3f8]">
            Recompute scores now
          </h2>
          <p className="mt-1 text-sm text-[#3f5068] dark:text-[#a7bacd]">
            Re-projects all verified evidence into pillar scores, then re-derives overall scores, momentum,
            and ranking snapshots — so the dashboard, quadrant, ecosystem navigator, and generators reflect
            the latest evidence immediately. No sourcing, no LLM cost. (The 03:05 UTC cron does this daily.)
          </p>
          {verifiedSignals != null && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#d4af37]/60 bg-white/70 px-3 py-1.5 text-sm dark:bg-[#0a1f38]/50">
              <span className="text-lg font-bold tabular-nums text-[#15263c] dark:text-[#eef3f8]">
                {verifiedSignals.toLocaleString()}
              </span>
              <span className="text-[#3f5068] dark:text-[#a7bacd]">
                verified evidence signal{verifiedSignals === 1 ? "" : "s"} to process this run — all of them
                {verifiedSignals > RECOMPUTE_ROW_CAP && (
                  <span className="ml-1 text-rose-600 dark:text-rose-400">
                    · exceeds the {RECOMPUTE_ROW_CAP.toLocaleString()}-row safety ceiling — oldest rows will be skipped and reported
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={anyBusy}
              onClick={() => recomputeNow()}
              className="inline-flex items-center gap-2 rounded-full bg-[#13294b] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1d3a5f] disabled:opacity-40 dark:bg-[#d4af37] dark:text-[#0a1f38] dark:hover:bg-[#e8c95c]"
            >
              {busyRecompute ? <><SpinIcon />Recomputing…</> : <>Recompute from evidence <span aria-hidden>→</span></>}
            </button>
          </div>
          {recomputeResult && !busyRecompute && <ResultBanner text={recomputeResult} />}
          {recomputeError && <ErrorBanner text={recomputeError} />}
        </div>

        {/* ── ARENA ELO: seed Model Provider overallScores from benchmark ─ */}
        <div className="mt-6 rounded-2xl border border-[#d6c9a8] dark:border-[#2a4a6b] bg-white dark:bg-[#0c2238] p-6 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4c5d75]">
            Benchmark anchor · Model Provider scoring
          </div>
          <h2 className="mt-1 text-lg font-semibold text-[#15263c] dark:text-[#eef3f8]">
            Update Arena ELO scores
          </h2>
          <p className="mt-1 text-sm text-[#3f5068] dark:text-[#a7bacd]">
            Seeds <code className="font-mono text-xs">overallScore</code> for each Model Provider vendor from the top-2 Arena ELO average per vendor.
            Source:{" "}
            <a href="https://openlm.ai/chatbot-arena/" target="_blank" rel="noopener noreferrer"
              className="underline hover:text-[#15263c] dark:hover:text-white">
              openlm.ai/chatbot-arena/
            </a>
            . Fixed anchors (ELO 1050→30, ELO 1510→95) — stable as new vendors enter the leaderboard.
            The <code className="font-mono text-xs">derive-scores</code> cron will not override these until a vendor has ≥3 pillar evidence rows.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={anyBusy}
              onClick={() => updateEloScores()}
              className="inline-flex items-center gap-2 rounded-full bg-[#0c2238] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1d3a5f] disabled:opacity-40 dark:bg-[#1d3a5f] dark:hover:bg-[#2a4a6b]"
            >
              {busyElo ? <><SpinIcon />Updating ELO scores…</> : <>Seed Arena ELO scores <span aria-hidden>→</span></>}
            </button>
          </div>
          {eloResult && !busyElo && <ResultBanner text={eloResult} />}
          {eloError && <ErrorBanner text={eloError} />}
        </div>

        {/* ── FILL EVIDENCE GAPS: web_search-source un-evidenced vendors ─ */}
        <div className="mt-6 rounded-2xl border border-[#d6c9a8] dark:border-[#2a4a6b] bg-white dark:bg-[#0c2238] p-6 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4c5d75]">
            Establish data sources · vendors with limited / no evidence
          </div>
          <h2 className="mt-1 text-lg font-semibold text-[#15263c] dark:text-[#eef3f8]">
            Fill evidence gaps (web search)
          </h2>
          <p className="mt-1 text-sm text-[#3f5068] dark:text-[#a7bacd]">
            Targets exactly the vendors showing the <span className="font-semibold text-rose-700 dark:text-rose-300">&ldquo;seed estimate&rdquo;</span> / <span className="font-semibold text-amber-700 dark:text-amber-300">&ldquo;limited evidence&rdquo;</span> alerts (fewer than 10 analyst-verified rows). Uses web search to discover <strong>real, cited</strong> sources across the pillar domains and queues them as proposals for review in <Link href="/admin/evidence" className="underline">/admin/evidence</Link>. Processes up to 10 least-evidenced vendors per click to bound cost — re-run for the rest.
          </p>
          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            ⚠ Spends Anthropic web_search credit (~5 searches/vendor). Nothing is fabricated — only real cited sources are recorded.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={anyBusy}
              onClick={() => fillEvidenceGaps()}
              className="inline-flex items-center gap-2 rounded-full bg-[#0c2238] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1d3a5f] disabled:opacity-40 dark:bg-[#1d3a5f] dark:hover:bg-[#2a4a6b]"
            >
              {gapsJob.busy ? <><SpinIcon />Sourcing gap vendors…</> : <>Source next 10 gap vendors <span aria-hidden>→</span></>}
            </button>
            {gapsJob.busy && (
              <span className="text-xs text-[#4c5d75] dark:text-[#a7bacd]">
                {(() => {
                  const p = gapsJob.job?.progress as { current?: number; total?: number; vendor?: string } | undefined;
                  const prog = p && typeof p.current === "number" && p.total ? `${p.current}/${p.total}${p.vendor ? ` · ${p.vendor}` : ""}` : "starting…";
                  return `Running server-side (${prog}) · ${gapsJob.elapsedSec}s — safe to leave this page`;
                })()}
              </span>
            )}
          </div>
          {gapsResult && <ResultBanner text={gapsResult} />}
          {gapsError && <ErrorBanner text={gapsError} />}
        </div>

        {/* ── PRIMARY: rolling ingest ─────────────────────────────────── */}
        <div className="mt-8 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-6 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/30">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Rolling pipeline · trust centres, docs, pricing, status
          </div>
          <h2 className="mt-1 text-xl font-semibold text-emerald-900 dark:text-emerald-100">
            Run standard evidence ingestion
          </h2>
          <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">
            Fetches every non-news source in the manifest for today&apos;s rotation vendor, LLM-extracts evidence proposals, and writes them to the review queue.
          </p>
          <p className="mt-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
            Estimated cost — full 42-vendor run: ${estimateIngestionCost().totalUsd.toFixed(2)} · single-vendor: ~$
            {(estimateIngestionCost().totalUsd / 42).toFixed(2)}{" "}
            <Link href="/settings" className="font-normal underline">adjust in Settings →</Link>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={anyBusy}
              onClick={() => ingestNow()}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              {sourcingJob.busy ? (
                <><SpinIcon />Running…</>
              ) : (
                <>Ingest today&apos;s vendor <span aria-hidden>→</span></>
              )}
            </button>
          </div>

          {/* Multi-vendor batch selection — loops SERVER-SIDE; safe to leave the tab. */}
          <VendorMultiSelect
            title="Or select vendors to ingest (multi-select + select all)"
            vendors={vendors}
            selected={stdSelected}
            onChange={setStdSelected}
            accent="emerald"
            disabled={anyBusy}
            onRun={() => ingestSelected(stdSelected)}
            runLabel="Run selected"
          />
          {sourcingJob.busy && <ProgressBanner elapsed={sourcingJob.elapsedSec} label="Rolling pipeline" detail="Fetching sources, extracting proposals with the 3-stage AI pipeline (Haiku → Sonnet → Opus), and writing results. Runs server-side — safe to leave this page." batch={jobBatch(sourcingJob.job)} />}
          {ingestResult && <ResultBanner text={ingestResult} />}
          {ingestError && <ErrorBanner text={ingestError} />}
        </div>

        {/* ── NEWS FEED: market-news RSS (writes IntelligenceNewsItem) ─── */}
        <div className="mt-6 rounded-2xl border-2 border-violet-500 bg-violet-50 p-6 shadow-sm dark:border-violet-600 dark:bg-violet-950/30">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">
            News feed · powers /news + the Query breaking-news card
          </div>
          <h2 className="mt-1 text-xl font-semibold text-violet-900 dark:text-violet-100">
            Refresh the news feed (AI-news RSS)
          </h2>
          <p className="mt-1 text-sm text-violet-900/80 dark:text-violet-200/80">
            Fetches the curated AI press / commentary / benchmark RSS sources, Haiku-scores each item for
            enterprise impact, tags which tracked vendors are mentioned, and writes the kept items to the
            <strong> news feed (IntelligenceNewsItem)</strong>. This is what actually populates the News tab —
            the press-release button below writes <em>evidence proposals</em>, not the feed. Needs the Anthropic
            API (Haiku); if usage is capped, this run will report the exact error.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={anyBusy}
              onClick={() => refreshNewsFeed()}
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-40 dark:bg-violet-500 dark:hover:bg-violet-400"
            >
              {marketJob.busy ? <><SpinIcon />Refreshing…</> : <>Refresh news feed <span aria-hidden>→</span></>}
            </button>
          </div>
          {marketResult && <ResultBanner text={marketResult} color="sky" />}
          {marketError && <ErrorBanner text={marketError} />}
        </div>

        {/* ── NEWS SOURCING: press-release discovery ──────────────────── */}
        <div className="mt-6 rounded-2xl border-2 border-sky-500 bg-sky-50 p-6 shadow-sm dark:border-sky-600 dark:bg-sky-950/30">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
            News pipeline · press releases &amp; blog announcements
          </div>
          <h2 className="mt-1 text-xl font-semibold text-sky-900 dark:text-sky-100">
            Run news &amp; press-release sourcing
          </h2>
          <p className="mt-1 text-sm text-sky-900/80 dark:text-sky-200/80">
            Fetches each vendor&apos;s news listing page, uses Haiku to discover and score individual articles
            (relevance ≥ 60, importance ≥ 40), deduplicates against existing proposals, then ingests up to
            5 fresh articles per vendor through the standard extract → classify pipeline.
          </p>
          <p className="mt-2 text-xs text-sky-800 dark:text-sky-300">
            {newsVendors.length} vendors have press-release sources configured · 3-day freshness horizon · ~5 articles max per run
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={anyBusy}
              onClick={() => ingestNews()}
              className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-40 dark:bg-sky-500 dark:hover:bg-sky-400"
            >
              {newsJob.busy ? (
                <><SpinIcon />Running…</>
              ) : (
                <>Run today&apos;s news vendor <span aria-hidden>→</span></>
              )}
            </button>
          </div>

          {/* Multi-vendor batch selection for the news pipeline. */}
          <VendorMultiSelect
            title="Or select news vendors to run (multi-select + select all)"
            vendors={newsVendors}
            selected={newsSelected}
            onChange={setNewsSelected}
            accent="sky"
            disabled={anyBusy}
            onRun={() => ingestNewsSelected(newsSelected)}
            runLabel="Run selected"
          />
          {newsJob.busy && <ProgressBanner elapsed={newsJob.elapsedSec} label="News discovery pipeline" detail="Fetching listing pages, scoring articles for relevance and importance (Haiku), deduplicating, then ingesting fresh articles. Runs server-side — safe to leave this page." color="sky" batch={jobBatch(newsJob.job)} />}
          {newsResult && <ResultBanner text={newsResult} color="sky" />}
          {newsError && <ErrorBanner text={newsError} />}
        </div>

        {/* ── Recent jobs ──────────────────────────────────────────────── */}
        <h2 className="mt-10 text-xl font-semibold">Recent jobs</h2>
        <div className="mt-3 rounded-xl border border-[#e3d9c0] dark:border-[#1d3a57] bg-white dark:bg-[#0c2238] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f6f1e3] dark:bg-[#071827]">
              <tr className="text-left text-xs uppercase text-[#4c5d75]">
                <th className="px-4 py-2 font-medium">Job</th>
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Proposals</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-[#4c5d75]">No jobs yet.</td></tr>
              )}
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-[#ece4d0] dark:border-[#1d3a57]">
                  <td className="px-4 py-2 font-mono text-xs">{j.id.slice(0, 16)}…</td>
                  <td className="px-4 py-2">{j.vendorId}</td>
                  <td className="px-4 py-2"><StatusPill status={j.status} /></td>
                  <td className="px-4 py-2 tabular-nums">{j.proposalsCount}</td>
                  <td className="px-4 py-2 text-xs text-[#4c5d75]">{new Date(j.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── ADVANCED: paste-raw-text form ──────────────────────────── */}
        <div className="mt-10">
          <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="text-sm text-[#4c5d75] hover:underline">
            {showAdvanced ? "▾" : "▸"} Advanced — paste a single source manually
          </button>
          {showAdvanced && (
            <div className="mt-3 rounded-2xl border border-[#e3d9c0] dark:border-[#1d3a57] bg-white dark:bg-[#0c2238] p-6 space-y-4">
              <p className="text-xs text-[#4c5d75]">
                Use this when you want to run the extractor against arbitrary fetched text — e.g. a vendor blog post the manifest doesn&apos;t cover. The auto-ingest above is the normal path.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Vendor">
                  <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full rounded-lg border border-[#d6c9a8] dark:border-[#2a4a6b] bg-white dark:bg-[#071827] px-3 py-2 text-sm">
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </Field>
                <Field label="Source category">
                  <select value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value as typeof SOURCE_CATEGORIES[number])} className="w-full rounded-lg border border-[#d6c9a8] dark:border-[#2a4a6b] bg-white dark:bg-[#071827] px-3 py-2 text-sm">
                    {SOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Source URL">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://vendor.com/trust"
                  className="w-full rounded-lg border border-[#d6c9a8] dark:border-[#2a4a6b] bg-white dark:bg-[#071827] px-3 py-2 text-sm" />
              </Field>
              <Field label="Raw text content">
                <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={10} placeholder="Paste fetched text…"
                  className="w-full rounded-lg border border-[#d6c9a8] dark:border-[#2a4a6b] bg-white dark:bg-[#071827] px-3 py-2 text-sm font-mono" />
              </Field>
              <div className="flex items-center justify-between">
                <button
                  disabled={busyManual || !rawText || !url || !vendorId}
                  onClick={triggerManual}
                  className="rounded-full bg-[#0c2238] dark:bg-white px-6 py-2 text-sm font-medium text-white dark:text-[#0a1f38] disabled:opacity-40"
                >{busyManual ? "Running…" : "Run manual extraction"}</button>
                {manualResult && <div className="text-xs text-emerald-700 dark:text-emerald-400">{manualResult}</div>}
              </div>
              {manualError && <div className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">Error: {manualError}</div>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Background-job result helpers ─────────────────────────────────────────────

/** Format a completed sourcing/news/market/batch job's result for the banner.
 *  Returns null while running or before a result exists. */
function sourcingResultText(j: { busy: boolean; job: BackgroundJob | null }): string | null {
  if (j.busy || !j.job || j.job.status !== "ok") return null;
  const r = (j.job.result ?? {}) as Record<string, unknown>;
  const n = (k: string) => Number(r[k] ?? 0);
  if (typeof r.vendors === "number") return `Ran ${r.vendors} vendor${r.vendors === 1 ? "" : "s"} · ${n("ok")} ok · ${n("failed")} failed · ${n("proposalsPersisted")} proposals`;
  if (r.itemsUpserted !== undefined || r.feedsFetched !== undefined) return `${n("feedsFetched")} feeds · ${n("itemsScored")} scored · ${n("itemsUpserted")} added to feed`;
  if (r.articlesDiscovered !== undefined || r.articlesIngested !== undefined) return `${n("articlesDiscovered")} discovered · ${n("articlesIngested")} ingested · ${n("proposalsPersisted")} proposals`;
  if (r.proposalsExtracted !== undefined || r.proposalsPersisted !== undefined) return `${r.vendorId ?? "vendor"} · ${n("proposalsExtracted")} extracted · ${n("proposalsPersisted")} persisted`;
  return j.job.label ? `${j.job.label} — done` : "Done";
}

/** Extract a {current,total,vendor} batch snapshot from a job's progress. */
function jobBatch(job: BackgroundJob | null): { current: number; total: number; vendor: string } | null {
  const p = job?.progress as { current?: number; total?: number; vendor?: string } | undefined;
  if (!p || typeof p.current !== "number" || !p.total || p.total <= 1) return null;
  return { current: p.current, total: p.total, vendor: typeof p.vendor === "string" ? p.vendor : "" };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LastRunCard({ run }: { run: LastRun }) {
  const when = new Date(run.finishedAt);
  const secs = Math.round(run.durationMs / 1000);
  const dur = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
  // Render the compact summary as "key: value" chips (primitives only).
  const chips = Object.entries(run.summary ?? {})
    .filter(([, v]) => typeof v === "number" || typeof v === "string" || typeof v === "boolean")
    .map(([k, v]) => `${k}: ${v}`);
  const ok = run.status === "ok";
  return (
    <div className={`mt-6 rounded-xl border px-4 py-3 ${ok
      ? "border-[#cfe0cf] bg-[#f3f8f3] dark:border-[#244a36] dark:bg-[#0c2a1c]/40"
      : "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4c5d75] dark:text-[#7a9bb8]">
          Last completed run · persisted
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ok
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>
          {ok ? "OK" : "ERROR"}
        </span>
      </div>
      <div className="mt-1 text-sm font-semibold text-[#15263c] dark:text-[#eef3f8]">{run.label}</div>
      <div className="mt-0.5 text-xs text-[#4c5d75] dark:text-[#a7bacd]">
        {when.toLocaleString()} · {dur}
      </div>
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-[#3f5068] tabular-nums dark:bg-[#0c2238] dark:text-[#a7bacd]">
              {c}
            </span>
          ))}
        </div>
      )}
      {run.error && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {run.error}
        </div>
      )}
    </div>
  );
}

function SpinIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle className="opacity-25" cx="12" cy="12" r="10" />
      <path className="opacity-75" d="M4 12a8 8 0 018-8" strokeLinecap="round" />
    </svg>
  );
}

function ProgressBanner({ elapsed, label, detail, color = "emerald", batch }: { elapsed: number; label: string; detail: string; color?: string; batch?: { current: number; total: number; vendor: string } | null }) {
  const border = color === "sky" ? "border-sky-300 dark:border-sky-700" : "border-emerald-300 dark:border-emerald-700";
  const bg = color === "sky" ? "bg-sky-50/60 dark:bg-sky-950/40" : "bg-emerald-50/60 dark:bg-emerald-950/40";
  const text = color === "sky" ? "text-sky-800 dark:text-sky-200" : "text-emerald-800 dark:text-emerald-200";
  const sub = color === "sky" ? "text-sky-700 dark:text-sky-300" : "text-emerald-700 dark:text-emerald-300";
  return (
    <div className={`mt-4 rounded-xl border ${border} ${bg} px-4 py-3`}>
      <div className={`flex items-center gap-2 text-sm font-medium ${text}`}>
        <SpinIcon />
        {label} running — {elapsed}s elapsed
        {batch && <span className="font-semibold"> · vendor {batch.current}/{batch.total} ({batch.vendor.replace(/^vendor_/, "")})</span>}
      </div>
      <p className={`mt-1 text-xs ${sub}`}>{detail}</p>
    </div>
  );
}

// Multi-vendor picker with filter + select-all, used by both the standard and
// news ingestion sections. Selecting "all" while a filter is active toggles
// only the filtered subset, which is the expected behaviour for a search box.
function VendorMultiSelect({
  title, vendors, selected, onChange, accent, disabled, onRun, runLabel,
}: {
  title: string;
  vendors: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  accent: "emerald" | "sky";
  disabled: boolean;
  onRun: () => void;
  runLabel: string;
}) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? vendors.filter((v) => v.name.toLowerCase().includes(ql) || v.id.toLowerCase().includes(ql))
    : vendors;
  const sel = new Set(selected);
  const toggle = (id: string) =>
    onChange(sel.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((v) => sel.has(v.id));
  const a = accent === "sky"
    ? { ring: "border-sky-300 dark:border-sky-700", btn: "bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400", chip: "text-sky-800 dark:text-sky-300", box: "accent-sky-600" }
    : { ring: "border-emerald-300 dark:border-emerald-700", btn: "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400", chip: "text-emerald-800 dark:text-emerald-300", box: "accent-emerald-600" };
  return (
    <div className={`mt-4 rounded-xl border ${a.ring} bg-white/60 p-3 dark:bg-[#0c2238]/60`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs font-semibold ${a.chip}`}>{title}</span>
        <div className="flex items-center gap-3 text-[11px]">
          <button
            type="button"
            disabled={disabled || filtered.length === 0}
            onClick={() =>
              onChange(
                allFilteredSelected
                  ? selected.filter((id) => !filtered.some((v) => v.id === id))
                  : [...new Set([...selected, ...filtered.map((v) => v.id)])],
              )
            }
            className="underline disabled:opacity-40"
          >
            {allFilteredSelected ? "Deselect" : "Select all"}{ql ? " (filtered)" : ` (${vendors.length})`}
          </button>
          {selected.length > 0 && (
            <button type="button" disabled={disabled} onClick={() => onChange([])} className="underline disabled:opacity-40">
              Clear
            </button>
          )}
        </div>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter vendors…"
        className={`mt-2 w-full max-w-xs rounded-lg border ${a.ring} bg-white px-2.5 py-1 text-xs dark:bg-[#071827]`}
      />
      <div className="mt-2 grid max-h-52 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto sm:grid-cols-3">
        {filtered.map((v) => (
          <label key={v.id} className="flex items-center gap-1.5 text-xs text-[#2e3f57] dark:text-[#c2d1e0]">
            <input type="checkbox" className={a.box} checked={sel.has(v.id)} disabled={disabled} onChange={() => toggle(v.id)} />
            <span className="truncate" title={v.name}>{v.name}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <span className="col-span-full text-xs text-[#6b7d93]">No vendors match “{q}”.</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || selected.length === 0}
          onClick={onRun}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-40 ${a.btn}`}
        >
          {runLabel} ({selected.length}) <span aria-hidden>→</span>
        </button>
        {selected.length > 0 && (
          <span className="text-[11px] text-[#6b7d93] dark:text-[#8fa5bb]">runs sequentially · each vendor saved as it finishes</span>
        )}
      </div>
    </div>
  );
}

function ResultBanner({ text, color = "emerald" }: { text: string; color?: string }) {
  const cls = color === "sky"
    ? "bg-white/60 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200"
    : "bg-white/60 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200";
  return <div className={`mt-3 rounded-lg ${cls} px-3 py-2 text-xs`}>✓ {text}</div>;
}

function ErrorBanner({ text }: { text: string }) {
  return <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">Error: {text}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-[#4c5d75]">{label}</div>
      {children}
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "completed" || status === "ready_for_review" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    : status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
    : "bg-[#ece3cb] text-[#2e3f57] dark:bg-[#143049] dark:text-[#c2d1e0]";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}
