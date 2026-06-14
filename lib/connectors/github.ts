/**
 * GitHub REST API — developer/community/open-source signals.
 * GITHUB_TOKEN optional but raises rate limit (60 → 5000 req/hr unauth → auth).
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";
const HOME = "https://github.com/";
const DOCS = "https://docs.github.com/en/rest";
const API = "https://api.github.com";
export interface GithubQuery { path: string; params?: Record<string, string>; }
interface GithubRecord { path: string; raw: unknown }
export const githubConnector: Connector<GithubQuery, GithubRecord> = {
  health(): ConnectorHealth {
    const token = process.env.GITHUB_TOKEN;
    const last = getLastFetch("github");
    return {
      id: "github", label: "GitHub REST API", group: "developer", tier: "developer_signal",
      requiresKey: false, envVars: ["GITHUB_TOKEN"], configured: true, status: "ok",
      homepageUrl: HOME, apiDocsUrl: DOCS,
      rateLimitNotes: token ? "5000 req/hr (authenticated)" : "60 req/hr (unauthenticated). Set GITHUB_TOKEN for 5000.",
      defaultEvidenceGrade: "E3", defaultConfidenceFloor: 70,
      description: "Repo signals, releases, contributors, languages — open-source momentum proxies.",
      lastFetchAt: last?.at, lastFetchOk: last?.ok, lastFetchError: last?.error, lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: GithubQuery): Promise<FetchResult<GithubRecord>> {
    const fetchedAt = new Date().toISOString();
    if (!query?.path) return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "path required (e.g. '/repos/openai/openai-python')" };
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const params = new URLSearchParams(query.params ?? {});
    const url = `${API}${query.path}${params.toString() ? `?${params.toString()}` : ""}`;
    try {
      const res = await fetch(url, { headers });
      const remaining = Number(res.headers.get("x-ratelimit-remaining"));
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("github", { ok: false, error });
        return { ok: false, status: res.status === 403 ? "rate_limited" : "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url, rateLimitRemaining: remaining };
      }
      const raw = await res.json();
      const records: GithubRecord[] = [{ path: query.path, raw }];
      recordLastFetch("github", { ok: true, recordCount: 1 });
      return { ok: true, status: "ok", records, recordCount: 1, fetchedAt, sourceUrl: url, rateLimitRemaining: remaining };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("github", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
