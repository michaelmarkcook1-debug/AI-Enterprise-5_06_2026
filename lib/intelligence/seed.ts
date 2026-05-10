import type {
  Capability,
  EvidenceSource,
  MarketCategory,
  MarketCategoryId,
  MarketShareEstimate,
  NewsItem,
  Vendor,
  VendorCapability,
  VendorMomentum,
  VendorPillarScore,
  Watchlist,
} from "./types";
import type { EvidenceGrade, PillarId } from "../types";
import { calculateMarketMomentum, marketShareChangePct } from "./metrics";

const lastUpdated = "2026-05-07T00:00:00.000Z";

export const INTELLIGENCE_VENDORS: Vendor[] = [
  vendor("openai", "OpenAI", "Frontier model/API", 91, 78, "San Francisco, US", "private", ["Frontier model/API", "Agent platform", "Enterprise assistant"], "Category shaper with strong model cadence and fast enterprise API expansion.", "Lead with model quality, agent runtime, enterprise controls, and ecosystem distribution through strategic partners.", "Advanced supervised and autonomous agent patterns; enterprise production controls still need careful validation.", ["Models", "Agents", "Developer productivity", "Knowledge assistant"], ["SSO", "admin controls", "API controls"], ["Commercial dependency concentration", "fast-changing roadmap"], "Winning, but buyers should separate model capability from enterprise operating control."),
  vendor("microsoft", "Microsoft", "Cloud AI platform", 90, 84, "Redmond, US", "public", ["Cloud AI platform", "Enterprise assistant", "Developer/coding agent"], "Distribution leader through Microsoft 365, Azure, GitHub, and enterprise procurement reach.", "Bundle AI into productivity, developer, security, and cloud workflows while shifting buyers into Azure-managed control planes.", "Strong copilot estate with widening agent orchestration across productivity and developer workflows.", ["Enterprise assistant", "Developer productivity", "Cloud AI", "Governance"], ["identity", "compliance", "tenant controls", "security"], ["Bundling opacity", "cost governance complexity"], "Likely to own the enterprise access layer, but category share must be measured by workload, not by suite reach."),
  vendor("google", "Google", "Cloud AI platform", 86, 76, "Mountain View, US", "public", ["Cloud AI platform", "Frontier model/API", "RAG/enterprise search"], "Technically deep platform with improving enterprise packaging through Google Cloud and Workspace.", "Differentiate on model research, multimodal capability, data/cloud integration, and Workspace adoption.", "Strong model and multimodal progress; enterprise agent operating model varies by buyer stack.", ["Models", "Cloud AI", "Enterprise search", "Workspace"], ["cloud controls", "data controls", "identity"], ["Enterprise adoption consistency", "fragmented portfolio perception"], "Strong challenger where data, search, and cloud-native workloads matter."),
  vendor("anthropic", "Anthropic", "Frontier model/API", 84, 73, "San Francisco, US", "private", ["Frontier model/API", "Enterprise assistant"], "Safety-positioned frontier lab gaining enterprise attention for reasoning, coding, and policy-sensitive use cases.", "Compete on trustworthy model behaviour, enterprise APIs, and partnerships with cloud and productivity ecosystems.", "Strong supervised agent and coding momentum; buyer diligence should inspect governance and deployment options.", ["Models", "Coding", "Knowledge assistant"], ["API controls", "policy controls"], ["Narrower first-party enterprise suite", "partner dependency"], "High-quality model contender with a control narrative that resonates in regulated buyers."),
  vendor("aws", "AWS", "Cloud AI platform", 83, 82, "Seattle, US", "public", ["Cloud AI platform", "Agent platform", "Infrastructure"], "Infrastructure-heavy AI platform provider with breadth across model choice, deployment, and cloud operations.", "Win through Bedrock-style model optionality, cloud-native deployment, and enterprise infrastructure trust.", "Strong agent platform foundations for AWS estates; business-user assistant layer is less concentrated.", ["Cloud AI", "Agent platform", "Infrastructure", "Governance"], ["cloud identity", "network controls", "observability"], ["Complexity for non-AWS estates", "service sprawl"], "Best considered a control plane and deployment platform, not a single assistant market-share proxy."),
  vendor("salesforce", "Salesforce", "CRM/customer AI", 80, 75, "San Francisco, US", "public", ["CRM/customer AI", "Agent platform", "Workflow automation AI"], "CRM workflow owner with strong access to sales, service, and customer data.", "Embed AI agents into CRM workflows and monetise via packaged customer-facing productivity outcomes.", "Strong domain-agent narrative in sales and service; cross-enterprise autonomy requires validation.", ["CRM AI", "Service AI", "Agents"], ["data cloud governance", "admin controls"], ["Platform cost", "CRM-centric scope"], "A sector leader for customer workflows, but not a universal enterprise AI platform."),
  vendor("servicenow", "ServiceNow", "ITSM/HR/service AI", 79, 76, "Santa Clara, US", "public", ["ITSM/HR/service AI", "Workflow automation AI", "Agent platform"], "Workflow automation incumbent with strong IT, HR, and enterprise service management footprint.", "Position AI agents as workflow execution inside systems of record for service operations.", "Good supervised workflow-agent fit; autonomy should be staged around approval and audit paths.", ["ITSM", "HR service", "Workflow automation"], ["workflow audit", "RBAC", "approval controls"], ["Suite dependency", "implementation complexity"], "A practical enterprise agent player where workflows already live in ServiceNow."),
  vendor("oracle", "Oracle", "Cloud AI platform", 74, 72, "Austin, US", "public", ["Cloud AI platform", "Regulated-industry AI", "Enterprise applications"], "Enterprise application and database incumbent with AI embedded into cloud and business suites.", "Use cloud infrastructure, database estate, and apps to pull AI into existing Oracle accounts.", "Agentic capability is more application-embedded than broad open agent platform.", ["Enterprise apps", "Database AI", "Cloud AI"], ["database controls", "app controls"], ["Perception gap", "ecosystem breadth"], "Relevant for Oracle-heavy estates; market leadership varies sharply by category."),
  vendor("sap", "SAP", "Enterprise applications", 73, 73, "Walldorf, Germany", "public", ["Enterprise applications", "Workflow automation AI", "Regulated-industry AI"], "ERP and business-process incumbent embedding AI into finance, supply chain, HR, and procurement.", "Defend and extend system-of-record workflows through embedded assistants and process intelligence.", "Agentic capability is strongest in governed business processes rather than open-ended autonomy.", ["ERP AI", "Process intelligence", "Governance"], ["role controls", "process audit"], ["Suite dependency", "slower perceived cadence"], "Strong for SAP-centric operating models; do not confuse ERP reach with frontier AI share."),
  vendor("ibm", "IBM", "Regulated-industry AI", 72, 78, "Armonk, US", "public", ["Regulated-industry AI", "Governance", "Hybrid AI"], "Governance and hybrid-enterprise specialist with credibility in regulated operating environments.", "Compete on trusted AI, hybrid deployment, consulting, governance, and model lifecycle management.", "More conservative agentic posture; strong where auditability and controls outweigh speed.", ["Governance", "Hybrid deployment", "Regulated AI"], ["model governance", "audit", "hybrid controls"], ["Momentum perception", "developer mindshare"], "Useful benchmark for control maturity even when not the fastest growth story."),
  vendor("cohere", "Cohere", "Frontier model/API", 70, 70, "Toronto, Canada", "private", ["Frontier model/API", "RAG/enterprise search", "Regulated-industry AI"], "Enterprise-oriented model provider with emphasis on secure deployment and retrieval workloads.", "Focus on enterprise models, private deployment patterns, and knowledge-intensive workloads.", "Agentic layer is less visible than model and retrieval strengths.", ["Models", "RAG", "Private deployment"], ["deployment controls", "data controls"], ["Lower broad-market visibility", "ecosystem scale"], "A credible specialist when private deployment and RAG quality matter more than suite breadth."),
  vendor("mistral", "Mistral", "Frontier model/API", 71, 68, "Paris, France", "private", ["Frontier model/API", "Open model", "European AI"], "European model provider with strong open-weight and sovereignty positioning.", "Win buyers needing model optionality, European positioning, and flexible deployment.", "Agentic capability depends heavily on partners and implementation layer.", ["Models", "Sovereign AI", "Developer AI"], ["deployment optionality"], ["Enterprise control proof depth", "smaller account coverage"], "Momentum is real, but enterprise readiness should be validated workload by workload."),
  vendor("glean", "Glean", "RAG/enterprise search", 78, 74, "Palo Alto, US", "private", ["RAG/enterprise search", "Enterprise assistant"], "Enterprise knowledge assistant specialist with strong workplace search heritage.", "Own enterprise knowledge retrieval and expand from answer engine into assistant and agent workflows.", "Promising knowledge-agent path; source permissioning remains a central buyer checkpoint.", ["Enterprise search", "Knowledge assistant", "RAG"], ["source permissions", "connector controls"], ["Platform breadth", "dependency on content connectors"], "Strong category specialist for knowledge-heavy enterprises."),
  vendor("moveworks", "Moveworks", "ITSM/HR/service AI", 75, 72, "Mountain View, US", "private", ["ITSM/HR/service AI", "Workflow automation AI"], "Employee support automation specialist focused on IT, HR, and internal service workflows.", "Expand from support automation into broader enterprise service agents.", "Strong supervised service automation; broad autonomy depends on workflow integration depth.", ["Employee service", "Workflow automation", "ITSM"], ["workflow approval", "identity"], ["Category concentration", "suite competition"], "Clear value in service automation, especially where ticket deflection is measurable."),
  vendor("writer", "Writer", "Enterprise assistant", 74, 70, "San Francisco, US", "private", ["Enterprise assistant", "Content AI", "Agent platform"], "Enterprise generative AI platform focused on brand-safe content, workflows, and knowledge apps.", "Differentiate through enterprise content workflows, governance, and business-user tooling.", "Agentic workflows are emerging around content and knowledge operations.", ["Content AI", "Knowledge apps", "Governance"], ["brand controls", "admin controls"], ["Category crowding", "proof at broad scale"], "Potential winner in governed content workflows, less proven as a universal platform."),
  vendor("hebbia", "Hebbia", "RAG/enterprise search", 69, 62, "New York, US", "private", ["RAG/enterprise search", "Financial services AI"], "Research and document intelligence specialist with strength in high-value knowledge work.", "Target analysts and deal teams with structured document intelligence and workflow depth.", "Agentic capability is workflow-specific and should be tested against regulated review needs.", ["Document intelligence", "Financial research", "RAG"], ["workspace controls"], ["Scale evidence", "category scope"], "Compelling specialist for research-intensive teams, with confidence still shaped by reference depth."),
  vendor("rogo", "Rogo", "Regulated-industry AI", 67, 61, "New York, US", "private", ["Financial services AI", "RAG/enterprise search"], "Financial-services AI specialist targeting banking, investing, and research workflows.", "Win regulated financial teams through domain fit, workflow language, and curated data experiences.", "Agentic capability should remain supervised in high-stakes finance contexts.", ["Financial research", "Knowledge assistant"], ["domain controls"], ["Limited horizontal proof", "vendor maturity"], "Interesting vertical specialist; evaluate evidence depth before enterprise-scale rollout."),
  vendor("harvey", "Harvey", "Regulated-industry AI", 76, 71, "San Francisco, US", "private", ["Legal AI", "Regulated-industry AI"], "Legal AI specialist with strong mindshare in law firms and legal departments.", "Own legal knowledge work and expand into adjacent professional-services workflows.", "Agentic capability is valuable but should be bounded by human review and privilege controls.", ["Legal research", "Contract review", "Professional services"], ["matter controls", "audit"], ["Vertical concentration", "pricing opacity"], "High-signal vertical leader; market share should be assessed in legal, not generic AI."),
  vendor("databricks", "Databricks", "Cloud AI platform", 79, 76, "San Francisco, US", "private", ["Cloud AI platform", "Data AI", "Developer/coding agent"], "Data and AI platform with strong lakehouse footprint and model-building orientation.", "Use data estate, open model tooling, and governance to become enterprise AI build platform.", "Agentic capability is strongest for data/analytics and custom enterprise build patterns.", ["Data AI", "Model operations", "Governance"], ["data governance", "lineage"], ["Business-user assistant reach", "implementation skill needs"], "Strong for build-oriented enterprises that treat data governance as the AI foundation."),
  vendor("snowflake", "Snowflake", "Cloud AI platform", 77, 75, "Bozeman, US", "public", ["Cloud AI platform", "Data AI", "RAG/enterprise search"], "Data cloud incumbent embedding AI into analytics, apps, and governed enterprise data workflows.", "Turn governed data estate into AI applications, search, and application-development layer.", "Agentic capability is emerging around governed data and app workflows.", ["Data AI", "Enterprise search", "Governance"], ["data access controls", "governance"], ["AI platform breadth", "ecosystem competition"], "Strong data-layer contender; category share differs greatly between data AI and assistant markets."),
];

