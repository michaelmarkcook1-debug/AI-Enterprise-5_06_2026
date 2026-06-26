// Sourcing manifest — single source of truth for "where every data point comes from".
//
// Each entry pairs a vendor with one URL on the public web that we believe
// gives evidence for one or more backend domains. The runner fetches the URL,
// runs the LLM Evidence Extractor against the content, classifies the
// proposals, and (when the operator approves) promotes them to scored
// EvidenceRecord rows.
//
// The URLs are CURATED, not scraped. Treat this file as operator-editable
// configuration. Adding a new entry is the way to teach the system about a
// new evidence source. Removing an entry stops the system pulling from it.
//
// Confidence horizon (in days) controls how often the runner will re-fetch.
// Trust centres + pricing change rarely; status pages + changelogs change
// often. The freshness modifier in the engine respects these horizons.

import type { SourceCategory } from "../../generated/prisma/client";

export interface SourceManifestEntry {
  vendorId: string;
  category: SourceCategory;
  url: string;
  // Plain-English label rendered in the admin UI + logs.
  label: string;
  // What this URL is expected to contribute, for log readability.
  expectedDomains: string[];
  // How many days a fetched snapshot is treated as fresh.
  freshnessHorizonDays: number;
  // RSS/Atom feed URL. When present the news-runner uses the structured feed
  // instead of HTML scraping (faster, cheaper — skips Haiku article discovery).
  rssUrl?: string;
  // Operator notes — why we chose this URL, caveats.
  notes?: string;
}

const TRUST_HORIZON = 30;
const PRICING_HORIZON = 14;
const STATUS_HORIZON = 1;
const CHANGELOG_HORIZON = 7;
const FILING_HORIZON = 90;
// News and press release pages change frequently — check every 3 days.
const NEWS_HORIZON = 3;

