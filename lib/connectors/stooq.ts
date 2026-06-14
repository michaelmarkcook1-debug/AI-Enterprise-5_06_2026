/**
 * Stooq — alternative no-key public price + history source.
 *
 * Used as a secondary to Yahoo Finance for the Investor Tools surfaces.
 * Stooq is a Polish exchange-data aggregator with a CSV download API
 * that requires no registration and no API key. It serves:
 *   - Daily OHLCV bars     (s=AAPL.US&i=d)
 *   - End-of-day quote     (last row of the same CSV)
 *
 * URL pattern:
 *   https://stooq.com/q/d/l/?s=<symbol>&i=<interval>
 *
 * Symbol convention: US tickers need a `.US` suffix (e.g. AAPL.US,
 * MSFT.US). The helper in this file normalises raw tickers.
 *
 * Important caveats:
 *   - Stooq returns CSV, not JSON. We parse the first/last row.
 *   - Some thinly-traded names return empty CSV; treat as "not found".
 *   - The CSV is updated end-of-day; intraday quotes are not available
 *     via the no-key endpoint.
 *
 * Evidence grade: E3 (real public quote, same tier as Yahoo).
 */

import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";

const STOOQ_BASE = "https://stooq.com/q/d/l/";
const HOMEPAGE = "https://stooq.com/";
const DOCS = "https://stooq.com/q/d/?h"; // help page on download params

export interface StooqQuery {
  /** Raw exchange ticker (e.g. "AAPL", "MSFT", "GOOGL"). */
  symbol: string;
  /** "d" daily, "w" weekly, "m" monthly. Defaults to "d". */
  interval?: "d" | "w" | "m";
  /** US market suffix toggle. Default true. */
  appendUsSuffix?: boolean;
}

export interface StooqPoint {
  date: string; // YYYY-MM-DD
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface StooqRecord {
  symbol: string;
  resolvedSymbol: string;
  points: StooqPoint[];
  /** Convenience: the last close in the series, the simplest "quote". */
  lastClose: number | null;
  /** Period covered, useful for the UI provenance badge. */
  startDate: string | null;
  endDate: string | null;
}

const POLITE_HEADERS: HeadersInit = {
  "user-agent": "AI Enterprise market data fetcher (contact: investor-tools@ai-enterprise.local)",
  "accept-language": "en-US,en;q=0.9",
  accept: "text/csv,text/plain;q=0.9,*/*;q=0.5",
};

function normaliseSymbol(symbol: string, appendUsSuffix: boolean): string {
  const s = symbol.toUpperCase();
  if (!appendUsSuffix) return s;
  if (s.includes(".")) return s;
  return `${s}.US`;
}

function parseCsv(text: string): StooqPoint[] {
  // Header: Date,Open,High,Low,Close,Volume
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const di = header.indexOf("date");
  const oi = header.indexOf("open");
  const hi = header.indexOf("high");
  const li = header.indexOf("low");
  const ci = header.indexOf("close");
  const vi = header.indexOf("volume");
  if (di === -1 || ci === -1) return [];
  const out: StooqPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    const date = row[di]?.trim();
    if (!date) continue;
    const num = (idx: number) => {
      if (idx === -1) return null;
      const raw = row[idx]?.trim();
      if (!raw || raw === "N/A") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    out.push({
      date,
      open: num(oi),
      high: num(hi),
      low: num(li),
      close: num(ci),
      volume: num(vi),
    });
  }
  return out;
}

export const stooqConnector: Connector<StooqQuery, StooqRecord> = {
  health(): ConnectorHealth {
    const last = getLastFetch("stooq");
    return {
      id: "stooq",
      label: "Stooq (no-key alternative)",
      group: "market_data",
      tier: "exchange",
      requiresKey: false,
      envVars: [],
      configured: true,
      status: "ok",
      homepageUrl: HOMEPAGE,
      apiDocsUrl: DOCS,
      rateLimitNotes: "No formal limit. CSV download endpoint. Polite User-Agent sent. Updated end-of-day.",
      defaultEvidenceGrade: "E3",
      defaultConfidenceFloor: 76,
      description: "Stooq daily OHLCV — alternative to Yahoo Finance for the Investor Tools surfaces. Free, no key, CSV.",
      lastFetchAt: last?.at,
      lastFetchOk: last?.ok,
      lastFetchError: last?.error,
      lastFetchRecordCount: last?.recordCount,
    };
  },

  async fetch(query?: StooqQuery): Promise<FetchResult<StooqRecord>> {
    const fetchedAt = new Date().toISOString();
    if (!query?.symbol) {
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "symbol required" };
    }
    const resolved = normaliseSymbol(query.symbol, query.appendUsSuffix ?? true);
    const interval = query.interval ?? "d";
    const url = `${STOOQ_BASE}?s=${encodeURIComponent(resolved.toLowerCase())}&i=${interval}`;
    try {
      const res = await fetch(url, { headers: POLITE_HEADERS });
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("stooq", { ok: false, error });
        return { ok: false, status: res.status === 429 ? "rate_limited" : "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const text = await res.text();
      // Stooq returns the literal string "No data" (HTTP 200) for unknown symbols.
      if (text.toLowerCase().startsWith("no data")) {
        const error = `Stooq: no data for ${resolved}`;
        recordLastFetch("stooq", { ok: false, error });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const points = parseCsv(text);
      if (points.length === 0) {
        const error = "Stooq: empty CSV";
        recordLastFetch("stooq", { ok: false, error });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const last = points[points.length - 1];
      const first = points[0];
      const record: StooqRecord = {
        symbol: query.symbol,
        resolvedSymbol: resolved,
        points,
        lastClose: last.close,
        startDate: first.date,
        endDate: last.date,
      };
      recordLastFetch("stooq", { ok: true, recordCount: points.length });
      return { ok: true, status: "ok", records: [record], recordCount: points.length, fetchedAt, sourceUrl: url };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      recordLastFetch("stooq", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
    }
  },
};
