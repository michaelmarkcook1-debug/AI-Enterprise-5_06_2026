"use client";

import Link from "next/link";
import { useState } from "react";

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
}: {
  hasDatabase: boolean;
  vendors: { id: string; name: string }[];
  initialJobs: Job[];
}) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [sourceCategory, setSourceCategory] = useState<typeof SOURCE_CATEGORIES[number]>("trust_center");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function trigger() {
    setBusy(true);
    setError(null);
    setLastResult(null);
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
      setLastResult(`job ${body.jobId} → ${body.status} (${body.proposalsCount} proposals)`);
      // Refresh job list
      if (hasDatabase) {
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#071827] text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">← Admin</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Ingestion console</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Trigger an extraction run. Paste raw source content (e.g. a trust-centre page) — the LLM extractor will produce evidence proposals routed to review.
        </p>

        {!hasDatabase && (
          <div className="mt-6 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            DATABASE_URL not set — runs execute in dry-run mode and are not persisted.
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vendor">
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#071827] px-3 py-2 text-sm">
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="Source category">
              <select value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value as typeof SOURCE_CATEGORIES[number])} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#071827] px-3 py-2 text-sm">
                {SOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Source URL">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://vendor.com/trust"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#071827] px-3 py-2 text-sm" />
          </Field>
          <Field label="Raw text content">
            <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={10}
              placeholder="Paste fetched text…"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#071827] px-3 py-2 text-sm font-mono" />
          </Field>
          <Field label="x-admin-token (optional in dev)">
            <input value={token} onChange={(e) => setToken(e.target.value)} type="password"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#071827] px-3 py-2 text-sm" />
          </Field>
          <div className="flex items-center justify-between">
            <button
              disabled={busy || !rawText || !url || !vendorId}
              onClick={trigger}
              className="rounded-full bg-zinc-900 dark:bg-white px-6 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-40"
            >{busy ? "Running…" : "Run extraction"}</button>
            {lastResult && <div className="text-xs text-emerald-700 dark:text-emerald-400">{lastResult}</div>}
          </div>
          {error && <div className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">Error: {error}</div>}
        </div>

        <h2 className="mt-10 text-xl font-semibold">Recent jobs</h2>
        <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-[#071827]">
              <tr className="text-left text-xs uppercase text-zinc-500">
                <th className="px-4 py-2 font-medium">Job</th>
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Proposals</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-500">No jobs yet.</td></tr>
              )}
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2 font-mono text-xs">{j.id}</td>
                  <td className="px-4 py-2">{j.vendorId}</td>
                  <td className="px-4 py-2"><StatusPill status={j.status} /></td>
                  <td className="px-4 py-2 tabular-nums">{j.proposalsCount}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">{new Date(j.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-zinc-500">{label}</div>
      {children}
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "completed" || status === "ready_for_review" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    : status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}
