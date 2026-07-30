// Step-health inspection — PURE, and deliberately in its own file.
// ─────────────────────────────────────────────────────────────────────────────
// This lived in daily-refresh.ts, which imports Next (`next/headers` via the
// auth sweep), Prisma, and ~30 other modules. Anything importing it to reach
// this one function dragged that entire graph in — a test doing so blocked at
// import time and vitest killed the worker after 537s with "Timeout waiting for
// worker to respond" and ZERO transform time. Same failure mode as
// encroachment-context: a pure helper trapped behind a heavy module.
//
// No imports here, by design. Keep it that way.

/**
 * Does a step's own summary admit that it failed?
 *
 * The orchestrator's `timed()` marked ANY step that returned as ok:true — it
 * only caught THROWN errors. But several steps catch their own exception and
 * report it as a field instead (`error`, `errorCount`, `failed`). Those ran as
 * green while broken: routine_inbox_pull reported ok:true with a Prisma
 * foreign-key violation sitting in its summary, so "27/27 steps OK" and the 96%
 * health dial were both overstating what actually happened.
 *
 * A hard `error` string means the step did not do its job → not ok.
 * Partial counts (`errorCount`, `failed` > 0) mean it partly worked; those stay
 * ok but surface as `partialErrors`, so one flaky feed can't red an entire run
 * while still being visible rather than rounded away to green.
 */
export function inspectSummary(summary: Record<string, unknown>): {
  hardError: string | null;
  partialErrors: number;
} {
  const raw = summary.error;
  const hardError =
    typeof raw === "string" && raw.trim().length > 0
      ? raw.trim()
      : raw instanceof Error
        ? raw.message
        : null;

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  // `errors` is a count here; steps carrying arrays already map to errorCount.
  const partialErrors = num(summary.errorCount) + num(summary.failed) + num(summary.errors);

  return { hardError, partialErrors };
}