function vendor(
  id: string,
  name: string,
  category: string,
  overallScore: number,
  confidenceScore: number,
  headquarters: string,
  ownershipType: string,
  supportedUseCases: string[],
  description: string,
  strategy: string,
  agenticCapability: string,
  productCapabilities: string[],
  enterpriseControls: string[],
  riskProfile: string[],
  analystInterpretation: string,
): Vendor {
  const supportedIndustries = ["Commercial enterprise", "Financial services", "Healthcare", "Public sector", "Technology"].filter((industry) =>
    category.includes("Regulated") ? industry !== "Commercial enterprise" || id !== "harvey" : true,
  );
  return {
    id,
    name,
    slug: id,
    category,
    description,
    headquarters,
    ownershipType,
    supportedIndustries,
    supportedUseCases,
    supportedEcosystems: ecosystemFor(id),
    deploymentOptions: deploymentFor(id),
    autonomyLevelMax: id === "openai" || id === "microsoft" || id === "aws" ? "supervised_agent" : "human_in_loop",
    overallScore,
    confidenceScore,
    marketPosition: marketPositionFor(overallScore),
    strategy,
    productCapabilities,
    enterpriseControls,
    agenticCapability,
    industryStrength: industryStrengthFor(id),
    riskProfile,
    analystInterpretation,
    lastUpdated,
  };
}

