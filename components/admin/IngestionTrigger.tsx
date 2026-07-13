"use client";

// Manual ingestion trigger with a cost-confirmation gate.
// ──────────────────────────────────────────────────────
// Automated ingestion (the daily Vercel cron) is SUSPENDED. Ingestion now only
// runs when an operator presses this button and confirms the spend. Pressing it
// opens a red warning card with an itemised Anthropic-API cost estimate; only
// after explicit confirmation does it POST /api/cron/daily-refresh?full=1.
//
// The full run takes many minutes — far longer than a request can stay open
// (that was the HTTP 504). So the POST now returns 202 immediately and the run
// executes in the BACKGROUND (after(), durable via progressive persistence).
// This component then POLLS ?status=1 to render live per-step progress until the
// run finishes. /admin/pipeline-health remains the authoritative live view.

import { useEffect, useRef, useState } from "react";

// Itemised estimate for a forced FULL run (full 43-vendor competitive news at
// 3 searches each + analyst coverage + IPO forecasts + sourcing/financials on
// Haiku). Web-search token sizes dominate the variance, hence a range.
const COST_LINES: Array<{ label: string; detail: string; usd: string }> = [
  { label: "Competitive news (43 vendors)", detail: "~129 web searches + Sonnet", usd: "$5–7" },
  { label: "Analyst coverage (24 providers)", detail: "~144 web searches + Sonnet", usd: "$3–5" },
  { label: "IPO forecasts (12 providers)", detail: "~48 web searches + Sonnet", usd: "$1–2" },
  { label: "Sourcing + financials", detail: "Haiku extraction (cheap)", usd: "$1–2" },
];
const COST_TOTAL = "≈ $10–16";

// Must match the LAST trackedStep in lib/system/daily-refresh.ts. When this step
// is present the run reached the end (even if some steps errored). If the
// orchestrator changes, the stall-timeout fallback below still terminates.
const FINAL_STEP = "competitive_overlap_alerts";
// The whole run is capped at the route's 600s maxDuration, and a single heavy
// step (analyst coverage / investor tools) can run several minutes without a
// heartbeat. Keep the stall window comfortably ABOVE the max run length so it
// only fires for a genuinely cut/crashed run — never mid-step. The happy path
// terminates instantly via FINAL_STEP, so this is just the safety net.
const STALL_TIMEOUT_MS = 12 * 60 * 1000;
// Absolute catch-all: if the page can't confirm completion within this window —
// e.g. the background run threw before writing ANY row, so no run is ever
// recognised as "ours" — stop spinning and point the operator at Pipeline health.
const ABSOLUTE_TIMEOUT_MS = 13 * 60 * 1000;

interface StepReport { step: string; ok: boolean; durationMs: number; summary?: Record<string, unknown>; error?: string }
type Phase = "idle" | "confirming" | "running" | "done" | "error";

