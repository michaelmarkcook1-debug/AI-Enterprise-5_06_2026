// Competitive-intelligence target list.
// ─────────────────────────────────────
// The companies the news monitor tracks across six event dimensions. Source of
// truth for the /api/cron/competitive-intel job and any UI that surfaces "what
// we're watching".
//
// Vendor IDs are the CANONICAL plain spine ids (e.g. "openai", not
// "vendor_openai"), so news rows the monitor writes into
// IntelligenceNewsItem.vendors match the IntelligenceVendor spine directly.
// Coverage spans the full assessable universe plus the silicon / neocloud /
// sovereign infrastructure layer added June 2026 — investors are intentionally
// excluded (they sit on the market map, not the competitive-news feed).

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
  // ── Frontier model / API ──────────────────────────────────────────────
  { vendorId: "openai",      name: "OpenAI",          aliases: ["ChatGPT", "GPT-5", "Sora"],                domain: "openai.com" },
  { vendorId: "anthropic",   name: "Anthropic",       aliases: ["Claude", "Claude Code"],                  domain: "anthropic.com" },
  { vendorId: "google",      name: "Google DeepMind", aliases: ["DeepMind", "Gemini", "Google AI"],        domain: "deepmind.google" },
  { vendorId: "meta",        name: "Meta",            aliases: ["Llama", "Meta AI", "FAIR"],               domain: "ai.meta.com" },
  { vendorId: "xai",         name: "xAI",             aliases: ["Grok"],                                   domain: "x.ai" },
  { vendorId: "mistral",     name: "Mistral AI",      aliases: ["Mistral", "Le Chat"],                     domain: "mistral.ai" },
  { vendorId: "cohere",      name: "Cohere",          aliases: ["Command R", "Aleph Alpha", "Pharia"],     domain: "cohere.com" },
  { vendorId: "deepseek",    name: "DeepSeek",        aliases: ["DeepSeek V4", "DeepSeek R1"],             domain: "deepseek.com" },
  { vendorId: "alibaba",     name: "Alibaba / Qwen",  aliases: ["Qwen", "Tongyi", "Model Studio"],         domain: "alibabacloud.com" },
  { vendorId: "moonshot",    name: "Moonshot AI",     aliases: ["Kimi", "Kimi K2"],                        domain: "moonshot.ai" },
  { vendorId: "zai",         name: "Zhipu / Z.ai",    aliases: ["GLM", "Zhipu AI", "ChatGLM"],             domain: "z.ai" },
  { vendorId: "minimax",     name: "MiniMax",         aliases: ["MiniMax M2", "Hailuo"],                   domain: "minimax.io" },
  { vendorId: "ai21",        name: "AI21 Labs",       aliases: ["Jamba", "AI21"],                          domain: "ai21.com" },
  { vendorId: "perplexity",  name: "Perplexity",      aliases: ["Perplexity AI", "Sonar", "Pplx"],         domain: "perplexity.ai" },
  // ── Platforms / clouds / data ─────────────────────────────────────────
  { vendorId: "microsoft",   name: "Microsoft",       aliases: ["Azure AI", "Copilot", "Azure OpenAI"],    domain: "microsoft.com" },
  { vendorId: "aws",         name: "AWS",             aliases: ["Amazon Bedrock", "SageMaker", "Nova"],    domain: "aws.amazon.com" },
  { vendorId: "oracle",      name: "Oracle",          aliases: ["OCI", "Oracle AI", "Fusion AI"],          domain: "oracle.com" },
  { vendorId: "ibm",         name: "IBM watsonx",     aliases: ["IBM", "watsonx", "Granite"],              domain: "ibm.com" },
  { vendorId: "sap",         name: "SAP",             aliases: ["Joule", "Business AI"],                   domain: "sap.com" },
  { vendorId: "databricks",  name: "Databricks",      aliases: ["Mosaic AI", "DBRX"],                      domain: "databricks.com" },
  { vendorId: "snowflake",   name: "Snowflake",       aliases: ["Cortex AI", "Arctic"],                    domain: "snowflake.com" },
  { vendorId: "salesforce",  name: "Salesforce",      aliases: ["Agentforce", "Einstein"],                 domain: "salesforce.com" },
  { vendorId: "servicenow",  name: "ServiceNow",      aliases: ["Now Assist", "Now LLM"],                  domain: "servicenow.com" },
  // ── Applications / specialists ────────────────────────────────────────
  { vendorId: "glean",       name: "Glean",           aliases: ["Glean AI"],                               domain: "glean.com" },
  { vendorId: "writer",      name: "Writer",          aliases: ["Writer AI", "Palmyra"],                   domain: "writer.com" },
  { vendorId: "moveworks",   name: "Moveworks",       aliases: [],                                         domain: "moveworks.com" },
  { vendorId: "harvey",      name: "Harvey",          aliases: ["Harvey AI"],                              domain: "harvey.ai" },
  { vendorId: "rogo",        name: "Rogo",            aliases: ["Rogo AI"],                                domain: "rogo.ai" },
  { vendorId: "hebbia",      name: "Hebbia",          aliases: ["Hebbia AI", "Matrix"],                    domain: "hebbia.ai" },
  // ── Silicon / semiconductor ───────────────────────────────────────────
  { vendorId: "nvidia",      name: "NVIDIA",          aliases: ["Blackwell", "Hopper", "CUDA", "DGX"],     domain: "nvidia.com" },
  { vendorId: "amd",         name: "AMD",             aliases: ["Instinct", "MI300", "ROCm"],              domain: "amd.com" },
  { vendorId: "broadcom",    name: "Broadcom",        aliases: ["custom ASIC", "Tomahawk"],                domain: "broadcom.com" },
  { vendorId: "tsmc",        name: "TSMC",            aliases: ["Taiwan Semiconductor", "CoWoS"],          domain: "tsmc.com" },
  { vendorId: "cerebras",    name: "Cerebras",        aliases: ["WSE-3", "Cerebras Inference"],            domain: "cerebras.ai" },
  // ── Neoclouds / inference ─────────────────────────────────────────────
  { vendorId: "coreweave",   name: "CoreWeave",       aliases: ["CoreWeave Cloud"],                        domain: "coreweave.com" },
  { vendorId: "lambda",      name: "Lambda",          aliases: ["Lambda Labs", "Lambda Cloud"],            domain: "lambdalabs.com" },
  { vendorId: "together",    name: "Together AI",     aliases: ["Together", "Together Inference"],         domain: "together.ai" },
  { vendorId: "fireworks",   name: "Fireworks AI",    aliases: ["Fireworks", "FireAttention"],             domain: "fireworks.ai" },
  { vendorId: "groq",        name: "Groq",            aliases: ["GroqCloud", "LPU"],                       domain: "groq.com" },
  { vendorId: "nscale",      name: "Nscale",          aliases: ["Nscale Cloud"],                           domain: "nscale.com" },
  // ── Sovereign / regional ──────────────────────────────────────────────
  { vendorId: "g42",         name: "G42 / Falcon",    aliases: ["G42", "Falcon", "TII", "Khazna"],         domain: "g42.ai" },
  { vendorId: "humain",      name: "HUMAIN",          aliases: ["HUMAIN AI", "PIF AI"],                    domain: "humain.ai" },
  { vendorId: "sakana",      name: "Sakana AI",       aliases: ["Sakana"],                                 domain: "sakana.ai" },
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