function ecosystemFor(id: string): string[] {
  const defaults = ["microsoft", "aws", "google_workspace", "salesforce", "servicenow", "databricks", "snowflake"];
  const map: Record<string, string[]> = {
    microsoft: ["microsoft", "azure", "github", "servicenow", "sap"],
    google: ["google_workspace", "gcp", "databricks", "snowflake"],
    aws: ["aws", "databricks", "salesforce", "servicenow"],
    salesforce: ["salesforce", "slack", "mulesoft", "snowflake"],
    servicenow: ["servicenow", "microsoft", "workday", "sap"],
    sap: ["sap", "microsoft", "aws"],
    oracle: ["oracle", "oci", "microsoft"],
  };
  return map[id] ?? defaults.slice(0, 4);
}

function deploymentFor(id: string): string[] {
  if (["aws", "microsoft", "google", "ibm", "cohere", "mistral", "databricks"].includes(id)) return ["saas", "vpc", "hybrid", "sovereign"];
  if (["openai", "anthropic", "salesforce", "servicenow"].includes(id)) return ["saas", "vpc"];
  return ["saas"];
}

function marketPositionFor(score: number): string {
  if (score >= 88) return "Leader";
  if (score >= 80) return "Major challenger";
  if (score >= 74) return "Category leader";
  if (score >= 70) return "Specialist contender";
  return "Emerging specialist";
}

