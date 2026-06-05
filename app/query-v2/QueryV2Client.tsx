"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Metric, Panel, SeedDataBadge } from "@/components/intelligence-ui";
import { OwnershipBadge, VendorNameWithOwnership } from "@/components/ownership-indicator";

type Role =
  | "Platform Vendor"
  | "Model Provider"
  | "Application Vendor"
  | "Infrastructure Player"
  | "Investor"
  | "Hardware Provider"
  | "Data & Services Provider"
  | "Cloud / Hosting Provider"
  | "Sovereign / Regional AI"
  | "Regulator / Policy Actor"
  | "Open-Source Ecosystem"
  | "Vertical Specialist";

type CategoryKey =
  | "all"
  | "platforms"
  | "models"
  | "applications"
  | "infrastructure"
  | "investors"
  | "hardware"
  | "sovereign"
  | "vertical";

type Ownership = "public" | "private" | "subsidiary";

type Entity = {
  id: string;
  name: string;
  slug: string;
  ownership: Ownership;
  primaryRole: Role;
  secondaryRoles: Role[];
  leadershipScore: number;
  momentum: number;
  ecosystemReach: number;
  risk: "low" | "medium" | "high";
  confidence: number;
  usageShare: number;
  innovation: number;
  readiness: number;
  movement: { dx: number; dy: number };
  deltas: {
    leadership: number;
    reach: number;
    adoption: number;
    infrastructure: number;
    risk: number;
  };
  modelsOwned: string[];
  hostedThirdParty: string[];
  infrastructureExposure: string[];
  investorRelationships: string[];
  hardwareDependencies: string[];
  cioInterpretation: string;
  evidenceGrade: "E1" | "E2" | "E3" | "E4" | "E5";
  dataCaveats: string;
};

const CATEGORY_OPTIONS: Array<{ key: CategoryKey; label: string; roles: Role[]; summary: string; interpretation: string }> = [
  {
    key: "all",
    label: "All",
    roles: [],
    summary: "Full enterprise AI entity universe across platform, model, application, infrastructure, hardware and capital layers.",
    interpretation: "Use this view when the board needs a market map rather than a procurement shortlist. The top names control different layers, so direct score comparisons need role context.",
  },
  {
    key: "platforms",
    label: "Platforms",
    roles: ["Platform Vendor"],
    summary: "Control planes, enterprise distribution, cloud AI services and workflow surfaces.",
    interpretation: "Platform leadership is about distribution, identity, data access, governance and procurement leverage. It is not the same thing as model ownership.",
  },
  {
    key: "models",
    label: "Models",
    roles: ["Model Provider"],
    summary: "Frontier, open-weight, sovereign and domain model suppliers.",
    interpretation: "Model-provider strength should be read through quality, cost, deployment access, safety posture and ecosystem reach.",
  },
  {
    key: "applications",
    label: "Applications",
    roles: ["Application Vendor"],
    summary: "Packaged assistants, workflow agents and vertical AI applications.",
    interpretation: "Application vendors can convert AI into outcomes quickly, but buyers should test workflow depth, auditability and lock-in against the system of record.",
  },
  {
    key: "infrastructure",
    label: "Infrastructure",
    roles: ["Infrastructure Player", "Cloud / Hosting Provider", "Data & Services Provider"],
    summary: "Cloud, data, compute, deployment and operating infrastructure behind enterprise AI.",
    interpretation: "Infrastructure exposure is a resilience and dependency question: who hosts, who scales, who owns the data plane and who benefits from compute intensity.",
  },
  {
    key: "investors",
    label: "Investors",
    roles: ["Investor"],
    summary: "Strategic capital, ecosystem stakes and distribution-linked investment relationships.",
    interpretation: "Investor-linked entities shape access, cloud commitments and model distribution. Separate capital influence from product fitness.",
  },
  {
    key: "hardware",
    label: "Hardware",
    roles: ["Hardware Provider"],
    summary: "GPU, accelerator, networking, fabrication and semiconductor ecosystem players.",
    interpretation: "Hardware leadership is an upstream dependency signal. It matters for supply assurance, training economics and pricing power, not only direct buyer selection.",
  },
  {
    key: "sovereign",
    label: "Sovereign AI",
    roles: ["Sovereign / Regional AI"],
    summary: "Regional model and deployment alternatives that change jurisdiction, data residency and industrial-policy choices.",
    interpretation: "Sovereign AI is a risk-control and bargaining-leverage lens. It should be filtered by jurisdiction, data transfer policy and procurement eligibility.",
  },
  {
    key: "vertical",
    label: "Vertical Specialists",
    roles: ["Vertical Specialist"],
    summary: "Domain-specific AI providers for legal, finance, regulated workflows and enterprise knowledge work.",
    interpretation: "Vertical specialists can beat horizontal platforms inside narrow workflows. The key diligence question is whether the domain depth offsets maturity and scale risk.",
  },
];

