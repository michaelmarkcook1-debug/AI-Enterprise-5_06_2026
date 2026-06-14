// Decision Intelligence seed data.
// ────────────────────────────────
// Curated examples for the Board Defence Framework, Monitor, and
// Assess surfaces. All clearly labelled as estimated/seed.

import type {
  BoardAssumption,
  BusinessCase,
  CompetitorProfile,
  EnterpriseRisk,
  KPI,
} from "./types";

export const SEED_BUSINESS_CASE: BusinessCase = {
  businessProblem: "Manual knowledge work, customer operations, and software delivery consume disproportionate headcount cost with inconsistent quality and speed.",
  intendedOutcomes: [
    "Automate 30–40% of Tier-1 customer service volume",
    "Accelerate software delivery velocity by 25%",
    "Reduce knowledge-worker research time by 50%",
    "Improve customer response quality and consistency",
  ],
  productivityImpact: "15–30% productivity uplift across targeted workflows within 12 months",
  costReductionPotential: "10–20% operating cost reduction in targeted functions",
  revenuePotential: "Indirect — faster time-to-market, improved customer retention, reduced churn",
  cxExImpact: "Measurable improvement in response time, first-contact resolution, and employee satisfaction",
  confidence: 65,
  evidenceGrade: "E2",
  status: "estimated",
};

export const SEED_COMPETITOR_PROFILES: CompetitorProfile[] = [
  {
    peer: "Tier-1 banking peer group",
    maturity: "Advanced",
    useCases: ["Customer service automation", "Software engineering", "Risk operations", "KYC/AML"],
    knownVendors: ["Microsoft", "OpenAI", "ServiceNow"],
    implication: "Delaying AI workflow automation increases operating-model gap. Peers already scaling beyond pilot.",
  },
  {
    peer: "Big-4 consulting peer group",
    maturity: "Scaling",
    useCases: ["Research synthesis", "Proposal generation", "Code review", "Client briefings"],
    knownVendors: ["Anthropic", "Microsoft", "Google"],
    implication: "Professional services competitors gaining delivery efficiency. Talent attraction shifting to AI-enabled firms.",
  },
  {
    peer: "Enterprise SaaS peer group",
    maturity: "Piloting",
    useCases: ["Customer support", "Content generation", "Data analysis"],
    knownVendors: ["OpenAI", "Anthropic"],
    implication: "Early-mover advantage still available. Window narrows as platform vendors bundle AI capabilities.",
  },
  {
    peer: "Insurance sector peer group",
    maturity: "Exploring",
    useCases: ["Claims processing", "Underwriting support", "Document review"],
    knownVendors: ["IBM watsonx", "Microsoft"],
    implication: "Sector still early. Opportunity to leapfrog with well-governed deployment.",
  },
];

export const SEED_ENTERPRISE_RISKS: EnterpriseRisk[] = [
  { id: "r1", risk: "Sensitive data leakage via LLM prompts", category: "Data & Privacy", severity: "High", likelihood: "Medium", mitigation: "DLP integration, prompt filtering, no PII in prompts policy", owner: "CISO", status: "Monitoring" },
  { id: "r2", risk: "Model hallucination in customer-facing workflows", category: "Model Risk", severity: "High", likelihood: "High", mitigation: "Human-in-the-loop review, confidence thresholds, citation requirements", owner: "AI CoE", status: "Open" },
  { id: "r3", risk: "EU AI Act compliance failure for high-risk use cases", category: "Regulatory", severity: "Critical", likelihood: "Medium", mitigation: "Use-case risk classification, audit trails, conformity assessment", owner: "Legal", status: "Open" },
  { id: "r4", risk: "Single-vendor model dependency", category: "Vendor Risk", severity: "Medium", likelihood: "High", mitigation: "Multi-model architecture, abstraction layer, contract exit clauses", owner: "CTO", status: "Monitoring" },
  { id: "r5", risk: "Token cost explosion at scale", category: "Cost", severity: "Medium", likelihood: "Medium", mitigation: "Usage monitoring, caching, model routing by complexity, budget caps", owner: "CFO", status: "Monitoring" },
  { id: "r6", risk: "Employee resistance to AI-augmented workflows", category: "Adoption", severity: "Medium", likelihood: "High", mitigation: "Change management programme, training, early-adopter champions", owner: "CHRO", status: "Open" },
  { id: "r7", risk: "Integration failure with legacy systems", category: "Integration", severity: "Medium", likelihood: "Medium", mitigation: "API-first architecture, staged rollout, fallback processes", owner: "CTO", status: "Open" },
  { id: "r8", risk: "Vendor acquisition changes product roadmap", category: "Vendor Risk", severity: "Medium", likelihood: "Low", mitigation: "Diversified shortlist, contract protections, exit clause review", owner: "Procurement", status: "Monitoring" },
  { id: "r9", risk: "Concentration of AI spend on single cloud provider", category: "Concentration", severity: "Medium", likelihood: "Medium", mitigation: "Multi-cloud strategy, portable workloads, avoid cloud-specific lock-in", owner: "CTO", status: "Open" },
  { id: "r10", risk: "Reputational damage from AI error in public-facing service", category: "Reputation", severity: "High", likelihood: "Low", mitigation: "Staged rollout, monitoring, incident response plan, insurance", owner: "CEO", status: "Monitoring" },
];

