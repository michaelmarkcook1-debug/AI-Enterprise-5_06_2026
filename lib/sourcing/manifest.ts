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
  // Operator notes — why we chose this URL, caveats.
  notes?: string;
}

const TRUST_HORIZON = 30;
const PRICING_HORIZON = 14;
const STATUS_HORIZON = 1;
const CHANGELOG_HORIZON = 7;
const FILING_HORIZON = 90;

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