function industryStrengthFor(id: string): { industry: string; score: number; note: string }[] {
  const base = [
    { industry: "Technology", score: 78, note: "Good developer and platform fit." },
    { industry: "Financial services", score: 68, note: "Requires control validation." },
    { industry: "Healthcare", score: 62, note: "Needs privacy and clinical workflow evidence." },
  ];
  const overrides: Record<string, { industry: string; score: number; note: string }[]> = {
    harvey: [{ industry: "Legal", score: 91, note: "Strong legal workflow fit with human review." }],
    rogo: [{ industry: "Financial services", score: 86, note: "Finance-specific workflow and language fit." }],
    servicenow: [{ industry: "Enterprise service operations", score: 88, note: "Strong ITSM and service workflow ownership." }],
    salesforce: [{ industry: "Customer operations", score: 89, note: "Strong CRM data and workflow position." }],
    ibm: [{ industry: "Regulated enterprise", score: 82, note: "Control-led posture suits risk-heavy buyers." }],
  };
  return overrides[id] ?? base;
}

export const MARKET_CATEGORIES: MarketCategory[] = [
  { id: "frontier_model_api", name: "Frontier model/API", description: "Foundational model APIs and direct model consumption." },
  { id: "enterprise_assistant", name: "Enterprise assistant", description: "Knowledge workers using assistants embedded in productivity or work hubs." },
  { id: "developer_coding_agent", name: "Developer/coding agent", description: "Coding copilots, software agents, and developer productivity AI." },
  { id: "agent_platform", name: "Agent platform", description: "Tools for building, governing, and operating AI agents." },
  { id: "rag_enterprise_search", name: "RAG/enterprise search", description: "Enterprise knowledge retrieval, search, and answer systems." },
  { id: "workflow_automation_ai", name: "Workflow automation AI", description: "AI applied to multi-step internal workflow execution." },
  { id: "crm_customer_ai", name: "CRM/customer AI", description: "Sales, service, and customer-experience AI." },
  { id: "itsm_hr_service_ai", name: "ITSM/HR/service AI", description: "Employee service, ITSM, HR, and enterprise service automation." },
  { id: "cloud_ai_platform", name: "Cloud AI platform", description: "Cloud-native AI build, deployment, security, and operations." },
  { id: "regulated_industry_ai", name: "Regulated-industry AI", description: "Legal, financial, healthcare, public-sector, and high-control vertical AI." },
];

const shareRows: [string, MarketCategoryId, number, number | undefined, number][] = [
  ["openai", "frontier_model_api", 29, 26, 74], ["anthropic", "frontier_model_api", 17, 14, 67], ["google", "frontier_model_api", 16, 15, 62], ["mistral", "frontier_model_api", 7, 5, 55], ["cohere", "frontier_model_api", 5, 6, 58],
  ["microsoft", "enterprise_assistant", 36, 31, 72], ["openai", "enterprise_assistant", 15, 13, 58], ["glean", "enterprise_assistant", 10, 8, 57], ["writer", "enterprise_assistant", 6, 5, 52],
  ["microsoft", "developer_coding_agent", 40, 36, 76], ["openai", "developer_coding_agent", 12, 10, 55], ["anthropic", "developer_coding_agent", 10, 8, 53], ["google", "developer_coding_agent", 8, 8, 49],
  ["aws", "agent_platform", 19, 16, 61], ["openai", "agent_platform", 18, 14, 58], ["microsoft", "agent_platform", 16, 13, 64], ["salesforce", "agent_platform", 10, 8, 56], ["servicenow", "agent_platform", 9, 7, 55],
  ["glean", "rag_enterprise_search", 18, 15, 64], ["google", "rag_enterprise_search", 14, 12, 58], ["snowflake", "rag_enterprise_search", 11, 9, 56], ["cohere", "rag_enterprise_search", 9, 8, 54], ["hebbia", "rag_enterprise_search", 6, 5, 44],
  ["servicenow", "workflow_automation_ai", 20, 17, 68], ["salesforce", "workflow_automation_ai", 18, 15, 63], ["sap", "workflow_automation_ai", 13, 13, 56], ["moveworks", "workflow_automation_ai", 8, 7, 49],
  ["salesforce", "crm_customer_ai", 34, 31, 72], ["microsoft", "crm_customer_ai", 14, 13, 56], ["oracle", "crm_customer_ai", 10, 10, 50],
  ["servicenow", "itsm_hr_service_ai", 32, 29, 74], ["moveworks", "itsm_hr_service_ai", 13, 12, 55], ["microsoft", "itsm_hr_service_ai", 10, 9, 52],
  ["microsoft", "cloud_ai_platform", 25, 23, 78], ["aws", "cloud_ai_platform", 24, 22, 79], ["google", "cloud_ai_platform", 18, 17, 72], ["databricks", "cloud_ai_platform", 9, 8, 60], ["snowflake", "cloud_ai_platform", 7, 6, 58],
  ["harvey", "regulated_industry_ai", 13, 10, 57], ["ibm", "regulated_industry_ai", 12, 12, 65], ["cohere", "regulated_industry_ai", 8, 7, 50], ["rogo", "regulated_industry_ai", 5, 4, 42],
];

