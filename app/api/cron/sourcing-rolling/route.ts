// Rolling sourcing cron.
// ───────────────────────
// Runs the public-data ingestion pipeline against ONE vendor per
// invocation, rotating through the manifest. Designed for Vercel
// Cron daily schedule (Hobby plan ceiling) — full manifest cycles
// through every vendor in ~vendorCount days (~3-4 weeks for 28 vendors).
//
// Trigger:
//   - Vercel Cron daily at 03:05 UTC (Authorization: Bearer $CRON_SECRET)
//   - Manual: curl -H "x-admin-token: $TOKEN" /api/cron/sourcing-rolling
//
// Selection:
//   - Default: vendor index = (days-since-epoch) mod manifestVendorCount
//   - Override: ?vendor=vendor_writer to scope manually
//
// Each run persists proposals to the DB. Downstream pipeline:
//   1. This route fetches + LLM-extracts + persists pending proposals
//   2. /api/cron/safe-actions promotes the safe ones to evidence
//      records (separate cron, runs 15 min after this one).

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { runSourcing } from "@/lib/sourcing/runner";
import { runCompetitiveIntelMonitor } from "@/lib/intelligence/competitive-monitor";
import { runMarketNewsIngestion } from "@/lib/sourcing/market-news-runner";
import { deriveVendorScores } from "@/lib/system/derive-scores";
import { SOURCE_MANIFEST } from "@/lib/sourcing/manifest";
import { hasDatabase } from "@/lib/prisma";
import { touchRefreshTimestamp } from "@/lib/system/daily-refresh-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Functions default is 300s. Sourcing one vendor (~3 sources +
// LLM extraction) is typically 30-90s. Headroom is fine.
export const maxDuration = 300;

function pickTodaysVendor(override?: string): string | undefined {
  if (override) return override;
  const vendors = [...new Set(SOURCE_MANIFEST.map((e) => e.vendorId))].sort();
  if (vendors.length === 0) return undefined;
  // Day-of-epoch modulo vendor count → deterministic rotation that
  // cycles through every vendor over (vendors.length) days.
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
    return Response.json({ skipped: "no_vendors_in_manifest" }, { status: 200 });
  }

  try {
    const result = await runSourcing({ vendorId: vendor, persist: true });
    await touchRefreshTimestamp("sourcing_rolling", {
      vendor,
      proposalsExtracted: result.totals.proposalsExtracted,
      proposalsPersisted: result.totals.proposalsPersisted,
    });

    // Daily news publish — folded into this cron because Vercel Hobby caps
    // cron jobs at 2 (both slots are used by the sourcing crons). The
    // competitive-intel monitor is the only path that writes published
    // IntelligenceNewsItem rows (web-search grounded, 14-day lookback,
    // idempotent sha1-keyed upserts), so without this the news feed / Query
    // "Breaking news" card go stale. Sourcing one vendor leaves headroom under
    // the 300s cap; the monitor is wrapped so a failure or timeout never fails
    // the sourcing run, and its idempotent upserts simply resume next day.
    // (On Vercel Pro this would be a cleaner dedicated /api/cron/competitive-intel
    // daily cron — see vercel.json note.)
    let newsRefresh: { ok: boolean; itemsUpserted?: number; error?: string };
    try {
      const monitor = await runCompetitiveIntelMonitor();
      await touchRefreshTimestamp("competitive_intel", {
        vendorsAttempted: monitor.vendorsAttempted,
        itemsUpserted: monitor.itemsUpserted,
      });
      newsRefresh = { ok: monitor.errors.length === 0, itemsUpserted: monitor.itemsUpserted };
    } catch (newsErr) {
      console.error("[cron/sourcing-rolling] news monitor failed (sourcing still ok)", newsErr);
      newsRefresh = { ok: false, error: (newsErr as Error).message };
    }

    // Broad AI/tech news feeds — 9 RSS sources, Haiku batch-scored, written to
    // IntelligenceNewsItem alongside the per-vendor competitive monitor.
    let marketNews: { ok: boolean; upserted?: number; error?: string };
    try {
      const market = await runMarketNewsIngestion();
      marketNews = { ok: market.errors.length === 0, upserted: market.itemsUpserted };
    } catch (marketErr) {
      console.error("[cron/sourcing-rolling] market news ingestion failed (sourcing still ok)", marketErr);
      marketNews = { ok: false, error: (marketErr as Error).message };
    }

    // Recompute vendor momentum + overall/confidence scores from the freshly
    // ingested news + evidence. Pure DB math (no LLM cost) — runs LAST so it
    // sees this run's new rows. Idempotent; wrapped so a failure never fails
    // the sourcing run. This is what makes newly-sourced intel flow into the
    // momentum, winning/losing lists, and market-overview analysis daily —
    // previously deriveVendorScores only ran on a manual /admin trigger.
    let scoreRecompute: { ok: boolean; vendorsUpdated?: number; momentumRowsUpdated?: number; error?: string };
    try {
      const derived = await deriveVendorScores();
      await touchRefreshTimestamp("derive_scores", {
        vendorsUpdated: derived.vendorsUpdated,
        momentumRowsUpdated: derived.momentumRowsUpdated,
      });
      scoreRecompute = { ok: !derived.skipped, vendorsUpdated: derived.vendorsUpdated, momentumRowsUpdated: derived.momentumRowsUpdated };
    } catch (deriveErr) {
      console.error("[cron/sourcing-rolling] score recompute failed (sourcing still ok)", deriveErr);
      scoreRecompute = { ok: false, error: (deriveErr as Error).message };
    }

    return Response.json({
      ok: true,
      vendor,
      runId: result.runId,
      durationMs: result.durationMs,
      newsRefresh,
      marketNews,
      scoreRecompute,
      totals: result.totals,
      // Trim per-source detail — keep response under 1 MB so Vercel
      // logging stays clean.
      sources: result.outcomes.slice(0, 50).map((o) => ({
        url: o.url,
        status: o.status,
        proposalsExtracted: o.proposalsExtracted,
        proposalsPersisted: o.proposalsPersisted,
        durationMs: o.durationMs,
        error: o.error,
      })),
    });
  } catch (err) {
    console.error("[cron/sourcing-rolling] failed", err);
    return Response.json(
      { error: (err as Error).message, vendor },
      { status: 500 },
    );
  }
}

// Vercel Cron uses GET by default. Accept both for manual testing.
export const GET = handle;
export const POST = handle;
