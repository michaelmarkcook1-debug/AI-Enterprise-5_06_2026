// Returns the timestamp of the most-recent successful daily refresh.
// Used by the TopNav "Data refreshed" badge.
//
// We treat the most-recent VendorRankingSnapshot.capturedAt as the
// canonical freshness signal: every successful run of the daily
// pipeline writes one snapshot per vendor with capturedAt=now(), so
// the maximum capturedAt is a reliable proxy for "when did the
// pipeline last succeed".

import { getLastRefreshedAt } from "@/lib/system/daily-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const lastRefreshedAt = await getLastRefreshedAt();
  return Response.json({
    lastRefreshedAt: lastRefreshedAt?.toISOString() ?? null,
  });
}
