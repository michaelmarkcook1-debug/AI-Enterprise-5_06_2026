"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { estimateIngestionCost } from "@/lib/ingestion/cost-model";

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

export default function IngestionConsole({
  hasDatabase,
  vendors,
  initialJobs,
  newsVendors,
  lastRun,
}: {
  hasDatabase: boolean;
  vendors: { id: string; name: string }[];
  initialJobs: Job[];
  newsVendors: { id: string; name: string }[];
  lastRun: LastRun | null;
}) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [token, setToken] = useState("");

  // ── Rolling ingest state ────────────────────────────────────────────────
  const [busyAll, setBusyAll] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Market-news feed state (writes IntelligenceNewsItem) ────────────────
  const [busyMarket, setBusyMarket] = useState(false);
  const [marketResult, setMarketResult] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);

  // ── Recompute state (project evidence → scores, no LLM cost) ────────────
  const [busyRecompute, setBusyRecompute] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<string | null>(null);
  const [recomputeError, setRecomputeError] = useState<string | null>(null);

  // ── News sourcing state ─────────────────────────────────────────────────
  const [busyNews, setBusyNews] = useState(false);
  const [newsResult, setNewsResult] = useState<string | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [elapsedNewsSec, setElapsedNewsSec] = useState(0);
  const elapsedNewsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollNewsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Multi-vendor selection (batch runs) ─────────────────────────────────
  const [stdSelected, setStdSelected] = useState<string[]>([]);
  const [newsSelected, setNewsSelected] = useState<string[]>([]);
  const [batch, setBatch] = useState<{ scope: "std" | "news"; current: number; total: number; vendor: string } | null>(null);

  useEffect(() => {
    if (busyAll) {
      setElapsedSec(0);
      elapsedRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
      pollRef.current = setInterval(() => { void refreshJobs(); }, 5000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyAll]);

  useEffect(() => {
    if (busyNews) {
      setElapsedNewsSec(0);
      elapsedNewsRef.current = setInterval(() => setElapsedNewsSec((s) => s + 1), 1000);
      pollNewsRef.current = setInterval(() => { void refreshJobs(); }, 5000);
    } else {
      if (elapsedNewsRef.current) clearInterval(elapsedNewsRef.current);
      if (pollNewsRef.current) clearInterval(pollNewsRef.current);
    }
    return () => {
      if (elapsedNewsRef.current) clearInterval(elapsedNewsRef.current);
      if (pollNewsRef.current) clearInterval(pollNewsRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyNews]);

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

  async function ingestNow() {
    setBusyAll(true);
    setIngestError(null);
    setIngestResult(null);
    try {
      // Today's rotation vendor. The SCHEDULED run lives in the daily-refresh
      // pipeline; this is the admin "run the rotation vendor now" button.
      // (Specific / multiple vendors go through ingestSelected below.)
      const res = await fetch(`/api/admin/sourcing/run`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ persist: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const totals = body.totals ?? {};
      setIngestResult(
        `today's vendor · ${body.durationMs ?? 0} ms · ${totals.proposalsExtracted ?? 0} extracted · ${totals.proposalsPersisted ?? 0} persisted`,
      );
      await refreshJobs();
    } catch (e) {
      setIngestError((e as Error).message);
    } finally {
      setBusyAll(false);
    }
  }

  async function ingestNews(vendorOverride?: string) {
    setBusyNews(true);
    setNewsError(null);
    setNewsResult(null);
    try {
      // News sourcing is per-vendor; default to today's rotating news vendor
      // (same rotation the scheduled pipeline uses).
      let vendor = vendorOverride;
      if (!vendor && newsVendors.length > 0) {
        const dayOfEpoch = Math.floor(Date.now() / 86_400_000);
        vendor = newsVendors[dayOfEpoch % newsVendors.length].id;
      }
      if (!vendor) throw new Error("No news vendors configured");
      const res = await fetch(`/api/admin/sourcing/run`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ vendorId: vendor, news: true, persist: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const t = body.totals ?? {};
      setNewsResult(
        `${vendor} · ${body.durationMs ?? 0} ms · ${t.articlesDiscovered ?? 0} discovered · ${t.articlesIngested ?? 0} ingested · ${t.proposalsPersisted ?? 0} proposals`,
      );
      await refreshJobs();
    } catch (e) {
      setNewsError((e as Error).message);
    } finally {
      setBusyNews(false);
    }
  }

  // Run STANDARD evidence sourcing for a SET of vendors, one at a time. Each
  // request is a single vendor (≤300s — no 504); the loop is sequential so peak
  // Anthropic concurrency stays bounded (every vendor already parallelises its
  // own sources). One vendor failing does not abort the batch, and each vendor
  // is persisted as it finishes (admin_run_log + jobs), so closing the tab
  // mid-batch keeps the completed vendors.
  async function ingestSelected(ids: string[]) {
    if (ids.length === 0) return;
    const perVendor = estimateIngestionCost().totalUsd / 42;
    if (
      ids.length > 3 &&
      !window.confirm(
        `Run standard ingestion for ${ids.length} vendors, one after another?\n\n` +
          `Estimated ~$${(perVendor * ids.length).toFixed(2)} and ~${Math.max(1, Math.ceil(ids.length * 1.5))} min. ` +
          `Keep this tab open — each vendor is saved as it finishes.`,
      )
    ) {
      return;
    }
    setBusyAll(true);
    setIngestError(null);
    setIngestResult(null);
    const lines: string[] = [];
    try {
      for (let k = 0; k < ids.length; k++) {
        setBatch({ scope: "std", current: k + 1, total: ids.length, vendor: ids[k] });
        try {
          const res = await fetch(`/api/admin/sourcing/run`, {
            method: "POST",
            headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
            body: JSON.stringify({ vendorId: ids[k], persist: true }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) lines.push(`${ids[k]}: ✗ ${body.error ?? `HTTP ${res.status}`}`);
          else {
            const t = body.totals ?? {};
            lines.push(`${ids[k]}: ${t.proposalsExtracted ?? 0}→${t.proposalsPersisted ?? 0}`);
          }
        } catch (e) {
          lines.push(`${ids[k]}: ✗ ${(e as Error).message}`);
        }
        await refreshJobs();
      }
      setIngestResult(`Ran ${ids.length} vendor${ids.length !== 1 ? "s" : ""} · ${lines.join(" · ")}`);
    } finally {
      setBusyAll(false);
      setBatch(null);
    }
  }

  // Same pattern for the news / press-release pipeline.
  async function ingestNewsSelected(ids: string[]) {
    if (ids.length === 0) return;
    if (
      ids.length > 3 &&
      !window.confirm(
        `Run news & press-release sourcing for ${ids.length} vendors, one after another?\n\n` +
          `~${Math.max(1, Math.ceil(ids.length * 2))} min. Keep this tab open — each vendor is saved as it finishes.`,
      )
    ) {
      return;
    }
    setBusyNews(true);
    setNewsError(null);
    setNewsResult(null);
    const lines: string[] = [];
    try {
      for (let k = 0; k < ids.length; k++) {
        setBatch({ scope: "news", current: k + 1, total: ids.length, vendor: ids[k] });
        try {
          const res = await fetch(`/api/admin/sourcing/run`, {
            method: "POST",
            headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
            body: JSON.stringify({ vendorId: ids[k], news: true, persist: true }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) lines.push(`${ids[k]}: ✗ ${body.error ?? `HTTP ${res.status}`}`);
          else {
            const t = body.totals ?? {};
            lines.push(`${ids[k]}: ${t.proposalsPersisted ?? 0} proposals`);
          }
        } catch (e) {
          lines.push(`${ids[k]}: ✗ ${(e as Error).message}`);
        }
        await refreshJobs();
      }
      setNewsResult(`Ran ${ids.length} vendor${ids.length !== 1 ? "s" : ""} · ${lines.join(" · ")}`);
    } finally {
      setBusyNews(false);
      setBatch(null);
    }
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

  async function refreshNewsFeed() {
    setBusyMarket(true);
    setMarketError(null);
    setMarketResult(null);
    try {
      // Writes IntelligenceNewsItem (the /news + Query feed) from the AI-news
      // RSS sources, Haiku-scored. This is the feed itself — distinct from the
      // press-release button below, which writes evidence proposals.
      const res = await fetch(`/api/admin/sourcing/run`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ market: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const firstErr = Array.isArray(body.errors) && body.errors.length > 0 ? ` · first error: ${body.errors[0]}` : "";
      setMarketResult(
        `${body.feedsFetched ?? 0}/${body.feedsAttempted ?? 0} feeds · ${body.itemsScored ?? 0} scored · ${body.itemsUpserted ?? 0} added to feed${firstErr}`,
      );
    } catch (e) {
      setMarketError((e as Error).message);
    } finally {
      setBusyMarket(false);
    }
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
        `${body.projection?.scannedEvidenceRows ?? 0} verified rows · ${body.pillars?.pillarRowsUpserted ?? 0} pillar scores · ${body.scores?.vendorsUpdated ?? 0} vendors moved${topShift}${body.note ? ` — ${body.note}` : ""}`,
      );
    } catch (e) {
      setRecomputeError((e as Error).message);
    } finally {
      setBusyRecompute(false);
    }
  }

  const anyBusy = busyAll || busyNews || busyManual || busyMarket || busyRecompute;

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
              {busyAll ? (
                <><SpinIcon />Running…</>
              ) : (
                <>Ingest today&apos;s vendor <span aria-hidden>→</span></>
              )}
            </button>
          </div>

          {/* Multi-vendor batch selection — runs sequentially, each vendor saved as it finishes. */}
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
          {busyAll && <ProgressBanner elapsed={elapsedSec} label="Rolling pipeline" detail="Fetching sources, extracting proposals with the 3-stage AI pipeline (Haiku → Sonnet → Opus), and writing results. Typically 1–4 minutes." batch={batch?.scope === "std" ? batch : null} />}
          {ingestResult && !busyAll && <ResultBanner text={ingestResult} />}
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
              {busyMarket ? <><SpinIcon />Refreshing…</> : <>Refresh news feed <span aria-hidden>→</span></>}
            </button>
          </div>
          {marketResult && !busyMarket && <ResultBanner text={marketResult} color="sky" />}
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
              {busyNews ? (
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
          {busyNews && <ProgressBanner elapsed={elapsedNewsSec} label="News discovery pipeline" detail="Fetching listing pages, scoring articles for relevance and importance (Haiku), deduplicating, then ingesting fresh articles. Typically 2–5 minutes." color="sky" batch={batch?.scope === "news" ? batch : null} />}
          {newsResult && !busyNews && <ResultBanner text={newsResult} color="sky" />}
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
