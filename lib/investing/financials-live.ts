// Live financial-metrics fetcher for Investor Tools.
// ───────────────────────────────────────────────────
// Primary path: SEC EDGAR XBRL companyfacts JSON. Free, no key, audited
// at source. The 10-K filing data flows through XBRL into the
// `/api/xbrl/companyfacts/CIK<cik>.json` endpoint.
//
// Fallback path: scrape the vendor's investor-relations page via Claude
// with the web-search tool. Triggered when:
//   - SEC connector is not configured (missing SEC_USER_AGENT)
//   - The vendor has no CIK (private companies, foreign issuers without ADR)
//   - companyfacts returns 404 or empty data for the metric we want
//
// Both paths normalise into the existing `FinancialMetric` shape so the
// downstream UI doesn't care which source served the row. Metric source
// + confidence flag let the page render a provenance badge.
//
// IMPORTANT: this module never throws. Every error path returns an
// empty array + an error in the report so the daily-refresh orchestrator
// can record what failed without crashing the pipeline.

import Anthropic from "@anthropic-ai/sdk";
import { secConnector, isSecUserAgentValid } from "../connectors/sec";
import { hasLLM } from "../agents/llm-client";
import type { FinancialMetric, InvestmentProviderProfile } from "./types";

// IR-page financial extraction is a read-and-extract task — default to Haiku
// for lower cost (it's only a fallback when SEC XBRL misses). Override via env.
const DEFAULT_MODEL = process.env.ANTHROPIC_EXTRACT_MODEL ?? "claude-haiku-4-5";

/* ─── CIK + IR URL manifest ─────────────────────────────────────── */

/**
 * Curated mapping from investment-provider IDs (matches
 * lib/investing/seed.ts) to SEC CIK and IR page URL. Order of operations
 * for adding a new provider:
 *   1. Look up CIK at https://www.sec.gov/cgi-bin/browse-edgar
 *   2. Find the IR page (used as fallback when SEC fails)
 */
export interface ProviderFinancialsManifest {
  providerId: string;
  cik: string | null; // null means SEC unavailable; IR fallback only
  irUrl: string | null;
}

export const FINANCIALS_MANIFEST: ProviderFinancialsManifest[] = [
  { providerId: "microsoft",  cik: "0000789019", irUrl: "https://www.microsoft.com/en-us/Investor/" },
  { providerId: "alphabet",   cik: "0001652044", irUrl: "https://abc.xyz/investor/" },
  { providerId: "amazon",     cik: "0001018724", irUrl: "https://ir.aboutamazon.com/" },
  { providerId: "meta",       cik: "0001326801", irUrl: "https://investor.fb.com/" },
  { providerId: "oracle",     cik: "0001341439", irUrl: "https://investor.oracle.com/" },
  { providerId: "ibm",        cik: "0000051143", irUrl: "https://www.ibm.com/investor/" },
  { providerId: "snowflake",  cik: "0001640147", irUrl: "https://investors.snowflake.com/" },
  { providerId: "salesforce", cik: "0001108524", irUrl: "https://investor.salesforce.com/" },
  { providerId: "servicenow", cik: "0001373715", irUrl: "https://investors.servicenow.com/" },
  { providerId: "palantir",   cik: "0001321655", irUrl: "https://investors.palantir.com/" },
  { providerId: "nvidia",     cik: "0001045810", irUrl: "https://investor.nvidia.com/" },
  { providerId: "amd",        cik: "0000002488", irUrl: "https://ir.amd.com/" },
  { providerId: "intel",      cik: "0000050863", irUrl: "https://www.intc.com/" },
  // Private / no SEC presence — IR fallback only.
  { providerId: "openai",     cik: null, irUrl: null }, // No public IR
  { providerId: "anthropic",  cik: null, irUrl: null }, // No public IR
  { providerId: "xai",        cik: null, irUrl: null },
];

/* ─── XBRL concept → metricName mapping ─────────────────────────── */

