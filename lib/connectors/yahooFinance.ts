/**
 * Yahoo Finance — public no-key alternative to Alpha Vantage.
 *
 * Endpoint used:
 *   - https://query1.finance.yahoo.com/v8/finance/chart/<symbol>
 *     Returns OHLCV time series + meta block (currency, exchange,
 *     regularMarketPrice, previousClose). Used for BOTH "chart" mode
 *     (full series) and "quote" mode (last-point snapshot derived
 *     from chart meta + last close).
 *
 * Note on /v7/finance/quote: as of late 2025 the v7 quote endpoint
 * requires a Yahoo crumb cookie and returns 401 without it. We deliberately
 * do NOT use it — chart meta carries enough for a snapshot quote.
 *
 * No API key. No registration. Rate-limited unofficially by Yahoo; we
 * include a polite User-Agent and accept-language header. Tier is
 * "exchange" (same as Alpha Vantage). Default evidence grade is E3 —
 * not as authoritative as SEC filings (E5) but a real public quote
 * source. Use for Market Tracker / Public AI Stocks when
 * ALPHA_VANTAGE_API_KEY is not set.
 *
 * IMPORTANT — value handling:
 *   Yahoo returns numbers as JSON numbers (NOT strings like EIA).
 *   Some fields are absent for delisted / non-equity symbols — every
 *   accessor below tolerates undefined.
 */

import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";

