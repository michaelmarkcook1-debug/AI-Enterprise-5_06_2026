// Layered enterprise-AI infrastructure & ecosystem taxonomy (v1.3).
// ─────────────────────────────────────────────────────────────────────────
// Replaces the flat 13-item ECOSYSTEMS list with an 11-layer model plus
// per-archetype industry systems-of-record. Three independent 2026 stack
// references (nine-layer agent stack, seven-layer infra stack, five-layer
// enterprise blueprint) converge on: a horizontal foundation
// (compute → data → models → serving → retrieval → orchestration) plus two
// vertical rails that cut across every layer (Observability/Evals and
// Governance/Security), the integration/iPaaS plane, and the SaaS suites of
// record. Industry systems-of-record are a separate, archetype-gated layer.
//
// Why this shape:
//   - Buyers select MULTIPLE items WITHIN a layer (best-of-breed is the 2026
//     default), so ecosystem-fit must be per-layer set intersection.
//   - Each item carries an optional `parent` (the vendor family it belongs
//     to) so the engine can compute single-parent concentration / lock-in.
//   - Each layer carries a `minTier` so the multiselect is progressive:
//     Quick shows only the high-level layers; Guided shows the full stack;
//     Advanced additionally surfaces the gateway / observability / governance
//     rails that map to its sovereignty / switching-cost / concentration inputs.

import type { IndustryArchetype } from "./types";
import type { WorkflowTier } from "./use-cases";

export type InfraLayerId =
  | "cloud_compute"
  | "data_platform"
  | "model_provider"
  | "model_serving"
  | "vector_retrieval"
  | "agent_orchestration"
  | "ai_gateway"
  | "llmops_observability"
  | "governance_security"
  | "integration_ipaas"
  | "saas_suite_of_record";

export interface InfraItem {
  id: string;
  label: string;
  /** Vendor family for concentration / lock-in detection (e.g. microsoft). */
  parent?: string;
  /** True for open-weight / open-source / portable items (resilience bonus). */
  open?: boolean;
}

export interface InfraLayer {
  id: InfraLayerId;
  label: string;
  /** Minimum tier at which this layer is shown in the multiselect. */
  minTier: WorkflowTier;
  /** One-line description for the form. */
  hint: string;
  items: InfraItem[];
}

