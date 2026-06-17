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
}: {
  hasDatabase: boolean;
  vendors: { id: string; name: string }[];
  initialJobs: Job[];
  newsVendors: { id: string; name: string }[];
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

  // ── News sourcing state ─────────────────────────────────────────────────
  const [busyNews, setBusyNews] = useState(false);
  const [newsResult, setNewsResult] = useState<string | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [elapsedNewsSec, setElapsedNewsSec] = useState(0);
  const elapsedNewsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollNewsRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function ingestNow(scope: "rolling" | "vendor", vendorOverride?: string) {
    setBusyAll(true);
    setIngestError(null);
    setIngestResult(null);
    try {
      // Manual per-vendor standard sourcing. The SCHEDULED run lives in the one
      // daily-refresh pipeline; this is the admin "run one vendor now" tool.
      const res = await fetch(`/api/admin/sourcing/run`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ vendorId: scope === "vendor" ? vendorOverride : undefined, persist: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const totals = body.totals ?? {};
      setIngestResult(
        `${vendorOverride ?? "today's vendor"} · ${body.durationMs ?? 0} ms · ${totals.proposalsExtracted ?? 0} extracted · ${totals.proposalsPersisted ?? 0} persisted`,
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

  const anyBusy = busyAll || busyNews || busyManual;

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
              onClick={() => ingestNow("rolling")}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              {busyAll ? (
                <><SpinIcon />Running…</>
              ) : (
                <>Ingest today&apos;s vendor <span aria-hidden>→</span></>
              )}
            </button>
            <span className="text-xs text-emerald-900/70 dark:text-emerald-300/70">or pick a vendor:</span>
            <select
              defaultValue=""
              onChange={(e) => { const v = e.target.value; if (!v) return; void ingestNow("vendor", v); e.target.value = ""; }}
              disabled={anyBusy}
              className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs dark:border-emerald-700 dark:bg-[#0c2238]"
            >
              <option value="">Run for specific vendor…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {busyAll && <ProgressBanner elapsed={elapsedSec} label="Rolling pipeline" detail="Fetching sources, extracting proposals with the 3-stage AI pipeline (Haiku → Sonnet → Opus), and writing results. Typically 1–4 minutes." />}
          {ingestResult && !busyAll && <ResultBanner text={ingestResult} />}
          {ingestError && <ErrorBanner text={ingestError} />}
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
            <span className="text-xs text-sky-800/70 dark:text-sky-300/70">or pick a vendor:</span>
            <select
              defaultValue=""
              onChange={(e) => { const v = e.target.value; if (!v) return; void ingestNews(v); e.target.value = ""; }}
              disabled={anyBusy}
              className="rounded-full border border-sky-300 bg-white px-3 py-1.5 text-xs dark:border-sky-700 dark:bg-[#0c2238]"
            >
              <option value="">Run for specific news vendor…</option>
              {newsVendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {busyNews && <ProgressBanner elapsed={elapsedNewsSec} label="News discovery pipeline" detail="Fetching listing pages, scoring articles for relevance and importance (Haiku), deduplicating, then ingesting fresh articles. Typically 2–5 minutes." color="sky" />}
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

function SpinIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle className="opacity-25" cx="12" cy="12" r="10" />
      <path className="opacity-75" d="M4 12a8 8 0 018-8" strokeLinecap="round" />
    </svg>
  );
}

function ProgressBanner({ elapsed, label, detail, color = "emerald" }: { elapsed: number; label: string; detail: string; color?: string }) {
  const border = color === "sky" ? "border-sky-300 dark:border-sky-700" : "border-emerald-300 dark:border-emerald-700";
  const bg = color === "sky" ? "bg-sky-50/60 dark:bg-sky-950/40" : "bg-emerald-50/60 dark:bg-emerald-950/40";
  const text = color === "sky" ? "text-sky-800 dark:text-sky-200" : "text-emerald-800 dark:text-emerald-200";
  const sub = color === "sky" ? "text-sky-700 dark:text-sky-300" : "text-emerald-700 dark:text-emerald-300";
  return (
    <div className={`mt-4 rounded-xl border ${border} ${bg} px-4 py-3`}>
      <div className={`flex items-center gap-2 text-sm font-medium ${text}`}>
        <SpinIcon />
        {label} running — {elapsed}s elapsed
      </div>
      <p className={`mt-1 text-xs ${sub}`}>{detail}</p>
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
