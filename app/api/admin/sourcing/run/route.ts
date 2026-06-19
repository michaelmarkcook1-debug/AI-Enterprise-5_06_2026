import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { runSourcing } from "@/lib/sourcing/runner";
import { runNewsSourcing } from "@/lib/sourcing/news-runner";
import { runMarketNewsIngestion } from "@/lib/sourcing/market-news-runner";
import { recordAdminRun } from "@/lib/system/admin-run-log";

export const runtime = "nodejs";
// A standard sourcing pass or news discovery can each take 1-4 min.
export const maxDuration = 300;

const Body = z.object({
  vendorId: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  persist: z.boolean().optional(),
  // Manual per-vendor debug: run the press-release news pipeline (writes
  // EvidenceProposal) instead of standard evidence sourcing.
  news: z.boolean().optional(),
  // Manual "refresh the news FEED" — runs the AI-news RSS ingestion that writes
  // IntelligenceNewsItem (the rows shown on /news and the Query breaking-news
  // card). This is the only writer to the feed besides the competitive monitor,
  // and previously had NO manual trigger — it only ran inside the daily cron.
  market: z.boolean().optional(),
});

/** Human-readable kind + label for the durable admin-run log. */
function describeRun(d: z.infer<typeof Body>): { kind: string; label: string } {
  if (d.market) return { kind: "news_feed", label: "Refresh news feed (AI-news RSS)" };
  if (d.news) return { kind: "news_sourcing", label: `News sourcing — ${d.vendorId ?? "?"}` };
  if (d.vendorId) return { kind: "sourcing", label: `Evidence sourcing — ${d.vendorId}` };
  return { kind: "sourcing", label: "Evidence sourcing — today's rotation vendor" };
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }

  // News sourcing requires an explicit vendor — validate before we start (and
  // before we log a run that never ran).
  if (parsed.data.news && !parsed.data.vendorId) {
    return Response.json({ error: "vendorId required for news sourcing" }, { status: 422 });
  }

  const { kind, label } = describeRun(parsed.data);
  const startedAt = new Date();
  try {
    let result: unknown;
    let summary: Record<string, unknown>;
    if (parsed.data.market) {
      result = await runMarketNewsIngestion();
      summary = toSummary(result);
    } else if (parsed.data.news) {
      result = await runNewsSourcing(parsed.data.vendorId!);
      summary = toSummary(result);
    } else {
      const r = await runSourcing(parsed.data);
      result = r;
      // Keep the compact numeric totals only. Drop the large per-source
      // `outcomes` array and the free-text `firstError` (an unbounded upstream
      // error string makes an ugly durable chip and could embed a source URL;
      // it stays visible in the live response, the jobs table, and the logs).
      const totals: Record<string, unknown> = { ...r.totals };
      delete totals.firstError;
      summary = { vendorId: parsed.data.vendorId ?? "rotation", durationMs: r.durationMs, ...totals };
    }
    // Best-effort durable log so the result survives navigation / tab switches.
    await recordAdminRun({ kind, label, status: "ok", summary, startedAt, finishedAt: new Date() }).catch(() => {});
    return Response.json(result);
  } catch (err) {
    const message = (err as Error).message;
    console.error("[admin/sourcing/run] failed", err);
    await recordAdminRun({ kind, label, status: "error", error: message, startedAt, finishedAt: new Date() }).catch(() => {});
    return Response.json({ error: message }, { status: 500 });
  }
}

/** Keep only primitive/number fields from a run result for the compact log. */
function toSummary(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") out[k] = v;
  }
  return out;
}