interface XbrlExtractTarget {
  concept: string;
  metricName: string;
  taxonomy: "us-gaap" | "ifrs-full";
}

const XBRL_TARGETS: XbrlExtractTarget[] = [
  { concept: "Revenues",                                 metricName: "revenue_ttm",          taxonomy: "us-gaap" },
  { concept: "RevenueFromContractWithCustomerExcludingAssessedTax", metricName: "revenue_ttm", taxonomy: "us-gaap" },
  { concept: "OperatingIncomeLoss",                      metricName: "operating_income_ttm", taxonomy: "us-gaap" },
  { concept: "ResearchAndDevelopmentExpense",            metricName: "rd_expense_ttm",       taxonomy: "us-gaap" },
  { concept: "NetCashProvidedByUsedInOperatingActivities", metricName: "operating_cash_flow_ttm", taxonomy: "us-gaap" },
  { concept: "NetIncomeLoss",                            metricName: "net_income_ttm",       taxonomy: "us-gaap" },
];

/**
 * XBRL companyfacts schema (only the bits we read):
 *   facts["us-gaap"][concept].units["USD"] = [{ end, val, fy, fp, form }, ...]
 * We take the most recent annual (form=10-K) value as the TTM proxy.
 */
interface XbrlFactPoint {
  end: string;
  val: number;
  fy: number;
  fp: string;
  form: string;
  filed: string;
}
interface XbrlConceptBlock {
  label?: string;
  description?: string;
  units?: Record<string, XbrlFactPoint[]>;
}
interface XbrlCompanyFacts {
  cik: number;
  entityName: string;
  facts?: Record<string, Record<string, XbrlConceptBlock>>;
}

function latestAnnual(points: XbrlFactPoint[]): XbrlFactPoint | null {
  const annuals = points.filter((p) => p.form === "10-K" || p.form === "10-K/A");
  if (annuals.length === 0) return null;
  annuals.sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime());
  return annuals[0];
}

