/**
 * Free / official data-source connector framework.
 *
 * Each connector implements this contract. The runtime gate (configured /
 * not_configured / not_implemented / error / ok) makes the operator's life
 * obvious: nothing fakes a "live" status.
 *
 * Connector outputs are normalised into EvidenceSource shape (see
 * lib/evidence/normalise.ts) so they flow into the truth engine without
 * connector-specific glue downstream.
 */

import type { EvidenceGrade } from "../types";

export type ConnectorStatus = "ok" | "not_configured" | "not_implemented" | "error" | "rate_limited";

export type ConnectorTier = "official" | "official_government" | "central_bank" | "exchange" | "reputable_news" | "developer_signal";

export interface ConnectorHealth {
  id: string;
  label: string;
  group: "macro" | "filings" | "energy" | "regulatory" | "developer" | "news_event" | "market_data" | "vendor_docs";
  tier: ConnectorTier;
  requiresKey: boolean;
  envVars: string[];
  configured: boolean;
  status: ConnectorStatus;
  /** Optional human-readable status detail — e.g. "EIA_API_KEY is required"
   * when status is `not_configured`. Surfaced in /api/data-sources/status
   * and the /admin/data-sources page. */
  message?: string;
  rateLimitNotes?: string;
  homepageUrl: string;
  apiDocsUrl: string;
  lastFetchAt?: string;
  lastFetchOk?: boolean;
  lastFetchError?: string;
  lastFetchRecordCount?: number;
  defaultEvidenceGrade: EvidenceGrade;
  defaultConfidenceFloor: number; // 0-100, baseline confidence applied to records from this source
  description: string;
}

export interface FetchResult<T = unknown> {
  ok: boolean;
  status: ConnectorStatus;
  records: T[];
  recordCount: number;
  fetchedAt: string;
  error?: string;
  rateLimitRemaining?: number;
  sourceUrl?: string;
}

/**
 * Connector contract. Each adapter implements `health()` synchronously (cheap
 * env-check only, no network) and `fetch(query?)` asynchronously.
 */
export interface Connector<TQuery = void, TRecord = unknown> {
  health(): ConnectorHealth;
  fetch(query?: TQuery): Promise<FetchResult<TRecord>>;
}

// In-memory rolling state — last-fetch outcome per connector for the admin
// status page. Persisted to DB later via SourcingRun + EvidenceSource.
const _lastFetch = new Map<string, { at: string; ok: boolean; recordCount?: number; error?: string }>();

export function recordLastFetch(connectorId: string, outcome: { ok: boolean; recordCount?: number; error?: string }): void {
  _lastFetch.set(connectorId, { at: new Date().toISOString(), ...outcome });
}

export function getLastFetch(connectorId: string) {
  return _lastFetch.get(connectorId);
}
