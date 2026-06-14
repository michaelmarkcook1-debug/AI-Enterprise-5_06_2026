// Seed vendor profiles for MVP. Evidence is anonymised/representative — real values
// would be populated by the LLM Evidence Extractor agents (spec §15) in production.

import type { Vendor, EvidenceItem, RiskFlag, DomainId, EvidenceGrade } from "./types";

let counter = 0;
const nextId = (prefix: string) => `${prefix}_${++counter}`;

function ev(
  vendorId: string,
  domain: DomainId,
  subfactor: string,
  grade: EvidenceGrade,
  rawScore: number,
  excerpt: string,
  capturedAt = "2026-04-15",
): EvidenceItem {
  return {
    id: nextId("ev"),
    vendorId,
    domain,
    subfactor,
    grade,
    rawScore,
    excerpt,
    capturedAt,
    sourceUrl: undefined,
  };
}

function risk(
  vendorId: string,
  severity: RiskFlag["severity"],
  description: string,
  domain: DomainId,
  fatalIn?: RiskFlag["fatalInIndustries"],
): RiskFlag {
  return { id: nextId("risk"), vendorId, severity, description, domain, fatalInIndustries: fatalIn };
}

// ─────────────────────────────────────────────────────────────────────────
// Vendor A: Hyperscaler enterprise AI platform — broad, secure, expensive
// ─────────────────────────────────────────────────────────────────────────
const vA: Vendor = (() => {
  const id = "vendor_atlas";
  return {
    id,
    name: "Atlas Enterprise AI",
    category: "Enterprise AI Platform",
    ownership: "public",
    summary: "Hyperscaler-backed enterprise AI suite with deep tenant isolation, BYOK, regional residency, and broad agent tooling.",
    supportedDeployments: ["saas", "vpc", "sovereign"],
    ecosystemFit: ["microsoft", "azure", "salesforce", "servicenow"],
    useCaseFit: ["knowledge_assistant", "code_assistant", "customer_service_agent", "data_analysis", "operations_automation"],
    evidence: [
      ev(id, "data_security_privacy", "Training data policy", "E5", 92, "Independent audit confirms no customer data used for foundation model training; SOC 2 Type II + ISO 27001 + HIPAA."),
      ev(id, "data_security_privacy", "Data residency", "E4", 88, "Production references confirm EU/UK/US/APAC residency with documented routing."),
      ev(id, "identity_access", "SSO/SCIM/RBAC", "E4", 90, "Enterprise SSO, SCIM provisioning, RBAC + ABAC documented and verified by reference customers."),
      ev(id, "identity_access", "Source-permission inheritance", "E3", 82, "Connector framework inherits ACLs from upstream systems; verified in sandbox."),
      ev(id, "governance_compliance", "Audit logs", "E4", 87, "Immutable audit logs with 13-month retention; SIEM integrations verified."),
      ev(id, "governance_compliance", "EU AI Act readiness", "E3", 80, "Public crosswalk to EU AI Act Article 9-15 obligations."),
      ev(id, "model_reliability", "Citation behaviour", "E3", 78, "Grounded retrieval with inline citations and refusal on missing source."),
      ev(id, "security_threat", "Prompt injection defence", "E4", 84, "Pen-test reports show robust defence in depth; incident response runbook published."),
      ev(id, "integration_architecture", "Connector breadth", "E4", 88, "150+ certified connectors; documented reliability SLAs."),
      ev(id, "agentic_autonomy", "Approval gates + kill switch", "E3", 79, "Documented action approval gates, scoped tool-use, simulation mode."),
      ev(id, "cost_finops", "Pricing transparency", "E2", 60, "Public pricing tiers; usage volatility moderately high beyond seat baseline."),
      ev(id, "workforce_adoption", "Adoption support", "E4", 85, "Dedicated change-management programme with measurable adoption uplift case studies."),
      ev(id, "vendor_maturity_lockin", "Model portability", "E3", 72, "Multi-model routing supported; export of prompts/configs documented."),
      ev(id, "capital_resilience", "Public filings runway", "E5", 95, "Public-company financials confirm strong runway and infrastructure independence."),
      ev(id, "market_position", "Sector adoption", "E4", 90, "Documented production deployments at top-tier banks, healthcare systems, governments."),
      ev(id, "strategic_value", "Use-case coverage", "E4", 86, "Broad pilot-to-production references across knowledge, code, service, analytics."),
    ],
    risks: [
      risk(id, "moderate", "Cost at 3x usage shows steep step pricing — FinOps controls advised", "cost_finops"),
    ],
    industryAdoption: [
      { industry: "regulated_financial", productionReferenceCount: 22, deploymentDepthScore: 80, confidence: 85 },
      { industry: "health_life_sciences", productionReferenceCount: 14, deploymentDepthScore: 70, confidence: 80 },
      { industry: "public_sector_education", productionReferenceCount: 18, deploymentDepthScore: 65, confidence: 75 },
      { industry: "enterprise_software", productionReferenceCount: 35, deploymentDepthScore: 75, confidence: 90 },
      { industry: "commercial_enterprise", productionReferenceCount: 48, deploymentDepthScore: 80, confidence: 92 },
    ],
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// Vendor B: Frontier model lab — strong reasoning, weaker enterprise control
// ─────────────────────────────────────────────────────────────────────────
const vB: Vendor = (() => {
  const id = "vendor_borealis";
  return {
    id,
    name: "Borealis Frontier",
    category: "Frontier Model + Enterprise API",
    ownership: "private",
    summary: "Frontier reasoning models with strong API and growing enterprise tier; rapidly maturing controls.",
    supportedDeployments: ["saas", "vpc"],
    ecosystemFit: ["aws", "azure", "snowflake", "databricks"],
    useCaseFit: ["knowledge_assistant", "code_assistant", "data_analysis", "marketing_content", "sales_research"],
    evidence: [
      ev(id, "data_security_privacy", "Training data policy", "E3", 80, "Public docs and DPA confirm no enterprise prompt/output training; verified via API headers."),
      ev(id, "identity_access", "SSO/SCIM", "E2", 65, "Enterprise SSO documented; SCIM in private preview."),
      ev(id, "governance_compliance", "Audit logs", "E2", 60, "Audit logs available on Enterprise tier; retention configurable."),
      ev(id, "model_reliability", "Baseline factuality", "E4", 92, "Independent benchmarks place model in top tier for reasoning and factual accuracy."),
      ev(id, "model_reliability", "Citation behaviour", "E3", 75, "Citations supported via grounding APIs; refusal behaviour documented."),
      ev(id, "security_threat", "Prompt injection", "E3", 78, "Public adversarial benchmark results; mitigations documented."),
      ev(id, "integration_architecture", "API quality", "E4", 90, "Mature SDKs across 6 languages; high-quality streaming and tool-use APIs."),
      ev(id, "agentic_autonomy", "Tool scoping", "E3", 80, "Native tool-use scoping; sandbox supported; kill switch via API."),
      ev(id, "cost_finops", "Pricing transparency", "E2", 70, "Public token pricing; usage caps configurable; volatility model documented."),
      ev(id, "vendor_maturity_lockin", "Exit support", "E1", 50, "Vendor claims data export; limited public proof."),
      ev(id, "capital_resilience", "Funding/runway", "E2", 70, "Late-stage funding rounds publicly reported; multi-cloud presence."),
      ev(id, "market_position", "Momentum", "E4", 90, "High developer adoption signals; strong roadmap delivery."),
      ev(id, "strategic_value", "Use-case fit", "E3", 78, "Strong fit for reasoning-heavy and content workloads."),
      ev(id, "workforce_adoption", "Adoption support", "E2", 60, "Self-serve docs; limited managed change-management."),
    ],
    risks: [
      risk(id, "moderate", "Limited evidence of source-permission inheritance for connectors", "identity_access"),
      risk(id, "severe", "Capital resilience reliant on a single hyperscaler partnership", "capital_resilience", ["critical_infrastructure_defence"]),
      risk(id, "moderate", "Audit logging maturity below regulated-industry expectations", "governance_compliance"),
    ],
    industryAdoption: [
      { industry: "enterprise_software", productionReferenceCount: 40, deploymentDepthScore: 78, confidence: 88 },
      { industry: "commercial_enterprise", productionReferenceCount: 28, deploymentDepthScore: 65, confidence: 80 },
      { industry: "regulated_financial", productionReferenceCount: 4, deploymentDepthScore: 35, confidence: 55 },
    ],
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// Vendor C: Vertical specialist — legal/professional services
// ─────────────────────────────────────────────────────────────────────────
const vC: Vendor = (() => {
  const id = "vendor_caelum";
  return {
    id,
    name: "Caelum Legal AI",
    category: "Legal Vertical AI",
    ownership: "private",
    summary: "Purpose-built legal AI with matter/client permissioning, citation discipline, and integrations with iManage/NetDocuments.",
    supportedDeployments: ["saas", "vpc"],
    ecosystemFit: ["microsoft"],
    useCaseFit: ["contract_review", "knowledge_assistant"],
    evidence: [
      ev(id, "data_security_privacy", "Privilege controls", "E4", 90, "Customer references confirm matter-level data isolation; SOC 2 Type II."),
      ev(id, "identity_access", "Matter/client permissioning", "E4", 92, "Native matter/client ACLs verified by AmLaw 100 references."),
      ev(id, "model_reliability", "Citation discipline", "E5", 95, "Independent benchmark shows 99%+ valid citation rate vs ~70% for general LLMs."),
      ev(id, "model_reliability", "Hallucination control", "E4", 90, "Refusal rate verified for unsupported answers in legal benchmarks."),
      ev(id, "governance_compliance", "Audit + retention", "E3", 80, "Configurable retention; export of all activity logs."),
      ev(id, "integration_architecture", "Connectors", "E3", 75, "iManage, NetDocuments, SharePoint integrations with documented behaviour."),
      ev(id, "agentic_autonomy", "Human-in-loop default", "E3", 80, "All workflows are human-in-loop by default; agentic use scoped."),
      ev(id, "cost_finops", "Pricing", "E2", 65, "Per-seat enterprise pricing; predictable."),
      ev(id, "strategic_value", "Use-case fit", "E5", 95, "Production references across top 50 global law firms in contract review and research."),
      ev(id, "market_position", "Legal sector adoption", "E4", 88, "Strong analyst recognition; differentiated in legal vertical."),
      ev(id, "workforce_adoption", "Training programmes", "E3", 78, "Documented adoption playbooks tailored to legal workflows."),
      ev(id, "vendor_maturity_lockin", "Exit support", "E2", 60, "Data export available; some prompt/template lock-in."),
      ev(id, "capital_resilience", "Runway", "E2", 65, "Series C reported; profitability not disclosed."),
    ],
    risks: [
      risk(id, "moderate", "Limited use-case coverage outside legal/professional services", "strategic_value"),
      risk(id, "low", "Single-cloud deployment dependency", "capital_resilience"),
    ],
    industryAdoption: [
      { industry: "legal_professional", productionReferenceCount: 60, deploymentDepthScore: 88, confidence: 92 },
      { industry: "regulated_financial", productionReferenceCount: 8, deploymentDepthScore: 45, confidence: 65 },
    ],
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// Vendor D: Open-source / self-hosted leader
// ─────────────────────────────────────────────────────────────────────────
const vD: Vendor = (() => {
  const id = "vendor_delta";
  return {
    id,
    name: "Delta Open Stack",
    category: "Open-source AI Platform",
    ownership: "private",
    summary: "Self-hostable AI stack with strong sovereignty story; weaker managed support and adoption services.",
    supportedDeployments: ["on_prem", "vpc", "sovereign"],
    ecosystemFit: ["aws", "azure", "gcp", "databricks"],
    useCaseFit: ["knowledge_assistant", "code_assistant", "data_analysis", "operations_automation"],
    evidence: [
      ev(id, "data_security_privacy", "Self-host data isolation", "E4", 90, "Air-gapped deployments verified by defence and government references."),
      ev(id, "identity_access", "RBAC", "E3", 78, "RBAC documented; SCIM via plugins."),
      ev(id, "model_reliability", "Baseline factuality", "E2", 65, "Public benchmark results vary by model selected."),
      ev(id, "security_threat", "Threat resilience", "E3", 75, "Hardening guides and pen-test results published by community."),
      ev(id, "governance_compliance", "Auditability", "E2", 60, "Audit logging exists; quality depends on operator."),
      ev(id, "integration_architecture", "API + portability", "E4", 85, "Open API standards; full model portability."),
      ev(id, "agentic_autonomy", "Controls", "E2", 60, "Configurable controls; no managed simulation mode."),
      ev(id, "cost_finops", "Cost predictability", "E3", 80, "Self-hosted infra cost predictable; FinOps tooling community-supported."),
      ev(id, "strategic_value", "Sovereignty fit", "E4", 88, "Strong fit for sovereign cloud and regulated workloads."),
      ev(id, "vendor_maturity_lockin", "Portability", "E5", 95, "Fully open-source; no platform lock-in."),
      ev(id, "capital_resilience", "Foundation backing", "E3", 78, "Backed by foundation + commercial sponsor; public roadmap."),
      ev(id, "market_position", "Developer momentum", "E3", 80, "Strong GitHub activity; growing enterprise adoption."),
      ev(id, "workforce_adoption", "Adoption support", "E1", 45, "Limited managed change-management; partner-led."),
    ],
    risks: [
      risk(id, "severe", "Adoption support and managed services are partner-dependent", "workforce_adoption"),
      risk(id, "moderate", "Reliability/factuality varies by chosen model", "model_reliability"),
    ],
    industryAdoption: [
      { industry: "critical_infrastructure_defence", productionReferenceCount: 12, deploymentDepthScore: 70, confidence: 78 },
      { industry: "public_sector_education", productionReferenceCount: 18, deploymentDepthScore: 60, confidence: 72 },
      { industry: "enterprise_software", productionReferenceCount: 22, deploymentDepthScore: 55, confidence: 75 },
    ],
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// Vendor E: Healthcare specialist
// ─────────────────────────────────────────────────────────────────────────
const vE: Vendor = (() => {
  const id = "vendor_evergreen";
  return {
    id,
    name: "Evergreen Clinical AI",
    category: "Health & Life Sciences AI",
    ownership: "private",
    summary: "HIPAA-grade clinical decision support with EHR integrations and strong human-in-loop workflows.",
    supportedDeployments: ["saas", "vpc"],
    ecosystemFit: ["microsoft", "aws"],
    useCaseFit: ["clinical_decision_support", "knowledge_assistant", "operations_automation"],
    evidence: [
      ev(id, "data_security_privacy", "PHI controls", "E5", 95, "HITRUST CSF certified + SOC 2 Type II + HIPAA BAA standard."),
      ev(id, "model_reliability", "Clinical validation", "E4", 88, "Peer-reviewed clinical validation studies for primary use cases."),
      ev(id, "governance_compliance", "Audit trail", "E4", 90, "Full clinical audit trail with provider attribution."),
      ev(id, "identity_access", "Role-aware access", "E3", 82, "Provider-role aware permissioning verified."),
      ev(id, "integration_architecture", "EHR connectors", "E4", 85, "Epic + Cerner + FHIR integrations with production deployments."),
      ev(id, "agentic_autonomy", "Human-in-loop", "E4", 88, "All clinically impactful actions require provider sign-off."),
      ev(id, "strategic_value", "Clinical fit", "E5", 92, "Production references across academic medical centres and integrated delivery networks."),
      ev(id, "market_position", "Health adoption", "E4", 86, "Top-tier presence in health AI category."),
      ev(id, "vendor_maturity_lockin", "Exit support", "E2", 60, "Data export documented; some workflow lock-in."),
      ev(id, "capital_resilience", "Funding", "E2", 65, "Series C; revenue not disclosed."),
      ev(id, "workforce_adoption", "Clinician training", "E3", 80, "Tailored clinician onboarding and adoption metrics."),
    ],
    risks: [
      risk(id, "low", "Limited use-case coverage outside healthcare", "strategic_value"),
    ],
    industryAdoption: [
      { industry: "health_life_sciences", productionReferenceCount: 45, deploymentDepthScore: 85, confidence: 90 },
    ],
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// Vendor F: Promising startup — high momentum, low evidence maturity
// ─────────────────────────────────────────────────────────────────────────
const vF: Vendor = (() => {
  const id = "vendor_falcon";
  return {
    id,
    name: "Falcon Agents",
    category: "Agentic Automation Startup",
    ownership: "private",
    summary: "Fast-moving agentic automation startup; impressive demos, limited enterprise control evidence.",
    supportedDeployments: ["saas"],
    ecosystemFit: ["salesforce", "google_workspace", "atlassian"],
    useCaseFit: ["operations_automation", "customer_service_agent", "sales_research"],
    evidence: [
      ev(id, "data_security_privacy", "Privacy", "E1", 55, "Marketing claims SOC 2 in progress."),
      ev(id, "identity_access", "SSO", "E2", 60, "SSO documented; SCIM not yet supported."),
      ev(id, "model_reliability", "Reasoning quality", "E2", 70, "Internal benchmarks shared in blog posts."),
      ev(id, "agentic_autonomy", "Action scoping", "E3", 75, "Demonstrated tool scoping and replay in product."),
      ev(id, "integration_architecture", "API maturity", "E2", 65, "Public API; rate limits documented; SDK in beta."),
      ev(id, "strategic_value", "Use-case demos", "E2", 70, "Compelling demos in operations and customer service."),
      ev(id, "market_position", "Hype/momentum", "E2", 75, "Strong news/social signals; Series A funding."),
      ev(id, "workforce_adoption", "Adoption support", "E1", 40, "Self-serve only."),
      ev(id, "capital_resilience", "Runway", "E2", 60, "Series A reported; runway estimate unclear."),
      ev(id, "cost_finops", "Pricing", "E2", 65, "Public usage pricing."),
    ],
    risks: [
      risk(id, "severe", "Audit logging and governance evidence is claim-only (E1/E2)", "governance_compliance"),
      risk(id, "severe", "Single-cloud, single-model dependency disclosed", "capital_resilience", ["regulated_financial", "critical_infrastructure_defence"]),
      risk(id, "moderate", "Workforce adoption support limited to self-serve", "workforce_adoption"),
    ],
    industryAdoption: [
      { industry: "commercial_enterprise", productionReferenceCount: 8, deploymentDepthScore: 35, confidence: 50 },
      { industry: "enterprise_software", productionReferenceCount: 12, deploymentDepthScore: 40, confidence: 55 },
    ],
  };
})();

export const SEED_VENDORS: Vendor[] = [vA, vB, vC, vD, vE, vF];

export function getSeedVendors(): Vendor[] {
  return SEED_VENDORS;
}
