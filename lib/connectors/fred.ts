/**
 * FRED — Federal Reserve Economic Data.
 *
 * Use cases: rates, yields, unemployment, CPI/PCE proxies, financial
 * conditions indices. Foundational macro signals for the market-regime
 * engine.
 *
 * Requires FRED_API_KEY (free at https://fred.stlouisfed.org/docs/api/api_key.html).
 * Rate limit: 120 req/min per key.
 */

import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { scrubSecretsFromUrl } from "./url-scrub";
import { getLastFetch, recordLastFetch } from "./types";

const HOME = "https://fred.stlouisfed.org/";
const DOCS = "https://fred.stlouisfed.org/docs/api/fred/";
const API = "https://api.stlouisfed.org/fred/series/observations";

export interface FredQuery {
  /** FRED series ID, e.g. "FEDFUNDS", "CPIAUCSL", "DGS10". */
  seriesId: string;
  observationStart?: string; // YYYY-MM-DD
  observationEnd?: string;
  limit?: number;
}

interface FredObservation { date: string; value: string }
interface FredRecord { seriesId: string; observations: FredObservation[] }

export const fredConnector: Connector<FredQuery, FredRecord> = {
  health(): ConnectorHealth {
    const key = process.env.FRED_API_KEY;
    const last = getLastFetch("fred");
    return {
      id: "fred",
      label: "FRED (Federal Reserve)",
      group: "macro",
      tier: "central_bank",
      requiresKey: true,
      envVars: ["FRED_API_KEY"],
      configured: Boolean(key),
      status: key ? "ok" : "not_configured",
      homepageUrl: HOME,
      apiDocsUrl: DOCS,
      rateLimitNotes: "120 req/min/key. Free tier — register at fred.stlouisfed.org/docs/api/api_key.html.",
      defaultEvidenceGrade: "E5",
      defaultConfidenceFloor: 95,
      description: "Macro time-series (rates, CPI, PCE, unemployment, yield curve, financial conditions). Authoritative.",
      lastFetchAt: last?.at,
      lastFetchOk: last?.ok,
      lastFetchError: last?.error,
      lastFetchRecordCount: last?.recordCount,
    };
  },

  async fetch(query?: FredQuery): Promise<FetchResult<FredRecord>> {
    const fetchedAt = new Date().toISOString();
    const key = process.env.FRED_API_KEY;
    if (!key) return { ok: false, status: "not_configured", records: [], recordCount: 0, fetchedAt, error: "FRED_API_KEY not set" };
    if (!query?.seriesId) return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "seriesId required" };
    const params = new URLSearchParams({ series_id: query.seriesId, api_key: key, file_type: "json" });
    if (query.observationStart) params.set("observation_start", query.observationStart);
    if (query.observationEnd) params.set("observation_end", query.observationEnd);
    if (query.limit) params.set("limit", String(query.limit));
    const url = `${API}?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("fred", { ok: false, error });
        return { ok: false, status: res.status === 429 ? "rate_limited" : "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: scrubSecretsFromUrl(url) };
      }
      const json = await res.json() as { observations?: FredObservation[] };
      const records: FredRecord[] = [{ seriesId: query.seriesId, observations: json.observations ?? [] }];
      recordLastFetch("fred", { ok: true, recordCount: json.observations?.length ?? 0 });
      return { ok: true, status: "ok", records, recordCount: json.observations?.length ?? 0, fetchedAt, sourceUrl: scrubSecretsFromUrl(url) };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("fred", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
