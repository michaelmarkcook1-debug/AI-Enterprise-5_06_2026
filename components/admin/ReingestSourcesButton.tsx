"use client";

import { useState } from "react";

interface ReingestRow {
  id: string;
  label: string;
  group: string;
  configured: boolean;
  status: string;
  recordCount: number;
  error?: string;
  envVars: string[];
  requiresKey: boolean;
}

interface ReingestResult {
  ranAt: string;
  attempted: number;
  ok: number;
  notConfigured: number;
  failed: number;
  skipped: number;
  rows: ReingestRow[];
}

const STATUS_TONE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  not_configured: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  rate_limited: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  skipped: "bg-[#ece3cb] text-[#3f5068] dark:bg-[#143049] dark:text-[#a7bacd]",
  error: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

export default function ReingestSourcesButton() {
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [result, setResult] = useState<ReingestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/data-sources/reingest", {
        method: "POST",
        headers: token ? { "x-admin-token": token, "content-type": "application/json" } : { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body as ReingestResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border-2 border-[#d4af37] bg-[#fbf6e4] p-6 shadow-sm dark:border-[#d4af37] dark:bg-[#1a1605]/40">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#a07f1f] dark:text-[#d4af37]">
        Live engine · reingest every official-data source
      </div>
      <h2 className="mt-1 text-xl font-semibold text-[#15263c] dark:text-[#eef3f8]">Reingest sources now</h2>
      <p className="mt-1 max-w-3xl text-sm text-[#3f5068] dark:text-[#a7bacd]">
        Runs a real probe fetch against every connector and reports the true result — green only when
        the source actually connected and returned rows. Connectors missing their API key report{" "}
        <span className="font-mono text-xs">not_configured</span> with the env var you need to set. No status is faked.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={run}
          className="inline-flex items-center gap-2 rounded-full bg-[#13294b] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1d3a5f] disabled:opacity-40 dark:bg-[#d4af37] dark:text-[#0a1f38] dark:hover:bg-[#e8c95c]"
        >
          {busy ? "Reingesting…" : <>Reingest from sources <span aria-hidden>→</span></>}
        </button>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          type="password"
          placeholder="x-admin-token (if ADMIN_API_OPEN is off)"
          className="w-72 rounded-lg border border-[#d6c9a8] bg-white px-3 py-2 text-sm dark:border-[#2a4a6b] dark:bg-[#071827]"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {result.ok} ok
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {result.notConfigured} not configured
            </span>
            {result.failed > 0 && (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                {result.failed} failed
              </span>
            )}
            {result.skipped > 0 && (
              <span className="rounded-full bg-[#ece3cb] px-2.5 py-1 text-[#3f5068] dark:bg-[#143049] dark:text-[#a7bacd]">
                {result.skipped} skipped
              </span>
            )}
            <span className="px-2.5 py-1 text-[#4c5d75]">
              ran {new Date(result.ranAt).toISOString().slice(0, 19).replace("T", " ")} UTC
            </span>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-[#e3d9c0] bg-white dark:border-[#1d3a57] dark:bg-[#0c2238]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#4c5d75]">
                <tr>
                  <th className="px-4 py-2">Connector</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Records</th>
                  <th className="px-4 py-2">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece4d0] dark:divide-[#1d3a57]">
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium">{r.label}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[r.status] ?? STATUS_TONE.error}`}>
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono tabular-nums text-xs">{r.recordCount || "—"}</td>
                    <td className="px-4 py-2 text-xs text-[#4c5d75]">
                      {r.status === "not_configured"
                        ? `Set ${r.envVars.join(", ")}${r.requiresKey ? " (API key)" : ""}`
                        : r.error
                          ? r.error.slice(0, 80)
                          : r.status === "ok"
                            ? "connected"
                            : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
