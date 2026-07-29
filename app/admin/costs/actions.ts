"use server";

// Server Actions for the paid-action buttons.
// ─────────────────────────────────────────────────────────────────────────────
// Owner 2026-07-28: "stop asking for the admin token!!!!" — correct. Pasting a
// secret into your own back office to press your own button is friction I
// added, not security you asked for.
//
// So the button no longer carries a credential at all. It calls a Server Action
// which invokes the pipeline DIRECTLY in server code — no HTTP hop, no header,
// nothing to type.
//
// WHY THIS IS STILL NOT THE HOLE I CLOSED. The original problem was that a
// plain GET to /api/cron/daily-refresh ran the pipeline, so any crawler
// following the URL billed a run. A Server Action is not reachable that way:
// Next.js only dispatches it on a POST carrying a build-generated action id,
// and enforces same-origin. A crawler cannot trigger it by walking links.
//
// The HTTP route keeps its isSpendAuthorized() gate for cron/CLI callers, so
// that path stays closed to anonymous GETs. This action is the human path.
//
// Honest limit: a Server Action is not an authentication boundary. Anyone who
// loads this public /admin page could press the button. That is the same
// exposure every other admin control here already has (admin pages are public
// by owner instruction 2026-07-10), it needs a deliberate POST rather than a
// stray GET, and the $5/cycle + $25/day caps and duplicate-run guard still
// bound the damage. If that changes, the fix is a real admin session, not a
// token field.

import { runDailyRefresh, DuplicateRunError } from "@/lib/system/daily-refresh";
import { isRunActive } from "@/lib/system/daily-refresh-store";

export interface RunResult {
  ok: boolean;
  message: string;
}

/**
 * Run the refresh pipeline. `full` forces every step (the web-search-heavy
 * ones that otherwise wait for the weekly cadence).
 *
 * The full run is fire-and-forget because it outlives a request; the standard
 * run is awaited so the button can report a real outcome.
 */
export async function runRefresh(full: boolean): Promise<RunResult> {
  // Pre-check the duplicate guard so a double-click reports honestly instead of
  // throwing — and, more to the point, never bills twice.
  if (await isRunActive()) {
    return { ok: false, message: "A run is already in progress — not starting another." };
  }

  try {
    if (full) {
      // Deliberately not awaited: a full run takes many minutes. Errors are
      // logged rather than surfaced, so the ledger is where you confirm cost.
      void runDailyRefresh(new Date(), { force: true }).catch((err) => {
        console.error("[admin/costs] full run failed:", err);
      });
      return {
        ok: true,
        message: "Full run started in the background. Cost appears in the ledger as steps complete.",
      };
    }

    const report = await runDailyRefresh(new Date(), { force: false });
    return {
      ok: report.ok,
      message: report.ok
        ? "Standard run finished. Check the recorded figure above — the ledger under-reports, so treat it as a floor."
        : "Run finished with errors — see the pipeline logs.",
    };
  } catch (err) {
    if (err instanceof DuplicateRunError) {
      return { ok: false, message: "A run is already in progress — not starting another." };
    }
    return { ok: false, message: `Failed: ${(err as Error).message}` };
  }
}
