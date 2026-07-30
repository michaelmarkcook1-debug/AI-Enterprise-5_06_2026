"use server";

// Server Actions for the paid-action buttons.
// ─────────────────────────────────────────────────────────────────────────────
// Owner 2026-07-28: "stop asking for the admin token!!!!" — correct. So the
// button carries no credential; this action supplies it server-side.
//
// ⚠️ THE BUG THIS FILE EXISTS TO NOT REPEAT (2026-07-30):
// The first version called runDailyRefresh() directly and returned immediately
// with `void promise.catch(...)`. That is a floating promise in a serverless
// invocation. The moment the action returned its response, Vercel was free to
// freeze the function — the run died 17 SECONDS IN, after 2 of 27 steps, while
// the UI told the operator they could close the tab and it would keep going.
//
// Next's `after()` is what keeps an invocation alive past the response, and
// /api/cron/daily-refresh ALREADY does this correctly, with maxDuration = 600
// and the duplicate-run guard. That mechanism worked before I replaced it.
//
// So this action no longer reimplements background execution. It is now a
// server-side authenticated PROXY to that route: it attaches ADMIN_API_TOKEN
// (which never reaches the browser) and lets the route do the work it was
// already built to do. One background mechanism, in one place, already proven.

import { absoluteUrl } from "@/lib/site";

export interface RunResult {
  ok: boolean;
  message: string;
}

/**
 * Run the refresh pipeline via the cron route.
 *
 * `full` forces every step — including web_evidence, which is what actually
 * refreshes vendor evidence. The route returns 202 immediately and continues
 * under after(); a standard run completes within the request.
 */
export async function runRefresh(full: boolean): Promise<RunResult> {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    return {
      ok: false,
      message: "ADMIN_API_TOKEN is not configured on this deployment — the pipeline cannot be triggered.",
    };
  }

  const url = absoluteUrl(`/api/cron/daily-refresh${full ? "?full=1" : ""}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-admin-token": token },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    // 409 = a run is already going. Not an error; the caller attaches to it.
    if (res.status === 409) {
      return { ok: false, message: "A run is already in progress — not starting another." };
    }
    if (res.status === 401) {
      return { ok: false, message: "Rejected by the spend gate (401) — check ADMIN_API_TOKEN." };
    }
    if (!res.ok && res.status !== 202) {
      return { ok: false, message: `Failed: HTTP ${res.status} ${String(body.error ?? "")}`.trim() };
    }

    return full
      ? {
          ok: true,
          message:
            "Full run started. It continues on the server — you can close this tab. Watch progress on /admin/pipeline-health.",
        }
      : {
          ok: true,
          message:
            "Standard run finished. NOTE: a standard run gathers NO new web evidence — use Run FULL to refresh evidence.",
        };
  } catch (err) {
    return { ok: false, message: `Could not reach the pipeline route: ${(err as Error).message}` };
  }
}
