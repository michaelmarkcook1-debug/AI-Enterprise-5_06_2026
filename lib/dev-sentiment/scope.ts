// Dev-sentiment SCOPE — the hard "where applicable" rule.
// ────────────────────────────────────────────────────────
// Developer-community sentiment is valid ONLY for coding / developer-agent
// models + categories. Applying it to enterprise-assistant / RAG / infra /
// CRM vendors (bought by CIOs, not judged on dev forums) is a category error.
// Every consumer MUST gate on these predicates before showing or weighting the
// signal.

/** Category ids where dev-community sentiment is a valid signal. */
export const DEV_SENTIMENT_CATEGORIES = new Set<string>([
  "frontier_model_api", // foundational models used directly for coding
  "developer_coding_agent", // coding copilots / software agents
]);

/** Bare vendor ids whose coding models this signal covers. A vendor is
 *  in-scope only if it ships a coding/developer model people discuss in dev
 *  communities — NOT every tracked vendor. */
export const DEV_SENTIMENT_VENDORS = new Set<string>([
  "anthropic",
  "openai",
  "google",
  "deepseek",
  "alibaba",
  "meta",
  "mistral",
]);

export function isDevSentimentCategory(categoryId: string | null | undefined): boolean {
  return !!categoryId && DEV_SENTIMENT_CATEGORIES.has(categoryId);
}

/** In-scope for the dev-sentiment signal. Accepts the vendor_ prefix. */
export function isDevSentimentVendor(vendorId: string | null | undefined): boolean {
  if (!vendorId) return false;
  return DEV_SENTIMENT_VENDORS.has(vendorId.replace(/^vendor_/, ""));
}
