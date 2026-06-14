// Market categories + share estimates + vendor momentum (mock seeds for v0.2).

import type {
  MarketCategory, MarketCategoryId, MarketShareEstimate, VendorMomentum,
} from "./types";

export const MARKET_CATEGORIES: MarketCategory[] = [
  { id: "frontier_model_api",        name: "Frontier model API",          description: "Foundation-model providers exposing reasoning + multimodal models via API." },
  { id: "enterprise_assistant",      name: "Enterprise assistant",        description: "Productivity assistants embedded in M365 / Workspace / CRM seat workflows." },
  { id: "developer_coding_agent",    name: "Developer / coding agent",    description: "AI assistants and agents for software engineering and code review." },
  { id: "agent_platform",            name: "Agent platform",              description: "Build-and-run platforms for multi-step, tool-using AI agents." },
  { id: "rag_enterprise_search",     name: "RAG / enterprise search",     description: "Permission-aware retrieval and assistants over enterprise knowledge." },
  { id: "workflow_automation_ai",    name: "Workflow automation AI",      description: "AI woven into ERP / back-office processes." },
  { id: "crm_customer_ai",           name: "CRM / customer AI",           description: "AI-driven customer service, sales, marketing inside CRM." },
  { id: "itsm_hr_service_ai",        name: "ITSM / HR / service AI",      description: "Conversational AI for IT, HR, employee service workflows." },
  { id: "cloud_ai_platform",         name: "Cloud AI platform",           description: "Model marketplaces + training + serving on hyperscaler clouds." },
  { id: "regulated_industry_ai",     name: "Regulated-industry AI",       description: "Vertical AI for legal, financial, healthcare workflows." },
];

const m = (
  vendorId: string, categoryId: MarketCategoryId, estimatedShare: number,
  confidence: number, prev: number, source: string,
  reportedShare?: number,
): MarketShareEstimate => ({
  vendorId, categoryId,
  reportedShare, estimatedShare, confidence,
  source, sourceDate: "2026-04-30",
  methodology: "Triangulation across analyst reports, hyperscaler disclosures, hiring + product velocity, partner ecosystem footprint",
  previousEstimate: prev, changePct: +(estimatedShare - prev).toFixed(1),
});

export const MARKET_SHARES: MarketShareEstimate[] = [
  // Frontier model API
  m("vendor_openai",    "frontier_model_api", 38, 78, 41, "Analyst triangulation"),
  m("vendor_anthropic", "frontier_model_api", 22, 76, 18, "Analyst triangulation"),
  m("vendor_google",    "frontier_model_api", 18, 70, 17, "Analyst triangulation"),
  m("vendor_mistral",   "frontier_model_api",  6, 64,  5, "EU procurement signals"),
  m("vendor_cohere",    "frontier_model_api",  4, 64,  4, "Analyst triangulation"),

  // Enterprise assistant
  m("vendor_microsoft", "enterprise_assistant", 52, 84, 48, "Hyperscaler disclosures"),
  m("vendor_google",    "enterprise_assistant", 14, 70, 14, "Workspace adoption proxy"),
  m("vendor_glean",     "enterprise_assistant",  9, 72,  7, "Job posting + reference signals"),
  m("vendor_writer",    "enterprise_assistant",  4, 68,  4, "Analyst triangulation"),

  // Developer / coding agent
  m("vendor_microsoft", "developer_coding_agent", 60, 86, 58, "GitHub Copilot disclosures"),
  m("vendor_openai",    "developer_coding_agent", 12, 70, 10, "Codex usage signals"),
  m("vendor_anthropic", "developer_coding_agent", 10, 70,  6, "Claude Code adoption signals"),
  m("vendor_google",    "developer_coding_agent",  8, 68,  9, "Gemini Code Assist signals"),

  // Agent platform
  m("vendor_microsoft", "agent_platform", 24, 76, 21, "Copilot Studio + Agent Service"),
  m("vendor_aws",       "agent_platform", 18, 74, 15, "Bedrock Agents + Strands"),
  m("vendor_salesforce","agent_platform", 16, 76, 12, "Agentforce production references"),
  m("vendor_servicenow","agent_platform", 12, 74, 10, "AI Agents inside Now"),
  m("vendor_openai",    "agent_platform", 10, 70,  7, "Responses + Assistants API"),

  // RAG / enterprise search
  m("vendor_glean",     "rag_enterprise_search", 26, 78, 22, "Reference customer growth"),
  m("vendor_microsoft", "rag_enterprise_search", 24, 76, 22, "Copilot Studio knowledge"),
  m("vendor_google",    "rag_enterprise_search", 12, 68, 12, "Vertex AI Search"),
  m("vendor_databricks","rag_enterprise_search", 10, 70,  8, "Vector Search + Genie"),

  // Workflow automation AI
  m("vendor_sap",       "workflow_automation_ai", 28, 74, 27, "S/4HANA + Joule footprint"),
  m("vendor_microsoft", "workflow_automation_ai", 22, 74, 20, "Copilot Studio + Power Automate"),
  m("vendor_servicenow","workflow_automation_ai", 16, 76, 14, "Now Assist"),
  m("vendor_oracle",    "workflow_automation_ai", 12, 70, 12, "Fusion AI Agents"),

  // CRM / customer AI
  m("vendor_salesforce","crm_customer_ai", 44, 84, 42, "Agentforce production references", 42),
  m("vendor_microsoft", "crm_customer_ai", 18, 74, 18, "Dynamics 365 Copilot"),
  m("vendor_servicenow","crm_customer_ai", 10, 72,  9, "CSM Now Assist"),

  // ITSM / HR / service AI
  m("vendor_servicenow","itsm_hr_service_ai", 42, 82, 39, "Now Assist + Moveworks"),
  m("vendor_moveworks", "itsm_hr_service_ai", 14, 72, 16, "Standalone presence (acquired)"),
  m("vendor_microsoft", "itsm_hr_service_ai", 12, 72, 11, "M365 Copilot + Dynamics"),
  m("vendor_salesforce","itsm_hr_service_ai", 10, 70, 10, "Service Cloud"),

  // Cloud AI platform
  m("vendor_microsoft", "cloud_ai_platform", 32, 80, 30, "Azure AI Foundry"),
  m("vendor_aws",       "cloud_ai_platform", 28, 80, 28, "Bedrock + SageMaker"),
  m("vendor_google",    "cloud_ai_platform", 18, 76, 18, "Vertex AI"),
  m("vendor_oracle",    "cloud_ai_platform",  8, 70,  7, "OCI Generative AI"),
  m("vendor_ibm",       "cloud_ai_platform",  6, 68,  6, "watsonx"),

  // Regulated-industry AI
  m("vendor_harvey",    "regulated_industry_ai", 28, 80, 24, "AmLaw 100 deployments"),
  m("vendor_hebbia",    "regulated_industry_ai", 14, 72, 12, "Asset-management deployments"),
  m("vendor_writer",    "regulated_industry_ai", 10, 70,  9, "Pharma med-comms"),
  m("vendor_rogo",      "regulated_industry_ai",  6, 64,  4, "IB pilots"),
];

