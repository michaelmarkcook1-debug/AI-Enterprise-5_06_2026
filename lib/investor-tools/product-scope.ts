import type { ProductCategory, ProductScope } from "../investing/types";

const PROMPT_PACK_SOURCE_ID = "source_prompt_pack_zero_hallucination_2026_05_07";
const DEFAULT_MODULES = ["Market Intelligence", "Vendor Profiles", "Capability Tracker", "Investor Tools"];
const DEFAULT_UNCERTAINTY = "Seed inventory from product scope prompt pack. Requires source refresh before treating as documented or verified.";

type ProductSeed = {
  vendorId: string;
  vendorName: string;
  products: Array<[string, ProductCategory, string?]>;
  modules?: string[];
  simulator?: boolean;
  assessment?: boolean;
  /** Set false to exclude this vendor from every Investor Tools surface
   * (Investment Intelligence, Investment Simulator, IPO Watch, Public AI
   * Stocks, Indirect Exposure Map, Investor Briefings, Investor
   * Watchlist). Defaults to true. */
  investorTools?: boolean;
  uncertainty?: string;
};

const PRODUCT_SEEDS: ProductSeed[] = [
  scope("openai", "OpenAI", [
    ["ChatGPT Enterprise", "enterprise_assistant"],
    ["ChatGPT Business", "enterprise_assistant"],
    ["ChatGPT Edu", "enterprise_assistant"],
    ["ChatGPT agent", "agent_platform"],
    ["Deep Research", "enterprise_search"],
    ["Data Analysis", "enterprise_assistant"],
    ["Canvas", "enterprise_assistant"],
    ["Projects", "enterprise_assistant"],
    ["Connectors", "workflow_ai"],
    ["File uploads", "rag_knowledge"],
    ["Image generation", "model_api"],
    ["Codex", "coding_agent"],
    ["OpenAI API", "model_api"],
    ["Responses API", "model_api"],
    ["Sora / video generation", "model_api", "Plan, geography, and availability may vary."],
    ["Enterprise admin (SSO, SCIM, RBAC, data controls)", "governance_control"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "News Intelligence", "Investment Simulator"], simulator: true, assessment: true }),
  scope("msft", "Microsoft", [
    ["Microsoft 365 Copilot", "enterprise_assistant"],
    ["Microsoft Agent 365", "agent_platform", "Product naming and packaging must be source-refreshed."],
    ["Microsoft Entra", "security_ai"],
    ["Microsoft Defender", "security_ai"],
    ["Microsoft Purview", "agent_governance"],
    ["Azure AI / Azure AI Foundry", "cloud_ai_platform"],
    ["Azure AI Foundry Models", "model_api"],
    ["Azure AI Foundry Agent Service", "agent_runtime"],
    ["Azure AI Search", "enterprise_search"],
    ["Copilot Studio", "agent_platform"],
    ["GitHub Copilot", "coding_agent"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("googl", "Google / Alphabet", [
    ["Gemini Enterprise", "enterprise_assistant"],
    ["Gemini models", "model_api"],
    ["Google Agentspace", "enterprise_assistant"],
    ["Vertex AI", "cloud_ai_platform"],
    ["Vertex AI Studio", "cloud_ai_platform"],
    ["Vertex AI Agent Builder", "agent_platform"],
    ["Agent Development Kit", "developer_ai"],
    ["Agent2Agent protocol", "agent_runtime"],
    ["Gemini Code Assist", "coding_agent"],
    ["Model Garden", "cloud_ai_platform"],
    ["Model Armor", "security_ai"],
    ["BigQuery AI", "data_ai_platform"],
    ["Workspace Gemini", "enterprise_assistant"],
    ["TPU / Google Cloud AI infrastructure exposure", "ai_compute"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("amzn", "AWS / Amazon", [
    ["Amazon Bedrock", "cloud_ai_platform"],
    ["Amazon SageMaker AI", "data_ai_platform"],
    ["Amazon Q Business", "enterprise_assistant"],
    ["Amazon Q Developer", "coding_agent"],
    ["Amazon Nova", "model_api"],
    ["Trainium", "ai_compute"],
    ["Inferentia", "ai_compute"],
    ["AWS AI infrastructure", "ai_infrastructure"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("anthropic", "Anthropic", [
    ["Claude", "model_api"],
    ["Claude Enterprise", "enterprise_assistant"],
    ["Claude for Work", "enterprise_assistant"],
    ["Claude Team", "enterprise_assistant"],
    ["Claude API", "model_api"],
    ["Messages API", "model_api"],
    ["Claude Code", "coding_agent"],
    ["Claude model family", "model_api"],
    ["Tool use", "model_api"],
    ["Computer use", "model_api"],
    ["Citations", "rag_knowledge"],
    ["Batch processing", "model_api"],
    ["Extended context (1M)", "model_api"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "News Intelligence", "Investment Simulator"], simulator: true, assessment: true }),
  scope("crm", "Salesforce", [
    ["Agentforce", "agent_platform"],
    ["Agentforce 360", "crm_ai"],
    ["Agentforce Builder", "agent_platform"],
    ["Einstein", "crm_ai"],
    ["Data Cloud / Data 360", "data_ai_platform"],
    ["Slack AI", "workflow_ai"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("now", "ServiceNow", [
    ["ServiceNow AI Platform", "workflow_ai"],
    ["Now Assist", "enterprise_assistant"],
    ["AI Control Tower", "agent_governance"],
    ["Action Fabric", "agent_platform"],
    ["AI Agent Advisor", "agent_platform"],
    ["Autonomous Workforce", "workflow_ai"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("orcl", "Oracle", [
    ["Oracle Fusion Agentic Applications", "workflow_ai"],
    ["Fusion Agentic Applications for CX", "crm_ai"],
    ["Fusion Agentic Applications for HR", "hr_ai"],
    ["Oracle AI Agent Studio", "agent_platform"],
    ["OCI Generative AI", "cloud_ai_platform"],
    ["Oracle Cloud Infrastructure AI exposure", "ai_infrastructure"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("sap", "SAP", [
    ["SAP Business AI", "workflow_ai"],
    ["Joule", "enterprise_assistant"],
    ["Joule Agents", "agent_platform"],
    ["Joule Studio", "agent_platform"],
    ["Joule Skills", "workflow_ai"],
    ["SAP BTP AI-related capabilities", "cloud_ai_platform"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("ibm", "IBM", [
    ["IBM watsonx", "data_ai_platform"],
    ["IBM watsonx Orchestrate", "agent_platform"],
    ["IBM Bob", "enterprise_assistant"],
    ["IBM Concert", "agent_governance"],
    ["IBM Sovereign Core", "sovereign_ai"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("snow", "Snowflake", [
    ["Snowflake Cortex AI", "data_ai_platform"],
    ["Snowflake Intelligence", "enterprise_assistant"],
    ["Cortex Agents", "agent_platform"],
    ["Cortex Analyst", "rag_knowledge"],
    ["Cortex Search", "enterprise_search"],
    ["Cortex Code", "coding_agent"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("databricks", "Databricks", [
    ["Databricks Data Intelligence Platform", "data_ai_platform"],
    ["Mosaic AI", "model_api"],
    ["Agent Bricks", "agent_platform"],
    ["Genie", "enterprise_assistant"],
    ["Lakebase", "data_ai_platform"],
    ["Unity Catalog governance", "agent_governance"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("cerebras", "Cerebras", [
    ["Cerebras AI accelerator systems", "ai_compute"],
    ["Wafer-scale AI compute exposure", "ai_compute"],
    ["AI infrastructure IPO watch exposure", "investment_exposure"],
  ], { modules: ["Infrastructure Intelligence", "Investor Tools", "Investment Simulator"], simulator: true, assessment: false, uncertainty: "Seed investor-tools scope only. Product details, customers, and IPO status require source validation." }),
  scope("cohere", "Cohere", [
    ["North", "enterprise_assistant"],
    ["Compass", "enterprise_search"],
    ["Command", "model_api"],
    ["Embed", "model_api"],
    ["Rerank", "rag_knowledge"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("mistral", "Mistral AI", [
    ["Le Chat", "enterprise_assistant"],
    ["Le Chat Enterprise", "enterprise_assistant"],
    ["Studio", "agent_platform"],
    ["Mistral API / La Plateforme", "model_api"],
    ["Mistral models", "model_api"],
    ["Custom agents", "agent_platform"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("glean", "Glean", [
    ["Glean Assistant", "enterprise_assistant"],
    // Glean's marketing rebrand of the Assistant. Both names appear on
    // glean.com — kept as a separate scope entry so the linkage
    // suggester catches either form in the excerpt.
    ["Glean Work AI", "enterprise_assistant"],
    ["Glean Agents", "agent_platform"],
    ["Glean Search", "enterprise_search"],
    ["Glean Protect", "security_ai"],
    // Named components on glean.com/security. Sensitive content
    // protection, oversharing triage, and granular access controls all
    // ship under these two names on the Glean security page.
    ["Glean Permissions", "governance_control"],
    ["Glean Sensitive Content Protection", "security_ai"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("moveworks", "Moveworks", [
    ["Moveworks AI Assistant Platform", "enterprise_assistant"],
    ["Reasoning Engine", "agent_platform"],
    ["AI Agent Marketplace", "agent_platform"],
    ["Business initiative agent bundles", "workflow_ai"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment"], assessment: true }),
  scope("writer", "Writer", [
    ["Writer AI Studio", "agent_platform"],
    ["AskWriter", "enterprise_assistant"],
    ["Writer Agents", "agent_platform"],
    ["Writer AI Apps", "workflow_ai"],
    ["Palmyra X", "model_api"],
    ["Palmyra Med", "model_api"],
    ["Palmyra Fin", "model_api"],
    ["Palmyra-powered agents", "model_api"],
    ["Writer Knowledge Graph", "rag_knowledge"],
    ["Writer Platform", "agent_platform"],
    ["Governance and agent lifecycle features", "agent_governance"],
  ], { modules: [...DEFAULT_MODULES, "Investment Simulator"], simulator: true, assessment: true }),
  scope("harvey", "Harvey", [
    ["Harvey Assistant", "legal_ai"],
    ["Harvey Vault", "legal_ai"],
    ["Harvey Workflow Agents", "agent_platform"],
    ["Agent Builder", "agent_platform"],
    ["Microsoft 365 Copilot integration", "workflow_ai"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  scope("hebbia", "Hebbia", [
    ["Hebbia Matrix", "finance_ai"],
    ["Multi-step workflow AI", "agent_platform"],
    ["Citations / transparent agent actions", "agent_governance"],
    ["Enterprise integrations", "workflow_ai"],
  ], { modules: [...DEFAULT_MODULES, "Investment Simulator"], simulator: true, assessment: true }),
  scope("rogo", "Rogo", [
    ["Rogo financial AI platform", "finance_ai"],
    ["Autonomous financial agents", "agent_platform"],
    ["Financial data/platform integrations", "finance_ai"],
    ["Institutional investment memo outputs", "finance_ai"],
  ], { modules: [...DEFAULT_MODULES, "AI Platform Fit Assessment", "Investment Simulator"], simulator: true, assessment: true }),
  // Perplexity is a PLATFORM vendor only — included in ProductScope,
  // Capabilities, Commercial Models, Vendor Intelligence, and News
  // Intelligence; EXCLUDED from every Investor Tools surface
  // (Investment Intelligence, Investment Simulator, IPO Watch, Public
  // AI Stocks, Indirect Exposure Map, Investor Briefings, Investor
  // Watchlist). Source: prompt 09 of the Stage-2 Rev2 batch.
  scope("perplexity", "Perplexity", [
    ["Perplexity Enterprise Pro", "enterprise_search"],
    ["Perplexity Enterprise Max", "enterprise_search"],
    ["Search API", "model_api"],
    ["Sonar API", "model_api"],
    ["Agent API", "agent_runtime", "Hosts third-party models alongside Perplexity's own; tag first-party vs hosted_third_party per CommercialModel rules."],
    ["Sonar", "model_api"],
    ["Sonar Pro", "model_api"],
    ["Sonar Reasoning Pro", "model_api"],
    ["Sonar Deep Research", "enterprise_search"],
    ["Real-time web answer/research API", "enterprise_search"],
  ], {
    modules: [...DEFAULT_MODULES, "News Intelligence"],
    simulator: false,
    assessment: true,
    investorTools: false,
  }),
  scope("xai", "xAI", [
    ["Grok", "model_api"],
    ["Grok API", "model_api"],
    ["Grok on X", "enterprise_assistant"],
  ], { modules: [...DEFAULT_MODULES, "News/Risk Intelligence", "Investment Simulator"], simulator: true }),
  scope("nvda", "NVIDIA", [
    ["NVIDIA GPUs / Blackwell", "ai_compute"],
    ["NVIDIA DGX", "ai_infrastructure"],
    ["NVIDIA NIM", "model_api"],
    ["NVIDIA NeMo", "agent_platform"],
    ["NVIDIA AI Enterprise", "ai_infrastructure"],
    ["NVIDIA networking / AI infrastructure exposure", "ai_networking"],
  ], { modules: ["Infrastructure Intelligence", "Investor Tools", "Investment Simulator"], simulator: true, assessment: false, uncertainty: "NVIDIA is an infrastructure enabler, not a general enterprise AI software-platform peer." }),
  scope("amd", "AMD", [
    ["AMD Instinct accelerators", "ai_compute"],
    ["ROCm", "developer_ai"],
    ["EPYC AI infrastructure exposure", "ai_compute"],
    ["Ryzen AI", "ai_compute"],
  ], { modules: ["Infrastructure Intelligence", "Investor Tools", "Investment Simulator"], simulator: true, assessment: false }),
  scope("avgo", "Broadcom", [
    ["Tomahawk AI networking", "ai_networking"],
    ["Jericho AI networking", "ai_networking"],
    ["Co-packaged optics / AI networking", "ai_networking"],
    ["Custom silicon exposure", "ai_compute"],
  ], { modules: ["Infrastructure Intelligence", "Investor Tools", "Investment Simulator"], simulator: true, assessment: false }),
  scope("asml", "ASML", [
    ["EUV lithography systems", "semiconductor_equipment"],
    ["High-NA EUV / EXE systems", "semiconductor_equipment"],
    ["DUV lithography", "semiconductor_equipment"],
    ["Semiconductor manufacturing exposure for AI chips", "investment_exposure"],
  ], { modules: ["Infrastructure Intelligence", "Investor Tools", "Investment Simulator"], simulator: true, assessment: false, uncertainty: "ASML is semiconductor equipment exposure, not an AI software provider." }),
  scope("arm", "Arm", [
    ["Arm compute/IP exposure for AI workloads", "ai_compute"],
    ["Edge/mobile/server architecture exposure", "ai_compute"],
    ["Investment exposure", "investment_exposure"],
  ], { modules: ["Infrastructure Intelligence", "Investor Tools", "Investment Simulator"], simulator: true, assessment: false }),
];

export const PRODUCT_SCOPES: ProductScope[] = PRODUCT_SEEDS.flatMap((seed) =>
  seed.products.map(([productName, category, productUncertainty]) => {
    const id = `${seed.vendorId}_${slugify(productName)}`;
    const modules = seed.modules ?? DEFAULT_MODULES;
    const uncertaintyNote = productUncertainty ?? seed.uncertainty ?? DEFAULT_UNCERTAINTY;
    return {
      id,
      vendorId: seed.vendorId,
      vendorName: seed.vendorName,
      productName,
      productCategory: category,
      productDescription: `${productName} scope entry for ${seed.vendorName}. Seed inventory only until source refresh is connected.`,
      measurementScope: `Measure ${category.replace(/_/g, " ")} relevance only where the product is explicitly included in this registry.`,
      includedInModules: modules,
      productType: category.replace(/_/g, " "),
      moduleCoverage: modules,
      measuredInModules: modules,
      sourceStatus: "requires_validation",
      sourceName: "AI Enterpise product scope seed registry",
      sourceUrl: undefined,
      evidenceGrade: "E1",
      evidenceStatus: "seed",
      confidenceScore: 30,
      sourceIds: [PROMPT_PACK_SOURCE_ID],
      truthRecordIds: [`truth_${id}`],
      uncertaintyNote,
      lastVerified: "1970-01-01T00:00:00.000Z",
      includeInAssessment: seed.assessment ?? true,
      includeInMarketIntelligence: true,
      includeInInvestorTools: seed.investorTools ?? true,
      includeInSimulator: seed.simulator ?? false,
    };
  }),
);

export function listProductScopes() {
  return PRODUCT_SCOPES;
}

export function productScopesForVendor(vendorId: string) {
  const normalised = normaliseVendorId(vendorId);
  return PRODUCT_SCOPES.filter((scope) => scope.vendorId === normalised);
}

export function productScopeIdsForVendor(vendorId: string) {
  return productScopesForVendor(vendorId).map((scope) => scope.id);
}

function scope(vendorId: string, vendorName: string, products: ProductSeed["products"], options: Partial<Omit<ProductSeed, "vendorId" | "vendorName" | "products">> = {}): ProductSeed {
  return { vendorId, vendorName, products, ...options };
}

function normaliseVendorId(vendorId: string) {
  const aliases: Record<string, string> = {
    microsoft: "msft",
    google: "googl",
    alphabet: "googl",
    aws: "amzn",
    amazon: "amzn",
    salesforce: "crm",
    servicenow: "now",
    oracle: "orcl",
    broadcom: "avgo",
  };
  return aliases[vendorId] ?? vendorId;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
