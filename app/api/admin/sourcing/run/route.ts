import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { runSourcing } from "@/lib/sourcing/runner";
import { runNewsSourcing } from "@/lib/sourcing/news-runner";
import { runMarketNewsIngestion } from "@/lib/sourcing/market-news-runner";

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

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }
  try {
    if (parsed.data.market) {
      const result = await runMarketNewsIngestion();
      return Response.json(result);
    }
    if (parsed.data.news) {
      if (!parsed.data.vendorId) {
        return Response.json({ error: "vendorId required for news sourcing" }, { status: 422 });
      }
      const result = await runNewsSourcing(parsed.data.vendorId);
      return Response.json(result);
    }
    const result = await runSourcing(parsed.data);
    return Response.json(result);
  } catch (err) {
    console.error("[admin/sourcing/run] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