export const INFRA_LAYERS: InfraLayer[] = [
  {
    id: "cloud_compute",
    label: "Cloud & Compute",
    minTier: "quick",
    hint: "Where workloads and GPUs run.",
    items: [
      { id: "aws", label: "Amazon Web Services", parent: "amazon" },
      { id: "azure", label: "Microsoft Azure", parent: "microsoft" },
      { id: "gcp", label: "Google Cloud Platform", parent: "google" },
      { id: "oracle_cloud", label: "Oracle Cloud (OCI)", parent: "oracle" },
      { id: "coreweave", label: "CoreWeave" },
      { id: "nebius", label: "Nebius" },
      { id: "lambda_labs", label: "Lambda" },
      { id: "nvidia_dgx_cloud", label: "NVIDIA DGX Cloud", parent: "nvidia" },
      { id: "on_prem_private", label: "On-prem / Private cloud", open: true },
    ],
  },
  {
    id: "data_platform",
    label: "Data Platform",
    minTier: "quick",
    hint: "Lakehouse / warehouse system of record for analytical data.",
    items: [
      { id: "snowflake", label: "Snowflake" },
      { id: "databricks", label: "Databricks" },
      { id: "microsoft_fabric", label: "Microsoft Fabric / OneLake", parent: "microsoft" },
      { id: "bigquery", label: "Google BigQuery", parent: "google" },
      { id: "aws_redshift", label: "Amazon Redshift", parent: "amazon" },
      { id: "postgres", label: "PostgreSQL", open: true },
      { id: "mongodb", label: "MongoDB" },
      { id: "confluent_kafka", label: "Confluent / Kafka" },
    ],
  },
  {
    id: "model_provider",
    label: "Model Providers",
    minTier: "quick",
    hint: "Foundation-model families. Open-weight items improve sovereignty.",
    items: [
      { id: "openai", label: "OpenAI" },
      { id: "anthropic", label: "Anthropic Claude" },
      { id: "google_gemini", label: "Google Gemini", parent: "google" },
      { id: "xai_grok", label: "xAI Grok" },
      { id: "meta_llama", label: "Meta Llama (open-weight)", open: true },
      { id: "mistral", label: "Mistral (open-weight)", open: true },
      { id: "deepseek", label: "DeepSeek (open-weight)", open: true },
      { id: "qwen", label: "Alibaba Qwen (open-weight)", parent: "alibaba", open: true },
    ],
  },
  {
    id: "model_serving",
    label: "Model Serving & Inference",
    minTier: "guided",
    hint: "Managed inference hosts and self-hosted serving runtimes.",
    items: [
      { id: "aws_bedrock", label: "Amazon Bedrock", parent: "amazon" },
      { id: "azure_openai", label: "Azure AI Foundry / OpenAI", parent: "microsoft" },
      { id: "google_vertex", label: "Google Vertex AI", parent: "google" },
      { id: "together_ai", label: "Together AI" },
      { id: "fireworks_ai", label: "Fireworks AI" },
      { id: "groq", label: "Groq" },
      { id: "baseten", label: "Baseten" },
      { id: "vllm_self_host", label: "vLLM / SGLang (self-hosted)", open: true },
      { id: "ollama", label: "Ollama (local)", open: true },
    ],
  },
  {
    id: "vector_retrieval",
    label: "Vector & Retrieval",
    minTier: "guided",
    hint: "RAG / context substrate — a key reliability signal for agents.",
    items: [
      { id: "pinecone", label: "Pinecone" },
      { id: "weaviate", label: "Weaviate", open: true },
      { id: "qdrant", label: "Qdrant", open: true },
      { id: "milvus", label: "Milvus / Zilliz", open: true },
      { id: "chroma", label: "Chroma", open: true },
      { id: "pgvector", label: "pgvector (Postgres)", open: true },
      { id: "elastic", label: "Elasticsearch / OpenSearch" },
      { id: "glean", label: "Glean (enterprise search)" },
      { id: "vectara", label: "Vectara" },
    ],
  },
  {
    id: "agent_orchestration",
    label: "Agent Orchestration",
    minTier: "guided",
    hint: "Frameworks and protocols coordinating multi-step / multi-agent work.",
    items: [
      { id: "langgraph", label: "LangGraph", open: true },
      { id: "openai_agents_sdk", label: "OpenAI Agents SDK", parent: "openai" },
      { id: "microsoft_agent_framework", label: "Microsoft Agent Framework", parent: "microsoft" },
      { id: "google_adk", label: "Google Agent Dev Kit (ADK)", parent: "google" },
      { id: "crewai", label: "CrewAI", open: true },
      { id: "llamaindex", label: "LlamaIndex", open: true },
      { id: "mcp", label: "Model Context Protocol (MCP)", open: true },
      { id: "temporal", label: "Temporal" },
    ],
  },
  {
    id: "ai_gateway",
    label: "AI Gateway",
    minTier: "advanced",
    hint: "Routing, rate-limiting and key management across model providers.",
    items: [
      { id: "litellm", label: "LiteLLM", open: true },
      { id: "portkey", label: "Portkey" },
      { id: "openrouter", label: "OpenRouter" },
      { id: "cloudflare_ai_gateway", label: "Cloudflare AI Gateway", parent: "cloudflare" },
      { id: "kong_ai_gateway", label: "Kong AI Gateway", parent: "kong" },
    ],
  },
  {
    id: "llmops_observability",
    label: "LLMOps & Observability",
    minTier: "advanced",
    hint: "Tracing, evals and monitoring — an operational-maturity signal.",
    items: [
      { id: "langsmith", label: "LangSmith", parent: "langchain" },
      { id: "langfuse", label: "Langfuse", open: true },
      { id: "arize", label: "Arize / Phoenix" },
      { id: "braintrust", label: "Braintrust" },
      { id: "weights_biases", label: "Weights & Biases (Weave)" },
      { id: "helicone", label: "Helicone", open: true },
      { id: "mlflow", label: "MLflow", open: true },
      { id: "datadog_llm", label: "Datadog LLM Observability", parent: "datadog" },
    ],
  },
  {
    id: "governance_security",
    label: "AI Governance & Security",
    minTier: "advanced",
    hint: "Policy, guardrails and model-risk tooling. Signals governance maturity.",
    items: [
      { id: "credo_ai", label: "Credo AI" },
      { id: "onetrust_ai", label: "OneTrust AI Governance", parent: "onetrust" },
      { id: "watsonx_governance", label: "IBM watsonx.governance", parent: "ibm" },
      { id: "nemo_guardrails", label: "NVIDIA NeMo Guardrails", parent: "nvidia" },
      { id: "lakera", label: "Lakera (prompt firewall)" },
      { id: "protect_ai", label: "Protect AI" },
      { id: "opa", label: "Open Policy Agent (OPA)", open: true },
      { id: "holistic_ai", label: "Holistic AI" },
    ],
  },
  {
    id: "integration_ipaas",
    label: "Integration / iPaaS",
    minTier: "guided",
    hint: "How AI connects to the rest of the estate.",
    items: [
      { id: "mulesoft", label: "MuleSoft", parent: "salesforce" },
      { id: "boomi", label: "Boomi" },
      { id: "workato", label: "Workato" },
      { id: "informatica", label: "Informatica IDMC" },
      { id: "snaplogic", label: "SnapLogic" },
      { id: "zapier", label: "Zapier" },
      { id: "celigo", label: "Celigo" },
    ],
  },
  {
    id: "saas_suite_of_record",
    label: "SaaS Suites of Record",
    minTier: "quick",
    hint: "CRM / ERP / ITSM / HCM / productivity systems of record.",
    items: [
      { id: "microsoft_365_copilot", label: "Microsoft 365 / Copilot", parent: "microsoft" },
      { id: "google_workspace", label: "Google Workspace", parent: "google" },
      { id: "salesforce", label: "Salesforce (CRM)", parent: "salesforce" },
      { id: "sap", label: "SAP (ERP)", parent: "sap" },
      { id: "oracle_apps", label: "Oracle Fusion / NetSuite", parent: "oracle" },
      { id: "microsoft_dynamics", label: "Microsoft Dynamics 365", parent: "microsoft" },
      { id: "servicenow", label: "ServiceNow (ITSM)", parent: "servicenow" },
      { id: "workday", label: "Workday (HCM/Fin)", parent: "workday" },
      { id: "atlassian", label: "Atlassian (Jira/Confluence)", parent: "atlassian" },
    ],
  },
];

