/**
 * BEA — Bureau of Economic Analysis. GDP, consumption, investment, industry.
 * Requires BEA_API_KEY (free at apps.bea.gov/API/signup/).
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";
const HOME = "https://www.bea.gov/";
const DOCS = "https://apps.bea.gov/api/_pdf/bea_web_service_api_user_guide.pdf";
const API = "https://apps.bea.gov/api/data";
export interface BeaQuery { datasetName: string; tableName?: string; frequency?: string; year?: string; }
interface BeaRecord { datasetName: string; rows: unknown[] }
export const beaConnector: Connector<BeaQuery, BeaRecord> = {
  health(): ConnectorHealth {
    const key = process.env.BEA_API_KEY;
    const last = getLastFetch("bea");
    return {
      id: "bea", label: "BEA (Bureau of Economic Analysis)", group: "macro", tier: "official_government",
      requiresKey: true, envVars: ["BEA_API_KEY"], configured: Boolean(key),
      status: key ? "ok" : "not_configured",
      homepageUrl: HOME, apiDocsUrl: DOCS,
      rateLimitNotes: "100 req/min/key. Free — sign up at apps.bea.gov/API/signup/.",
      defaultEvidenceGrade: "E5", defaultConfidenceFloor: 95,
      description: "GDP, consumption, investment, industry data — authoritative US national accounts.",
      lastFetchAt: last?.at, lastFetchOk: last?.ok, lastFetchError: last?.error, lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: BeaQuery): Promise<FetchResult<BeaRecord>> {
    const fetchedAt = new Date().toISOString();
    const key = process.env.BEA_API_KEY;
    if (!key) return { ok: false, status: "not_configured", records: [], recordCount: 0, fetchedAt, error: "BEA_API_KEY not set" };
    if (!query?.datasetName) return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "datasetName required" };
    const params = new URLSearchParams({ UserID: key, method: "GetData", DatasetName: query.datasetName, ResultFormat: "JSON" });
    if (query.tableName) params.set("TableName", query.tableName);
    if (query.frequency) params.set("Frequency", query.frequency);
    if (query.year) params.set("Year", query.year);
    const url = `${API}?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("bea", { ok: false, error });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const json = await res.json() as { BEAAPI?: { Results?: { Data?: unknown[] } } };
      const rows = json.BEAAPI?.Results?.Data ?? [];
      const records: BeaRecord[] = [{ datasetName: query.datasetName, rows }];
      recordLastFetch("bea", { ok: true, recordCount: rows.length });
      return { ok: true, status: "ok", records, recordCount: rows.length, fetchedAt, sourceUrl: url };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("bea", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