function fetchFromXbrl(
  cik: string,
  facts: XbrlCompanyFacts,
  providerId: string,
  capturedAt: string,
): FinancialMetric[] {
  const out: FinancialMetric[] = [];
  for (const target of XBRL_TARGETS) {
    const concept = facts.facts?.[target.taxonomy]?.[target.concept];
    const usdPoints = concept?.units?.["USD"];
    if (!usdPoints || usdPoints.length === 0) continue;
    const latest = latestAnnual(usdPoints);
    if (!latest) continue;
    // Avoid duplicate metricName (Revenues + RevenueFromContractWithCustomer
    // can both apply). Keep the first one we find.
    if (out.some((m) => m.metricName === target.metricName)) continue;
    out.push({
      providerId,
      metricName: target.metricName,
      value: latest.val,
      period: `FY${latest.fy} ${latest.fp} (${latest.end})`,
      sourceType: "sec_xbrl",
      sourceName: `SEC EDGAR XBRL · ${target.taxonomy}:${target.concept}`,
      sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K`,
      confidence: 95, // XBRL is audited; gradient kept under 100 to leave room for fully E5 sources
      capturedAt,
    });
  }
  return out;
}

/* ─── Vendor IR fallback via Claude web-search ──────────────────── */

async function fetchFromIrPage(
  provider: InvestmentProviderProfile,
  irUrl: string,
  capturedAt: string,
): Promise<FinancialMetric[]> {
  if (!hasLLM()) return [];
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      // Web search server tool: lets Claude fetch the IR page directly.
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 } as never],
      messages: [{
        role: "user",
        content: `Visit ${provider.name}'s investor-relations page (${irUrl}) and extract their MOST RECENT reported figures for the four metrics below. Return ONLY a JSON array, no prose, no markdown fences.

Required metrics (use trailing-12-months when reported; otherwise latest full fiscal year):
  - revenue_ttm
  - operating_income_ttm
  - rd_expense_ttm
  - operating_cash_flow_ttm

JSON format:
  [{"metricName":"revenue_ttm","value":<number in USD>,"period":"<e.g. FY2025>","sourceUrl":"<actual URL you fetched>"}]

If a metric is not available, OMIT it from the array. Do not fabricate. Use the exact USD value (not millions, not billions — full integer).`,
      }],
    });
    // Concatenate all text blocks.
    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("\n")
      .trim();
    // Find the JSON array — be tolerant of preamble.
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as Array<{
      metricName: string;
      value: number;
      period: string;
      sourceUrl?: string;
    }>;
    return parsed
      .filter((m) => typeof m.value === "number" && Number.isFinite(m.value))
      .map((m) => ({
        providerId: provider.id,
        metricName: m.metricName,
        value: m.value,
        period: m.period,
        sourceType: "ir_page_llm",
        sourceName: `${provider.name} IR page (web-search extraction)`,
        sourceUrl: m.sourceUrl ?? irUrl,
        confidence: 78, // Below SEC: needs human verification
        capturedAt,
      }));
  } catch {
    return [];
  }
}

/* ─── Public API ────────────────────────────────────────────────── */

export interface FinancialsFetchReport {
  providerId: string;
  source: "sec_xbrl" | "ir_page_llm" | "none";
  metricCount: number;
  error: string | null;
}

export async function fetchFinancialsForProvider(
  provider: InvestmentProviderProfile,
): Promise<{ metrics: FinancialMetric[]; report: FinancialsFetchReport }> {
  const capturedAt = new Date().toISOString();
  const entry = FINANCIALS_MANIFEST.find((m) => m.providerId === provider.id);

  // Path A — SEC XBRL companyfacts.
  if (entry?.cik && isSecUserAgentValid(process.env.SEC_USER_AGENT)) {
    try {
      const result = await secConnector.fetch({ cik: entry.cik, resource: "facts" });
      if (result.ok && result.records.length > 0) {
        const raw = result.records[0].raw as XbrlCompanyFacts;
        const metrics = fetchFromXbrl(entry.cik, raw, provider.id, capturedAt);
        if (metrics.length > 0) {
          return {
            metrics,
            report: { providerId: provider.id, source: "sec_xbrl", metricCount: metrics.length, error: null },
          };
        }
      }
    } catch (err) {
      // Fall through to IR fallback.
      const errMessage = err instanceof Error ? err.message : String(err);
      // Try fallback before reporting.
      if (entry.irUrl) {
        const fallback = await fetchFromIrPage(provider, entry.irUrl, capturedAt);
        return {
          metrics: fallback,
          report: { providerId: provider.id, source: fallback.length > 0 ? "ir_page_llm" : "none", metricCount: fallback.length, error: `SEC error: ${errMessage}` },
        };
      }
      return { metrics: [], report: { providerId: provider.id, source: "none", metricCount: 0, error: `SEC error: ${errMessage}` } };
    }
  }

  // Path B — IR page via Claude web-search.
  if (entry?.irUrl) {
    const fallback = await fetchFromIrPage(provider, entry.irUrl, capturedAt);
    return {
      metrics: fallback,
      report: { providerId: provider.id, source: fallback.length > 0 ? "ir_page_llm" : "none", metricCount: fallback.length, error: fallback.length === 0 ? "IR scrape returned no metrics" : null },
    };
  }

  // No source available — provider is private with no public IR.
  return { metrics: [], report: { providerId: provider.id, source: "none", metricCount: 0, error: "No CIK and no IR URL on file" } };
}

/**
 * Fetch financials for a batch of providers. Runs SEC + IR calls in
 * parallel since the SEC connector enforces its own polite rate limits.
 */
export async function fetchFinancialsForProviders(
  providers: InvestmentProviderProfile[],
): Promise<{ metrics: FinancialMetric[]; reports: FinancialsFetchReport[] }> {
  const results = await Promise.all(providers.map((p) => fetchFinancialsForProvider(p)));
  return {
    metrics: results.flatMap((r) => r.metrics),
    reports: results.map((r) => r.report),
  };
}