const ROLE_TONE: Record<Role, { bg: string; text: string; fill: string }> = {
  "Platform Vendor": { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-800 dark:text-emerald-300", fill: "#10b981" },
  "Model Provider": { bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-800 dark:text-sky-300", fill: "#38bdf8" },
  "Application Vendor": { bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-800 dark:text-violet-300", fill: "#8b5cf6" },
  "Infrastructure Player": { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-900 dark:text-amber-300", fill: "#f59e0b" },
  Investor: { bg: "bg-lime-50 dark:bg-lime-950/40", text: "text-lime-900 dark:text-lime-300", fill: "#84cc16" },
  "Hardware Provider": { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-900 dark:text-orange-300", fill: "#f97316" },
  "Data & Services Provider": { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-900 dark:text-cyan-300", fill: "#06b6d4" },
  "Cloud / Hosting Provider": { bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-900 dark:text-teal-300", fill: "#14b8a6" },
  "Sovereign / Regional AI": { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-900 dark:text-rose-300", fill: "#f43f5e" },
  "Regulator / Policy Actor": { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-700 dark:text-zinc-300", fill: "#71717a" },
  "Open-Source Ecosystem": { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-900 dark:text-indigo-300", fill: "#6366f1" },
  "Vertical Specialist": { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", text: "text-fuchsia-900 dark:text-fuchsia-300", fill: "#d946ef" },
};

const ENTITIES: Entity[] = [
  entity("microsoft", "Microsoft", "public", "Platform Vendor", ["Application Vendor", "Investor", "Infrastructure Player", "Model Provider", "Cloud / Hosting Provider"], 91, 72, 96, "medium", 86, 18.8, 76, 91, [2, 1], [3, 4, 3, 2, 1], ["Phi", "MAI"], ["OpenAI GPT", "Mistral", "Llama"], ["Azure AI", "Azure OpenAI", "GitHub", "Microsoft 365", "Entra"], ["OpenAI strategic investment", "Mistral partnership"], ["NVIDIA GPU supply", "AMD MI-series optionality"], "Microsoft ranks as a platform leader because it controls enterprise distribution, cloud deployment, identity/security surfaces, Copilot applications and Azure AI access. It should not be treated as only a model provider, despite owning Phi and MAI model assets.", "E4", "Strong public evidence, but Copilot usage, Azure-hosted model traffic and first-party model share must be separated."),
  entity("openai", "OpenAI", "private", "Model Provider", ["Application Vendor"], 89, 74, 89, "medium", 78, 17.6, 90, 78, [1, 1], [2, 2, 4, 0, 2], ["GPT", "o-series", "image/audio models"], [], ["Azure distribution", "API platform", "ChatGPT Enterprise"], ["Microsoft strategic investment"], ["NVIDIA GPU supply", "cloud partner capacity"], "OpenAI remains the model and product cadence shaper, but enterprise buyers should separate model quality from operating controls, data-retention evidence and dependency on Microsoft/Azure distribution.", "E3", "Usage share is directional and heavily influenced by public mindshare, API visibility and ChatGPT Enterprise references."),
  entity("anthropic", "Anthropic", "private", "Model Provider", ["Application Vendor"], 88, 76, 84, "medium", 76, 15.8, 88, 80, [2, 2], [3, 3, 5, 1, 1], ["Claude Opus", "Claude Sonnet", "Claude Haiku"], [], ["AWS Bedrock", "Google Vertex AI", "Snowflake", "Databricks"], ["Amazon investment", "Google investment"], ["NVIDIA GPU supply", "AWS Trainium exposure"], "Anthropic is a model provider with rising application pull through Claude Code and computer-use patterns. Its enterprise attractiveness is strongest where reasoning, coding and safety posture matter more than packaged suite breadth.", "E3", "Distribution is multi-cloud but partner-dependent; first-party enterprise application footprint is narrower than Microsoft or Google."),
  entity("google", "Google", "public", "Platform Vendor", ["Model Provider", "Cloud / Hosting Provider", "Hardware Provider", "Application Vendor"], 86, 69, 88, "medium", 82, 14.9, 84, 82, [1, 1], [1, 2, 2, 3, 0], ["Gemini", "Imagen", "Veo", "Gemma"], ["Anthropic Claude via Vertex"], ["Google Cloud", "Vertex AI", "Workspace", "TPU ecosystem"], ["Anthropic investment"], ["TPUs", "NVIDIA GPUs"], "Google is both platform and model provider: Gemini, Workspace, Vertex AI and TPU infrastructure should be read as one integrated stack, with enterprise traction strongest in cloud/data-heavy and Workspace-heavy estates.", "E4", "Public evidence is broad; commercial share varies by Workspace, Cloud and model API segment."),
  entity("aws", "AWS", "public", "Platform Vendor", ["Cloud / Hosting Provider", "Investor", "Infrastructure Player"], 84, 68, 92, "medium", 84, 10.6, 72, 86, [1, 0], [2, 3, 2, 4, 0], ["Nova", "Titan"], ["Claude", "Llama", "Mistral"], ["Bedrock", "SageMaker", "AWS AI infrastructure"], ["Anthropic investment"], ["Trainium", "Inferentia", "NVIDIA GPUs"], "AWS is a platform and infrastructure control plane with model optionality. It wins where buyers want cloud-native deployment depth rather than a single assistant or model brand.", "E4", "Bedrock adoption and hosted-model mix are hard to disaggregate from AWS account penetration."),
  entity("nvidia", "NVIDIA", "public", "Hardware Provider", ["Infrastructure Player", "Investor"], 83, 73, 94, "low", 84, 8.2, 78, 88, [3, 1], [2, 5, 4, 6, -1], ["Nemotron"], [], ["CUDA", "DGX Cloud", "GPU supply", "AI Enterprise software"], ["Strategic investments across AI ecosystem"], ["Own GPU and networking stack"], "NVIDIA is the upstream hardware and software ecosystem winner. For CIOs, it is a dependency and infrastructure-cost signal more than a direct application shortlist name.", "E4", "Infrastructure exposure is high, but downstream enterprise usage share should not be treated as vendor application share."),
  entity("meta", "Meta", "public", "Model Provider", ["Open-Source Ecosystem", "Application Vendor"], 81, 66, 83, "medium", 70, 5.8, 79, 65, [1, 0], [1, 3, 2, 0, 1], ["Llama"], [], ["Open-weight ecosystem", "hyperscaler hosting"], [], ["NVIDIA GPUs"], "Meta matters because Llama changes enterprise negotiation leverage and open-weight strategy. It is less mature as a packaged enterprise platform.", "E2", "Enterprise controls often come from hosting partners rather than Meta first-party surfaces."),
  entity("mistral", "Mistral AI", "private", "Model Provider", ["Sovereign / Regional AI", "Open-Source Ecosystem"], 77, 70, 68, "medium", 67, 4.9, 80, 66, [2, 1], [3, 2, 2, 0, 1], ["Large", "Medium", "Small", "Codestral", "Magistral"], [], ["Azure AI Foundry", "La Plateforme"], ["Microsoft partnership"], ["NVIDIA GPUs"], "Mistral is the clearest European sovereign-model alternative with open-weight leverage, but buyers still need to validate enterprise controls and account support depth.", "E2", "Momentum is visible; enterprise production evidence remains more selective than US hyperscaler-backed peers."),
  entity("cohere", "Cohere", "private", "Model Provider", ["Data & Services Provider", "Sovereign / Regional AI"], 73, 59, 61, "medium", 68, 3.4, 66, 67, [-1, 0], [0, 1, 0, 0, 1], ["Command", "Embed", "Rerank"], [], ["Private deployment", "RAG workloads"], ["Oracle partnership"], ["NVIDIA GPUs"], "Cohere is a credible enterprise-oriented model and retrieval provider, strongest where private deployment and RAG matter more than broad-market visibility.", "E2", "Lower public adoption visibility means confidence depends on named customer and deployment evidence."),
  entity("ibm", "IBM", "public", "Platform Vendor", ["Model Provider", "Data & Services Provider"], 74, 62, 69, "low", 78, 3.0, 61, 76, [0, 0], [1, 1, 0, 1, -1], ["Granite"], ["Mistral", "Llama"], ["watsonx", "Red Hat", "hybrid cloud"], [], ["NVIDIA GPUs", "IBM Z acceleration"], "IBM is a control, governance and hybrid-AI benchmark. It is less of a hype leader, but it matters in regulated deployments where auditability outranks speed.", "E4", "Momentum is more conservative; score should be weighted differently for high-control buyers."),
  entity("databricks", "Databricks", "private", "Data & Services Provider", ["Platform Vendor", "Infrastructure Player"], 78, 67, 76, "medium", 74, 3.7, 71, 74, [1, 1], [2, 2, 2, 2, 0], ["DBRX", "Mosaic lineage"], ["Claude", "Llama", "Mistral"], ["Lakehouse", "Mosaic AI", "model serving"], [], ["NVIDIA GPUs", "cloud GPUs"], "Databricks is a build-and-data platform: high relevance for enterprises treating governed data as the AI foundation, less so for packaged assistant-only needs.", "E3", "Category share depends heavily on data engineering maturity and existing lakehouse footprint."),
  entity("snowflake", "Snowflake", "public", "Data & Services Provider", ["Platform Vendor", "Infrastructure Player"], 76, 64, 73, "medium", 73, 3.2, 68, 73, [1, 0], [1, 1, 1, 2, 0], ["Arctic"], ["Claude", "Mistral", "Llama"], ["Cortex AI", "Snowpark", "Data Cloud"], [], ["Cloud GPU supply"], "Snowflake is a governed data-cloud AI player. CIOs should read it as a data/control layer rather than a standalone frontier model competitor.", "E3", "First-party model claims are secondary to data-cloud adoption and partner model access."),
  entity("servicenow", "ServiceNow", "public", "Application Vendor", ["Platform Vendor", "Vertical Specialist"], 79, 66, 78, "medium", 76, 3.1, 70, 78, [1, 1], [2, 2, 2, 1, 0], ["Now LLM"], ["OpenAI", "Azure OpenAI"], ["Now Platform", "ITSM/HR workflows"], [], ["Cloud GPU supply"], "ServiceNow is an application/workflow platform for enterprise service processes. Its agent story is strongest where workflows and approvals already live in ServiceNow.", "E3", "Adoption should be read by ITSM/HR/service workflow, not generic enterprise AI share."),
  entity("salesforce", "Salesforce", "public", "Application Vendor", ["Platform Vendor", "Data & Services Provider"], 78, 65, 77, "medium", 75, 2.8, 69, 77, [1, 0], [1, 1, 1, 0, 1], ["Einstein family"], ["OpenAI", "Anthropic", "Google"], ["Agentforce", "Data Cloud", "CRM workflows"], [], ["Cloud GPU supply"], "Salesforce is an application-layer agent platform where CRM workflow ownership drives adoption. Cost and per-action economics need careful buyer scrutiny.", "E3", "CRM and service workflow share should not be projected to broad AI platform share."),
  entity("oracle", "Oracle", "public", "Platform Vendor", ["Cloud / Hosting Provider", "Infrastructure Player"], 75, 61, 74, "medium", 72, 2.7, 63, 74, [0, 0], [1, 1, 0, 2, 0], [], ["Cohere", "Llama"], ["OCI", "Oracle Database", "sovereign regions"], ["Cohere partnership"], ["NVIDIA GPUs"], "Oracle is relevant where database, enterprise applications and OCI infrastructure are already strategic. Sovereign and dedicated cloud claims need region-level validation.", "E2", "AI leadership varies sharply by Oracle estate depth and workload."),
  entity("perplexity", "Perplexity", "private", "Application Vendor", ["Model Provider"], 72, 66, 61, "medium", 58, 2.6, 72, 58, [1, 1], [1, 1, 2, 0, 1], ["Sonar"], ["OpenAI", "Anthropic"], ["Search and research product"], [], ["Cloud GPU supply"], "Perplexity is best read as an AI search and research application with model-provider characteristics through Sonar, not a horizontal enterprise platform.", "E2", "Enterprise controls and source quality evidence should be tested before knowledge-work scale-up."),
  entity("harvey", "Harvey", "private", "Vertical Specialist", ["Application Vendor"], 76, 68, 57, "medium", 61, 2.5, 69, 64, [2, 1], [2, 1, 3, 0, 1], [], ["Multi-provider"], ["Legal workflow product"], [], ["Cloud GPU supply"], "Harvey is a vertical specialist with strong legal workflow credibility. It can outperform horizontal platforms in law and professional-services use cases.", "E2", "Vertical concentration and pricing opacity limit broad-market extrapolation."),
  entity("rogo", "Rogo", "private", "Vertical Specialist", ["Application Vendor"], 69, 57, 46, "medium", 52, 1.6, 61, 55, [0, 0], [1, 0, 1, 0, 1], [], ["Multi-provider"], ["Financial research workflows"], [], ["Cloud GPU supply"], "Rogo is a financial-services specialist; useful for domain shortlists, but scale evidence and horizontal proof remain the diligence points.", "E1", "Small sample of public proof means confidence should stay conservative."),
  entity("writer", "Writer", "private", "Application Vendor", ["Model Provider"], 73, 61, 58, "medium", 60, 2.2, 64, 66, [1, 1], [1, 1, 1, 0, 0], ["Palmyra"], [], ["Enterprise content workflow platform"], [], ["Cloud GPU supply"], "Writer is an enterprise application and model provider for governed content and knowledge workflows. It is not a universal platform, but it can win specific business-user use cases.", "E2", "Category is crowded; broad enterprise scale proof matters."),
  entity("moveworks", "Moveworks", "private", "Application Vendor", ["Vertical Specialist"], 72, 60, 55, "medium", 63, 1.9, 62, 68, [0, 0], [1, 0, 1, 0, 0], [], ["Multi-provider"], ["Employee support automation"], [], ["Cloud GPU supply"], "Moveworks is a service-workflow application specialist, strongest in IT and HR support automation where deflection and resolution metrics are measurable.", "E2", "Suite competition from Microsoft and ServiceNow must be modelled."),
  entity("deepseek", "DeepSeek", "private", "Model Provider", ["Sovereign / Regional AI", "Open-Source Ecosystem"], 76, 71, 65, "high", 55, 2.4, 84, 53, [3, 0], [2, 1, 3, 0, 3], ["R1", "V3"], [], ["API platform", "open release ecosystem"], [], ["GPU access constraints"], "DeepSeek is a cost-per-quality disruptor for model strategy, but regulated buyers must treat jurisdiction, data transfer and access compliance as gating factors.", "E1", "Performance and pricing signals are strong; enterprise controls and geopolitical access are uncertain."),
  entity("alibaba-qwen", "Alibaba / Qwen", "public", "Model Provider", ["Cloud / Hosting Provider", "Sovereign / Regional AI", "Open-Source Ecosystem"], 77, 66, 70, "high", 58, 2.3, 78, 58, [1, 1], [1, 2, 2, 1, 2], ["Qwen"], [], ["Alibaba Cloud Model Studio"], [], ["GPU and accelerator supply"], "Qwen matters as a global frontier alternative with multilingual and regional reach. Western enterprise adoption depends on jurisdiction and procurement policy.", "E1", "Signals are strongest in APAC and open-weight contexts; global enterprise controls need validation."),
  entity("moonshot-kimi", "Moonshot / Kimi", "private", "Model Provider", ["Sovereign / Regional AI"], 70, 63, 52, "high", 48, 1.4, 73, 50, [1, 0], [1, 0, 1, 0, 1], ["Kimi"], [], ["Platform API"], [], ["GPU supply"], "Moonshot/Kimi is a long-context and reasoning contender. It is useful for market scanning, but not yet a default enterprise platform choice.", "E1", "Enterprise packaging, procurement access and controls remain early."),
  entity("zhipu-glm", "Zhipu / GLM", "private", "Model Provider", ["Sovereign / Regional AI"], 68, 58, 49, "high", 46, 1.2, 70, 49, [0, 0], [0, 0, 1, 0, 1], ["GLM"], [], ["API and regional enterprise deployments"], [], ["GPU supply"], "Zhipu/GLM is relevant for jurisdictional diversity and China-market coverage, with limited Western enterprise readiness evidence.", "E1", "Confidence is low outside domestic/regional contexts."),
  entity("coreweave", "CoreWeave", "private", "Infrastructure Player", ["Cloud / Hosting Provider"], 74, 70, 79, "medium", 61, 1.7, 69, 73, [2, 1], [1, 3, 2, 5, 1], [], [], ["GPU cloud", "AI training infrastructure"], ["NVIDIA ecosystem ties"], ["NVIDIA GPUs"], "CoreWeave is a high-signal infrastructure player. It matters for supply, hosting and training capacity, not as an enterprise application vendor.", "E2", "Dependency and customer concentration should be watched."),
  entity("amd", "AMD", "public", "Hardware Provider", ["Infrastructure Player"], 70, 65, 67, "medium", 70, 1.5, 65, 70, [1, 0], [1, 2, 1, 3, 0], [], [], ["MI accelerator ecosystem"], [], ["Own accelerator roadmap"], "AMD is an alternative accelerator provider that affects negotiating leverage and supply diversification more than direct AI application choice.", "E3", "Software ecosystem maturity remains the key counterweight to hardware performance."),
  entity("broadcom", "Broadcom", "public", "Hardware Provider", ["Infrastructure Player"], 68, 62, 66, "low", 68, 1.3, 60, 69, [0, 0], [0, 2, 0, 3, -1], [], [], ["AI networking", "custom silicon"], [], ["Own networking and ASIC exposure"], "Broadcom is part of the infrastructure dependency map through networking and custom silicon. CIO relevance is indirect but important for cloud cost and capacity.", "E3", "Enterprise buyer visibility is indirect through cloud and infrastructure suppliers."),
  entity("tsmc", "TSMC", "public", "Hardware Provider", ["Infrastructure Player"], 72, 60, 82, "low", 78, 1.4, 58, 83, [0, 0], [0, 4, 0, 4, -1], [], [], ["Semiconductor fabrication", "advanced process nodes"], [], ["Own fabrication capacity"], "TSMC is the fabrication backbone for AI hardware. It is a supply-chain and geopolitical risk signal rather than a direct software vendor.", "E4", "Risk is supply-chain and geopolitical, not product-fit."),
  entity("xai", "xAI", "private", "Model Provider", ["Application Vendor", "Infrastructure Player"], 71, 66, 59, "medium", 47, 1.4, 74, 54, [1, 1], [1, 1, 1, 2, 1], ["Grok"], [], ["Colossus compute build-out", "X distribution"], [], ["NVIDIA GPU supply", "Oracle OCI exposure"], "xAI is a model provider with compute-scale ambitions and consumer distribution through X. Enterprise readiness evidence remains thin.", "E1", "Treat as watch-list until enterprise controls and customer proof mature."),
];

const WINNING_BY_LAYER: Array<{ title: string; names: string[]; note: string }> = [
  { title: "Platform Vendors", names: ["Microsoft", "AWS", "Google Cloud", "IBM", "Databricks"], note: "Distribution, cloud control and enterprise-governance depth." },
  { title: "Model Providers", names: ["OpenAI", "Anthropic", "Google DeepMind", "xAI", "Mistral", "Meta", "DeepSeek", "Qwen"], note: "Quality, cadence, deployment paths and model economics." },
  { title: "Application Vendors", names: ["Microsoft Copilot", "Harvey", "Writer", "Moveworks", "Rogo", "Perplexity"], note: "Workflow conversion, domain fit and business-user adoption." },
  { title: "Infrastructure Players", names: ["Azure", "AWS", "Google Cloud", "Oracle", "CoreWeave"], note: "Hosting, scale, deployment and compute access." },
  { title: "Hardware", names: ["NVIDIA", "AMD", "Broadcom", "TSMC"], note: "Accelerators, networking, custom silicon and fabrication." },
  { title: "Investors", names: ["Microsoft", "Amazon", "Google", "NVIDIA", "SoftBank"], note: "Strategic capital, distribution rights and ecosystem influence." },
];

const MODEL_GROUPS = [
  { title: "First-party models", items: ["OpenAI: GPT, o-series, image/audio models", "Anthropic: Claude Opus, Sonnet, Haiku", "Google: Gemini, Imagen, Veo", "Mistral: Large, Medium, Small, Codestral, Magistral", "Cohere: Command, Embed, Rerank", "IBM: Granite", "DeepSeek: R1, V3", "Alibaba: Qwen", "Moonshot: Kimi", "Zhipu: GLM"] },
  { title: "Hosted third-party models", items: ["Microsoft: hosted OpenAI, Mistral and Llama through Azure", "AWS: Claude, Llama, Mistral and other Bedrock models", "Google: Claude through Vertex AI", "Oracle: Cohere and Llama through OCI"] },
  { title: "Open-weight models", items: ["Meta: Llama", "Mistral: open-weight families", "DeepSeek: open releases", "Alibaba: Qwen open-weight variants"] },
  { title: "Underlying product models", items: ["Microsoft Copilot: OpenAI + Microsoft small models", "Harvey: multi-provider legal AI stack", "Glean: multi-provider enterprise search stack", "ServiceNow: Now LLM + provider orchestration"] },
  { title: "Unknown / unverified", items: ["Vertical applications with multi-provider routing", "Private model routing where vendor disclosures are incomplete", "Product-level model mix that changes by customer contract"] },
];

function entity(
  id: string,
  name: string,
  ownership: Ownership,
  primaryRole: Role,
  secondaryRoles: Role[],
  leadershipScore: number,
  momentum: number,
  ecosystemReach: number,
  risk: Entity["risk"],
  confidence: number,
  usageShare: number,
  innovation: number,
  readiness: number,
  movementTuple: [number, number],
  deltaTuple: [number, number, number, number, number],
  modelsOwned: string[],
  hostedThirdParty: string[],
  infrastructureExposure: string[],
  investorRelationships: string[],
  hardwareDependencies: string[],
  cioInterpretation: string,
  evidenceGrade: Entity["evidenceGrade"],
  dataCaveats: string,
): Entity {
  return {
    id,
    name,
    slug: id === "alibaba-qwen" ? "alibaba" : id === "moonshot-kimi" ? "moonshot" : id === "zhipu-glm" ? "zai" : id,
    ownership,
    primaryRole,
    secondaryRoles,
    leadershipScore,
    momentum,
    ecosystemReach,
    risk,
    confidence,
    usageShare,
    innovation,
    readiness,
    movement: { dx: movementTuple[0], dy: movementTuple[1] },
    deltas: {
      leadership: deltaTuple[0],
      reach: deltaTuple[1],
      adoption: deltaTuple[2],
      infrastructure: deltaTuple[3],
      risk: deltaTuple[4],
    },
    modelsOwned,
    hostedThirdParty,
    infrastructureExposure,
    investorRelationships,
    hardwareDependencies,
    cioInterpretation,
    evidenceGrade,
    dataCaveats,
  };
}

function rolesFor(entity: Entity) {
  return [entity.primaryRole, ...entity.secondaryRoles];
}

function matchesCategory(entity: Entity, key: CategoryKey) {
  const option = CATEGORY_OPTIONS.find((item) => item.key === key);
  if (!option || option.roles.length === 0) return true;
  const roles = rolesFor(entity);
  return option.roles.some((role) => roles.includes(role));
}

function roleBadge(role: Role) {
  const tone = ROLE_TONE[role];
  return (
    <span key={role} className={`inline-flex rounded border border-current/20 px-1.5 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
      {role}
    </span>
  );
}

function riskClass(risk: Entity["risk"]) {
  if (risk === "low") return "text-emerald-700 dark:text-emerald-300";
  if (risk === "high") return "text-rose-700 dark:text-rose-300";
  return "text-amber-700 dark:text-amber-300";
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

export default function QueryV2Client() {
  const [category, setCategory] = useState<CategoryKey>("all");
  const [selectedId, setSelectedId] = useState(ENTITIES[0].id);

  const selectedOption = CATEGORY_OPTIONS.find((option) => option.key === category) ?? CATEGORY_OPTIONS[0];
  const filtered = useMemo(
    () => ENTITIES.filter((entity) => matchesCategory(entity, category)).sort((a, b) => b.leadershipScore - a.leadershipScore),
    [category],
  );
  const selectedEntity = filtered.find((entity) => entity.id === selectedId) ?? filtered[0] ?? ENTITIES[0];
  const maxShare = Math.max(...filtered.map((entity) => entity.usageShare), 1);
  const normalizedShare = filtered.map((entity) => ({
    entity,
    share: (entity.usageShare / filtered.reduce((sum, item) => sum + item.usageShare, 0)) * 100,
  }));

  function chooseCategory(nextCategory: CategoryKey) {
    const nextFiltered = ENTITIES
      .filter((entity) => matchesCategory(entity, nextCategory))
      .sort((a, b) => b.leadershipScore - a.leadershipScore);
    setCategory(nextCategory);
    setSelectedId(nextFiltered[0]?.id ?? ENTITIES[0].id);
  }

  const kpis = [
    { label: "Total tracked entities", value: ENTITIES.length, note: "role-classified universe" },
    { label: "Platform vendors", value: ENTITIES.filter((entity) => rolesFor(entity).includes("Platform Vendor")).length, note: "control-plane layer" },
    { label: "Model providers", value: ENTITIES.filter((entity) => rolesFor(entity).includes("Model Provider")).length, note: "frontier + specialist" },
    { label: "Application vendors", value: ENTITIES.filter((entity) => rolesFor(entity).includes("Application Vendor")).length, note: "workflow products" },
    { label: "Infra / hardware", value: ENTITIES.filter((entity) => rolesFor(entity).some((role) => role === "Infrastructure Player" || role === "Hardware Provider")).length, note: "dependency layer" },
    { label: "Investor-linked", value: ENTITIES.filter((entity) => rolesFor(entity).includes("Investor") || entity.investorRelationships.length > 0).length, note: "capital influence" },
    { label: "Evidence confidence", value: `${average(ENTITIES.map((entity) => entity.confidence)).toFixed(0)}%`, note: "directional model" },
  ];

  const movers = {
    leadership: filtered.filter((entity) => entity.deltas.leadership > 0).sort((a, b) => b.deltas.leadership - a.deltas.leadership).slice(0, 4),
    reach: filtered.filter((entity) => entity.deltas.reach > 0).sort((a, b) => b.deltas.reach - a.deltas.reach).slice(0, 4),
    adoption: filtered.filter((entity) => entity.deltas.adoption > 0).sort((a, b) => b.deltas.adoption - a.deltas.adoption).slice(0, 4),
    infrastructure: filtered.filter((entity) => entity.deltas.infrastructure > 0).sort((a, b) => b.deltas.infrastructure - a.deltas.infrastructure).slice(0, 4),
    risk: filtered.filter((entity) => entity.deltas.risk > 0).sort((a, b) => b.deltas.risk - a.deltas.risk).slice(0, 4),
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-lg border border-[#dfe4da] bg-white p-3 dark:border-zinc-800 dark:bg-[#071827]">
          <Link href="/query" className="block rounded-md px-3 py-2 text-sm font-semibold text-[#18201b] hover:bg-[#eef2e8] dark:text-zinc-100 dark:hover:bg-zinc-900">
            Query classic
          </Link>
          {["Role overview", "Leaderboard", "Layer winners", "Usage share", "Atlas", "Movers", "Models"].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} className="mt-1 block rounded-md px-3 py-2 text-xs font-medium text-[#596151] hover:bg-[#eef2e8] dark:text-zinc-400 dark:hover:bg-zinc-900">
              {item}
            </a>
          ))}
        </div>
      </aside>

      <div className="min-w-0">
        <section id="role-overview" className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          {kpis.map((kpi) => <Metric key={kpi.label} {...kpi} />)}
        </section>

        <Panel
          title="Entity role selector"
          action={<SeedDataBadge label="Directional estimate" provenance="seed" reason="Category roles and market signals are evidence-labelled directional intelligence for route /query-v2." />}
        >
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => {
              const active = option.key === category;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => chooseCategory(option.key)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "border-[#192319] bg-[#192319] text-white dark:border-white dark:bg-white dark:text-[#071827]"
                      : "border-[#d7ddd1] bg-[#fbfcf8] text-[#4d574b] hover:bg-[#eef2e8] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-md border border-[#e2e7dc] bg-[#fbfcf8] p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">Category summary</div>
              <div className="mt-2 text-sm font-semibold text-[#18201b] dark:text-zinc-100">{selectedOption.label}</div>
              <p className="mt-2 text-xs leading-5 text-[#596151] dark:text-zinc-400">{selectedOption.summary}</p>
            </div>
            <div className="rounded-md border border-[#e2e7dc] bg-[#fbfcf8] p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">CIO interpretation</div>
              <p className="mt-2 text-sm leading-6 text-[#2f392f] dark:text-zinc-300">{selectedOption.interpretation}</p>
            </div>
          </div>
        </Panel>

        <section id="leaderboard" className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel title="Category-aware leaderboard">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] text-left text-sm">
                <thead className="border-b border-[#e7ebe2] text-[11px] uppercase tracking-wide text-[#697362] dark:border-zinc-800 dark:text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Rank</th>
                    <th className="py-2 pr-3">Entity</th>
                    <th className="py-2 pr-3">Primary role</th>
                    <th className="py-2 pr-3">Secondary roles</th>
                    <th className="py-2 pr-3 text-right">Leadership</th>
                    <th className="py-2 pr-3 text-right">Momentum</th>
                    <th className="py-2 pr-3 text-right">Reach</th>
                    <th className="py-2 pr-3">Risk</th>
                    <th className="py-2 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ea] dark:divide-zinc-800">
                  {filtered.map((entity, index) => {
                    const active = entity.id === selectedEntity.id;
                    return (
                      <tr
                        key={entity.id}
                        onClick={() => setSelectedId(entity.id)}
                        className={`cursor-pointer transition-colors ${active ? "bg-[#eef2e8] dark:bg-zinc-900" : "hover:bg-[#f5f7f2] dark:hover:bg-zinc-900/70"}`}
                      >
                        <td className="py-3 pr-3 font-mono text-[#697362] dark:text-zinc-500">{index + 1}</td>
                        <td className="py-3 pr-3 font-semibold text-[#18201b] dark:text-zinc-100">
                          <VendorNameWithOwnership name={entity.name} ownershipType={entity.ownership} />
                        </td>
                        <td className="py-3 pr-3">{roleBadge(entity.primaryRole)}</td>
                        <td className="py-3 pr-3">
                          <div className="flex max-w-[280px] flex-wrap gap-1">
                            {entity.secondaryRoles.slice(0, 4).map(roleBadge)}
                            {entity.secondaryRoles.length > 4 && <span className="text-xs text-[#697362] dark:text-zinc-500">+{entity.secondaryRoles.length - 4}</span>}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono">{entity.leadershipScore}</td>
                        <td className="py-3 pr-3 text-right font-mono">{entity.momentum}</td>
                        <td className="py-3 pr-3 text-right font-mono">{entity.ecosystemReach}</td>
                        <td className={`py-3 pr-3 text-xs font-semibold uppercase ${riskClass(entity.risk)}`}>{entity.risk}</td>
                        <td className="py-3 text-right font-mono">{entity.confidence}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Entity detail">
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-[#18201b] dark:text-zinc-100">{selectedEntity.name}</h3>
                  <OwnershipBadge ownershipType={selectedEntity.ownership} compact />
                  <span className="rounded border border-[#d8ded0] px-1.5 py-0.5 text-xs text-[#495344] dark:border-zinc-700 dark:text-zinc-400">{selectedEntity.evidenceGrade}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {roleBadge(selectedEntity.primaryRole)}
                  {selectedEntity.secondaryRoles.map(roleBadge)}
                </div>
              </div>
              <p className="text-sm leading-6 text-[#2f392f] dark:text-zinc-300">{selectedEntity.cioInterpretation}</p>
              <DetailList title="Models/products owned" items={selectedEntity.modelsOwned} empty="No material first-party model disclosed in this view." />
              <DetailList title="Hosted third-party models" items={selectedEntity.hostedThirdParty} />
              <DetailList title="Infrastructure exposure" items={selectedEntity.infrastructureExposure} />
              <DetailList title="Investor relationships" items={selectedEntity.investorRelationships} />
              <DetailList title="Hardware dependencies" items={selectedEntity.hardwareDependencies} />
              <div className="rounded-md border border-[#e2e7dc] bg-[#fbfcf8] p-3 text-xs leading-5 text-[#596151] dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                <span className="font-semibold text-[#18201b] dark:text-zinc-100">Data caveat: </span>
                {selectedEntity.dataCaveats}
              </div>
            </div>
          </Panel>
        </section>

        <section id="layer-winners" className="mt-6">
          <Panel title="Who is winning by layer">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {WINNING_BY_LAYER.map((layer) => (
                <div key={layer.title} className="border-l border-[#d6dccf] pl-4 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{layer.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#66705f] dark:text-zinc-500">{layer.note}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {layer.names.map((name) => (
                      <span key={name} className="rounded border border-[#dfe4da] px-2 py-1 text-xs dark:border-zinc-800">{name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section id="usage-share" className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <Panel title="Share of named enterprise AI usage">
            <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
              Directional, evidence-labelled estimate. Not audited global market share.
              The bars below re-weight the original usage-share idea to the selected role category.
            </p>
            <div className="space-y-3">
              {filtered.slice(0, 10).map((entity) => (
                <div key={entity.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium"><VendorNameWithOwnership name={entity.name} ownershipType={entity.ownership} /></span>
                    <span className="font-mono">{entity.usageShare.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#e8ede2] dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-[#2f5d50] dark:bg-emerald-400" style={{ width: `${Math.max(3, (entity.usageShare / maxShare) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Category share estimate">
            <div className="space-y-3">
              {normalizedShare.slice(0, 8).map(({ entity, share }) => (
                <div key={entity.id} className="flex items-center justify-between gap-3 border-b border-[#edf0ea] pb-2 text-sm last:border-0 dark:border-zinc-800">
                  <div>
                    <div className="font-medium text-[#18201b] dark:text-zinc-100">{entity.name}</div>
                    <div className="mt-1 text-xs text-[#697362] dark:text-zinc-500">{entity.primaryRole}</div>
                  </div>
                  <div className="font-mono text-lg font-semibold">{share.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section id="atlas" className="mt-6">
          <Panel title="Enhance x Innovate role map">
            <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
              X-axis is innovation / market momentum. Y-axis is enterprise readiness / execution.
              Bubble size is ecosystem reach; colour is primary category; outline is public/private/subsidiary; arrow shows movement since prior snapshot.
            </p>
            <RoleScatter entities={filtered} selectedId={selectedEntity.id} onSelect={setSelectedId} />
          </Panel>
        </section>

        <section id="movers" className="mt-6">
          <Panel title="Market movers by signal type">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MoverColumn title="Rising by leadership score" entities={movers.leadership} pick={(entity) => entity.deltas.leadership} />
              <MoverColumn title="Rising by ecosystem reach" entities={movers.reach} pick={(entity) => entity.deltas.reach} />
              <MoverColumn title="Rising by adoption" entities={movers.adoption} pick={(entity) => entity.deltas.adoption} />
              <MoverColumn title="Rising by infrastructure exposure" entities={movers.infrastructure} pick={(entity) => entity.deltas.infrastructure} />
              <MoverColumn title="Falling / risk increasing" entities={movers.risk} pick={(entity) => entity.deltas.risk} tone="risk" />
            </div>
          </Panel>
        </section>

        <section id="models" className="mt-6">
          <Panel title="Commercial models by vendor">
            <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
              Source-backed model availability should be grouped by ownership and hosting route. Hosted third-party models keep the original owner and should not be reattributed to the platform that hosts them.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {MODEL_GROUPS.map((group) => (
                <div key={group.title} className="rounded-md border border-[#e2e7dc] bg-[#fbfcf8] p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <h3 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{group.title}</h3>
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-[#596151] dark:text-zinc-400">
                    {group.items.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function DetailList({ title, items, empty = "None disclosed in this view." }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length > 0 ? items.map((item) => (
          <span key={item} className="rounded border border-[#dfe4da] px-2 py-1 text-xs text-[#2f392f] dark:border-zinc-800 dark:text-zinc-300">{item}</span>
        )) : <span className="text-xs text-[#697362] dark:text-zinc-500">{empty}</span>}
      </div>
    </div>
  );
}

function MoverColumn({ title, entities, pick, tone = "gain" }: { title: string; entities: Entity[]; pick: (entity: Entity) => number; tone?: "gain" | "risk" }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">{title}</h3>
      <div className="mt-3 space-y-3">
        {entities.length ? entities.map((entity) => (
          <div key={entity.id} className="border-l border-[#d6dccf] pl-3 dark:border-zinc-800">
            <div className="text-sm font-medium text-[#18201b] dark:text-zinc-100">{entity.name}</div>
            <div className={`mt-1 font-mono text-xs ${tone === "risk" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {signed(pick(entity))}
            </div>
          </div>
        )) : <div className="text-xs text-[#697362] dark:text-zinc-500">No material signal.</div>}
      </div>
    </div>
  );
}

function RoleScatter({ entities, selectedId, onSelect }: { entities: Entity[]; selectedId: string; onSelect: (id: string) => void }) {
  const width = 860;
  const height = 460;
  const pad = 56;
  const x = (value: number) => pad + ((value - 45) / 50) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - 45) / 50) * (height - pad * 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px]" role="img" aria-label="Enhance by innovate enterprise AI role map">
        <rect x="0" y="0" width={width} height={height} rx="12" fill="currentColor" className="text-[#fbfcf8] dark:text-zinc-950" />
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#a6b0a0" strokeWidth="1" />
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#a6b0a0" strokeWidth="1" />
        {[55, 65, 75, 85].map((tick) => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={pad} y2={height - pad} stroke="#dfe4da" strokeDasharray="4 6" />
            <line x1={pad} x2={width - pad} y1={y(tick)} y2={y(tick)} stroke="#dfe4da" strokeDasharray="4 6" />
            <text x={x(tick)} y={height - 22} textAnchor="middle" className="fill-[#697362] text-[11px]">{tick}</text>
            <text x={26} y={y(tick) + 4} className="fill-[#697362] text-[11px]">{tick}</text>
          </g>
        ))}
        <text x={width / 2} y={height - 8} textAnchor="middle" className="fill-[#4d574b] text-[12px] font-semibold">Innovation / market momentum</text>
        <text transform={`translate(14 ${height / 2}) rotate(-90)`} textAnchor="middle" className="fill-[#4d574b] text-[12px] font-semibold">Enterprise readiness / execution</text>
        {entities.map((entity) => {
          const cx = x(entity.innovation);
          const cy = y(entity.readiness);
          const r = Math.max(8, Math.min(22, entity.ecosystemReach / 4.4));
          const tone = ROLE_TONE[entity.primaryRole];
          const selected = entity.id === selectedId;
          const stroke = entity.ownership === "public" ? "#059669" : entity.ownership === "subsidiary" ? "#0284c7" : "#7c3aed";
          return (
            <g key={entity.id} className="cursor-pointer" onClick={() => onSelect(entity.id)}>
              <line x1={cx - entity.movement.dx * 5} y1={cy + entity.movement.dy * 5} x2={cx} y2={cy} stroke={tone.fill} strokeWidth="1.5" markerEnd="url(#arrow)" opacity="0.75" />
              <circle cx={cx} cy={cy} r={r} fill={tone.fill} fillOpacity={selected ? 0.95 : 0.72} stroke={selected ? "#111827" : stroke} strokeWidth={selected ? 3 : 2} />
              <text x={cx + r + 5} y={cy + 4} className="fill-[#18201b] text-[11px] font-semibold dark:fill-zinc-100">{entity.name}</text>
            </g>
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L6,3 z" fill="#64748b" />
          </marker>
        </defs>
      </svg>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {Array.from(new Set(ENTITIES.map((entity) => entity.primaryRole))).map((role) => (
          <span key={role} className={`rounded border border-current/20 px-2 py-1 ${ROLE_TONE[role].bg} ${ROLE_TONE[role].text}`}>{role}</span>
        ))}
      </div>
    </div>
  );
}
