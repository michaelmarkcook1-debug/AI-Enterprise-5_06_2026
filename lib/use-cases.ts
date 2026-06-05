// Enterprise AI workflow taxonomy.
// ─────────────────────────────────
// The source of truth for the workflows a buyer can select inside the
// Assessment. The original v1 of this list was 10 entries — this v2
// expands it to 60+ workflows organised by industry-function category
// so the Guided and Advanced assessment tiers can offer the depth
// procurement teams expect, while the Quick tier still presents a
// curated short list.
//
// Backwards compatibility: every v1 id (knowledge_assistant,
// customer_service_agent, code_assistant, contract_review, etc.) is
// preserved verbatim so existing assessments, saved shortlists, and
// the assessment-adapter USE_CASE_MAP fallback continue to resolve.
//
// Extending the schema:
//   - `tier`: which assessment depth surfaces this workflow.
//       quick    → 12 most common horizontal workflows
//       guided   → ~30 covering the main functions
//       advanced → everything
//   - `industries`: industry archetypes where the workflow is common.
//       Empty array = horizontal (relevant to all industries).
//   - `commonInputs`: short tags describing the data the workflow
//       ingests — feeds the dynamic data-sensitivity weighting.
//   - `regulatoryFlags`: regulatory regimes that typically apply.
//       Used by the risk engine to raise reliability requirements
//       and trigger "controlled deployment" bands when relevant.
//   - `complexity`: simple | moderate | complex. Used by the
//       autonomy/maturity scoring.
//   - `subcategory`: optional finer grouping inside `category` for
//       the AssessForm collapsible UI.

export type WorkflowTier = "quick" | "guided" | "advanced";
export type WorkflowComplexity = "simple" | "moderate" | "complex";

export type RegulatoryFlag =
  | "GDPR"
  | "CCPA"
  | "HIPAA"
  | "SOX"
  | "PCI_DSS"
  | "FINRA"
  | "MiFID_II"
  | "BASEL_III"
  | "FERPA"
  | "ITAR"
  | "EU_AI_Act"
  | "SOC2"
  | "ISO_27001"
  | "FDA_21CFR11";

export type IndustryTag =
  | "financial_services"
  | "healthcare"
  | "pharma_life_sciences"
  | "legal"
  | "professional_services"
  | "technology_software"
  | "manufacturing"
  | "retail_consumer"
  | "telecom_media"
  | "public_sector"
  | "education"
  | "energy_utilities"
  | "transport_logistics"
  | "insurance"
  | "real_estate";

export interface UseCase {
  id: string;
  label: string;
  riskTier: "low" | "medium" | "high" | "critical";
  reliabilityRequirement: number; // 1-5
  autonomyDefault: "advisory_only" | "human_in_loop" | "supervised_agent";
  category: string;
  // v2 fields — all optional so older tests that construct a UseCase
  // by positional sense continue to work. New code reads these via
  // helper accessors below that default sensibly when undefined.
  description?: string;
  tier?: WorkflowTier;
  subcategory?: string;
  industries?: IndustryTag[];
  commonInputs?: string[];
  regulatoryFlags?: RegulatoryFlag[];
  complexity?: WorkflowComplexity;
}

/**
 * Helper to read a use case's tier, defaulting unmarked entries to the
 * narrowest tier so they always surface in Advanced and gate up from
 * there when the schema is extended.
 */
export function workflowTierOf(uc: UseCase): WorkflowTier {
  return uc.tier ?? "advanced";
}

export function workflowsForTier(tier: WorkflowTier): UseCase[] {
  // tier ordering: quick ⊂ guided ⊂ advanced.
  const allow: Record<WorkflowTier, WorkflowTier[]> = {
    quick: ["quick"],
    guided: ["quick", "guided"],
    advanced: ["quick", "guided", "advanced"],
  };
  const allowed = new Set(allow[tier]);
  return USE_CASES.filter((u) => allowed.has(workflowTierOf(u)));
}

/**
 * Group workflows by category for the AssessForm collapsible UI.
 * Preserves the insertion order inside each category so a curated
 * "most common first" ordering can be authored in this file.
 */
export function workflowsByCategory(workflows: UseCase[]): Map<string, UseCase[]> {
  const map = new Map<string, UseCase[]>();
  for (const uc of workflows) {
    const bucket = map.get(uc.category) ?? [];
    bucket.push(uc);
    map.set(uc.category, bucket);
  }
  return map;
}

