// Uniform background-job scheduler for admin routes.
// ──────────────────────────────────────────────────
// Wraps the "start → persist → after()" contract so every long-running admin
// action survives the client navigating away: the route returns a 202
// immediately while the real work runs post-response via after() (Next 16),
// recording progress to admin_jobs. One call replaces the per-route
// begin/after/finalise boilerplate.
//
// Dedup: a kind already in flight is rejected (so a double-click / navigate-back
// re-click cannot double-spend LLM / web_search budget).

import { after } from "next/server";
import { beginJob, updateJobProgress, finaliseJob, isJobActive } from "./admin-job-store";

export interface ScheduleResult {
  started: boolean;
  jobId: string | null;
  /** true when rejected because a job of this kind is already running. */
  alreadyActive: boolean;
}

/** Report-progress callback handed to the work fn (heartbeat + snapshot). */
export type ReportProgress = (progress: Record<string, unknown>) => Promise<void>;

/**
 * Schedule `run` to execute AFTER the response is sent. Returns immediately with
 * { started, jobId }. The work continues server-side regardless of the client
 * connection; progress + final result land in the admin_jobs store for polling.
 */
export async function scheduleBackgroundJob(opts: {
  kind: string;
  label: string;
  run: (report: ReportProgress) => Promise<Record<string, unknown> | void>;
}): Promise<ScheduleResult> {
  if (await isJobActive(opts.kind)) {
    return { started: false, jobId: null, alreadyActive: true };
  }
  const jobId = await beginJob(opts.kind, opts.label);
  after(async () => {
    try {
      const result = await opts.run((progress) => updateJobProgress(jobId, progress));
      await finaliseJob(jobId, "ok", (result as Record<string, unknown>) ?? {});
    } catch (err) {
      await finaliseJob(jobId, "error", {}, err instanceof Error ? err.message : String(err));
    }
  });
  return { started: true, jobId, alreadyActive: false };
}
