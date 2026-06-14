/**
 * BLS — Bureau of Labor Statistics.
 *
 * Use cases: CPI, PPI, employment situation, unemployment, payrolls, wages.
 * BLS_API_KEY optional but raises rate limit (500 → 25 req/day without key).
 */

import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";

const HOME = "https://www.bls.gov/";
const DOCS = "https://www.bls.gov/developers/";
const API = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

export interface BlsQuery {
  seriesIds: string[]; // up to 50 with key, 25 without
  startYear?: string;
  endYear?: string;
}

interface BlsObservation { year: string; period: string; value: string }
interface BlsRecord { seriesId: string; observations: BlsObservation[] }

export const blsConnector: Connector<BlsQuery, BlsRecord> = {
  health(): ConnectorHealth {
    const key = process.env.BLS_API_KEY;
    const last = getLastFetch("bls");
    return {
      id: "bls",
      label: "BLS (Bureau of Labor Statistics)",
      group: "macro",
      tier: "official_government",
      requiresKey: false,
      envVars: ["BLS_API_KEY"],
      configured: true, // works without key, just lower limits
      status: "ok",
      homepageUrl: HOME,
      apiDocsUrl: DOCS,
      rateLimitNotes: key ? "500 req/day with key, 50 series per request, 20 years range" : "25 req/day no key, 25 series per request, 10 years range — register at bls.gov for 500/day",
      defaultEvidenceGrade: "E5",
      defaultConfidenceFloor: 95,
      description: "CPI, PPI, employment, payrolls, wages — authoritative US labour data.",
      lastFetchAt: last?.at,
      lastFetchOk: last?.ok,
      lastFetchError: last?.error,
      lastFetchRecordCount: last?.recordCount,
    };
  },

  async fetch(query?: BlsQuery): Promise<FetchResult<BlsRecord>> {
    const fetchedAt = new Date().toISOString();
    if (!query?.seriesIds?.length) return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "seriesIds required" };
    const key = process.env.BLS_API_KEY;
    const body: Record<string, unknown> = { seriesid: query.seriesIds };
    if (query.startYear) body.startyear = query.startYear;
    if (query.endYear) body.endyear = query.endYear;
    if (key) body.registrationkey = key;
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("bls", { ok: false, error });
        return { ok: false, status: res.status === 429 ? "rate_limited" : "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: API };
      }
      const json = await res.json() as { Results?: { series?: { seriesID: string; data: BlsObservation[] }[] } };
      const records: BlsRecord[] = (json.Results?.series ?? []).map((s) => ({ seriesId: s.seriesID, observations: s.data }));
      const total = records.reduce((sum, r) => sum + r.observations.length, 0);
      recordLastFetch("bls", { ok: true, recordCount: total });
      return { ok: true, status: "ok", records, recordCount: total, fetchedAt, sourceUrl: API };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("bls", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
