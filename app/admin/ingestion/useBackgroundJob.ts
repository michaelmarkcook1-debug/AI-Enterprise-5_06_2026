"use client";

// Client hook for a server-backed background job (admin_jobs).
// ───────────────────────────────────────────────────────────
// fire() POSTs a start endpoint that returns 202 + jobId, then POLLS
// /api/admin/jobs/status?kind= until the SERVER reports the job inactive. busy
// is driven by the server's view — so leaving the tab and returning re-attaches
// to the in-flight run (seed `initialActive` from the server-rendered page) and
// the spinner reflects work that's still executing, not just a pending fetch.

import { useCallback, useEffect, useRef, useState } from "react";

export interface BackgroundJob {
  id: string;
  kind: string;
  label: string;
  status: "running" | "ok" | "error";
  progress: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

const POLL_MS = 3000;

export function useBackgroundJob(
  kind: string,
  opts?: { token?: string; initialActive?: BackgroundJob | null },
) {
  const [busy, setBusy] = useState<boolean>(!!opts?.initialActive);
  const [job, setJob] = useState<BackgroundJob | null>(opts?.initialActive ?? null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // drives elapsed re-render
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const token = opts?.token;

  const headers = useCallback(
    (): HeadersInit => (token ? { "x-admin-token": token, "content-type": "application/json" } : { "content-type": "application/json" }),
    [token],
  );

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/jobs/status?kind=${encodeURIComponent(kind)}`, { headers: headers() });
      const body = await res.json().catch(() => ({}));
      if (body.job) setJob(body.job as BackgroundJob);
      if (body.active) { setBusy(true); setTick((t) => t + 1); }
      else { setBusy(false); stopPoll(); }
    } catch {
      /* transient — keep polling */
    }
  }, [kind, headers, stopPoll]);

  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(() => { void poll(); }, POLL_MS);
  }, [poll, stopPoll]);

  // Resume on mount: if the server says a job is in flight, attach to it.
  useEffect(() => {
    if (opts?.initialActive) { setBusy(true); startPoll(); void poll(); }
    return stopPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fire = useCallback(
    async (endpoint: string, payload: Record<string, unknown>) => {
      setError(null);
      setBusy(true); // optimistic — closes the click→first-poll gap
      try {
        const res = await fetch(endpoint, { method: "POST", headers: headers(), body: JSON.stringify(payload) });
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) { setError(body.error ?? "Already running."); startPoll(); void poll(); return; }
        if (!res.ok && res.status !== 202) { setBusy(false); setError(body.error ?? `HTTP ${res.status}`); return; }
        if (body.started === false) { setBusy(false); setJob(null); setError(body.note ? null : (body.error ?? null)); return; }
        startPoll(); void poll();
      } catch (e) {
        setBusy(false);
        setError((e as Error).message);
      }
    },
    [headers, startPoll, poll],
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _tick = tick;
  const elapsedSec = busy && job?.startedAt
    ? Math.max(0, Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000))
    : 0;

  return { busy, job, error, elapsedSec, fire };
}