const HOME = "https://finance.yahoo.com/";
const DOCS = "https://finance.yahoo.com/"; // No formal docs page — endpoints are unofficial but stable for years.
const CHART_API = (symbol: string, range: string, interval: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;

const POLITE_HEADERS: Record<string, string> = {
  // Yahoo blocks default fetch UA; this is the documented polite shape.
  "User-Agent": "Mozilla/5.0 (compatible; AIEnterpise/1.0; +https://www.aienterpise.app)",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface YahooFinanceQuery {
  /** "chart" returns OHLCV series; "quote" returns instant summary. */
  resource: "chart" | "quote";
  /** Single symbol for chart, csv list for quote. */
  symbol?: string;
  symbols?: string[];
  /** chart-only: range (e.g. "1mo", "1y", "5y", "max"). Default "1y". */
  range?: string;
  /** chart-only: interval (e.g. "1d", "1wk", "1mo"). Default "1d". */
  interval?: string;
}

export interface YahooChartPoint {
  date: string; // ISO date
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface YahooChartRecord {
  resource: "chart";
  symbol: string;
  currency?: string;
  exchange?: string;
  regularMarketPrice?: number;
  points: YahooChartPoint[];
}

export interface YahooQuoteRecord {
  resource: "quote";
  symbol: string;
  shortName?: string;
  currency?: string;
  exchange?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
  trailingPE?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

export type YahooRecord = YahooChartRecord | YahooQuoteRecord;

export const yahooFinanceConnector: Connector<YahooFinanceQuery, YahooRecord> = {
  health(): ConnectorHealth {
    const last = getLastFetch("yahooFinance");
    return {
      id: "yahooFinance",
      label: "Yahoo Finance (no-key public alternative)",
      group: "market_data",
      tier: "exchange",
      requiresKey: false,
      envVars: [],
      configured: true, // No env required — always available.
      status: "ok",
      homepageUrl: HOME,
      apiDocsUrl: DOCS,
      rateLimitNotes:
        "No formal limit. Unofficial endpoint. Polite User-Agent + Accept-Language sent. May rate-limit aggressive callers.",
      defaultEvidenceGrade: "E3",
      defaultConfidenceFloor: 78,
      description:
        "Public no-key market data — OHLCV time series + quote summaries. Used as fallback for Market Tracker / Public AI Stocks when ALPHA_VANTAGE_API_KEY is not set.",
      lastFetchAt: last?.at,
      lastFetchOk: last?.ok,
      lastFetchError: last?.error,
      lastFetchRecordCount: last?.recordCount,
    };
  },

  async fetch(query?: YahooFinanceQuery): Promise<FetchResult<YahooRecord>> {
    const fetchedAt = new Date().toISOString();
    if (!query?.resource) {
      return {
        ok: false,
        status: "error",
        records: [],
        recordCount: 0,
        fetchedAt,
        error: "resource required: 'chart' or 'quote'",
      };
    }

    try {
      if (query.resource === "chart") {
        if (!query.symbol) {
          return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "symbol required for chart" };
        }
        const url = CHART_API(query.symbol, query.range ?? "1y", query.interval ?? "1d");
        const res = await fetch(url, { headers: POLITE_HEADERS });
        if (!res.ok) {
          const error = `HTTP ${res.status} ${res.statusText}`;
          recordLastFetch("yahooFinance", { ok: false, error });
          return { ok: false, status: res.status === 429 ? "rate_limited" : "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
        }
        const json = (await res.json()) as ChartResponse;
        const result = json.chart?.result?.[0];
        if (!result) {
          const error = "Yahoo returned no chart result";
          recordLastFetch("yahooFinance", { ok: false, error });
          return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
        }
        const points = parseChartPoints(result);
        const record: YahooChartRecord = {
          resource: "chart",
          symbol: query.symbol,
          currency: result.meta?.currency,
          exchange: result.meta?.exchangeName,
          regularMarketPrice: result.meta?.regularMarketPrice,
          points,
        };
        recordLastFetch("yahooFinance", { ok: true, recordCount: points.length });
        return { ok: true, status: "ok", records: [record], recordCount: points.length, fetchedAt, sourceUrl: url };
      }

      // resource === "quote" — derived from chart meta. The v7 quote
      // endpoint requires Yahoo crumb auth and we deliberately avoid
      // it (see file header). Chart meta carries the same snapshot
      // data: regularMarketPrice, previousClose, currency, exchange,
      // 52-week high/low.
      const symbols = query.symbols ?? (query.symbol ? [query.symbol] : []);
      if (symbols.length === 0) {
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "symbols required for quote" };
      }
      const records: YahooQuoteRecord[] = [];
      const errors: string[] = [];
      // One request per symbol — chart endpoint is single-symbol.
      // For ≤ 10 symbols this is fast and stays under rate limit.
      for (const sym of symbols) {
        const url = CHART_API(sym, "5d", "1d");
        const res = await fetch(url, { headers: POLITE_HEADERS });
        if (!res.ok) {
          errors.push(`${sym}: HTTP ${res.status}`);
          continue;
        }
        const json = (await res.json()) as ChartResponse;
        const result = json.chart?.result?.[0];
        if (!result) {
          errors.push(`${sym}: no chart result`);
          continue;
        }
        const meta = result.meta;
        const change =
          meta?.regularMarketPrice !== undefined && meta.previousClose !== undefined
            ? meta.regularMarketPrice - meta.previousClose
            : undefined;
        const pct =
          change !== undefined && meta?.previousClose ? (change / meta.previousClose) * 100 : undefined;
        records.push({
          resource: "quote" as const,
          symbol: sym,
          currency: meta?.currency,
          exchange: meta?.exchangeName,
          regularMarketPrice: meta?.regularMarketPrice,
          regularMarketChange: change,
          regularMarketChangePercent: pct,
          fiftyTwoWeekHigh: meta?.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: meta?.fiftyTwoWeekLow,
        });
      }
      const ok = records.length > 0;
      if (!ok) {
        recordLastFetch("yahooFinance", { ok: false, error: errors.join("; ") });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: errors.join("; ") || "no quote data" };
      }
      recordLastFetch("yahooFinance", { ok: true, recordCount: records.length });
      return { ok: true, status: "ok", records, recordCount: records.length, fetchedAt };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("yahooFinance", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};

// ─── Internal types + helpers ────────────────────────────────────────────

interface ChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        exchangeName?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: unknown;
  };
}

function parseChartPoints(result: NonNullable<NonNullable<ChartResponse["chart"]>["result"]>[number]): YahooChartPoint[] {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) return [];
  return timestamps.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    open: quote.open?.[i] ?? null,
    high: quote.high?.[i] ?? null,
    low: quote.low?.[i] ?? null,
    close: quote.close?.[i] ?? null,
    volume: quote.volume?.[i] ?? null,
  }));
}
