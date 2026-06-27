import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { runSourcing } from "@/lib/sourcing/runner";
import { runNewsSourcing } from "@/lib/sourcing/news-runner";
import { runMarketNewsIngestion } from "@/lib/sourcing/market-news-runner";
import { recordAdminRun } from "@/lib/system/admin-run-log";
import { scheduleBackgroundJob } from "@/lib/system/with-background-job";

export const runtime = "nodejs";
// A standard sourcing pass or news discovery can each take 1-4 min.
export const maxDuration = 300;

const Body = z.object({
  vendorId: z.string().optional(),
  // Server-side multi-vendor batch: the console sends the id list ONCE and the
  // loop runs in after(), so closing the tab no longer kills the remaining
  // vendors (the old client-side loop did).
  vendorIds: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional(),
  persist: z.boolean().optional(),
  // Manual per-vendor debug: run the press-release news pipeline (writes
  // EvidenceProposal) instead of standard evidence sourcing.
  news: z.boolean().optional(),
  // Manual "refresh the news FEED" — runs the AI-news RSS ingestion that writes
  // IntelligenceNewsItem (the rows shown on /news and the Query breaking-news card).
  market: z.boolean().optional(),
});
type BodyT = z.infer<typeof Body>;

/** Human-readable kind + label for the durable admin-run log. */
function describeRun(d: BodyT): { kind: string; label: string } {
  if (d.market) return { kind: "news_feed", label: "Refresh news feed (AI-news RSS)" };
  if (d.news) return { kind: "news_sourcing", label: `News sourcing — ${d.vendorId ?? "?"}` };
  if (d.vendorId) return { kind: "sourcing", label: `Evidence sourcing — ${d.vendorId}` };
  return { kind: "sourcing", label: "Evidence sourcing — today's rotation vendor" };
}

/** Keep only primitive fields from a run result for the compact log. */
function toSummary(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Compact summary for a standard sourcing run (drops the big outcomes array +
 *  the free-text firstError, which stays in the live logs). */
function sourcingSummary(r: Awaited<ReturnType<typeof runSourcing>>, vendorId?: string): Record<string, unknown> {
  const totals: Record<string, unknown> = { ...r.totals };
  delete totals.firstError;
  return { vendorId: vendorId ?? "rotation", durationMs: r.durationMs, ...totals };
}

const busy = () =>
  Response.json({ ok: false, started: false, error: "A sourcing run is already in progress. Wait for it to finish." }, { status: 409 });
const startedResp = (kind: string, jobId: string | null, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: true, started: true, kind, jobId, ...extra }, { status: 202 });

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }
  const d = parsed.data;
  const hasBatch = Array.isArray(d.vendorIds) && d.vendorIds.length > 0;
  if (d.news && !d.vendorId && !hasBatch) {
    return Response.json({ error: "vendorId required for news sourcing" }, { status: 422 });
  }

  // ── Multi-vendor batch: loop SERVER-SIDE in one background job ──────────────
  if (hasBatch) {
    const ids = d.vendorIds!;
    const kind = d.news ? "news_sourcing" : "sourcing";
    const noun = d.news ? "News" : "Evidence";
    const sched = await scheduleBackgroundJob({
      kind,
      label: `${noun} sourcing — ${ids.length} vendor${ids.length === 1 ? "" : "s"}`,
      run: async (report) => {
        let ok = 0, failed = 0, proposalsPersisted = 0;
        for (let i = 0; i < ids.length; i += 1) {
          const vid = ids[i];
          await report({ phase: kind, current: i, total: ids.length, vendor: vid });
          const s = new Date();
          try {
            const summary = d.news
              ? toSummary(await runNewsSourcing(vid))
              : sourcingSummary(await runSourcing({ vendorId: vid, persist: d.persist }), vid);
            ok += 1;
            proposalsPersisted += Number(summary.proposalsPersisted ?? 0);
            await recordAdminRun({ kind, label: `${noun} sourcing — ${vid}`, status: "ok", summary, startedAt: s, finishedAt: new Date() }).catch(() => {});
          } catch (e) {
            failed += 1;
            await recordAdminRun({ kind, label: `${noun} sourcing — ${vid}`, status: "error", error: (e as Error).message, startedAt: s, finishedAt: new Date() }).catch(() => {});
          }
        }
        await report({ phase: kind, current: ids.length, total: ids.length });
        return { vendors: ids.length, ok, failed, proposalsPersisted };
      },
    });
    return sched.alreadyActive ? busy() : startedResp(kind, sched.jobId, { vendors: ids.length });
  }

  // ── Single run (rotation vendor / one vendor / news / market) ──────────────
  const { kind, label } = describeRun(d);
  const sched = await scheduleBackgroundJob({
    kind,
    label,
    run: async (report) => {
      await report({ phase: kind, current: 0, total: 1, vendor: d.vendorId });
      const startedAt = new Date();
      try {
        let summary: Record<string, unknown>;
        if (d.market) summary = toSummary(await runMarketNewsIngestion());
        else if (d.news) summary = toSummary(await runNewsSourcing(d.vendorId!));
        else summary = sourcingSummary(await runSourcing(d), d.vendorId);
        await recordAdminRun({ kind, label, status: "ok", summary, startedAt, finishedAt: new Date() }).catch(() => {});
        return summary;
      } catch (err) {
        await recordAdminRun({ kind, label, status: "error", error: (err as Error).message, startedAt, finishedAt: new Date() }).catch(() => {});
        throw err;
      }
    },
  });
  return sched.alreadyActive ? busy() : startedResp(kind, sched.jobId);
}
