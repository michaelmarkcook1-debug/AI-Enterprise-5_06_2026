/**
 * Freshness gate — translates a sourceDate + a per-source horizon into a
 * fresh / stale / unknown status. The horizon is per source class:
 * official filings stay fresh for 90 days, market sentiment for 14, etc.
 */

import type { ConnectorTier } from "../connectors/types";

export type FreshnessStatus = "fresh" | "stale" | "unknown";

const HORIZON_DAYS_BY_TIER: Record<ConnectorTier, number> = {
  official: 180,
  official_government: 180,
  central_bank: 90,
  exchange: 7,
  reputable_news: 14,
  developer_signal: 30,
};

export function freshnessOf(sourceDate: string | undefined, tier: ConnectorTier, now = new Date()): FreshnessStatus {
  if (!sourceDate) return "unknown";
  const d = new Date(sourceDate);
  if (Number.isNaN(d.getTime())) return "unknown";
  const ageDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > HORIZON_DAYS_BY_TIER[tier] ? "stale" : "fresh";
}
