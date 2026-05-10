/**
 * Alpha Vantage — public equities, fundamentals, news/sentiment, market status.
 * Requires ALPHA_VANTAGE_API_KEY (free tier: 25 req/day).
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";
const HOME = "https://www.alphavantage.co/";
const DOCS = "https://www.alphavantage.co/documentation/";
const API = "https://www.alphavantage.co/query";
export interface AlphaVantageQuery { fn: string; symbol?: string; params?: Record<string, string>; }
interface AlphaVantageRecord { fn: string; raw: unknown }
export const alphaVantageConnector: Connector<AlphaVantageQuery, AlphaVantageRecord> = {
  health(): ConnectorHealth {
    const key = process.env.ALPHA_VANTAGE_API_KEY;
    const last = getLastFetch("alphaVantage");
    return {
      id: "alphaVantage", label: "Alpha Vantage", group: "market_data", tier: "exchange",
      requiresKey: true, envVars: ["ALPHA_VANTAGE_API_KEY"], configured: Boolean(key),
      status: key ? "ok" : "not_configured",
      homepageUrl: HOME, apiDocsUrl: DOCS,
      rateLimitNotes: "Free tier: 25 req/day. Premium: 75-1200 req/min depending on plan.",
      defaultEvidenceGrade: "E4", defaultConfidenceFloor: 80,
      description: "Public equities prices, fundamentals, news + sentiment, market status. Tight free-tier limit.",
      lastFetchAt: last?.at, lastFetchOk: last?.ok, lastFetchError: last?.error, lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: AlphaVantageQuery): Promise<FetchResult<AlphaVantageRecord>> {
    const fetchedAt = new Date().toISOString();
    const key = process.env.ALPHA_VANTAGE_API_KEY;
    if (!key) return { ok: false, status: "not_configured", records: [], recordCount: 0, fetchedAt, error: "ALPHA_VANTAGE_API_KEY not set" };
    if (!query?.fn) return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "fn required (e.g. 'GLOBAL_QUOTE', 'NEWS_SENTIMENT')" };
    const params = new URLSearchParams({ function: query.fn, apikey: key });
    if (query.symbol) params.set("symbol", query.symbol);
    Object.entries(query.params ?? {}).forEach(([k, v]) => params.set(k, v));
    const url = `${API}?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("alphaVantage", { ok: false, error });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const raw = await res.json() as Record<string, unknown>;
      // Alpha Vantage returns 200 with a "Note" or "Information" field on rate-limit hits.
      if (typeof raw["Note"] === "string" || typeof raw["Information"] === "string") {
        const error = String(raw["Note"] ?? raw["Information"]);
        recordLastFetch("alphaVantage", { ok: false, error });
        return { ok: false, status: "rate_limited", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const records: AlphaVantageRecord[] = [{ fn: query.fn, raw }];
      recordLastFetch("alphaVantage", { ok: true, recordCount: 1 });
      return { ok: true, status: "ok", records, recordCount: 1, fetchedAt, sourceUrl: url };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("alphaVantage", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
