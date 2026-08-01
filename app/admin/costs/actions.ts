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
 * Run the GitHub routine-inbox pull on its own. Costs nothing: it reads JSON
 * from the GitHub Contents API and writes through the same validation firewall
 * as the direct POST route. No model is called, so this is safe to press at any
 * time regardless of Anthropic credit.
 *
 * It exists as its own button because of what it proves. This step spent weeks
 * reporting ok:true while persisting NOTHING — EvidenceProposal.jobId is a
 * foreign key to IngestionJob and the step was synthesising an id with no
 * matching row, so every insert violated the constraint and the error was
 * swallowed into a summary field. The fix creates the parent job first. Until
 * this step actually runs against production data that fix is unverified, and
 * the only other way to run it was a full pipeline run — which does spend money.
 * Verifying a free step should not cost anything.
 */
export async function runInboxPull(): Promise<RunResult> {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    return { ok: false, message: "ADMIN_API_TOKEN is not configured on this deployment." };
  }

  try {
    const res = await fetch(absoluteUrl("/api/admin/routine-inbox-pull"), {
      method: "POST",
      headers: { "x-admin-token": token },
      cache: "no-store",
    });
    const b = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.status === 401) {
      return { ok: false, message: "Rejected by the admin gate (401) — check ADMIN_API_TOKEN." };
    }
    if (b.configured === false) {
      return { ok: false, message: "GITHUB_INBOX_TOKEN is not set, so there is no inbox to read." };
    }
    if (typeof b.error === "string" && b.error) {
      return { ok: false, message: `Inbox pull failed: ${b.error}` };
    }

    const num = (k: string) => (typeof b[k] === "number" ? (b[k] as number) : 0);
    const rejected = [
      ...(Array.isArray(b.proposalsRejected) ? b.proposalsRejected : []),
      ...(Array.isArray(b.findingsRejected) ? b.findingsRejected : []),
    ] as Array<{ reason?: string }>;

    // The deciding signal. A foreign-key message here means the fix did not
    // take; anything else is ordinary per-item validation noise.
    const fkHit = rejected.find((r) => /foreign key/i.test(String(r?.reason ?? "")));
    if (fkHit) {
      return {
        ok: false,
        message: `STILL BROKEN — a foreign-key violation came back: ${String(fkHit.reason).slice(0, 200)}`,
      };
    }

    const listed = num("filesListed");
    const processed = num("filesProcessed");
    const skipped = num("filesSkippedAlreadyProcessed");
    const proposals = num("proposalsAccepted");
    const findings = num("findingsAccepted");

    if (listed === 0) {
      return {
        ok: true,
        message:
          "Inbox reached, but it holds no files — nothing to ingest. No foreign-key error, though with zero rows this run does not yet prove the fix.",
      };
    }
    if (processed === 0 && skipped > 0) {
      return {
        ok: true,
        message: `All ${skipped} file(s) were already ingested, so nothing new was written. Re-running is a safe no-op by design; this run does not exercise an insert.`,
      };
    }

    return {
      ok: true,
      message: `Ingested ${processed} of ${listed} file(s): ${proposals} proposal(s) into the triage queue, ${findings} finding(s) into the news feed${
        rejected.length ? `, ${rejected.length} item(s) rejected on validation` : ""
      }. No foreign-key error — the jobId fix holds.`,
    };
  } catch (err) {
    return { ok: false, message: `Could not reach the inbox route: ${(err as Error).message}` };
  }
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
