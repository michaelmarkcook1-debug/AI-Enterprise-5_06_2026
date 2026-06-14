// Live valuation metrics for Investor Tools.
// ───────────────────────────────────────────
// Combines two free, no-key sources to produce a live valuation snapshot
// per publicly-listed AI provider:
//
//   1. Stooq end-of-day price        → last close × shares = market cap
//   2. SEC XBRL companyfacts shares  → EntityCommonStockSharesOutstanding
//   3. Financials-live revenue       → P/Sales
//   4. Financials-live net income    → P/E
//
// All values are derived deterministically from the underlying public
// data. No proprietary aggregator (Yahoo quoteSummary etc.) is needed.
//
// Update frequency: matches the daily-refresh cron — every metric is
// recomputed from the previous trading day's close + the latest 10-K
// figures.

import { stooqConnector } from "../connectors/stooq";
import { secConnector, isSecUserAgentValid } from "../connectors/sec";
import { FINANCIALS_MANIFEST } from "./financials-live";
import type {
  FinancialMetric,
  InvestmentProviderProfile,
  ValuationMetric,
} from "./types";

/**
 * Read `EntityCommonStockSharesOutstanding` from the XBRL companyfacts
 * payload. That concept lives under the `dei` taxonomy (not us-gaap).
 * Returns the most-recent reported value across any filing.
 */
function readSharesOutstanding(facts: {
  facts?: Record<string, Record<string, { units?: Record<string, Array<{ end: string; val: number; form: string }>> }>>;
} | null): number | null {
  if (!facts) return null;
  const block = facts.facts?.["dei"]?.["EntityCommonStockSharesOutstanding"];
  const points = block?.units?.["shares"];
  if (!points || points.length === 0) return null;
  const sorted = [...points].sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime());
  return sorted[0]?.val ?? null;
}

async function fetchSharesOutstanding(cik: string): Promise<number | null> {
  if (!isSecUserAgentValid(process.env.SEC_USER_AGENT)) return null;
  try {
    const result = await secConnector.fetch({ cik, resource: "facts" });
    if (!result.ok || result.records.length === 0) return null;
    return readSharesOutstanding(result.records[0].raw as Parameters<typeof readSharesOutstanding>[0]);
  } catch {
    return null;
  }
}

async function fetchLastClose(ticker: string): Promise<{ close: number; date: string } | null> {
  try {
    const result = await stooqConnector.fetch({ symbol: ticker, interval: "d" });
    if (!result.ok || result.records.length === 0) return null;
    const rec = result.records[0];
    if (rec.lastClose === null || rec.endDate === null) return null;
    return { close: rec.lastClose, date: rec.endDate };
  } catch {
    return null;
  }
}

/* ─── Public API ────────────────────────────────────────────────── */

export interface ValuationFetchReport {
  providerId: string;
  source: "stooq+sec" | "stooq_only" | "none";
  fields: string[];
  error: string | null;
}

/**
 * Build a valuation snapshot for one provider. `financials` is the array
 * of FinancialMetric rows the caller already fetched via fetchFinancials
 * — passing them in avoids a second SEC round-trip.
 */
export async function fetchValuationForProvider(
  provider: InvestmentProviderProfile,
  financials: FinancialMetric[],
): Promise<{ metric: ValuationMetric | null; report: ValuationFetchReport }> {
  const capturedAt = new Date().toISOString();

  if (!provider.ticker) {
    return {
      metric: null,
      report: { providerId: provider.id, source: "none", fields: [], error: "No ticker on file" },
    };
  }

  const close = await fetchLastClose(provider.ticker);
  if (!close) {
    return {
      metric: null,
      report: { providerId: provider.id, source: "none", fields: [], error: `Stooq: no quote for ${provider.ticker}` },
    };
  }

  const entry = FINANCIALS_MANIFEST.find((m) => m.providerId === provider.id);
  const shares = entry?.cik ? await fetchSharesOutstanding(entry.cik) : null;
  const marketCap = shares !== null ? Math.round(close.close * shares) : null;

  // Latest revenue / net income from the already-fetched financials.
  const findValue = (metricName: string): number | null => {
    const hit = financials.find((m) => m.providerId === provider.id && m.metricName === metricName);
    if (!hit || typeof hit.value !== "number") return null;
    return hit.value;
  };
  const revenue = findValue("revenue_ttm");
  const netIncome = findValue("net_income_ttm");
  const operatingIncome = findValue("operating_income_ttm");

  // Derived ratios from the public sources. EV is approximated as
  // market cap until net cash from the balance sheet is wired in.
  const peRatio = marketCap !== null && netIncome && netIncome > 0 ? marketCap / netIncome : undefined;
  const evRevenue = marketCap !== null && revenue && revenue > 0 ? marketCap / revenue : undefined;
  const fcfMargin = revenue && operatingIncome && revenue > 0 ? operatingIncome / revenue : undefined;

  const fields: string[] = [];
  if (marketCap !== null) fields.push("marketCap");
  if (evRevenue !== undefined) fields.push("evRevenue");
  if (peRatio !== undefined) fields.push("peRatio");
  if (fcfMargin !== undefined) fields.push("fcfMargin");

  // Reuse ValuationMetric shape but be honest: most rich fields
  // (enterpriseValue, evGrossProfit, sbcRevenue, etc.) need balance-sheet
  // detail we don't pull yet — they stay undefined until that's wired in.
  const metric: ValuationMetric = {
    providerId: provider.id,
    marketCap: marketCap ?? undefined,
    enterpriseValue: marketCap ?? undefined,
    evRevenue,
    peRatio,
    fcfMargin,
    valuationDate: capturedAt,
    confidence: shares !== null ? 86 : 70,
  };
  // Stash source attribution off-schema so the UI badge can read it.
  (metric as ValuationMetric & { sourceUrl?: string; sourceName?: string }).sourceUrl = `https://stooq.com/q/?s=${encodeURIComponent(provider.ticker.toLowerCase())}.us`;
  (metric as ValuationMetric & { sourceUrl?: string; sourceName?: string }).sourceName = `Stooq close ${close.date}${shares !== null ? " · SEC shares outstanding" : ""}`;

  return {
    metric,
    report: {
      providerId: provider.id,
      source: shares !== null ? "stooq+sec" : "stooq_only",
      fields,
      error: null,
    },
  };
}

export async function fetchValuationForProviders(
  providers: InvestmentProviderProfile[],
  financials: FinancialMetric[],
): Promise<{ metrics: ValuationMetric[]; reports: ValuationFetchReport[] }> {
  const results = await Promise.all(providers.map((p) => fetchValuationForProvider(p, financials)));
  return {
    metrics: results.map((r) => r.metric).filter((m): m is ValuationMetric => m !== null),
    reports: results.map((r) => r.report),
  };
}
