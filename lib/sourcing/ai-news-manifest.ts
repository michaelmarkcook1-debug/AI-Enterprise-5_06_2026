// AI/tech news RSS sources — market-intelligence layer.
// These feeds are fetched by market-news-runner.ts and written directly to
// IntelligenceNewsItem (not EvidenceProposal — these are market signals, not
// structured vendor evidence). Haiku batch-scores each item for relevance and
// tags which tracked vendors are mentioned before the upsert.

export interface AiNewsSource {
  feedUrl: string;
  sourceName: string;
  tier: "tier1" | "tier2";   // tier1 = flagship AI press; tier2 = broader tech
  notes?: string;
}

// Curated AI/enterprise-tech news RSS feeds — all free, no API key required.
export const AI_NEWS_SOURCES: AiNewsSource[] = [
  // ── Tier 1: specialist AI press ───────────────────────────────────────────
  {
    feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
    sourceName: "TechCrunch AI",
    tier: "tier1",
  },
  {
    feedUrl: "https://venturebeat.com/category/ai/feed/",
    sourceName: "VentureBeat AI",
    tier: "tier1",
  },
  {
    feedUrl: "https://www.technologyreview.com/feed/",
    sourceName: "MIT Technology Review",
    tier: "tier1",
  },
  {
    feedUrl: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    sourceName: "The Verge — AI",
    tier: "tier1",
  },
  {
    feedUrl: "https://www.zdnet.com/topic/artificial-intelligence/rss.xml",
    sourceName: "ZDNET AI",
    tier: "tier1",
  },
  // ── Tier 2: enterprise tech / broader coverage ────────────────────────────
  {
    feedUrl: "https://www.wired.com/feed/category/science/artificial-intelligence/latest/rss",
    sourceName: "Wired AI",
    tier: "tier2",
  },
  {
    feedUrl: "https://www.theregister.com/emergent_tech/ai_ml/headlines.atom",
    sourceName: "The Register — AI",
    tier: "tier2",
    notes: "Strong on enterprise AI deals and critical analysis",
  },
  {
    feedUrl: "https://www.infoworld.com/feed/",
    sourceName: "InfoWorld",
    tier: "tier2",
    notes: "Enterprise software / developer-angle AI coverage",
  },
  {
    feedUrl: "https://siliconangle.com/feed/",
    sourceName: "SiliconANGLE",
    tier: "tier2",
    notes: "Enterprise cloud, AI infrastructure, funding rounds",
  },
];

// Tracked vendor names for Haiku mention-matching.
// Key = vendorId in EvidenceProposal/IntelligenceNewsItem; value = display name.
export const TRACKED_VENDOR_NAMES: Record<string, string> = {
  vendor_openai:     "OpenAI",
  vendor_microsoft:  "Microsoft",
  vendor_google:     "Google",
  vendor_anthropic:  "Anthropic",
  vendor_aws:        "AWS",
  vendor_salesforce: "Salesforce",
  vendor_servicenow: "ServiceNow",
  vendor_oracle:     "Oracle",
  vendor_sap:        "SAP",
  vendor_ibm:        "IBM",
  vendor_cohere:     "Cohere",
  vendor_mistral:    "Mistral",
  vendor_glean:      "Glean",
  vendor_moveworks:  "Moveworks",
  vendor_writer:     "Writer",
  vendor_hebbia:     "Hebbia",
  vendor_harvey:     "Harvey",
  vendor_databricks: "Databricks",
  vendor_snowflake:  "Snowflake",
};