export const SOURCE_MANIFEST: SourceManifestEntry[] = [
  // ─ OpenAI ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_openai", category: "trust_center",
    url: "https://trust.openai.com/",
    label: "OpenAI Trust Portal",
    expectedDomains: ["data_security_privacy", "identity_access", "governance_compliance"],
    freshnessHorizonDays: TRUST_HORIZON,
    notes: "Lists certifications, subprocessors, residency. E2 unless audit reports linked." },
  { vendorId: "vendor_openai", category: "pricing_page",
    url: "https://openai.com/api/pricing/",
    label: "OpenAI API pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },
  { vendorId: "vendor_openai", category: "status_page",
    url: "https://status.openai.com/",
    label: "OpenAI status page",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: STATUS_HORIZON },
  { vendorId: "vendor_openai", category: "vendor_docs",
    url: "https://platform.openai.com/docs/overview",
    label: "OpenAI platform docs",
    expectedDomains: ["integration_architecture", "agentic_autonomy", "model_reliability"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ Microsoft ────────────────────────────────────────────────────────────
  { vendorId: "vendor_microsoft", category: "trust_center",
    url: "https://www.microsoft.com/en-us/trust-center",
    label: "Microsoft Trust Center",
    expectedDomains: ["data_security_privacy", "governance_compliance"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_microsoft", category: "vendor_docs",
    url: "https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-overview",
    label: "M365 Copilot overview",
    expectedDomains: ["business_fit", "enterprise_control"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_microsoft", category: "pricing_page",
    url: "https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/",
    label: "Azure OpenAI Service pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },
  { vendorId: "vendor_microsoft", category: "status_page",
    url: "https://status.azure.com/en-us/status",
    label: "Azure status",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: STATUS_HORIZON },
  { vendorId: "vendor_microsoft", category: "public_filing",
    url: "https://www.microsoft.com/en-us/Investor/sec-filings.aspx",
    label: "Microsoft SEC filings",
    expectedDomains: ["capital_resilience", "vendor_maturity_lockin"],
    freshnessHorizonDays: FILING_HORIZON },

  // ─ Google ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_google", category: "trust_center",
    url: "https://cloud.google.com/security/compliance",
    label: "Google Cloud compliance",
    expectedDomains: ["governance_compliance", "data_security_privacy"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_google", category: "vendor_docs",
    url: "https://cloud.google.com/vertex-ai/generative-ai/docs/overview",
    label: "Vertex AI generative AI overview",
    expectedDomains: ["integration_architecture", "agentic_autonomy"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_google", category: "pricing_page",
    url: "https://cloud.google.com/vertex-ai/generative-ai/pricing",
    label: "Vertex AI pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },
  { vendorId: "vendor_google", category: "status_page",
    url: "https://status.cloud.google.com/",
    label: "Google Cloud status",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: STATUS_HORIZON },

  // ─ Anthropic ────────────────────────────────────────────────────────────
  { vendorId: "vendor_anthropic", category: "trust_center",
    url: "https://trust.anthropic.com/",
    label: "Anthropic Trust Portal",
    expectedDomains: ["data_security_privacy", "governance_compliance"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_anthropic", category: "pricing_page",
    url: "https://www.anthropic.com/pricing",
    label: "Anthropic pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },
  { vendorId: "vendor_anthropic", category: "vendor_docs",
    url: "https://docs.anthropic.com/en/docs/welcome",
    label: "Anthropic API docs",
    expectedDomains: ["integration_architecture", "agentic_autonomy", "model_reliability"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_anthropic", category: "status_page",
    url: "https://status.anthropic.com/",
    label: "Anthropic status",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: STATUS_HORIZON },

  // ─ AWS ──────────────────────────────────────────────────────────────────
  { vendorId: "vendor_aws", category: "trust_center",
    url: "https://aws.amazon.com/compliance/programs/",
    label: "AWS compliance programs",
    expectedDomains: ["governance_compliance", "data_security_privacy"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_aws", category: "vendor_docs",
    url: "https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html",
    label: "AWS Bedrock user guide",
    expectedDomains: ["integration_architecture", "agentic_autonomy"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_aws", category: "pricing_page",
    url: "https://aws.amazon.com/bedrock/pricing/",
    label: "AWS Bedrock pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },
  { vendorId: "vendor_aws", category: "status_page",
    url: "https://health.aws.amazon.com/health/status",
    label: "AWS Health status",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: STATUS_HORIZON },

  // ─ Salesforce ───────────────────────────────────────────────────────────
  { vendorId: "vendor_salesforce", category: "trust_center",
    url: "https://trust.salesforce.com/en/",
    label: "Salesforce Trust",
    expectedDomains: ["data_security_privacy", "integration_architecture"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_salesforce", category: "vendor_docs",
    url: "https://www.salesforce.com/agentforce/",
    label: "Agentforce product page",
    expectedDomains: ["business_fit", "agentic_autonomy"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_salesforce", category: "status_page",
    url: "https://status.salesforce.com/",
    label: "Salesforce status",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: STATUS_HORIZON },

  // ─ ServiceNow ───────────────────────────────────────────────────────────
  { vendorId: "vendor_servicenow", category: "trust_center",
    url: "https://www.servicenow.com/trust.html",
    label: "ServiceNow Trust",
    expectedDomains: ["data_security_privacy", "governance_compliance"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_servicenow", category: "vendor_docs",
    url: "https://www.servicenow.com/products/now-assist.html",
    label: "Now Assist product page",
    expectedDomains: ["business_fit", "agentic_autonomy"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ Oracle ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_oracle", category: "trust_center",
    url: "https://www.oracle.com/security/compliance/",
    label: "Oracle compliance",
    expectedDomains: ["governance_compliance", "data_security_privacy"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_oracle", category: "vendor_docs",
    url: "https://www.oracle.com/artificial-intelligence/generative-ai/",
    label: "OCI Generative AI",
    expectedDomains: ["integration_architecture", "agentic_autonomy"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ SAP ──────────────────────────────────────────────────────────────────
  { vendorId: "vendor_sap", category: "trust_center",
    url: "https://www.sap.com/about/trust-center.html",
    label: "SAP Trust Center",
    expectedDomains: ["data_security_privacy", "governance_compliance"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_sap", category: "vendor_docs",
    url: "https://www.sap.com/products/artificial-intelligence/ai-assistant.html",
    label: "SAP Joule",
    expectedDomains: ["business_fit", "integration_architecture"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ IBM ──────────────────────────────────────────────────────────────────
  { vendorId: "vendor_ibm", category: "trust_center",
    url: "https://www.ibm.com/trust",
    label: "IBM Trust",
    expectedDomains: ["governance_compliance", "data_security_privacy"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_ibm", category: "vendor_docs",
    url: "https://www.ibm.com/products/watsonx-ai",
    label: "watsonx.ai product page",
    expectedDomains: ["integration_architecture", "agentic_autonomy"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ Cohere ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_cohere", category: "trust_center",
    url: "https://cohere.com/security",
    label: "Cohere security",
    expectedDomains: ["data_security_privacy", "governance_compliance"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_cohere", category: "pricing_page",
    url: "https://cohere.com/pricing",
    label: "Cohere pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },

  // ─ Mistral ──────────────────────────────────────────────────────────────
  { vendorId: "vendor_mistral", category: "trust_center",
    url: "https://mistral.ai/security",
    label: "Mistral security",
    expectedDomains: ["data_security_privacy"],
    freshnessHorizonDays: TRUST_HORIZON,
    notes: "EU-jurisdiction default — important for sovereignty scoring." },
  { vendorId: "vendor_mistral", category: "pricing_page",
    url: "https://mistral.ai/pricing",
    label: "Mistral pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },

  // ─ Glean ────────────────────────────────────────────────────────────────
  { vendorId: "vendor_glean", category: "trust_center",
    url: "https://www.glean.com/security",
    label: "Glean security",
    expectedDomains: ["data_security_privacy", "identity_access"],
    freshnessHorizonDays: TRUST_HORIZON,
    notes: "Source-permission inheritance is Glean's primary differentiator." },
  { vendorId: "vendor_glean", category: "vendor_docs",
    url: "https://www.glean.com/product",
    label: "Glean product page",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ Moveworks ────────────────────────────────────────────────────────────
  { vendorId: "vendor_moveworks", category: "trust_center",
    url: "https://www.moveworks.com/us/en/security",
    label: "Moveworks security",
    expectedDomains: ["data_security_privacy"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ Writer ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_writer", category: "trust_center",
    url: "https://writer.com/security/",
    label: "Writer security",
    expectedDomains: ["data_security_privacy", "governance_compliance"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_writer", category: "pricing_page",
    url: "https://writer.com/plans/",
    label: "Writer plans",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },

  // ─ Hebbia ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_hebbia", category: "vendor_docs",
    url: "https://www.hebbia.com/product",
    label: "Hebbia Matrix product page",
    expectedDomains: ["business_fit"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ Rogo ─────────────────────────────────────────────────────────────────
  { vendorId: "vendor_rogo", category: "vendor_docs",
    url: "https://rogo.ai/",
    label: "Rogo home",
    expectedDomains: ["business_fit"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ Harvey ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_harvey", category: "trust_center",
    url: "https://www.harvey.ai/security",
    label: "Harvey security",
    expectedDomains: ["data_security_privacy", "identity_access"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_harvey", category: "vendor_docs",
    url: "https://www.harvey.ai/product",
    label: "Harvey product",
    expectedDomains: ["business_fit"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ Databricks ───────────────────────────────────────────────────────────
  { vendorId: "vendor_databricks", category: "trust_center",
    url: "https://www.databricks.com/trust",
    label: "Databricks Trust",
    expectedDomains: ["data_security_privacy", "governance_compliance"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_databricks", category: "vendor_docs",
    url: "https://www.databricks.com/product/artificial-intelligence",
    label: "Databricks Mosaic AI",
    expectedDomains: ["integration_architecture", "agentic_autonomy"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_databricks", category: "pricing_page",
    url: "https://www.databricks.com/product/pricing",
    label: "Databricks pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },

  // ─ Snowflake ────────────────────────────────────────────────────────────
  { vendorId: "vendor_snowflake", category: "trust_center",
    url: "https://www.snowflake.com/en/trust-center/",
    label: "Snowflake Trust Center",
    expectedDomains: ["data_security_privacy", "governance_compliance"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_snowflake", category: "vendor_docs",
    url: "https://www.snowflake.com/en/product/features/cortex/",
    label: "Snowflake Cortex AI",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_snowflake", category: "status_page",
    url: "https://status.snowflake.com/",
    label: "Snowflake status",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: STATUS_HORIZON },

  // ════════════════════════════════════════════════════════════════════════════
  // PRESS RELEASE / NEWS PAGES
  // Processed by the news pipeline (lib/sourcing/news-runner.ts), not the
  // standard rolling cron. Each URL is a LISTING PAGE. The news runner
  // discovers and scores individual articles before ingestion.
  // ════════════════════════════════════════════════════════════════════════════

  // ─ OpenAI ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_openai", category: "press_release",
    url: "https://openai.com/news/",
    rssUrl: "https://openai.com/blog/rss/",
    label: "OpenAI news listing",
    expectedDomains: ["market_position", "agentic_autonomy", "integration_architecture"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ Microsoft ────────────────────────────────────────────────────────────
  { vendorId: "vendor_microsoft", category: "press_release",
    url: "https://news.microsoft.com/category/artificial-intelligence/",
    rssUrl: "https://news.microsoft.com/category/artificial-intelligence/feed/",
    label: "Microsoft AI news",
    expectedDomains: ["market_position", "integration_architecture", "agentic_autonomy"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ Google ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_google", category: "press_release",
    url: "https://blog.google/technology/ai/",
    rssUrl: "https://blog.google/technology/ai/rss/",
    label: "Google AI blog",
    expectedDomains: ["market_position", "agentic_autonomy", "model_reliability"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ Anthropic ────────────────────────────────────────────────────────────
  { vendorId: "vendor_anthropic", category: "press_release",
    url: "https://www.anthropic.com/news",
    label: "Anthropic news listing",
    expectedDomains: ["market_position", "model_reliability", "data_security_privacy"],
    freshnessHorizonDays: NEWS_HORIZON,
    notes: "No public RSS — HTML listing used." },

  // ─ AWS ──────────────────────────────────────────────────────────────────
  { vendorId: "vendor_aws", category: "press_release",
    url: "https://aws.amazon.com/blogs/machine-learning/",
    rssUrl: "https://aws.amazon.com/blogs/machine-learning/feed/",
    label: "AWS Machine Learning blog",
    expectedDomains: ["integration_architecture", "agentic_autonomy", "market_position"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ Salesforce ───────────────────────────────────────────────────────────
  { vendorId: "vendor_salesforce", category: "press_release",
    url: "https://www.salesforce.com/news/press-releases/",
    label: "Salesforce press releases",
    expectedDomains: ["market_position", "agentic_autonomy", "business_fit"],
    freshnessHorizonDays: NEWS_HORIZON,
    notes: "No reliable public RSS — HTML listing used." },

  // ─ ServiceNow ───────────────────────────────────────────────────────────
  { vendorId: "vendor_servicenow", category: "press_release",
    url: "https://www.servicenow.com/company/media/press-room.html",
    label: "ServiceNow press room",
    expectedDomains: ["market_position", "agentic_autonomy", "integration_architecture"],
    freshnessHorizonDays: NEWS_HORIZON,
    notes: "No public RSS — HTML listing used." },

  // ─ Oracle ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_oracle", category: "press_release",
    url: "https://www.oracle.com/news/",
    rssUrl: "https://www.oracle.com/news/rss/oracle-news-rss.xml",
    label: "Oracle newsroom",
    expectedDomains: ["market_position", "integration_architecture", "governance_compliance"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ SAP ──────────────────────────────────────────────────────────────────
  { vendorId: "vendor_sap", category: "press_release",
    url: "https://news.sap.com/",
    rssUrl: "https://news.sap.com/feed/",
    label: "SAP newsroom",
    expectedDomains: ["market_position", "integration_architecture", "agentic_autonomy"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ IBM ──────────────────────────────────────────────────────────────────
  { vendorId: "vendor_ibm", category: "press_release",
    url: "https://newsroom.ibm.com/",
    rssUrl: "https://newsroom.ibm.com/rss/",
    label: "IBM newsroom",
    expectedDomains: ["market_position", "governance_compliance", "integration_architecture"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ Cohere ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_cohere", category: "press_release",
    url: "https://cohere.com/blog",
    rssUrl: "https://cohere.com/blog/rss",
    label: "Cohere blog",
    expectedDomains: ["market_position", "model_reliability", "integration_architecture"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ Mistral ──────────────────────────────────────────────────────────────
  { vendorId: "vendor_mistral", category: "press_release",
    url: "https://mistral.ai/news/",
    label: "Mistral news",
    expectedDomains: ["market_position", "model_reliability", "data_security_privacy"],
    freshnessHorizonDays: NEWS_HORIZON,
    notes: "No confirmed public RSS — HTML listing used." },

  // ─ Glean ────────────────────────────────────────────────────────────────
  { vendorId: "vendor_glean", category: "press_release",
    url: "https://www.glean.com/press",
    label: "Glean press releases",
    expectedDomains: ["market_position", "integration_architecture"],
    freshnessHorizonDays: NEWS_HORIZON,
    notes: "No public RSS — HTML listing used." },

  // ─ Moveworks ────────────────────────────────────────────────────────────
  { vendorId: "vendor_moveworks", category: "press_release",
    url: "https://www.moveworks.com/us/en/resources/press-releases",
    label: "Moveworks press releases",
    expectedDomains: ["market_position", "agentic_autonomy", "workforce_adoption"],
    freshnessHorizonDays: NEWS_HORIZON,
    notes: "No public RSS — HTML listing used." },

  // ─ Writer ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_writer", category: "press_release",
    url: "https://writer.com/blog/",
    rssUrl: "https://writer.com/blog/rss/",
    label: "Writer blog",
    expectedDomains: ["market_position", "agentic_autonomy", "governance_compliance"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ Hebbia ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_hebbia", category: "press_release",
    url: "https://www.hebbia.com/blog",
    label: "Hebbia blog",
    expectedDomains: ["market_position", "business_fit"],
    freshnessHorizonDays: NEWS_HORIZON,
    notes: "No public RSS — HTML listing used." },

  // ─ Rogo ─────────────────────────────────────────────────────────────────
  { vendorId: "vendor_rogo", category: "press_release",
    url: "https://rogo.ai/blog",
    label: "Rogo blog",
    expectedDomains: ["market_position", "business_fit"],
    freshnessHorizonDays: NEWS_HORIZON,
    notes: "No public RSS — HTML listing used." },

  // ─ Harvey ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_harvey", category: "press_release",
    url: "https://www.harvey.ai/blog",
    label: "Harvey blog",
    expectedDomains: ["market_position", "business_fit", "data_security_privacy"],
    freshnessHorizonDays: NEWS_HORIZON,
    notes: "No public RSS — HTML listing used." },

  // ─ Databricks ───────────────────────────────────────────────────────────
  { vendorId: "vendor_databricks", category: "press_release",
    url: "https://www.databricks.com/blog",
    rssUrl: "https://www.databricks.com/blog/feed",
    label: "Databricks blog",
    expectedDomains: ["market_position", "integration_architecture", "agentic_autonomy"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ Snowflake ────────────────────────────────────────────────────────────
  { vendorId: "vendor_snowflake", category: "press_release",
    url: "https://www.snowflake.com/en/blog/",
    rssUrl: "https://www.snowflake.com/blog/feed/",
    label: "Snowflake blog",
    expectedDomains: ["market_position", "integration_architecture"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ── Thin-tail vendors wired 2026-06-26 (Batch-4 #03). Every URL below was
  //    web-fetched + confirmed first-party before adding (no guessed feeds).
  //    Adds ongoing daily sourcing for vendors that previously got only weekly
  //    competitive-news coverage. TSMC deliberately OMITTED — no credible
  //    AI-specific first-party source verified; left honest-empty, not padded.
  //    Investors (Sequoia, SoftBank, a16z, MGX) are excluded by existing design
  //    (they sit on the market map, not the evidence/news feed).

  // ─ Fireworks AI ─────────────────────────────────────────────────────────
  { vendorId: "vendor_fireworks", category: "press_release",
    url: "https://fireworks.ai/blog",
    label: "Fireworks AI blog",
    expectedDomains: ["market_position", "model_reliability", "integration_architecture"],
    freshnessHorizonDays: NEWS_HORIZON },
  { vendorId: "vendor_fireworks", category: "vendor_docs",
    url: "https://docs.fireworks.ai",
    label: "Fireworks AI docs",
    expectedDomains: ["integration_architecture", "agentic_autonomy", "model_reliability"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_fireworks", category: "pricing_page",
    url: "https://fireworks.ai/pricing",
    label: "Fireworks AI pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },

  // ─ Together AI ──────────────────────────────────────────────────────────
  { vendorId: "vendor_together", category: "press_release",
    url: "https://www.together.ai/blog",
    label: "Together AI blog",
    expectedDomains: ["market_position", "model_reliability", "agentic_autonomy"],
    freshnessHorizonDays: NEWS_HORIZON },
  { vendorId: "vendor_together", category: "vendor_docs",
    url: "https://docs.together.ai",
    label: "Together AI docs",
    expectedDomains: ["integration_architecture", "agentic_autonomy", "model_reliability"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_together", category: "pricing_page",
    url: "https://www.together.ai/pricing",
    label: "Together AI pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },

  // ─ HUMAIN ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_humain", category: "press_release",
    url: "https://www.humain.com/en/media-press.html",
    label: "HUMAIN media center",
    expectedDomains: ["market_position", "integration_architecture"],
    freshnessHorizonDays: NEWS_HORIZON,
    notes: "humain.ai 301-redirects to www.humain.com; no RSS (rss.xml 404)." },

  // ─ G42 ──────────────────────────────────────────────────────────────────
  { vendorId: "vendor_g42", category: "press_release",
    url: "https://www.g42.ai/resources/news",
    label: "G42 newsroom",
    expectedDomains: ["market_position", "governance_compliance", "integration_architecture"],
    freshnessHorizonDays: NEWS_HORIZON },

  // ─ Moonshot AI (Kimi) ───────────────────────────────────────────────────
  { vendorId: "vendor_moonshot", category: "press_release",
    url: "https://www.kimi.com/blog/",
    label: "Kimi (Moonshot AI) research blog",
    expectedDomains: ["model_reliability", "agentic_autonomy", "market_position"],
    freshnessHorizonDays: NEWS_HORIZON },
  { vendorId: "vendor_moonshot", category: "vendor_docs",
    url: "https://platform.kimi.ai/docs/introduction",
    label: "Kimi API docs",
    expectedDomains: ["integration_architecture", "model_reliability"],
    freshnessHorizonDays: TRUST_HORIZON,
    notes: "platform.moonshot.ai/docs 301-redirects to platform.kimi.ai." },
  { vendorId: "vendor_moonshot", category: "pricing_page",
    url: "https://platform.kimi.ai/docs/pricing/chat",
    label: "Kimi API pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },

  // ─ Zhipu / Z.ai ─────────────────────────────────────────────────────────
  { vendorId: "vendor_zai", category: "changelog",
    url: "https://docs.z.ai/release-notes/new-released",
    label: "Z.ai model release notes",
    expectedDomains: ["model_reliability", "agentic_autonomy"],
    freshnessHorizonDays: CHANGELOG_HORIZON },
  { vendorId: "vendor_zai", category: "vendor_docs",
    url: "https://docs.z.ai/",
    label: "Z.ai developer docs",
    expectedDomains: ["integration_architecture", "model_reliability"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_zai", category: "pricing_page",
    url: "https://docs.z.ai/guides/overview/pricing",
    label: "Z.ai pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },

  // ─ xAI ──────────────────────────────────────────────────────────────────
  { vendorId: "vendor_xai", category: "vendor_docs",
    url: "https://docs.x.ai/docs/overview",
    label: "xAI API docs",
    expectedDomains: ["integration_architecture", "model_reliability", "agentic_autonomy"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_xai", category: "pricing_page",
    url: "https://docs.x.ai/docs/pricing",
    label: "xAI API pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON,
    notes: "No first-party news/blog feed verified — docs + pricing only." },

  // ─ Lambda ───────────────────────────────────────────────────────────────
  { vendorId: "vendor_lambda", category: "press_release",
    url: "https://lambda.ai/blog",
    rssUrl: "https://lambda.ai/blog/rss.xml",
    label: "Lambda blog",
    expectedDomains: ["market_position", "integration_architecture"],
    freshnessHorizonDays: NEWS_HORIZON },
  { vendorId: "vendor_lambda", category: "pricing_page",
    url: "https://lambda.ai/pricing",
    label: "Lambda GPU cloud pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },
  { vendorId: "vendor_lambda", category: "vendor_docs",
    url: "https://docs.lambda.ai",
    label: "Lambda docs",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ Sakana AI ────────────────────────────────────────────────────────────
  { vendorId: "vendor_sakana", category: "press_release",
    url: "https://sakana.ai/blog/",
    label: "Sakana AI blog",
    expectedDomains: ["model_reliability", "market_position"],
    freshnessHorizonDays: NEWS_HORIZON },
  { vendorId: "vendor_sakana", category: "vendor_docs",
    url: "https://console.sakana.ai/get-started",
    label: "Sakana AI console docs",
    expectedDomains: ["integration_architecture"],
    freshnessHorizonDays: TRUST_HORIZON },

  // ─ Perplexity ───────────────────────────────────────────────────────────
  { vendorId: "vendor_perplexity", category: "changelog",
    url: "https://docs.perplexity.ai/changelog/changelog",
    label: "Perplexity API changelog",
    expectedDomains: ["model_reliability", "integration_architecture"],
    freshnessHorizonDays: CHANGELOG_HORIZON },
  { vendorId: "vendor_perplexity", category: "vendor_docs",
    url: "https://docs.perplexity.ai/getting-started/overview",
    label: "Perplexity API docs",
    expectedDomains: ["integration_architecture", "agentic_autonomy"],
    freshnessHorizonDays: TRUST_HORIZON },
  { vendorId: "vendor_perplexity", category: "pricing_page",
    url: "https://docs.perplexity.ai/getting-started/pricing",
    label: "Perplexity API pricing",
    expectedDomains: ["cost_finops"],
    freshnessHorizonDays: PRICING_HORIZON },
];

export function manifestForVendor(vendorId: string): SourceManifestEntry[] {
  return SOURCE_MANIFEST.filter((entry) => entry.vendorId === vendorId);
}

export function manifestSummary() {
  const byVendor: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const entry of SOURCE_MANIFEST) {
    byVendor[entry.vendorId] = (byVendor[entry.vendorId] ?? 0) + 1;
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
  }
  return { totalSources: SOURCE_MANIFEST.length, byVendor, byCategory };
}