export const USE_CASES: UseCase[] = [
  // ─── Productivity & Knowledge ──────────────────────────────────
  {
    id: "knowledge_assistant",
    label: "Knowledge Assistant / Internal Search",
    riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "advisory_only",
    category: "Productivity", subcategory: "Knowledge",
    description: "Answer questions over internal docs, wikis, and KBs with citations.",
    tier: "quick", industries: [],
    commonInputs: ["wiki pages", "PDFs", "Sharepoint", "Confluence"],
    regulatoryFlags: ["GDPR"], complexity: "simple",
  },
  {
    id: "meeting_assistant",
    label: "Meeting Notes & Action Tracker",
    riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "advisory_only",
    category: "Productivity", subcategory: "Knowledge",
    description: "Transcribe meetings, extract action items, route follow-ups.",
    tier: "quick", industries: [],
    commonInputs: ["audio", "calendar invites", "transcripts"],
    regulatoryFlags: ["GDPR"], complexity: "moderate",
  },
  {
    id: "executive_briefing",
    label: "Executive Briefing Pack Generator",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Productivity", subcategory: "Knowledge",
    description: "Synthesise market + internal data into board-ready briefings.",
    tier: "guided", industries: [],
    commonInputs: ["news", "internal reports", "CRM data"],
    regulatoryFlags: ["GDPR", "SOX"], complexity: "complex",
  },
  {
    id: "policy_qa",
    label: "Policy & Compliance Q&A",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Productivity", subcategory: "Knowledge",
    description: "Employee-facing assistant for HR / IT / compliance policy questions.",
    tier: "guided", industries: [],
    commonInputs: ["HR handbook", "compliance policies", "SOX manuals"],
    regulatoryFlags: ["GDPR", "SOX"], complexity: "moderate",
  },
  {
    id: "translation_localisation",
    label: "Translation & Document Localisation",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Productivity", subcategory: "Knowledge",
    description: "Translate marketing copy, contracts, and product docs across locales.",
    tier: "advanced", industries: [],
    commonInputs: ["source documents", "term glossaries"],
    regulatoryFlags: ["GDPR"], complexity: "moderate",
  },

  // ─── Customer Operations ───────────────────────────────────────
  {
    id: "customer_service_agent",
    label: "Customer Service Agent",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Customer", subcategory: "Service",
    description: "Resolve customer queries with guardrails and human escalation.",
    tier: "quick", industries: [],
    commonInputs: ["customer profile", "order history", "support KB"],
    regulatoryFlags: ["GDPR", "CCPA"], complexity: "complex",
  },
  {
    id: "tier1_triage",
    label: "Tier-1 Ticket Triage & Routing",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Customer", subcategory: "Service",
    description: "Classify, prioritise, and route inbound tickets to the right queue.",
    tier: "guided", industries: [],
    commonInputs: ["ticket text", "customer tier", "SLA matrix"],
    regulatoryFlags: ["GDPR"], complexity: "moderate",
  },
  {
    id: "agent_assist",
    label: "Live Agent Assist (real-time)",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Customer", subcategory: "Service",
    description: "Whisper suggested replies + KB articles to live human agents.",
    tier: "guided", industries: [],
    commonInputs: ["live transcript", "KB", "policy snippets"],
    regulatoryFlags: ["GDPR", "PCI_DSS"], complexity: "complex",
  },
  {
    id: "voice_ivr",
    label: "Voice IVR / Conversational Phone",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Customer", subcategory: "Service",
    description: "Replace touch-tone IVR with natural conversation routing.",
    tier: "advanced", industries: ["telecom_media", "financial_services", "insurance"],
    commonInputs: ["audio", "caller intent", "account state"],
    regulatoryFlags: ["GDPR", "PCI_DSS", "HIPAA"], complexity: "complex",
  },
  {
    id: "voice_of_customer",
    label: "Voice-of-Customer & CSAT Analysis",
    riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "advisory_only",
    category: "Customer", subcategory: "Insight",
    description: "Mine support transcripts, reviews, and surveys for themes.",
    tier: "guided", industries: [],
    commonInputs: ["support tickets", "G2 reviews", "NPS surveys"],
    regulatoryFlags: ["GDPR"], complexity: "moderate",
  },
  {
    id: "churn_prediction",
    label: "Churn Prediction & Retention Triggers",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Customer", subcategory: "Insight",
    description: "Score account churn risk and trigger retention plays.",
    tier: "advanced", industries: ["technology_software", "telecom_media", "insurance"],
    commonInputs: ["usage telemetry", "billing", "support history"],
    regulatoryFlags: ["GDPR"], complexity: "complex",
  },

  // ─── Sales & Marketing ────────────────────────────────────────
  {
    id: "sales_research",
    label: "Sales / Account Research",
    riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "advisory_only",
    category: "Revenue", subcategory: "Sales",
    description: "Pre-call account briefs from public sources + CRM data.",
    tier: "quick", industries: [],
    commonInputs: ["LinkedIn", "news", "10-Ks", "CRM"],
    regulatoryFlags: ["GDPR"], complexity: "simple",
  },
  {
    id: "lead_qualification",
    label: "Inbound Lead Qualification & Enrichment",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Revenue", subcategory: "Sales",
    description: "Score and enrich inbound leads, route to right seller.",
    tier: "guided", industries: [],
    commonInputs: ["form submissions", "firmographics", "intent signals"],
    regulatoryFlags: ["GDPR", "CCPA"], complexity: "moderate",
  },
  {
    id: "outbound_personalisation",
    label: "Outbound Email Personalisation",
    riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "human_in_loop",
    category: "Revenue", subcategory: "Sales",
    description: "Draft hyper-personalised cold emails grounded in account research.",
    tier: "guided", industries: [],
    commonInputs: ["account brief", "buying signals", "messaging library"],
    regulatoryFlags: ["GDPR", "CCPA"], complexity: "moderate",
  },
  {
    id: "rfp_proposal",
    label: "RFP / Proposal Response",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Revenue", subcategory: "Sales",
    description: "Draft RFP responses using approved language and case library.",
    tier: "advanced", industries: [],
    commonInputs: ["RFP document", "answer library", "case studies"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "complex",
  },
  {
    id: "marketing_content",
    label: "Marketing Content Generation",
    riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "human_in_loop",
    category: "Revenue", subcategory: "Marketing",
    description: "Draft blogs, landing copy, social posts on-brand.",
    tier: "quick", industries: [],
    commonInputs: ["brand voice guide", "topic brief", "SEO keywords"],
    regulatoryFlags: ["GDPR"], complexity: "simple",
  },
  {
    id: "campaign_orchestration",
    label: "Multi-Channel Campaign Orchestration",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Revenue", subcategory: "Marketing",
    description: "Plan + execute campaigns across email, ads, social, web.",
    tier: "advanced", industries: [],
    commonInputs: ["audience segments", "creative assets", "channel performance"],
    regulatoryFlags: ["GDPR", "CCPA"], complexity: "complex",
  },
  {
    id: "competitive_intel",
    label: "Competitive Intelligence Monitoring",
    riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "advisory_only",
    category: "Revenue", subcategory: "Marketing",
    description: "Track competitor product, pricing, and messaging moves.",
    tier: "guided", industries: [],
    commonInputs: ["competitor websites", "press releases", "filings"],
    regulatoryFlags: [], complexity: "moderate",
  },
  {
    id: "pricing_optimisation",
    label: "Pricing Optimisation & Quote Discounting",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Revenue", subcategory: "Sales",
    description: "Recommend deal-specific discount levels using win/loss + margin data.",
    tier: "advanced", industries: ["technology_software", "manufacturing", "retail_consumer"],
    commonInputs: ["historical deals", "margin floors", "competitive quotes"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },

  // ─── Engineering & DevOps ─────────────────────────────────────
  {
    id: "code_assistant",
    label: "Code Assistant / Developer Productivity",
    riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "human_in_loop",
    category: "Engineering", subcategory: "IDE",
    description: "In-IDE completions, refactors, and test scaffolding.",
    tier: "quick", industries: [],
    commonInputs: ["source code", "diffs", "ticket context"],
    regulatoryFlags: ["SOC2"], complexity: "moderate",
  },
  {
    id: "code_review_agent",
    label: "Automated Code Review & PR Comments",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Engineering", subcategory: "Review",
    description: "Comment on PRs for style, security, and test coverage.",
    tier: "guided", industries: [],
    commonInputs: ["PR diff", "team coding standards", "CI results"],
    regulatoryFlags: ["SOC2"], complexity: "moderate",
  },
  {
    id: "incident_response",
    label: "Incident Response & Runbook Execution",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Engineering", subcategory: "Operations",
    description: "Diagnose incidents, propose runbook steps, draft postmortems.",
    tier: "advanced", industries: [],
    commonInputs: ["alerts", "logs", "metrics", "runbooks"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "complex",
  },
  {
    id: "log_analysis",
    label: "Log & Telemetry Analysis",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Engineering", subcategory: "Operations",
    description: "Surface anomalies and root causes from observability data.",
    tier: "advanced", industries: [],
    commonInputs: ["application logs", "traces", "metrics"],
    regulatoryFlags: ["SOC2"], complexity: "moderate",
  },
  {
    id: "test_generation",
    label: "Test Case Generation",
    riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "human_in_loop",
    category: "Engineering", subcategory: "QA",
    description: "Generate unit, integration, and E2E tests from code + specs.",
    tier: "advanced", industries: [],
    commonInputs: ["source code", "API specs", "user stories"],
    regulatoryFlags: ["SOC2"], complexity: "moderate",
  },
  {
    id: "documentation_generator",
    label: "Engineering Documentation Generator",
    riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "human_in_loop",
    category: "Engineering", subcategory: "QA",
    description: "Draft API docs, README, and architecture diagrams from code.",
    tier: "advanced", industries: [],
    commonInputs: ["source code", "code comments"],
    regulatoryFlags: [], complexity: "simple",
  },
  {
    id: "vulnerability_triage",
    label: "Security Vulnerability Triage",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "Engineering", subcategory: "Security",
    description: "Score and de-duplicate vulnerability findings across scanners.",
    tier: "advanced", industries: [],
    commonInputs: ["scanner output", "CVE database", "asset inventory"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "complex",
  },

  // ─── Finance & Accounting ─────────────────────────────────────
  {
    id: "financial_analysis",
    label: "Financial Analysis & Reporting",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Finance", subcategory: "FP&A",
    description: "Variance analysis, scenario modelling, board-pack drafting.",
    tier: "quick", industries: [],
    commonInputs: ["GL", "budgets", "actuals", "operational drivers"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },
  {
    id: "ap_invoice_processing",
    label: "AP Invoice Processing & 3-Way Match",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Finance", subcategory: "AP/AR",
    description: "Extract invoice data, match POs and receipts, route exceptions.",
    tier: "guided", industries: [],
    commonInputs: ["invoice PDFs", "POs", "receipts", "vendor master"],
    regulatoryFlags: ["SOX"], complexity: "moderate",
  },
  {
    id: "ar_collections",
    label: "AR Collections & Dispute Resolution",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Finance", subcategory: "AP/AR",
    description: "Prioritise collections cases, draft customer dunning, log disputes.",
    tier: "advanced", industries: [],
    commonInputs: ["AR aging", "customer payment history", "dispute logs"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },
  {
    id: "month_end_close",
    label: "Month-End Close Automation",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Finance", subcategory: "Close",
    description: "Run reconciliation, flux analysis, and journal entry approvals.",
    tier: "advanced", industries: [],
    commonInputs: ["sub-ledgers", "reconciliations", "JE templates"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },
  {
    id: "expense_audit",
    label: "Expense Report Audit",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Finance", subcategory: "Controls",
    description: "Detect policy violations and duplicate claims in expense reports.",
    tier: "advanced", industries: [],
    commonInputs: ["expense reports", "receipts", "expense policy"],
    regulatoryFlags: ["SOX"], complexity: "moderate",
  },
  {
    id: "tax_research_assistant",
    label: "Tax Research Assistant",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "Finance", subcategory: "Tax",
    description: "Answer tax-treatment questions from regs, rulings, and prior memos.",
    tier: "advanced", industries: [],
    commonInputs: ["IRS code", "court rulings", "internal tax memos"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },

  // ─── HR & Talent ──────────────────────────────────────────────
  {
    id: "hr_helpdesk",
    label: "HR Helpdesk Assistant",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "HR", subcategory: "Operations",
    description: "Answer employee HR questions, file simple tickets, route the rest.",
    tier: "guided", industries: [],
    commonInputs: ["HRIS data", "benefits docs", "policy library"],
    regulatoryFlags: ["GDPR", "HIPAA"], complexity: "moderate",
  },
  {
    id: "resume_screening",
    label: "Resume Screening & Candidate Match",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "HR", subcategory: "Talent",
    description: "Score resumes against job criteria with bias mitigation.",
    tier: "advanced", industries: [],
    commonInputs: ["resumes", "JD", "rubrics"],
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "interview_assist",
    label: "Interview Question Generation & Notes",
    riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "advisory_only",
    category: "HR", subcategory: "Talent",
    description: "Generate role-specific question banks and synthesise feedback.",
    tier: "advanced", industries: [],
    commonInputs: ["job spec", "interview rubric", "panel notes"],
    regulatoryFlags: ["GDPR"], complexity: "simple",
  },
  {
    id: "onboarding_assistant",
    label: "Employee Onboarding Assistant",
    riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "human_in_loop",
    category: "HR", subcategory: "Operations",
    description: "Personalised onboarding plans, FAQ, and first-week checklists.",
    tier: "advanced", industries: [],
    commonInputs: ["role spec", "team handbook", "training catalog"],
    regulatoryFlags: ["GDPR"], complexity: "simple",
  },
  {
    id: "learning_recommender",
    label: "Personalised Learning Recommendations",
    riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "advisory_only",
    category: "HR", subcategory: "L&D",
    description: "Suggest courses and skills gaps from role + performance data.",
    tier: "advanced", industries: [],
    commonInputs: ["LMS history", "performance reviews", "skills taxonomy"],
    regulatoryFlags: ["GDPR"], complexity: "moderate",
  },

  // ─── Legal & Compliance ──────────────────────────────────────
  {
    id: "contract_review",
    label: "Contract & Document Review",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Legal", subcategory: "Contracts",
    description: "Redline contracts against playbooks, flag risky clauses.",
    tier: "quick", industries: [],
    commonInputs: ["draft contracts", "clause playbook", "precedent library"],
    regulatoryFlags: ["GDPR"], complexity: "complex",
  },
  {
    id: "ediscovery",
    label: "E-Discovery & Document Privilege Review",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Legal", subcategory: "Litigation",
    description: "Cluster documents, score relevance and privilege.",
    tier: "advanced", industries: ["legal", "financial_services"],
    commonInputs: ["email archives", "documents", "production sets"],
    regulatoryFlags: ["GDPR"], complexity: "complex",
  },
  {
    id: "regulatory_change_monitor",
    label: "Regulatory Change Monitoring",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "Legal", subcategory: "Compliance",
    description: "Detect new rules and assess applicability to the business.",
    tier: "guided", industries: [],
    commonInputs: ["regulator feeds", "policy register", "business operations map"],
    regulatoryFlags: ["GDPR", "EU_AI_Act", "SOX"], complexity: "complex",
  },
  {
    id: "compliance_attestations",
    label: "Compliance Attestation & Evidence Gathering",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Legal", subcategory: "Compliance",
    description: "Collect evidence for SOC2 / ISO27001 / SOX testing cycles.",
    tier: "advanced", industries: [],
    commonInputs: ["control matrix", "system exports", "ticket history"],
    regulatoryFlags: ["SOC2", "ISO_27001", "SOX"], complexity: "complex",
  },
  {
    id: "third_party_risk",
    label: "Third-Party Vendor Risk Assessment",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Legal", subcategory: "Compliance",
    description: "Review vendor SOC2 / DPAs and score residual risk.",
    tier: "advanced", industries: [],
    commonInputs: ["SOC2 reports", "DPAs", "vendor questionnaires"],
    regulatoryFlags: ["GDPR", "SOC2"], complexity: "moderate",
  },
  {
    id: "ip_landscape",
    label: "IP Landscape & Patent Search",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Legal", subcategory: "IP",
    description: "Search patent corpora and synthesise prior art landscapes.",
    tier: "advanced", industries: ["technology_software", "pharma_life_sciences", "manufacturing"],
    commonInputs: ["USPTO/EPO data", "tech briefs", "claim charts"],
    regulatoryFlags: [], complexity: "complex",
  },

  // ─── Operations & Supply Chain ────────────────────────────────
  {
    id: "operations_automation",
    label: "Back-Office Operations Automation",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Operations", subcategory: "BPM",
    description: "Replace manual swivel-chair tasks with end-to-end automation.",
    tier: "quick", industries: [],
    commonInputs: ["process specs", "system APIs", "exception logs"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },
  {
    id: "demand_forecasting",
    label: "Demand Forecasting",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Operations", subcategory: "Supply Chain",
    description: "Forecast SKU-level demand, plug into S&OP.",
    tier: "advanced", industries: ["retail_consumer", "manufacturing", "transport_logistics"],
    commonInputs: ["sales history", "promotions", "weather", "macro indices"],
    regulatoryFlags: [], complexity: "complex",
  },
  {
    id: "procurement_negotiation",
    label: "Procurement Negotiation Assistant",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Operations", subcategory: "Procurement",
    description: "Draft negotiation strategies and counter-offer language.",
    tier: "advanced", industries: [],
    commonInputs: ["category benchmarks", "supplier history", "contract terms"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },
  {
    id: "supplier_risk",
    label: "Supplier Risk & Resilience Monitoring",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Operations", subcategory: "Supply Chain",
    description: "Track supplier disruptions from news + financial signals.",
    tier: "advanced", industries: ["manufacturing", "retail_consumer", "transport_logistics"],
    commonInputs: ["supplier financials", "news feeds", "shipment data"],
    regulatoryFlags: [], complexity: "moderate",
  },
  {
    id: "field_dispatch",
    label: "Field-Service Dispatch Optimisation",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Operations", subcategory: "Field Service",
    description: "Optimise technician routing using skills, SLAs, and traffic.",
    tier: "advanced", industries: ["energy_utilities", "telecom_media", "manufacturing"],
    commonInputs: ["work orders", "technician skills", "GPS feeds"],
    regulatoryFlags: [], complexity: "complex",
  },

  // ─── Data & Analytics ────────────────────────────────────────
  {
    id: "data_analysis",
    label: "Data Analysis & BI Copilot",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Data", subcategory: "BI",
    description: "Conversational BI over warehouse data with self-serve answers.",
    tier: "quick", industries: [],
    commonInputs: ["warehouse tables", "semantic layer", "dashboards"],
    regulatoryFlags: ["GDPR", "SOX"], complexity: "complex",
  },
  {
    id: "text_to_sql",
    label: "Text-to-SQL / Self-Serve Query",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Data", subcategory: "BI",
    description: "Generate SQL from natural language with safe access scopes.",
    tier: "guided", industries: [],
    commonInputs: ["schema metadata", "RLS policies", "query history"],
    regulatoryFlags: ["GDPR", "SOX"], complexity: "moderate",
  },
  {
    id: "data_quality_monitor",
    label: "Data Quality & Pipeline Monitor",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Data", subcategory: "Engineering",
    description: "Surface anomalies, schema drift, and freshness issues.",
    tier: "advanced", industries: [],
    commonInputs: ["pipeline metrics", "table stats", "lineage graph"],
    regulatoryFlags: ["SOC2"], complexity: "moderate",
  },
  {
    id: "ml_feature_engineering",
    label: "ML Feature Engineering Copilot",
    riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "human_in_loop",
    category: "Data", subcategory: "ML",
    description: "Suggest features from raw tables, evaluate predictive power.",
    tier: "advanced", industries: [],
    commonInputs: ["table samples", "target variable", "model registry"],
    regulatoryFlags: [], complexity: "complex",
  },
  {
    id: "kpi_anomaly_explanation",
    label: "KPI Anomaly Detection & Root-Cause",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Data", subcategory: "BI",
    description: "Detect KPI breaks and propose contributing dimensions.",
    tier: "advanced", industries: [],
    commonInputs: ["metric stores", "dimension tables", "campaign calendars"],
    regulatoryFlags: [], complexity: "moderate",
  },

  // ─── IT & Security ───────────────────────────────────────────
  {
    id: "itsm_agent",
    label: "IT Service Management Agent",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "IT", subcategory: "ITSM",
    description: "Resolve password resets, access requests, and tier-1 tickets.",
    tier: "guided", industries: [],
    commonInputs: ["ITSM tool", "identity directory", "knowledge base"],
    regulatoryFlags: ["SOC2"], complexity: "moderate",
  },
  {
    id: "endpoint_security_triage",
    label: "Endpoint Security Alert Triage",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "IT", subcategory: "Security",
    description: "Score EDR/SIEM alerts, suggest containment, draft tickets.",
    tier: "advanced", industries: [],
    commonInputs: ["SIEM logs", "EDR alerts", "threat intel"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "complex",
  },
  {
    id: "soc_analyst_assist",
    label: "SOC Analyst Investigation Copilot",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "IT", subcategory: "Security",
    description: "Summarise alerts, query data lake, link related incidents.",
    tier: "advanced", industries: [],
    commonInputs: ["SIEM", "data lake", "case management"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "complex",
  },
  {
    id: "identity_access_review",
    label: "Identity & Access Review",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "IT", subcategory: "Security",
    description: "Quarterly access reviews — flag over-privileged accounts.",
    tier: "advanced", industries: [],
    commonInputs: ["IDP exports", "role matrix", "termination logs"],
    regulatoryFlags: ["SOX", "SOC2"], complexity: "moderate",
  },
  {
    id: "phishing_response",
    label: "Phishing Report Triage & Response",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "IT", subcategory: "Security",
    description: "Classify reported emails, quarantine, brief affected users.",
    tier: "advanced", industries: [],
    commonInputs: ["reported emails", "threat intel", "mailbox APIs"],
    regulatoryFlags: ["SOC2"], complexity: "moderate",
  },

  // ─── Healthcare ──────────────────────────────────────────────
  {
    id: "clinical_decision_support",
    label: "Clinical Decision Support",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Health", subcategory: "Clinical",
    description: "Suggest differentials, dosing, and care-path next steps for clinicians.",
    tier: "quick", industries: ["healthcare"],
    commonInputs: ["EHR notes", "lab results", "clinical guidelines"],
    regulatoryFlags: ["HIPAA", "FDA_21CFR11", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "medical_coding",
    label: "Medical Coding & Charge Capture",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Health", subcategory: "RCM",
    description: "Suggest ICD-10 / CPT codes from clinical notes.",
    tier: "advanced", industries: ["healthcare"],
    commonInputs: ["clinical notes", "code books", "payer rules"],
    regulatoryFlags: ["HIPAA", "SOX"], complexity: "complex",
  },
  {
    id: "prior_authorisation",
    label: "Prior Authorisation Drafting",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Health", subcategory: "RCM",
    description: "Draft prior-auth letters with the right clinical evidence.",
    tier: "advanced", industries: ["healthcare", "insurance"],
    commonInputs: ["clinical notes", "payer policies", "precedent letters"],
    regulatoryFlags: ["HIPAA"], complexity: "complex",
  },
  {
    id: "patient_intake",
    label: "Patient Intake & Symptom Triage",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Health", subcategory: "Patient",
    description: "Collect symptoms and route to right care pathway.",
    tier: "advanced", industries: ["healthcare"],
    commonInputs: ["symptom checker", "EHR scheduling", "triage protocol"],
    regulatoryFlags: ["HIPAA", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "pharmacovigilance",
    label: "Pharmacovigilance Case Processing",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Health", subcategory: "Pharma",
    description: "Process adverse-event reports, code per MedDRA, draft narratives.",
    tier: "advanced", industries: ["pharma_life_sciences"],
    commonInputs: ["case reports", "MedDRA dictionary", "regulatory templates"],
    regulatoryFlags: ["FDA_21CFR11", "HIPAA"], complexity: "complex",
  },

  // ─── Financial Services ──────────────────────────────────────
  {
    id: "kyc_aml",
    label: "KYC / AML Customer Due Diligence",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Financial Services", subcategory: "Compliance",
    description: "Verify identity, screen sanctions/PEP, document risk score.",
    tier: "advanced", industries: ["financial_services", "insurance"],
    commonInputs: ["customer ID docs", "sanctions lists", "transaction history"],
    regulatoryFlags: ["FINRA", "BASEL_III", "GDPR"], complexity: "complex",
  },
  {
    id: "fraud_detection",
    label: "Transaction Fraud Detection",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Financial Services", subcategory: "Risk",
    description: "Real-time scoring of card and payment transactions.",
    tier: "advanced", industries: ["financial_services", "retail_consumer"],
    commonInputs: ["transaction stream", "device fingerprint", "behaviour history"],
    regulatoryFlags: ["PCI_DSS", "FINRA"], complexity: "complex",
  },
  {
    id: "credit_underwriting",
    label: "Credit Underwriting Decision Support",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Financial Services", subcategory: "Lending",
    description: "Score loan applications with explainable factor breakdowns.",
    tier: "advanced", industries: ["financial_services", "insurance"],
    commonInputs: ["credit bureau", "application data", "alternative data"],
    regulatoryFlags: ["BASEL_III", "EU_AI_Act", "GDPR"], complexity: "complex",
  },
  {
    id: "trade_surveillance",
    label: "Trade Surveillance",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "Financial Services", subcategory: "Risk",
    description: "Detect market abuse patterns in trading + comms data.",
    tier: "advanced", industries: ["financial_services"],
    commonInputs: ["order book", "trade fills", "chat/voice"],
    regulatoryFlags: ["MiFID_II", "FINRA"], complexity: "complex",
  },
  {
    id: "claims_processing",
    label: "Insurance Claims Processing",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Financial Services", subcategory: "Insurance",
    description: "Triage claims, summarise evidence, suggest reserve.",
    tier: "advanced", industries: ["insurance"],
    commonInputs: ["FNOL form", "policy data", "photos/videos"],
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "complex",
  },

  // ─── Public Sector & Education ───────────────────────────────
  {
    id: "constituent_services",
    label: "Constituent / Citizen Service Assistant",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Public Sector", subcategory: "Service",
    description: "Answer citizen queries on benefits, permits, and services.",
    tier: "advanced", industries: ["public_sector"],
    commonInputs: ["policy library", "service catalog", "case management"],
    regulatoryFlags: ["GDPR"], complexity: "complex",
  },
  {
    id: "grant_review",
    label: "Grant & Benefits Application Review",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Public Sector", subcategory: "Service",
    description: "Review applications against eligibility criteria with audit trail.",
    tier: "advanced", industries: ["public_sector"],
    commonInputs: ["application forms", "eligibility rules", "supporting evidence"],
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "tutoring_assistant",
    label: "Student Tutoring Assistant",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Education", subcategory: "Learning",
    description: "Subject-matter tutoring with curriculum alignment.",
    tier: "advanced", industries: ["education"],
    commonInputs: ["curriculum", "lesson plans", "student work"],
    regulatoryFlags: ["FERPA", "GDPR"], complexity: "moderate",
  },
  {
    id: "research_synthesis",
    label: "Academic Research Synthesis",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Education", subcategory: "Research",
    description: "Literature review, citation extraction, and outline drafting.",
    tier: "advanced", industries: ["education", "pharma_life_sciences"],
    commonInputs: ["academic papers", "preprint servers", "institutional repo"],
    regulatoryFlags: [], complexity: "moderate",
  },

  // ─── Manufacturing ───────────────────────────────────────────
  {
    id: "predictive_maintenance",
    label: "Predictive Maintenance",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Manufacturing", subcategory: "Operations",
    description: "Predict equipment failure from telemetry and maintenance logs.",
    tier: "advanced", industries: ["manufacturing", "energy_utilities", "transport_logistics"],
    commonInputs: ["sensor streams", "maintenance history", "asset registry"],
    regulatoryFlags: ["ISO_27001"], complexity: "complex",
  },
  {
    id: "quality_inspection",
    label: "Visual Quality Inspection",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Manufacturing", subcategory: "Quality",
    description: "Computer-vision-based defect detection on production lines.",
    tier: "advanced", industries: ["manufacturing", "pharma_life_sciences"],
    commonInputs: ["camera feeds", "defect taxonomy", "spec sheets"],
    regulatoryFlags: ["FDA_21CFR11", "ISO_27001"], complexity: "complex",
  },
  {
    id: "shop_floor_assist",
    label: "Shop-Floor Operator Assistant",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Manufacturing", subcategory: "Operations",
    description: "SOP guidance, troubleshooting, and shift handover summaries.",
    tier: "advanced", industries: ["manufacturing"],
    commonInputs: ["SOPs", "machine state", "shift logs"],
    regulatoryFlags: [], complexity: "moderate",
  },
];

export const PRIMARY_OBJECTIVES = [
  { id: "productivity", label: "Workforce productivity uplift" },
  { id: "cost_reduction", label: "Cost reduction / automation" },
  { id: "revenue_growth", label: "Revenue growth / customer experience" },
  { id: "compliance", label: "Risk and compliance modernisation" },
  { id: "innovation", label: "New product / new market entry" },
  { id: "data_intelligence", label: "Data intelligence and decision support" },
  { id: "customer_experience", label: "Customer experience transformation" },
  { id: "talent_optimization", label: "Talent acquisition + retention uplift" },
  { id: "supply_chain", label: "Supply-chain resilience + visibility" },
  { id: "security_posture", label: "Security posture + threat reduction" },
];

export const ECOSYSTEMS = [
  "microsoft", "google_workspace", "salesforce", "aws", "azure", "gcp",
  "databricks", "snowflake", "servicenow", "sap", "oracle", "atlassian", "workday",
];
