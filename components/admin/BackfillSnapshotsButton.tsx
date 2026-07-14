"use client";

// One-click backfill of ranking snapshot history.
// Shows a confirm prompt with what will happen, then POSTs to
// /api/admin/backfill-snapshots. Safe to re-run — only gaps are filled.

import { useState } from "react";

type Phase = "idle" | "confirming" | "running" | "done" | "error";

export default function BackfillSnapshotsButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [token, setToken] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPhase("running");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/backfill-snapshots", {
        method: "POST",
        headers: token ? { "x-admin-token": token } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const { todayCaptured, backfill, totalSnapshots } = body as {
        todayCaptured: number;
        backfill: { ran: boolean; inserted: number; vendors: number };
        totalSnapshots: number;
      };
      setResult(
        backfill.ran
          ? `Backfilled ${backfill.inserted} historical snapshots across ${backfill.vendors} vendors + captured today's ${todayCaptured}. Total: ${totalSnapshots} rows.`
          : `Today's snapshots captured (${todayCaptured}). History already populated — ${totalSnapshots} total rows.`,
      );
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
        <span className="mr-1.5 font-bold">✓</span>{result}
        <button onClick={() => setPhase("idle")} className="ml-3 underline opacity-70 hover:opacity-100">Reset</button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
        <span className="mr-1.5 font-bold">✗</span>{error}
        <button onClick={() => setPhase("idle")} className="ml-3 underline opacity-70 hover:opacity-100">Retry</button>
      </div>
    );
  }

  if (phase === "confirming") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Confirm backfill</p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          This will capture today&apos;s snapshot for every vendor, then reconstruct historical data for all dates without existing records.
          It is non-destructive — existing rows are never overwritten.
        </p>
        {process.env.NODE_ENV !== "development" && (
          <input
            type="text"
            placeholder="Admin token (x-admin-token)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-3 w-full rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-mono dark:border-amber-700 dark:bg-[#0d1f17]"
          />
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={run}
            className="rounded bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Run backfill
          </button>
          <button
            onClick={() => setPhase("idle")}
            className="rounded border border-amber-300 px-4 py-1.5 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (phase === "running") {
    return (
      <div className="flex items-center gap-2 text-sm text-[#4c5d75] dark:text-[#a7bacd]">
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Backfilling snapshot history…
      </div>
    );
  }

  return (
    <button
      onClick={() => setPhase("confirming")}
      className="inline-flex items-center gap-2 rounded-lg border border-[#d6c9a8] bg-white px-4 py-2 text-sm font-medium text-[#2e3f57] shadow-sm hover:bg-[#f6f1e3] dark:border-[#2a4a6b] dark:bg-[#143049] dark:text-[#d8e2ec] dark:hover:bg-[#1c3d5c]"
    >
      <span className="text-base leading-none">📈</span>
      Backfill score history
    </button>
  );
}
