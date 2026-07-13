"use client";

// Manual trigger for the (non-forced, cheap-cadence) daily-refresh pipeline,
// with a live status bar. POSTs /api/admin/trigger-refresh (202, runs in the
// background via after() — see that route's maxDuration note), then polls its
// own GET ?status=1 (admin-session-cookie gated, no token needed) every 4s to
// show elapsed time, per-step chips, and the last step — same polling shape as
// IngestionTrigger's full-run status bar, retargeted to this cheaper button.

import { useEffect, useRef, useState } from "react";

// The route's own maxDuration (800s) is the hard ceiling on how long a run can
// take; give the stall/absolute timeouts headroom above it so they only fire
// for a genuinely crashed run, never mid-step.
const STALL_TIMEOUT_MS = 4 * 60 * 1000; // isRunActive's own heartbeat window is 3 min
const ABSOLUTE_TIMEOUT_MS = 850 * 1000;

interface StepReport { step: string; ok: boolean; durationMs: number; error?: string }
type Phase = "idle" | "running" | "done" | "error";

export default function TriggerDailyRefresh() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepReport[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);

  const triggeredAtRef = useRef(0);
  const acceptActiveRef = useRef(false);
  const lastStepCountRef = useRef(0);
  const lastChangeAtRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    setMsg("Couldn't confirm completion from this page — the run may still be finishing. See Pipeline health for the authoritative result.");
    setPhase("done");
  }

  async function pollStatus() {
    const overTime = Date.now() - triggeredAtRef.current > ABSOLUTE_TIMEOUT_MS;
    try {
      const res = await fetch("/api/admin/trigger-refresh?status=1", { credentials: "same-origin" });
      if (!res.ok) {
        if (overTime) finishUnconfirmed();
        return;
      }
      const { run, active } = (await res.json()) as {
        run: { startedAt: string; ok: boolean; steps: StepReport[]; errors: string[] } | null;
        active: boolean;
      };
      const isOurs =
        !!run && (acceptActiveRef.current || new Date(run.startedAt).getTime() >= triggeredAtRef.current - 5000);
      if (!run || !isOurs) {
        if (overTime) finishUnconfirmed();
        return;
      }

      const stepsArr: StepReport[] = Array.isArray(run.steps) ? run.steps : [];
      setSteps(stepsArr);

      const now = Date.now();
      if (stepsArr.length !== lastStepCountRef.current) {
        lastStepCountRef.current = stepsArr.length;
        lastChangeAtRef.current = now;
      }

      // Completion signal: the run's own heartbeat lock (isRunActive) has
      // cleared — no fragile "last step name" sentinel to keep in sync as the
      // pipeline's step list evolves.
      const stalled = !active && now - lastChangeAtRef.current > STALL_TIMEOUT_MS;

      if ((!active && stepsArr.length > 0) || stalled || overTime) {
        const okCount = stepsArr.filter((s) => s.ok).length;
        const errCount = Array.isArray(run.errors) ? run.errors.length : 0;
        setMsg(`Finished: ${okCount}/${stepsArr.length} steps OK${errCount ? ` · ${errCount} step error(s)` : ""}`);
        setPhase("done");
      }
    } catch {
      // transient poll error — the interval will retry
    }
  }

  async function trigger() {
    setPhase("running");
    setMsg(null);
    setSteps([]);
    triggeredAtRef.current = Date.now();
    acceptActiveRef.current = false;
    lastStepCountRef.current = 0;
    lastChangeAtRef.current = Date.now();
    try {
      const res = await fetch("/api/admin/trigger-refresh", { method: "POST", credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // Already running — attach to it and show its live progress.
        acceptActiveRef.current = true;
        return;
      }
      if (!res.ok) {
        setMsg(json.error ?? `HTTP ${res.status}`);
        setPhase("error");
      }
      // ok → the polling effect (phase === "running") tracks it to completion.
    } catch (e) {
      setMsg(String(e));
      setPhase("error");
    }
  }

  const okSoFar = steps.filter((s) => s.ok).length;

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={trigger}
          disabled={phase === "running"}
          className="rounded-lg border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-1.5 text-sm font-medium hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 transition"
        >
          {phase === "running" ? "Running…" : "Run daily refresh now"}
        </button>
        {phase !== "running" && msg && (
          <span className={`text-xs ${phase === "error" ? "text-red-500 dark:text-red-400" : "text-[#475a72] dark:text-[#8aa4c1]"}`}>
            {msg}
          </span>
        )}
      </div>

      {/* Status bar — live while running */}
      {phase === "running" && (
        <div className="mt-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-[#2e3f57] dark:text-[#c2d1e0]">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#9fb0c4] border-t-transparent" aria-hidden />
            {elapsedSec}s elapsed
            {steps.length > 0 && <span className="font-semibold"> · {okSoFar}/{steps.length} steps OK</span>}
          </div>
          <p className="mt-1 text-xs text-[#54647a] dark:text-[#a7bacd]">
            {steps.length === 0
              ? "Starting the pipeline…"
              : `Last step: ${steps[steps.length - 1]?.step}${steps[steps.length - 1]?.ok === false ? " (error)" : ""}`}
            {" "}You can leave this page — it keeps running. Full detail on{" "}
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

      {/* Finished summary + final step chips (stays visible until the next run) */}
      {phase === "done" && steps.length > 0 && (
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
  );
}