export const MARKET_SHARE_ESTIMATES: MarketShareEstimate[] = shareRows.map(([vendorId, categoryId, estimatedShare, previousEstimate, confidence]) => ({
  vendorId,
  categoryId,
  estimatedShare,
  previousEstimate,
  changePct: marketShareChangePct(estimatedShare, previousEstimate),
  confidence,
  source: "AI Enterpise seed data (mock market model)",
  sourceDate: "2026-05-06T00:00:00.000Z",
  methodology: "Directional category estimate based on mock adoption, distribution, product-signal, and customer-reference proxies. Not audited market share.",
}));

export const VENDOR_MOMENTUM: VendorMomentum[] = INTELLIGENCE_VENDORS.map((v, index) => {
  const signals = {
    newsVelocity: clamp(v.overallScore - 8 + (index % 4) * 4),
    productVelocity: clamp(v.overallScore - 4 + (index % 3) * 3),
    adoptionSignal: clamp(v.overallScore - 10 + (v.confidenceScore - 65) * 0.4),
    hiringSignal: clamp(45 + (index % 6) * 6),
    customerSignal: clamp(v.confidenceScore - 4),
    partnerSignal: clamp(v.overallScore - 12 + (index % 5) * 3),
    marketShareMovement: clamp(50 + (index % 5) * 8),
    riskSignal: clamp(28 + (index % 6) * 7),
  };
  return {
    vendorId: v.id,
    period: "2026-W19",
    ...signals,
    momentumScore: calculateMarketMomentum(signals),
    confidence: Math.round((v.confidenceScore + 65) / 2),
  };
});