/* ─── Industry systems-of-record (archetype-gated) ─────────────────────────
 * Shown only when the buyer selects the matching archetype. `standard` flags
 * open integration standards (FHIR, FIX, OPC-UA, ISO 20022) — vendors that
 * support the standard score higher on portability / lower on lock-in. */

export interface SystemOfRecord {
  id: string;
  label: string;
  category: string;
  parent?: string;
  /** Open integration standard, if any (portability signal). */
  standard?: string;
}

export const INDUSTRY_SYSTEMS_OF_RECORD: Record<IndustryArchetype, SystemOfRecord[]> = {
  regulated_financial: [
    { id: "temenos", label: "Temenos (Transact)", category: "Core banking", standard: "ISO 20022" },
    { id: "fis", label: "FIS (Modern Banking)", category: "Core banking", parent: "fis", standard: "ISO 20022" },
    { id: "fiserv", label: "Fiserv (DNA/Premier)", category: "Core banking", parent: "fiserv", standard: "ISO 20022" },
    { id: "jack_henry", label: "Jack Henry", category: "Core banking" },
    { id: "mambu", label: "Mambu", category: "Core banking (cloud)" },
    { id: "thought_machine", label: "Thought Machine (Vault)", category: "Core banking (cloud)" },
    { id: "ncino", label: "nCino", category: "Loan origination", parent: "salesforce" },
    { id: "bloomberg_terminal", label: "Bloomberg Terminal", category: "Market data", parent: "bloomberg" },
    { id: "lseg_refinitiv", label: "LSEG / Refinitiv Workspace", category: "Market data" },
    { id: "murex", label: "Murex MX.3", category: "Trading & risk", standard: "FIX" },
    { id: "nasdaq_calypso", label: "Nasdaq (Adenza/Calypso)", category: "Trading & risk", parent: "nasdaq", standard: "FIX" },
    { id: "ion_group", label: "ION Group", category: "Trading & risk", standard: "FIX" },
  ],
  health_life_sciences: [
    { id: "epic", label: "Epic", category: "EHR", standard: "FHIR/HL7" },
    { id: "oracle_health_cerner", label: "Oracle Health (Cerner)", category: "EHR", parent: "oracle", standard: "FHIR/HL7" },
    { id: "meditech", label: "MEDITECH", category: "EHR", standard: "FHIR/HL7" },
    { id: "veeva_vault", label: "Veeva Vault", category: "Life-sciences cloud", parent: "veeva" },
    { id: "iqvia", label: "IQVIA", category: "Real-world data" },
    { id: "medidata", label: "Medidata (Dassault)", category: "Clinical EDC", parent: "dassault" },
    { id: "salesforce_health_cloud", label: "Salesforce Health Cloud", category: "Care management CRM", parent: "salesforce" },
    { id: "allscripts_veradigm", label: "Veradigm (Allscripts)", category: "Ambulatory EHR", standard: "FHIR/HL7" },
  ],
  legal_professional: [
    { id: "imanage", label: "iManage", category: "Document management" },
    { id: "netdocuments", label: "NetDocuments", category: "Document management" },
    { id: "relativity", label: "Relativity", category: "eDiscovery" },
    { id: "clio", label: "Clio", category: "Practice management" },
    { id: "thomson_reuters", label: "Thomson Reuters (Westlaw/HighQ)", category: "Legal research", parent: "thomson_reuters" },
    { id: "lexisnexis", label: "LexisNexis", category: "Legal research" },
    { id: "aderant", label: "Aderant", category: "Legal ERP / billing" },
    { id: "sharepoint_legal", label: "Microsoft SharePoint", category: "Document management", parent: "microsoft" },
  ],
  public_sector_education: [
    { id: "tyler_tech", label: "Tyler Technologies", category: "Govt ERP / court" },
    { id: "salesforce_gov_cloud", label: "Salesforce Government Cloud", category: "Case management", parent: "salesforce" },
    { id: "palantir_foundry", label: "Palantir Foundry", category: "Data integration", parent: "palantir" },
    { id: "accela", label: "Accela", category: "Permitting / licensing" },
    { id: "granicus", label: "Granicus", category: "Citizen engagement" },
    { id: "sap_public", label: "SAP for Public Sector", category: "Govt ERP", parent: "sap" },
    { id: "workday_education_gov", label: "Workday (Gov/Edu)", category: "HCM / finance", parent: "workday" },
    { id: "ellucian", label: "Ellucian (Banner/Colleague)", category: "Student info system" },
    { id: "powerschool", label: "PowerSchool", category: "K-12 SIS" },
  ],
  critical_infrastructure_defence: [
    { id: "palantir_gotham", label: "Palantir Gotham / Maven", category: "C2 / intelligence", parent: "palantir" },
    { id: "anduril_lattice", label: "Anduril Lattice", category: "C2 / autonomy" },
    { id: "aveva_pi", label: "AVEVA PI System (OSIsoft)", category: "Historian", parent: "aveva", standard: "OPC-UA" },
    { id: "esri_arcgis", label: "Esri ArcGIS / Schneider ArcFM", category: "Utility GIS" },
    { id: "ge_gridos", label: "GE Vernova GridOS", category: "ADMS / grid" },
    { id: "siemens_spectrum_scada", label: "Siemens Spectrum Power / SCADA", category: "SCADA / EMS", parent: "siemens", standard: "OPC-UA" },
    { id: "schneider_ecostruxure", label: "Schneider EcoStruxure", category: "DCS / SCADA", parent: "schneider", standard: "OPC-UA" },
    { id: "honeywell_experion", label: "Honeywell Experion", category: "DCS", parent: "honeywell", standard: "OPC-UA" },
    { id: "emerson_deltav", label: "Emerson DeltaV", category: "DCS", parent: "emerson", standard: "OPC-UA" },
  ],
  enterprise_software: [
    { id: "github", label: "GitHub", category: "Code SCM", parent: "microsoft" },
    { id: "gitlab", label: "GitLab", category: "Code SCM / DevOps" },
    { id: "datadog", label: "Datadog", category: "Observability", parent: "datadog" },
    { id: "atlassian_jira", label: "Atlassian Jira", category: "Issue tracking", parent: "atlassian" },
    { id: "pagerduty", label: "PagerDuty", category: "Incident management" },
    { id: "servicenow_itsm", label: "ServiceNow ITSM", category: "ITSM", parent: "servicenow" },
    { id: "snowflake_data", label: "Snowflake", category: "Data cloud" },
    { id: "databricks_data", label: "Databricks", category: "Data lakehouse" },
    { id: "splunk", label: "Splunk", category: "Observability / SIEM", parent: "cisco" },
  ],
  industrial_physical_ops: [
    { id: "sap_s4_manufacturing", label: "SAP S/4HANA Manufacturing", category: "ERP", parent: "sap" },
    { id: "siemens_opcenter", label: "Siemens Opcenter / MindSphere", category: "MES / IoT", parent: "siemens", standard: "OPC-UA" },
    { id: "rockwell_factorytalk", label: "Rockwell FactoryTalk", category: "MES / historian", parent: "rockwell", standard: "OPC-UA" },
    { id: "ptc_thingworx", label: "PTC ThingWorx / Windchill", category: "IoT / PLM", parent: "ptc" },
    { id: "aveva_pi_industrial", label: "AVEVA PI System", category: "Historian", parent: "aveva", standard: "OPC-UA" },
    { id: "siemens_teamcenter", label: "Siemens Teamcenter", category: "PLM", parent: "siemens" },
    { id: "dassault_3dexperience", label: "Dassault 3DEXPERIENCE", category: "PLM", parent: "dassault" },
    { id: "blue_yonder", label: "Blue Yonder", category: "Supply-chain planning" },
    { id: "manhattan_active", label: "Manhattan Associates", category: "WMS / unified commerce", parent: "manhattan" },
  ],
  commercial_enterprise: [
    { id: "guidewire", label: "Guidewire", category: "Insurance core (P&C)" },
    { id: "duck_creek", label: "Duck Creek", category: "Insurance core (cloud)" },
    { id: "sapiens", label: "Sapiens", category: "Insurance core (L&A)" },
    { id: "oracle_retail_xstore", label: "Oracle Retail (Xstore)", category: "Retail POS", parent: "oracle" },
    { id: "shopify_plus", label: "Shopify Plus", category: "Commerce", parent: "shopify" },
    { id: "adobe_commerce", label: "Adobe Commerce (Magento)", category: "Commerce (B2B)", parent: "adobe" },
    { id: "salesforce_commerce", label: "Salesforce Commerce Cloud", category: "Commerce", parent: "salesforce" },
    { id: "manhattan_associates", label: "Manhattan Associates", category: "WMS / POS", parent: "manhattan" },
    { id: "sap_commerce", label: "SAP (S/4 + CAR)", category: "Retail ERP", parent: "sap" },
  ],
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */

const TIER_RANK: Record<WorkflowTier, number> = { quick: 0, guided: 1, advanced: 2 };

/** Layers visible at a given tier (progressive disclosure). */
export function layersForTier(tier: WorkflowTier): InfraLayer[] {
  return INFRA_LAYERS.filter((l) => TIER_RANK[l.minTier] <= TIER_RANK[tier]);
}

/** Industry systems-of-record for the selected archetype. */
export function systemsForArchetype(archetype: string): SystemOfRecord[] {
  return INDUSTRY_SYSTEMS_OF_RECORD[archetype as IndustryArchetype] ?? [];
}

const ITEM_BY_ID = new Map<string, InfraItem & { layer: InfraLayerId }>();
for (const layer of INFRA_LAYERS) {
  for (const item of layer.items) ITEM_BY_ID.set(item.id, { ...item, layer: layer.id });
}
const SOR_BY_ID = new Map<string, SystemOfRecord>();
for (const list of Object.values(INDUSTRY_SYSTEMS_OF_RECORD)) {
  for (const sor of list) SOR_BY_ID.set(sor.id, sor);
}

/** The vendor family an infra item or SoR belongs to (for concentration). */
export function infraItemParent(id: string): string | undefined {
  return ITEM_BY_ID.get(id)?.parent ?? SOR_BY_ID.get(id)?.parent;
}

/** The layer an infra item belongs to (undefined for SoRs). */
export function infraItemLayer(id: string): InfraLayerId | undefined {
  return ITEM_BY_ID.get(id)?.layer;
}

export function infraItemIsOpen(id: string): boolean {
  return Boolean(ITEM_BY_ID.get(id)?.open);
}

export function systemOfRecordById(id: string): SystemOfRecord | undefined {
  return SOR_BY_ID.get(id);
}

/** Every selectable infra item id (across all layers), for validation. */
export function allInfraItemIds(): string[] {
  return Array.from(ITEM_BY_ID.keys());
}

/**
 * Single-parent concentration of a buyer's selections: the share of
 * parented selections that fall under the most common parent. 0 when there
 * is no concentration signal. Feeds the lock-in / concentration overlay.
 */
export function concentrationOf(selectedIds: string[]): { topParent: string | null; share: number } {
  const counts = new Map<string, number>();
  let parented = 0;
  for (const id of selectedIds) {
    const p = infraItemParent(id);
    if (!p) continue;
    parented++;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  if (parented === 0) return { topParent: null, share: 0 };
  let topParent: string | null = null;
  let top = 0;
  for (const [p, c] of counts) if (c > top) { top = c; topParent = p; }
  return { topParent, share: top / parented };
}
