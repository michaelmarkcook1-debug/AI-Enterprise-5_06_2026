/**
 * Federal Register API — regulatory notices, rules, executive orders.
 * No API key required.
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";
const HOME = "https://www.federalregister.gov/";
const DOCS = "https://www.federalregister.gov/developers/documentation/api/v1";
const API = "https://www.federalregister.gov/api/v1";
export interface FederalRegisterQuery { path: string; params?: Record<string, string>; }
interface FederalRegisterRecord { path: string; raw: unknown }
export const federalRegisterConnector: Connector<FederalRegisterQuery, FederalRegisterRecord> = {
  health(): ConnectorHealth {
    const last = getLastFetch("federalRegister");
    return {
      id: "federalRegister", label: "Federal Register API", group: "regulatory", tier: "official_government",
      requiresKey: false, envVars: [], configured: true, status: "ok",
      homepageUrl: HOME, apiDocsUrl: DOCS,
      rateLimitNotes: "Public, no key. Polite limits.",
      defaultEvidenceGrade: "E5", defaultConfidenceFloor: 95,
      description: "Federal regulations, rules, executive orders. Authoritative US regulatory source.",
      lastFetchAt: last?.at, lastFetchOk: last?.ok, lastFetchError: last?.error, lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: FederalRegisterQuery): Promise<FetchResult<FederalRegisterRecord>> {
    const fetchedAt = new Date().toISOString();
    if (!query?.path) return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "path required (e.g. '/documents?conditions[term]=artificial+intelligence')" };
    const params = new URLSearchParams(query.params ?? {});
    const url = `${API}${query.path}${query.path.includes("?") ? "&" : "?"}${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("federalRegister", { ok: false, error });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const raw = await res.json() as { results?: unknown[]; count?: number };
      const records: FederalRegisterRecord[] = [{ path: query.path, raw }];
      recordLastFetch("federalRegister", { ok: true, recordCount: raw.count ?? raw.results?.length ?? 0 });
      return { ok: true, status: "ok", records, recordCount: raw.count ?? raw.results?.length ?? 0, fetchedAt, sourceUrl: url };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("federalRegister", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