export const SEED_RISK_MITIGATIONS = [
  { control: "Human-in-the-loop approval", description: "All high-risk outputs reviewed by qualified human before action", status: "Recommended" },
  { control: "Audit trail logging", description: "Every AI interaction logged with input/output, model version, and user context", status: "Recommended" },
  { control: "Policy-based access control", description: "Role-based permissions for AI tool access; sensitive workflows restricted", status: "Recommended" },
  { control: "Red teaming programme", description: "Regular adversarial testing of AI outputs for bias, hallucination, and security", status: "Planned" },
  { control: "Data Loss Prevention (DLP)", description: "Automated scanning of prompts for PII, credentials, and sensitive data", status: "Recommended" },
  { control: "Fallback process documentation", description: "Manual fallback for every AI-augmented workflow; tested quarterly", status: "Planned" },
  { control: "Vendor exit clause", description: "Contractual data portability and exit provisions in every AI vendor agreement", status: "Recommended" },
  { control: "Model diversification", description: "Architecture supports swapping underlying model without workflow redesign", status: "Recommended" },
  { control: "Monitoring and alerting", description: "Real-time monitoring of model performance, cost, latency, and error rate", status: "Planned" },
];

export const SEED_KPIS: KPI[] = [
  { metric: "Customer response time", baseline: "4.2 hours average", target: "< 30 minutes", owner: "VP Customer Success", cadence: "Weekly", method: "CRM analytics" },
  { metric: "Ticket deflection rate", baseline: "12%", target: "> 40%", owner: "VP Customer Success", cadence: "Monthly", method: "Support platform metrics" },
  { metric: "Software delivery velocity", baseline: "2.1 deploys/week", target: "> 5 deploys/week", owner: "VP Engineering", cadence: "Weekly", method: "CI/CD pipeline metrics" },
  { metric: "Cost per customer interaction", baseline: "$8.40", target: "< $3.50", owner: "CFO", cadence: "Monthly", method: "Finance reporting" },
  { metric: "Employee AI adoption rate", baseline: "5%", target: "> 60%", owner: "CHRO", cadence: "Quarterly", method: "Usage telemetry" },
  { metric: "Error rate in AI-assisted workflows", baseline: "N/A (new)", target: "< 2%", owner: "AI CoE", cadence: "Weekly", method: "Quality sampling" },
];

export const SEED_BOARD_ASSUMPTIONS: BoardAssumption[] = [
  {
    id: "ba1", title: "Frontier model capability continues improving",
    description: "The assumption that model quality, speed, and cost-efficiency improve annually, justifying investment now rather than waiting.",
    linkedVendorIds: ["openai", "anthropic", "google"],
    status: "Stable", failureTrigger: "Model improvement plateau or major capability regression",
    currentSignal: "GPT-5.x, Claude 4.x, Gemini 3.x all show significant year-over-year improvement",
    recommendedAction: "Continue monitoring frontier model benchmarks", confidence: 85, evidenceGrade: "E3",
  },
  {
    id: "ba2", title: "Enterprise AI pricing remains stable or declines",
    description: "Current pricing trajectory suggests token costs will decline, improving ROI over the contract period.",
    linkedVendorIds: ["openai", "anthropic", "google", "mistral"],
    status: "Stable", failureTrigger: "Major price increase or removal of batch/caching discounts",
    currentSignal: "All major vendors have reduced pricing in the last 12 months",
    recommendedAction: "Lock in pricing commitments where possible", confidence: 75, evidenceGrade: "E2",
  },
  {
    id: "ba3", title: "Harvey retains legal workflow differentiation",
    description: "The assumption that specialist legal AI vendors maintain advantage over frontier-model general capability.",
    linkedVendorIds: ["harvey"],
    status: "Watch", failureTrigger: "Anthropic or OpenAI launches native legal workflow agents with document review and matter management",
    currentSignal: "Frontier models increasingly capable at legal reasoning; no native workflow product yet",
    recommendedAction: "Reassess legal AI stack if frontier vendor launches legal-specific product", confidence: 55, evidenceGrade: "E2",
  },
  {
    id: "ba4", title: "EU AI Act compliance timeline holds",
    description: "Implementation proceeds on the published timeline without accelerated enforcement or scope expansion.",
    linkedVendorIds: [],
    status: "Stable", failureTrigger: "Accelerated enforcement or broadened scope of high-risk classification",
    currentSignal: "Implementation proceeding on published timeline",
    recommendedAction: "Monitor regulatory gazette and vendor compliance statements", confidence: 70, evidenceGrade: "E2",
  },
  {
    id: "ba5", title: "GPU supply normalises within 12 months",
    description: "AI infrastructure capacity constraints ease, reducing cost pressure and deployment delays.",
    linkedVendorIds: ["nvidia"],
    status: "At Risk", failureTrigger: "Extended NVIDIA supply constraints or export control escalation",
    currentSignal: "Geopolitical tension and demand growth continue to pressure supply",
    recommendedAction: "Evaluate multi-cloud inference and alternative hardware strategies", confidence: 45, evidenceGrade: "E2",
  },
];
