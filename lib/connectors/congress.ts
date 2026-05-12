/**
 * Congress.gov — AI / chip / privacy / export-control legislation tracking.
 * Requires CONGRESS_API_KEY (free at api.congress.gov/sign-up/).
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { scrubSecretsFromUrl } from "./url-scrub";
import { getLastFetch, recordLastFetch } from "./types";
const HOME = "https://www.congress.gov/";
const DOCS = "https://api.congress.gov/";
const API = "https://api.congress.gov/v3";
export interface CongressQuery { path: string; params?: Record<string, string>; }
interface CongressRecord { path: string; raw: unknown }
export const congressConnector: Connector<CongressQuery, CongressRecord> = {
  health(): ConnectorHealth {
    const key = process.env.CONGRESS_API_KEY;
    const last = getLastFetch("congress");
    return {
      id: "congress", label: "Congress.gov API", group: "regulatory", tier: "official_government",
      requiresKey: true, envVars: ["CONGRESS_API_KEY"], configured: Boolean(key),
      status: key ? "ok" : "not_configured",
      homepageUrl: HOME, apiDocsUrl: DOCS,
      rateLimitNotes: "5000 req/hr/key. Free — sign up at api.congress.gov/sign-up/.",
      defaultEvidenceGrade: "E5", defaultConfidenceFloor: 95,
      description: "US legislation tracking (AI bills, chip / export control, privacy). Authoritative.",
      lastFetchAt: last?.at, lastFetchOk: last?.ok, lastFetchError: last?.error, lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: CongressQuery): Promise<FetchResult<CongressRecord>> {
    const fetchedAt = new Date().toISOString();
    const key = process.env.CONGRESS_API_KEY;
    if (!key) return { ok: false, status: "not_configured", records: [], recordCount: 0, fetchedAt, error: "CONGRESS_API_KEY not set" };
    if (!query?.path) return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "path required (e.g. '/bill?q=artificial+intelligence')" };
    const params = new URLSearchParams({ api_key: key, format: "json", ...(query.params ?? {}) });
    const url = `${API}${query.path}${query.path.includes("?") ? "&" : "?"}${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("congress", { ok: false, error });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: scrubSecretsFromUrl(url) };
      }
      const raw = await res.json();
      const records: CongressRecord[] = [{ path: query.path, raw }];
      recordLastFetch("congress", { ok: true, recordCount: 1 });
      return { ok: true, status: "ok", records, recordCount: 1, fetchedAt, sourceUrl: scrubSecretsFromUrl(url) };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("congress", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
