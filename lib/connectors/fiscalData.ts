/**
 * US Treasury Fiscal Data — debt, rates, public finance, exchange rates.
 * No API key required.
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";
const HOME = "https://fiscaldata.treasury.gov/";
const DOCS = "https://fiscaldata.treasury.gov/api-documentation/";
const API = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service";
export interface FiscalQuery { endpoint: string; params?: Record<string, string>; }
interface FiscalRecord { endpoint: string; data: unknown[] }
export const fiscalDataConnector: Connector<FiscalQuery, FiscalRecord> = {
  health(): ConnectorHealth {
    const last = getLastFetch("fiscalData");
    return {
      id: "fiscalData", label: "US Treasury Fiscal Data", group: "macro", tier: "official_government",
      requiresKey: false, envVars: [], configured: true, status: "ok",
      homepageUrl: HOME, apiDocsUrl: DOCS,
      rateLimitNotes: "No key, public, generous limits.",
      defaultEvidenceGrade: "E5", defaultConfidenceFloor: 95,
      description: "Federal debt, daily rates, public finance, exchange rates. No key required.",
      lastFetchAt: last?.at, lastFetchOk: last?.ok, lastFetchError: last?.error, lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: FiscalQuery): Promise<FetchResult<FiscalRecord>> {
    const fetchedAt = new Date().toISOString();
    if (!query?.endpoint) return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "endpoint required (e.g. '/v1/accounting/od/debt_to_penny')" };
    const params = new URLSearchParams(query.params ?? {});
    const url = `${API}${query.endpoint}${params.toString() ? `?${params.toString()}` : ""}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("fiscalData", { ok: false, error });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const json = await res.json() as { data?: unknown[] };
      const records: FiscalRecord[] = [{ endpoint: query.endpoint, data: json.data ?? [] }];
      recordLastFetch("fiscalData", { ok: true, recordCount: json.data?.length ?? 0 });
      return { ok: true, status: "ok", records, recordCount: json.data?.length ?? 0, fetchedAt, sourceUrl: url };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("fiscalData", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
