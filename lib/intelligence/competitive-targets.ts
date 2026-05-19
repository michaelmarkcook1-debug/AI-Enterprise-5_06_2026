// Competitive-intelligence target list.
// ─────────────────────────────────────
// The 13 frontier-model and AI-platform companies the monitor tracks, and the
// six event dimensions it watches for. Source of truth for the
// /api/cron/competitive-intel job and any UI that surfaces "what we're
// watching".
//
// Vendor IDs match the IntelligenceVendor seed where one exists; xAI, Meta,
// and Perplexity are tracked even though they don't yet have full vendor
// records (IntelligenceNewsItem.vendors is a String[] — no FK), so news for
// them flows through the same pipeline without a schema change.

import type { NewsCategory } from "./types";

export type CompetitiveDimension =
  | "product_launch"
  | "pricing_change"
  | "partnership"
  | "key_hire"
  | "press_coverage"
  | "funding_round";

export interface CompetitiveTarget {
  vendorId: string;
  name: string;
  /** Aliases Claude should match in search results (DBA names, products). */
  aliases: string[];
  /** Apex domain used to prefer first-party sources where possible. */
  domain: string;
}

export const COMPETITIVE_TARGETS: CompetitiveTarget[] = [
  { vendorId: "vendor_openai",     name: "OpenAI",          aliases: ["ChatGPT", "GPT-5", "Sora"],                domain: "openai.com" },
  { vendorId: "vendor_anthropic",  name: "Anthropic",       aliases: ["Claude", "Claude Code"],                  domain: "anthropic.com" },
  { vendorId: "vendor_xai",        name: "xAI",             aliases: ["Grok"],                                   domain: "x.ai" },
  { vendorId: "vendor_meta",       name: "Meta",            aliases: ["Llama", "Meta AI", "FAIR"],               domain: "ai.meta.com" },
  { vendorId: "vendor_perplexity", name: "Perplexity",      aliases: ["Perplexity AI", "Pplx"],                  domain: "perplexity.ai" },
  { vendorId: "vendor_cohere",     name: "Cohere",          aliases: ["Command R", "Cohere For AI"],             domain: "cohere.com" },
  { vendorId: "vendor_mistral",    name: "Mistral AI",      aliases: ["Mistral", "Le Chat"],                     domain: "mistral.ai" },
  { vendorId: "vendor_google",     name: "Google DeepMind", aliases: ["DeepMind", "Gemini", "Google AI"],        domain: "deepmind.google" },
  { vendorId: "vendor_moveworks",  name: "Moveworks",       aliases: [],                                         domain: "moveworks.com" },
  { vendorId: "vendor_harvey",     name: "Harvey",          aliases: ["Harvey AI"],                              domain: "harvey.ai" },
  { vendorId: "vendor_ibm",        name: "IBM watsonx",     aliases: ["IBM", "watsonx", "Watsonx"],              domain: "ibm.com" },
  { vendorId: "vendor_rogo",       name: "Rogo",            aliases: ["Rogo AI"],                                domain: "rogo.ai" },
  { vendorId: "vendor_writer",     name: "Writer",          aliases: ["Writer AI", "Palmyra"],                   domain: "writer.com" },
];

/**
 * Mapping from a competitive dimension to the schema-level NewsCategory used
 * by IntelligenceNewsItem. Funding + press + hires don't have dedicated
 * categories, so they fold into the closest existing one — the dimension is
 * preserved separately on the row's `whyItMatters` for queryability.
 */
export const DIMENSION_TO_NEWS_CATEGORY: Record<CompetitiveDimension, NewsCategory> = {
  product_launch: "Product launch",
  pricing_change: "Pricing",
  partnership:    "Partnership",
  key_hire:       "Strategy signal",
  press_coverage: "Market movement",
  funding_round:  "Market movement",
};

export const DIMENSION_LABELS: Record<CompetitiveDimension, string> = {
  product_launch: "Product launches",
  pricing_change: "Pricing changes",
  partnership:    "Partnerships",
  key_hire:       "Key hires",
  press_coverage: "Press coverage",
  funding_round:  "Funding rounds",
};

export const ALL_DIMENSIONS: CompetitiveDimension[] = [
  "product_launch",
  "pricing_change",
  "partnership",
  "key_hire",
  "press_coverage",
  "funding_round",
];
