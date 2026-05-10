/**
 * EIA — US Energy Information Administration. Power, electricity, oil, gas.
 * Critical for AI-infrastructure constraint signals (data-centre energy).
 * Requires EIA_API_KEY (free at eia.gov/opendata/register.php).
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";
const HOME = "https://www.eia.gov/";
const DOCS = "https://www.eia.gov/opendata/documentation.php";
const API = "https://api.eia.gov/v2";
export interface EiaQuery { route: string; params?: Record<string, string | number>; }
interface EiaRecord { route: string; rows: unknown[] }
export const eiaConnector: Connector<EiaQuery, EiaRecord> = {
  health(): ConnectorHealth {
    const key = process.env.EIA_API_KEY;
    const last = getLastFetch("eia");
    return {
      id: "eia", label: "EIA (Energy Information Administration)", group: "energy", tier: "official_government",
      requiresKey: true, envVars: ["EIA_API_KEY"], configured: Boolean(key),
      status: key ? "ok" : "not_configured",
      homepageUrl: HOME, apiDocsUrl: DOCS,
      rateLimitNotes: "Generous limits, free key required.",
      defaultEvidenceGrade: "E5", defaultConfidenceFloor: 92,
      description: "Power, electricity, oil, gas, capacity. Critical for AI data-centre energy constraint signals.",
      lastFetchAt: last?.at, lastFetchOk: last?.ok, lastFetchError: last?.error, lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: EiaQuery): Promise<FetchResult<EiaRecord>> {
    const fetchedAt = new Date().toISOString();
    const key = process.env.EIA_API_KEY;
    if (!key) return { ok: false, status: "not_configured", records: [], recordCount: 0, fetchedAt, error: "EIA_API_KEY not set" };
    if (!query?.route) return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "route required (e.g. 'electricity/rto/region-data/data')" };
    const params = new URLSearchParams({ api_key: key });
    Object.entries(query.params ?? {}).forEach(([k, v]) => params.set(k, String(v)));
    const url = `${API}/${query.route}?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("eia", { ok: false, error });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const json = await res.json() as { response?: { data?: unknown[] } };
      const rows = json.response?.data ?? [];
      const records: EiaRecord[] = [{ route: query.route, rows }];
      recordLastFetch("eia", { ok: true, recordCount: rows.length });
      return { ok: true, status: "ok", records, recordCount: rows.length, fetchedAt, sourceUrl: url };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("eia", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