export const NEWS_ITEMS: NewsItem[] = [
  news("news_openai_agents", "OpenAI expands enterprise agent runtime controls", "Mock signal indicates stronger tool scoping, admin policies, and agent evaluation workflow.", ["openai"], ["Agentic AI", "Enterprise control"], 88, 70, ["integration_ops", "enterprise_control"], "Improves the agent operating model, but buyers still need proof across permission inheritance and audit trails.", [{ pillar: "integration_ops", direction: "up", magnitude: 3, rationale: "Broader agent tooling raises implementation fit." }, { pillar: "enterprise_control", direction: "watch", magnitude: 1, rationale: "Control claims need customer evidence." }], ["microsoft", "anthropic", "aws"], "positive"),
  news("news_microsoft_copilot", "Microsoft pushes Copilot agents deeper into enterprise workflows", "Mock signal highlights broader agent templates across productivity, service, and developer workflows.", ["microsoft"], ["Agentic AI", "Product launch"], 86, 74, ["business_fit", "integration_ops", "market_strength"], "Distribution advantage is meaningful, but market share remains category-specific and cost governance stays material.", [{ pillar: "market_strength", direction: "up", magnitude: 2, rationale: "Distribution signal strengthens." }], ["servicenow", "salesforce", "openai"], "positive"),
  news("news_google_multimodal", "Google strengthens multimodal enterprise AI packaging", "Mock release signal points to better model and Workspace integration for multimodal workloads.", ["google"], ["Product launch", "Infrastructure"], 76, 64, ["reliability_safety", "business_fit"], "Multimodal quality can shift workload-level fit, especially in content-rich operational processes.", [{ pillar: "business_fit", direction: "up", magnitude: 2, rationale: "More use cases become addressable." }], ["openai", "microsoft", "anthropic"], "positive"),
  news("news_anthropic_safety", "Anthropic extends enterprise safety positioning", "Mock signal suggests stronger policy controls and enterprise model governance narrative.", ["anthropic"], ["Enterprise control", "Strategy signal"], 74, 61, ["reliability_safety", "enterprise_control"], "The control narrative is useful, but procurement should inspect deployment, logging, and retention evidence.", [{ pillar: "enterprise_control", direction: "watch", magnitude: 2, rationale: "Narrative strength needs verified operating controls." }], ["openai", "cohere", "ibm"], "neutral"),
  news("news_salesforce_agents", "Salesforce packages CRM agents around service and sales workflows", "Mock signal shows more role-specific customer workflow agents.", ["salesforce"], ["Agentic AI", "Product launch"], 78, 66, ["business_fit", "integration_ops"], "Workflow ownership makes the signal relevant in CRM-heavy estates, not as generic platform leadership.", [{ pillar: "business_fit", direction: "up", magnitude: 3, rationale: "CRM workflow fit improves." }], ["microsoft", "servicenow", "oracle"], "positive"),
  news("news_servicenow_workflow", "ServiceNow advances service workflow AI roadmap", "Mock signal indicates more IT and HR service automation patterns with governance hooks.", ["servicenow"], ["Agentic AI", "Enterprise control"], 77, 67, ["integration_ops", "enterprise_control"], "ServiceNow can convert workflow ownership into agent adoption if approvals and auditability remain clear.", [{ pillar: "integration_ops", direction: "up", magnitude: 2, rationale: "Workflow execution fit improves." }], ["moveworks", "microsoft", "salesforce"], "positive"),
  news("news_ibm_governance", "IBM doubles down on governed AI lifecycle controls", "Mock strategy signal highlights governance, auditability, and hybrid deployment messaging.", ["ibm"], ["Regulation", "Enterprise control"], 70, 72, ["enterprise_control", "vendor_resilience"], "This matters in regulated contexts where control evidence can outweigh market momentum.", [{ pillar: "enterprise_control", direction: "up", magnitude: 2, rationale: "Governance signal strengthens high-control fit." }], ["microsoft", "aws", "cohere"], "neutral"),
  news("news_harvey_legal", "Harvey expands legal workflow intelligence", "Mock customer-signal item suggests deeper legal workflow templates and document intelligence.", ["harvey"], ["Product launch", "Market movement"], 73, 59, ["business_fit", "market_strength"], "Strengthens legal category position but should not be generalised to all enterprise AI use cases.", [{ pillar: "business_fit", direction: "up", magnitude: 3, rationale: "Vertical fit deepens." }], ["rogo", "hebbia", "openai"], "positive"),
  news("news_cost_risk", "Enterprise buyers flag rising AI usage-cost variance", "Mock cross-vendor signal indicates more board scrutiny on AI FinOps and unit economics.", ["openai", "microsoft", "google", "anthropic"], ["Pricing", "Risk event"], 82, 62, ["integration_ops", "vendor_resilience"], "Cost variance can derail scale even when pilots look successful; demand telemetry and usage guardrails.", [{ pillar: "integration_ops", direction: "down", magnitude: 2, rationale: "FinOps risk rises without controls." }], ["aws", "databricks", "snowflake"], "mixed"),
  news("news_regulation", "Regulatory pressure increases demand for evidence packs", "Mock policy signal suggests stricter expectations for audit trails, evaluation, and model-risk documentation.", ["ibm", "microsoft", "openai", "anthropic"], ["Regulation", "Enterprise control"], 84, 68, ["enterprise_control", "reliability_safety"], "Vendors with documented and verified controls should benefit; inferred claims should be discounted.", [{ pillar: "enterprise_control", direction: "watch", magnitude: 3, rationale: "Evidence quality matters more." }], ["cohere", "aws", "google"], "neutral"),
  news("news_aws_bedrock_evals", "AWS expands Bedrock evaluation workflow coverage", "Seed signal models a broader evaluation workflow for Bedrock deployments, including bias checks, PII checks, and model comparison reports.", ["aws"], ["Product launch", "Enterprise control"], 74, 68, ["reliability_safety", "enterprise_control"], "Evaluation depth can reduce regulated-buyer friction when it is paired with documented test methodology.", [{ pillar: "reliability_safety", direction: "up", magnitude: 2, rationale: "Evaluation workflow signal improves deployment confidence." }], ["microsoft", "google", "anthropic"], "positive"),
  news("news_oracle_sovereign_ai", "Oracle strengthens sovereign AI positioning", "Seed signal models stronger sovereign-region packaging for AI workloads attached to Oracle Cloud and enterprise application estates.", ["oracle"], ["Infrastructure", "Strategy signal"], 66, 61, ["vendor_resilience", "integration_ops"], "Sovereign deployment claims matter most in public-sector and regulated workloads, but buyer validation should inspect region availability and controls.", [{ pillar: "vendor_resilience", direction: "watch", magnitude: 2, rationale: "Sovereign positioning needs deployment evidence." }], ["microsoft", "aws", "sap"], "neutral"),
  news("news_sap_joule_agents", "SAP expands Joule business-process agents", "Seed signal models additional multi-step agent patterns across finance, procurement, supply chain, and HR workflows.", ["sap"], ["Agentic AI", "Product launch"], 69, 64, ["business_fit", "integration_ops"], "SAP's advantage is process context rather than open-ended autonomy; controls and workflow auditability remain the buyer checkpoint.", [{ pillar: "business_fit", direction: "up", magnitude: 2, rationale: "Process-specific agent fit improves." }], ["servicenow", "oracle", "microsoft"], "positive"),
  news("news_ibm_ai_governance_templates", "IBM expands AI governance template library", "Seed signal models more prebuilt governance templates for model inventory, risk review, audit evidence, and policy mapping.", ["ibm"], ["Enterprise control", "Regulation"], 71, 72, ["enterprise_control", "vendor_resilience"], "Control-led buyers may weight governance evidence above speed or market hype in high-risk contexts.", [{ pillar: "enterprise_control", direction: "up", magnitude: 2, rationale: "Governance signal improves high-control fit." }], ["microsoft", "sap", "aws"], "positive"),
  news("news_salesforce_pricing_scrutiny", "Salesforce agent pricing faces procurement scrutiny", "Seed signal models buyer concern that per-action or per-conversation pricing could create budget variance in high-volume service workflows.", ["salesforce"], ["Pricing", "Risk event"], 73, 63, ["integration_ops", "business_fit"], "Agent economics can change shortlist outcomes when cost telemetry is weak or deflection assumptions are unproven.", [{ pillar: "integration_ops", direction: "down", magnitude: 2, rationale: "FinOps risk increases without usage guardrails." }], ["servicenow", "microsoft"], "mixed"),
  news("news_servicenow_employee_service", "ServiceNow deepens employee-service AI workflow coverage", "Seed signal models new Now Assist patterns for IT, HR, facilities, and internal knowledge workflows.", ["servicenow"], ["Product launch", "Agentic AI"], 72, 66, ["business_fit", "integration_ops"], "Service workflow ownership creates practical adoption paths, particularly where approvals and escalation paths already exist.", [{ pillar: "integration_ops", direction: "up", magnitude: 2, rationale: "Workflow embedding improves operational fit." }], ["microsoft", "salesforce"], "positive"),
  news("news_google_workspace_controls", "Google adds more Workspace-oriented AI controls", "Seed signal models stronger admin settings, permission inheritance, and audit workflow around AI features in Workspace and Cloud.", ["google"], ["Enterprise control", "Product launch"], 75, 65, ["enterprise_control", "integration_ops"], "Control improvements can shift Google from model-led challenger to stronger enterprise assistant contender in Workspace-heavy estates.", [{ pillar: "enterprise_control", direction: "up", magnitude: 2, rationale: "Admin-control signal improves." }], ["microsoft", "glean"], "positive"),
  news("news_anthropic_cloud_distribution", "Anthropic benefits from expanded cloud distribution", "Seed signal models broader availability of Anthropic models across cloud marketplaces and enterprise procurement channels.", ["anthropic"], ["Partnership", "Market movement"], 77, 62, ["market_strength", "vendor_resilience"], "Distribution improves adoption reach, but partner dependency should still be separated from first-party enterprise controls.", [{ pillar: "market_strength", direction: "up", magnitude: 2, rationale: "Distribution signal strengthens market access." }], ["aws", "google", "databricks"], "positive"),
  news("news_microsoft_copilot_cost_controls", "Microsoft Copilot cost-control signals improve", "Seed signal models stronger admin reporting, workload analytics, and license optimisation views for Copilot estates.", ["microsoft"], ["Enterprise control", "Pricing"], 79, 70, ["integration_ops", "enterprise_control"], "Cost controls become a board-level buying criterion as pilots move into broad deployment.", [{ pillar: "integration_ops", direction: "up", magnitude: 2, rationale: "FinOps telemetry improves scale readiness." }], ["openai", "google", "salesforce"], "positive"),
  news("news_openai_control_risk_watch", "OpenAI enterprise-control diligence remains active", "Seed signal models continued buyer diligence around retention, audit logs, connector permissions, and agent tool boundaries.", ["openai"], ["Enterprise control", "Risk event"], 80, 60, ["enterprise_control", "reliability_safety"], "Model strength does not remove the need for operating controls in regulated or data-sensitive contexts.", [{ pillar: "enterprise_control", direction: "watch", magnitude: 3, rationale: "Controls need verified deployment evidence." }], ["microsoft", "anthropic", "google"], "mixed"),
  news("news_cross_vendor_regulation", "Regulatory teams increase AI evidence-pack requirements", "Seed signal models a cross-vendor shift toward formal evidence packs, audit trails, model-risk logs, and third-party assurance.", ["openai", "microsoft", "google", "anthropic", "aws", "ibm", "sap"], ["Regulation", "Enterprise control"], 85, 69, ["enterprise_control", "reliability_safety"], "Estimated market momentum should be discounted when evidence quality is weak in high-risk environments.", [{ pillar: "enterprise_control", direction: "watch", magnitude: 3, rationale: "Evidence depth becomes more important." }], ["salesforce", "servicenow", "oracle"], "neutral"),
];