export default function IngestionTrigger() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [token, setToken] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepReport[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);

  const triggeredAtRef = useRef(0);
  const acceptActiveRef = useRef(false);
  const lastStepCountRef = useRef(0);
  const lastChangeAtRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // While a background run is in progress, poll the run record every 4s and
  // tick an elapsed counter every 1s.
  useEffect(() => {
    if (phase !== "running") return;
    setElapsedSec(0);
    tickRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    pollRef.current = setInterval(() => { void pollStatus(); }, 4000);
    void pollStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function finishUnconfirmed() {
    setResult("Couldn't confirm completion from this page — the run may still be finishing. See Pipeline health for the authoritative result.");
    setError(null);
    setPhase("done");
  }

  async function pollStatus() {
    const overTime = Date.now() - triggeredAtRef.current > ABSOLUTE_TIMEOUT_MS;
    try {
      const res = await fetch("/api/cron/daily-refresh?status=1", {
        headers: token ? { "x-admin-token": token } : {},
      });
      if (!res.ok) {
        if (overTime) finishUnconfirmed();
        return;
      }
      const { run, active } = (await res.json()) as {
        run: { startedAt: string; ok: boolean; steps: StepReport[]; errors: string[] } | null;
        active: boolean;
      };
      // Ignore the *previous* run until our background run writes its row. If we
      // can never recognise our run (no row written / early crash), the absolute
      // timeout still releases the UI.
      const isOurs =
        !!run && (acceptActiveRef.current || new Date(run.startedAt).getTime() >= triggeredAtRef.current - 5000);
      if (!run || !isOurs) {
        if (overTime) finishUnconfirmed();
        return;
      }

      const stepsArr: StepReport[] = Array.isArray(run.steps) ? run.steps : [];
      setSteps(stepsArr);

      // Track step-count changes to detect a stalled (timed-out / crashed) run.
      const now = Date.now();
      if (stepsArr.length !== lastStepCountRef.current) {
        lastStepCountRef.current = stepsArr.length;
        lastChangeAtRef.current = now;
      }

      const reachedEnd = stepsArr.length > 0 && stepsArr[stepsArr.length - 1]?.step === FINAL_STEP;
      const stalled = overTime || (!active && now - lastChangeAtRef.current > STALL_TIMEOUT_MS);

      if (reachedEnd || stalled) {
        const okCount = stepsArr.filter((s) => s.ok).length;
        const errCount = Array.isArray(run.errors) ? run.errors.length : 0;
        setResult(
          reachedEnd
            ? `Finished: ${okCount}/${stepsArr.length} steps OK${errCount ? ` · ${errCount} step error(s)` : ""}`
            : `Stopped after ${okCount}/${stepsArr.length} steps — the run may have hit the time limit. Re-run, or see Pipeline health.`,
        );
        setError(null);
        setPhase("done");
      }
    } catch {
      // transient poll error — the interval will retry
    }
  }

  async function runIngestion() {
    setPhase("running");
    setError(null);
    setResult(null);
    setSteps([]);
    triggeredAtRef.current = Date.now();
    acceptActiveRef.current = false;
    lastStepCountRef.current = 0;
    // Seed the stall clock at trigger time so a run that writes a row but never
    // advances a step still releases via the stall path (not just the absolute one).
    lastChangeAtRef.current = Date.now();
    try {
      const res = await fetch("/api/cron/daily-refresh?full=1", {
        method: "POST",
        headers: token ? { "x-admin-token": token } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // A run is already in progress — attach to it and show its progress
        // instead of erroring out.
        acceptActiveRef.current = true;
        return;
      }
      if (!res.ok && res.status !== 202) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // 202 accepted — the polling effect (phase === "running") tracks it.
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  const okSoFar = steps.filter((s) => s.ok).length;

  return (
    <div className="rounded-2xl border border-[#e3d9c0] bg-white p-6 shadow-sm dark:border-[#1d3a57] dark:bg-[#0c2238]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#4c5d75] dark:text-[#a7bacd]">
            Data ingestion
          </div>
          <h2 className="mt-1 text-xl font-semibold">Run ingestion manually</h2>
          <p className="mt-1 text-sm text-[#3f5068] dark:text-[#a7bacd]">
            Automated daily ingestion is <strong className="text-amber-700 dark:text-amber-400">suspended</strong>.
            The pipeline now runs only when you trigger it here and confirm the cost.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Auto: OFF
        </span>
      </div>

      {/* Idle → primary button */}
      {(phase === "idle" || phase === "done" || phase === "error") && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPhase("confirming")}
            className="inline-flex items-center gap-2 rounded-full bg-[#0c2238] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1c3d5c] dark:bg-white dark:text-[#13294b] dark:hover:bg-[#e3d9c0]"
          >
            Run full ingestion now
            <span aria-hidden>→</span>
          </button>
          {phase === "done" && result && (
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              ✓ {result}
            </span>
          )}
          {phase === "error" && error && (
            <span className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              Error: {error}
            </span>
          )}
        </div>
      )}

      {/* Confirming → RED cost-warning card */}
      {phase === "confirming" && (
        <div className="mt-4 rounded-xl border-2 border-red-400 bg-red-50 p-5 dark:border-red-700 dark:bg-red-950/30">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400" aria-hidden>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h3 className="text-base font-bold text-red-800 dark:text-red-300">This run spends real money</h3>
          </div>
          <p className="mt-2 text-sm text-red-900/90 dark:text-red-200/90">
            A full ingestion run makes live Anthropic API calls (Claude + web search) across the whole vendor universe.
            It draws down your Anthropic credit balance and takes several minutes — it runs in the background, so you can
            leave this page; live progress also shows on Pipeline health.
          </p>

          {/* Itemised cost estimate */}
          <div className="mt-4 rounded-lg border border-red-200 bg-white/70 p-3 dark:border-red-900/50 dark:bg-red-950/40">
            <div className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
              Estimated cost (directional)
            </div>
            <table className="mt-2 w-full text-xs">
              <tbody className="divide-y divide-red-100 dark:divide-red-900/40">
                {COST_LINES.map((line) => (
                  <tr key={line.label}>
                    <td className="py-1.5 pr-2 font-medium text-red-900 dark:text-red-200">{line.label}</td>
                    <td className="py-1.5 pr-2 text-red-700/70 dark:text-red-300/60">{line.detail}</td>
                    <td className="py-1.5 text-right font-mono font-semibold text-red-900 dark:text-red-200">{line.usd}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-red-300 dark:border-red-800">
                  <td className="py-1.5 pr-2 font-bold text-red-900 dark:text-red-100" colSpan={2}>Estimated total</td>
                  <td className="py-1.5 text-right font-mono text-sm font-bold text-red-900 dark:text-red-100">{COST_TOTAL}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs italic text-red-700/70 dark:text-red-300/60">
              Estimate only — actual cost depends on web-search result sizes. If credits are exhausted, steps fail with a billing error.
            </p>
          </div>

          {/* Admin token (only when ADMIN_API_OPEN is off) */}
          <label className="mt-3 block">
            <div className="mb-1 text-xs font-medium text-red-800 dark:text-red-300">
              x-admin-token (only required when ADMIN_API_OPEN is off)
            </div>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm dark:border-red-800 dark:bg-[#0c2238]"
            />
          </label>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={runIngestion}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700"
            >
              Yes, run it and spend credits
            </button>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              className="rounded-full border border-[#d6c9a8] px-5 py-2.5 text-sm font-semibold text-[#2e3f57] transition-colors hover:bg-[#ece3cb] dark:border-[#2a4a6b] dark:text-[#d8e2ec] dark:hover:bg-[#143049]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Running → live progress from the background run */}
      {phase === "running" && (
        <div className="mt-4 rounded-xl border border-[#e3d9c0] bg-[#f6f1e3] px-4 py-3 dark:border-[#1d3a57] dark:bg-[#081c30]/40">
          <div className="flex items-center gap-3 text-sm font-medium text-[#2e3f57] dark:text-[#c2d1e0]">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#9fb0c4] border-t-transparent" aria-hidden />
            Running in the background — {elapsedSec}s elapsed
            {steps.length > 0 && <span className="font-semibold"> · {okSoFar}/{steps.length} steps OK</span>}
          </div>
          <p className="mt-1 text-xs text-[#54647a] dark:text-[#a7bacd]">
            {steps.length === 0
              ? "Starting the pipeline…"
              : `Last step: ${steps[steps.length - 1]?.step}${steps[steps.length - 1]?.ok === false ? " (error)" : ""}`}
            {" "}You can leave this page — it keeps running. Authoritative progress on{" "}
            <a href="/admin/pipeline-health" className="underline">Pipeline health →</a>
          </p>
          {steps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {steps.map((s) => (
                <span
                  key={s.step}
                  title={s.error ?? undefined}
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    s.ok
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                  }`}
                >
                  {s.step}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
