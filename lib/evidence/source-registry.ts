// Source Registry — Pack 03.
// ──────────────────────────
// Controlled, auditable registry of allowed intelligence sources.
// Each source defines type, reliability, licence, display permission,
// and refresh cadence.

import type { IntelligenceSource } from "./types";

export const SOURCE_REGISTRY: IntelligenceSource[] = [
  // ─── High-Trust: Official Vendor Sources ──────────────────
  { id: "src_openai_docs", name: "OpenAI API Documentation", url: "https://platform.openai.com/docs", sourceType: "official_vendor_docs", reliability: 90, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 30, owner: "AI Enterprise", notes: "Official model list and API reference." },
  { id: "src_openai_pricing", name: "OpenAI Pricing Page", url: "https://openai.com/api/pricing/", sourceType: "pricing_page", reliability: 95, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 14, owner: "AI Enterprise" },
  { id: "src_anthropic_docs", name: "Anthropic Documentation", url: "https://docs.anthropic.com", sourceType: "official_vendor_docs", reliability: 90, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 30, owner: "AI Enterprise" },
  { id: "src_anthropic_pricing", name: "Anthropic Pricing", url: "https://www.anthropic.com/pricing", sourceType: "pricing_page", reliability: 95, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 14, owner: "AI Enterprise" },
  { id: "src_google_pricing", name: "Google AI Pricing", url: "https://ai.google.dev/pricing", sourceType: "pricing_page", reliability: 95, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 14, owner: "AI Enterprise" },
  { id: "src_mistral_pricing", name: "Mistral AI Pricing", url: "https://mistral.ai/pricing", sourceType: "pricing_page", reliability: 90, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 14, owner: "AI Enterprise" },
  { id: "src_cohere_pricing", name: "Cohere Pricing", url: "https://cohere.com/pricing", sourceType: "pricing_page", reliability: 90, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 14, owner: "AI Enterprise" },
  { id: "src_xai_docs", name: "xAI Developer Docs", url: "https://docs.x.ai", sourceType: "official_vendor_docs", reliability: 85, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 30, owner: "AI Enterprise" },

  // ─── High-Trust: Financial & Regulatory ───────────────────
  { id: "src_sec_edgar", name: "SEC EDGAR", url: "https://www.sec.gov/cgi-bin/browse-edgar", sourceType: "financial_filing", reliability: 98, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 90, owner: "AI Enterprise", notes: "XBRL companyfacts for financial metrics." },
  { id: "src_eu_ai_act", name: "EU AI Act Publications", url: "https://artificialintelligenceact.eu", sourceType: "regulatory_publication", reliability: 95, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 180, owner: "AI Enterprise" },

  // ─── Medium-Trust: Market Data ────────────────────────────
  { id: "src_fred", name: "FRED (Federal Reserve Economic Data)", url: "https://fred.stlouisfed.org", sourceType: "benchmark", reliability: 95, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 7, owner: "AI Enterprise" },
  { id: "src_yahoo_finance", name: "Yahoo Finance", url: "https://finance.yahoo.com", sourceType: "developer_platform", reliability: 80, licenceStatus: "restricted", displayAllowed: true, refreshCadenceDays: 1, owner: "AI Enterprise", notes: "Unofficial chart API. No key required." },
  { id: "src_stooq", name: "Stooq", url: "https://stooq.com", sourceType: "developer_platform", reliability: 78, licenceStatus: "restricted", displayAllowed: true, refreshCadenceDays: 1, owner: "AI Enterprise", notes: "Free CSV price data. End-of-day." },
  { id: "src_gdelt", name: "GDELT Project", url: "https://www.gdeltproject.org", sourceType: "reputable_news", reliability: 70, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 1, owner: "AI Enterprise" },

  // ─── Medium-Trust: Developer & Customer Signals ───────────
  { id: "src_github", name: "GitHub API", url: "https://api.github.com", sourceType: "developer_platform", reliability: 85, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 1, owner: "AI Enterprise" },
  { id: "src_g2", name: "G2 Reviews", url: "https://www.g2.com", sourceType: "customer_review", reliability: 72, licenceStatus: "restricted", displayAllowed: true, refreshCadenceDays: 30, owner: "AI Enterprise", notes: "Aggregate scores; individual reviews require licence." },
  { id: "src_glassdoor", name: "Glassdoor", url: "https://www.glassdoor.com", sourceType: "customer_review", reliability: 68, licenceStatus: "restricted", displayAllowed: true, refreshCadenceDays: 30, owner: "AI Enterprise", notes: "Employee sentiment proxy." },

  // ─── Medium-Trust: Research ───────────────────────────────
  { id: "src_menlo", name: "Menlo Ventures — State of GenAI", url: "https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/", sourceType: "analyst_report", reliability: 80, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 180, owner: "AI Enterprise" },
  { id: "src_ramp", name: "Ramp AI Index", url: "https://ramp.com/leading-indicators/ai-index-may-2026", sourceType: "analyst_report", reliability: 78, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 30, owner: "AI Enterprise" },
  { id: "src_enlyft", name: "Enlyft / Similarweb / Apptopia", sourceType: "benchmark", reliability: 75, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 30, owner: "AI Enterprise", notes: "Third-party adoption measurement." },

  // ─── Internal / Seed ──────────────────────────────────────
  { id: "src_seed", name: "AI Enterprise Seed Data", sourceType: "seed", reliability: 40, licenceStatus: "approved", displayAllowed: true, refreshCadenceDays: 365, owner: "AI Enterprise", notes: "Curated seed values. Clearly labelled, not verified." },
  { id: "src_internal_research", name: "AI Enterprise Internal Research", sourceType: "internal_research", reliability: 60, licenceStatus: "internal_only", displayAllowed: false, refreshCadenceDays: 90, owner: "AI Enterprise" },
];

/** Lookup a source by ID. */
export function getSource(id: string): IntelligenceSource | undefined {
  return SOURCE_REGISTRY.find((s) => s.id === id);
}

/** All sources grouped by type. */
export function sourcesByType(): Map<string, IntelligenceSource[]> {
  const map = new Map<string, IntelligenceSource[]>();
  for (const s of SOURCE_REGISTRY) {
    const bucket = map.get(s.sourceType) ?? [];
    bucket.push(s);
    map.set(s.sourceType, bucket);
  }
  return map;
}

/** Count sources by trust tier. */
export function sourceTrustSummary(): { high: number; medium: number; low: number; internal: number } {
  let high = 0, medium = 0, low = 0, internal = 0;
  for (const s of SOURCE_REGISTRY) {
    if (s.reliability >= 85) high++;
    else if (s.reliability >= 65) medium++;
    else if (s.sourceType === "seed" || s.sourceType === "internal_research") internal++;
    else low++;
  }
  return { high, medium, low, internal };
}