function news(
  id: string,
  title: string,
  summary: string,
  vendors: string[],
  categories: NewsItem["categories"],
  impactScore: number,
  confidenceScore: number,
  affectedPillars: PillarId[],
  whyItMatters: string,
  suggestedScoreImpact: NewsItem["suggestedScoreImpact"],
  relatedVendors: string[],
  sentiment: NewsItem["sentiment"],
): NewsItem {
  return {
    id,
    title,
    summary,
    sourceName: "AI Enterpise seed data (mock news item)",
    sourceKind: "seed",
    sourceNote: "Illustrative seed data created for local development. This is not a real citation or published source.",
    sourceUrl: undefined,
    publishedAt: "2026-05-06T00:00:00.000Z",
    vendors,
    categories,
    impactScore,
    confidenceScore,
    affectedPillars,
    whyItMatters,
    suggestedScoreImpact,
    relatedVendors,
    sentiment,
  };
}

export const CAPABILITIES: Capability[] = [
  { id: "models", name: "Models", category: "Models", description: "Frontier, domain, open, or hosted model availability." },
  { id: "enterprise_assistant", name: "Enterprise assistant", category: "Assistant", description: "Business-user assistant surface for knowledge work." },
  { id: "rag", name: "RAG / enterprise knowledge", category: "Knowledge", description: "Retrieval, grounding, and enterprise knowledge integration." },
  { id: "agents", name: "Agents", category: "Agents", description: "Agent orchestration, tool use, approvals, and runtime controls." },
  { id: "governance", name: "Governance", category: "Control", description: "Policy, evaluation, audit, and model-risk controls." },
  { id: "security", name: "Security", category: "Control", description: "Identity, permissions, isolation, and threat resilience." },
  { id: "integrations", name: "Integrations", category: "Operations", description: "Connectors, APIs, ecosystem depth, and workflow embedding." },
  { id: "cost_controls", name: "Cost controls", category: "Operations", description: "Usage visibility, caps, budget controls, and FinOps telemetry." },
  { id: "deployment_options", name: "Deployment options", category: "Architecture", description: "SaaS, VPC, hybrid, sovereign, or on-prem options." },
  { id: "portability", name: "Portability", category: "Architecture", description: "Model, data, prompt, and workflow exitability." },
];

