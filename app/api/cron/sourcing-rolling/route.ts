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
import { SOURCE_MANIFEST } from "@/lib/sourcing/manifest";
import { hasDatabase } from "@/lib/prisma";

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
    return Response.json({
      ok: true,
      vendor,
      runId: result.runId,
      durationMs: result.durationMs,
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
