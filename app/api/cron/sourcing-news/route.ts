// Vendor news / press-release sourcing cron.
// ─────────────────────────────────────────────
// Runs the news discovery pipeline against ONE vendor per invocation,
// rotating through vendors with press_release entries in the manifest.
// Runs daily at 05:05 UTC — 2 hours after the standard rolling cron
// (03:05 UTC) so there's no resource contention.
//
// Discovery pipeline per vendor:
//   1. Fetch the vendor's news listing page.
//   2. Haiku discovers individual articles, scores each for relevance (≥60)
//      and importance (≥40). Irrelevant/low-importance articles are dropped
//      before any full fetch or LLM extraction cost is incurred.
//   3. Dedup against EvidenceProposal.sourceUrl — skip already-ingested URLs.
//   4. Fetch each passing article and run the standard extract→classify pipeline.
//   5. Persist as pending EvidenceProposals for operator review.
//
// Trigger:
//   - Vercel Cron daily at 05:05 UTC (Authorization: Bearer $CRON_SECRET)
//   - Manual: curl -H "x-admin-token: $TOKEN" /api/cron/sourcing-news
//   - Scoped: /api/cron/sourcing-news?vendor=vendor_openai

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { runNewsSourcing } from "@/lib/sourcing/news-runner";
import { SOURCE_MANIFEST } from "@/lib/sourcing/manifest";
import { hasDatabase } from "@/lib/prisma";
import { touchRefreshTimestamp } from "@/lib/system/daily-refresh-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Each article fetch + 2 Haiku passes (discovery + extraction) + classify
// takes ~15–30s. 5 articles per vendor × 30s = ~2.5 min worst case.
export const maxDuration = 300;

function pickTodaysVendor(override?: string): string | undefined {
  if (override) return override;
  // Only vendors that have at least one press_release entry
  const vendors = [...new Set(
    SOURCE_MANIFEST
      .filter((e) => e.category === "press_release")
      .map((e) => e.vendorId),
  )].sort();
  if (vendors.length === 0) return undefined;
  const dayOfEpoch = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return vendors[dayOfEpoch % vendors.length];
}

async function handle(request: Request) {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();
  if (!hasDatabase()) {
    return Response.json({ skipped: "no_database" }, { status: 200 });
  }

  const url = new URL(request.url);
  const vendor = pickTodaysVendor(url.searchParams.get("vendor") ?? undefined);
  if (!vendor) {
    return Response.json({ skipped: "no_press_release_vendors_in_manifest" }, { status: 200 });
  }

  try {
    const result = await runNewsSourcing(vendor);
    await touchRefreshTimestamp("sourcing_news", {
      vendor,
      articlesDiscovered: result.totals.articlesDiscovered,
      articlesIngested: result.totals.articlesIngested,
      proposalsPersisted: result.totals.proposalsPersisted,
    });
    return Response.json({
      ok: true,
      vendor,
      runId: result.runId,
      durationMs: result.durationMs,
      totals: result.totals,
      listings: result.listings.map((l) => ({
        listingUrl: l.listingUrl,
        listingFetchOk: l.listingFetchOk,
        articlesDiscovered: l.articlesDiscovered,
        articlesDedupSkipped: l.articlesDedupSkipped,
        articlesIngested: l.articlesIngested,
        proposalsExtracted: l.proposalsExtracted,
        proposalsPersisted: l.proposalsPersisted,
        articles: l.articles.map((a) => ({
          url: a.url,
          title: a.title,
          status: a.status,
          importance: a.importanceScore,
          proposalsExtracted: a.proposalsExtracted,
          proposalsPersisted: a.proposalsPersisted,
          durationMs: a.durationMs,
          error: a.error,
        })),
      })),
    });
  } catch (err) {
    console.error("[cron/sourcing-news] failed", err);
    return Response.json(
      { error: (err as Error).message, vendor },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