const capabilityWeights: Record<string, Partial<Record<string, number>>> = {
  openai: { models: 96, agents: 88, enterprise_assistant: 82, governance: 76, cost_controls: 65 },
  microsoft: { enterprise_assistant: 94, integrations: 92, security: 88, governance: 86, cost_controls: 68 },
  google: { models: 88, rag: 82, deployment_options: 82, integrations: 78 },
  anthropic: { models: 90, security: 78, governance: 80, agents: 76 },
  aws: { deployment_options: 92, security: 88, governance: 82, agents: 82, integrations: 86 },
  salesforce: { integrations: 88, agents: 82, enterprise_assistant: 76, governance: 74 },
  servicenow: { integrations: 87, agents: 80, governance: 78, enterprise_assistant: 74 },
  ibm: { governance: 90, deployment_options: 86, security: 84, portability: 78 },
  glean: { rag: 90, enterprise_assistant: 82, security: 76 },
  harvey: { rag: 82, enterprise_assistant: 76, governance: 73 },
  databricks: { deployment_options: 82, governance: 84, models: 76, portability: 82 },
  snowflake: { rag: 76, governance: 82, integrations: 78, deployment_options: 76 },
};

export const VENDOR_CAPABILITIES: VendorCapability[] = INTELLIGENCE_VENDORS.flatMap((vendor, vendorIndex) =>
  CAPABILITIES.map((capability, capabilityIndex) => {
    const maturity = Math.round(capabilityWeights[vendor.id]?.[capability.id] ?? clamp(vendor.overallScore - 18 + ((vendorIndex + capabilityIndex) % 5) * 5));
    const grade: EvidenceGrade = maturity >= 86 ? "E4" : maturity >= 75 ? "E3" : maturity >= 63 ? "E2" : "E1";
    return {
      vendorId: vendor.id,
      capabilityId: capability.id,
      status: grade === "E4" ? "verified" : grade === "E3" ? "tested" : grade === "E2" ? "documented" : "inferred",
      maturityScore: maturity,
      evidenceGrade: grade,
      lastVerified: lastUpdated,
      notes: `${vendor.name} ${capability.name.toLowerCase()} signal is ${grade === "E1" ? "mostly inferred" : grade === "E2" ? "documented" : grade === "E3" ? "tested in public/proxy evidence" : "supported by stronger external evidence"}.`,
    };
  }),
);

export const VENDOR_PILLAR_SCORES: VendorPillarScore[] = INTELLIGENCE_VENDORS.flatMap((vendor, vendorIndex) => {
  const pillars: PillarId[] = ["business_fit", "enterprise_control", "reliability_safety", "integration_ops", "vendor_resilience", "market_strength"];
  return pillars.map((pillar, pillarIndex) => {
    const score = clamp(vendor.overallScore - 10 + ((vendorIndex + pillarIndex) % 5) * 4 + (pillar === "market_strength" ? 6 : 0));
    const grade: EvidenceGrade = score >= 86 ? "E4" : score >= 76 ? "E3" : score >= 64 ? "E2" : "E1";
    return {
      vendorId: vendor.id,
      pillar,
      capabilityScore: score,
      evidenceGrade: grade,
      confidence: clamp(vendor.confidenceScore - 8 + pillarIndex * 2),
      strengths: [`${pillar.replace(/_/g, " ")} signal is directionally strong for ${vendor.category}.`],
      risks: vendor.riskProfile.slice(0, 1),
      missingEvidence: grade === "E1" || grade === "E2" ? ["Needs third-party validation before high-risk rollout."] : [],
    };
  });
});

export const EVIDENCE_SOURCES: EvidenceSource[] = [
  ...INTELLIGENCE_VENDORS.map((vendor) => ({
    id: `evsrc_${vendor.id}`,
    entityType: "vendor" as const,
    entityId: vendor.id,
    sourceType: "analyst_estimate" as const,
    sourceName: "AI Enterpise seed data (mock evidence source)",
    sourceUrl: undefined,
    capturedAt: lastUpdated,
    evidenceGrade: vendor.confidenceScore >= 78 ? "E3" as const : "E2" as const,
    confidence: vendor.confidenceScore,
    notes: "MVP seed record. Replace with public-source ingestion and analyst review.",
  })),
];

export const WATCHLISTS: Watchlist[] = [
  {
    id: "watchlist_frontier_risk",
    name: "Frontier model control watch",
    vendors: ["openai", "anthropic", "google", "mistral", "cohere"],
    categories: ["Enterprise control", "Risk event", "Regulation"],
    industries: ["Financial services", "Public sector"],
    alertRules: { riskThreshold: 70, momentumChangePct: 10, categories: ["Enterprise control", "Risk event", "Regulation"] },
    createdAt: lastUpdated,
  },
  {
    id: "watchlist_agentic_workflow",
    name: "Agentic workflow movers",
    vendors: ["microsoft", "salesforce", "servicenow", "aws", "openai"],
    categories: ["Agentic AI", "Product launch", "Partnership"],
    industries: ["Commercial enterprise", "Technology"],
    alertRules: { momentumChangePct: 12, categories: ["Agentic AI", "Product launch"] },
    createdAt: lastUpdated,
  },
];

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
