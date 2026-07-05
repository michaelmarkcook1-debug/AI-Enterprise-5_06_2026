/**
 * Customer-review sentiment — G2 / TrustRadius / Trustpilot (Reputation Tracker).
 * ─────────────────────────────────────────────────────────────────────────────
 * These platforms have NO free public API — access is via paid partner/business
 * APIs with commercial terms (G2 Partner API, TrustRadius API, Trustpilot
 * Business API). So this connector is GATED: without a provider key it reports
 * "not_configured" and returns nothing — no scraping, no fabricated review
 * scores. When the owner licenses a provider and sets the key, the fetcher
 * pulls the vendor's aggregate rating + review count + attributed quotes.
 *
 * MARKET signal only — feeds the Reputation Tracker alongside dev-sentiment +
 * news sentiment. NEVER an industry-analyst-house verdict (the independence
 * wedge: we are the alternative to the paywalled houses).
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";

const HOME = "https://www.g2.com/";
const DOCS = "https://partner-portal.g2.com/api";

/** Which review providers have a key configured. Any one enables the connector. */
function configuredProviders(): string[] {
  const p: string[] = [];
  if (process.env.G2_API_TOKEN) p.push("g2");
  if (process.env.TRUSTRADIUS_API_KEY) p.push("trustradius");
  if (process.env.TRUSTPILOT_API_KEY) p.push("trustpilot");
  return p;
}

export interface ReviewsQuery {
  provider?: "g2" | "trustradius" | "trustpilot";
  productSlug: string; // the vendor's product page slug on the provider
}
interface ReviewsRecord {
  provider: string;
  productSlug: string;
  raw: unknown;
}

export const reviewsConnector: Connector<ReviewsQuery, ReviewsRecord> = {
  health(): ConnectorHealth {
    const providers = configuredProviders();
    const configured = providers.length > 0;
    const last = getLastFetch("reviews");
    return {
      id: "reviews",
      label: "Customer reviews (G2 / TrustRadius / Trustpilot)",
      group: "developer",
      tier: "reputable_news",
      requiresKey: true,
      envVars: ["G2_API_TOKEN", "TRUSTRADIUS_API_KEY", "TRUSTPILOT_API_KEY"],
      configured,
      status: configured ? "ok" : "not_configured",
      message: configured
        ? `Configured providers: ${providers.join(", ")}`
        : "No customer-review provider connected. These platforms require a paid partner/business API + commercial terms — set G2_API_TOKEN / TRUSTRADIUS_API_KEY / TRUSTPILOT_API_KEY once licensed. Until then the Reputation Tracker shows an honest 'reviews not connected' state (no scraping, no fabricated ratings).",
      homepageUrl: HOME,
      apiDocsUrl: DOCS,
      rateLimitNotes: "Provider-specific; respect each platform's commercial terms.",
      defaultEvidenceGrade: "E3",
      defaultConfidenceFloor: 55,
      description: "Aggregate customer rating + review count + attributed quotes — a MARKET reputation signal, never an analyst-house verdict.",
      lastFetchAt: last?.at,
      lastFetchOk: last?.ok,
      lastFetchError: last?.error,
      lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: ReviewsQuery): Promise<FetchResult<ReviewsRecord>> {
    const fetchedAt = new Date().toISOString();
    const providers = configuredProviders();
    if (providers.length === 0) {
      return { ok: false, status: "not_configured", records: [], recordCount: 0, fetchedAt, error: "no review-provider key set" };
    }
    if (!query?.productSlug) {
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "productSlug required" };
    }
    // Provider fetch is implemented per-license (each API differs). Until a
    // provider is licensed + wired, this reports not_implemented honestly rather
    // than returning a fake rating.
    recordLastFetch("reviews", { ok: false, error: "provider fetch not implemented for the configured key" });
    return {
      ok: false,
      status: "not_implemented",
      records: [],
      recordCount: 0,
      fetchedAt,
      error: `Key present for [${providers.join(", ")}] but the provider fetch adapter is not wired yet — implement once the specific provider is licensed.`,
    };
  },
};