// ─── Vendor momentum ──────────────────────────────────────────────────────

const mom = (
  vendorId: string, momentumScore: number, newsVelocity: number, productVelocity: number,
  adoptionSignal: number, hiringSignal: number, customerSignal: number,
  partnerSignal: number, marketShareMovement: number, riskSignal: number, confidence: number,
): VendorMomentum => ({
  vendorId, period: "2026-W18", momentumScore, newsVelocity, productVelocity,
  adoptionSignal, hiringSignal, customerSignal, partnerSignal, marketShareMovement,
  riskSignal, confidence,
});

export const VENDOR_MOMENTUM: VendorMomentum[] = [
  mom("vendor_anthropic", 88, 88, 92, 84, 90, 80, 78, 82, 18, 78),
  mom("vendor_microsoft", 86, 78, 82, 88, 86, 92, 86, 70, 12, 88),
  mom("vendor_openai",    85, 92, 84, 80, 88, 78, 70, 60, 22, 76),
  mom("vendor_harvey",    78, 76, 80, 78, 76, 84, 70, 80, 14, 80),
  mom("vendor_glean",     76, 74, 78, 80, 76, 80, 68, 78, 10, 78),
  mom("vendor_databricks",75, 76, 80, 78, 78, 76, 78, 72, 12, 78),
  mom("vendor_google",    72, 78, 80, 70, 74, 68, 72, 64, 14, 72),
  mom("vendor_aws",       71, 70, 72, 76, 72, 76, 80, 60, 12, 80),
  mom("vendor_salesforce",70, 72, 74, 72, 70, 78, 70, 68, 18, 76),
  mom("vendor_servicenow",70, 70, 76, 74, 72, 78, 72, 70, 14, 76),
  mom("vendor_hebbia",    68, 68, 70, 74, 70, 78, 60, 76, 14, 72),
  mom("vendor_mistral",   66, 70, 72, 64, 72, 60, 68, 64, 18, 66),
  mom("vendor_writer",    62, 60, 66, 64, 64, 70, 58, 60, 14, 68),
  mom("vendor_cohere",    60, 58, 64, 60, 60, 64, 60, 60, 16, 66),
  mom("vendor_oracle",    58, 56, 64, 60, 58, 70, 64, 64, 14, 70),
  mom("vendor_moveworks", 58, 50, 56, 64, 56, 68, 64, 60, 18, 70),
  mom("vendor_snowflake", 64, 64, 72, 70, 66, 72, 68, 60, 14, 76),
  mom("vendor_rogo",      56, 60, 60, 56, 58, 60, 50, 70, 18, 64),
  mom("vendor_ibm",       54, 56, 58, 54, 56, 60, 60, 56, 12, 70),
  mom("vendor_sap",       54, 56, 58, 56, 56, 64, 60, 56, 14, 72),
];
