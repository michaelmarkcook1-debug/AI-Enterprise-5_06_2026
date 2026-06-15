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

import type { IndustryArchetype } from "./types";

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
  | "FDA_21CFR11"
  // v1.3 — defence / critical-infrastructure regimes (FY2026 NDAA folds an
  // AI/ML framework into CMMC/DFARS; NERC CIP governs grid OT; IEC 62443
  // governs industrial control systems; FedRAMP gates US federal cloud).
  | "CMMC"
  | "NIST_800_171"
  | "NERC_CIP"
  | "IEC_62443"
  | "FedRAMP";

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
  | "real_estate"
  // v1.3 — the 15-tag set had no defence tag, so the
  // critical_infrastructure_defence archetype could not be addressed.
  | "aerospace_defence";

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
  /**
   * v1.3 — direct engine-archetype targeting. New industry-specific
   * workflows set this so they surface for the archetype the buyer picks,
   * without needing the 15-tag taxonomy to carry the signal. Existing
   * workflows keep using `industries` (resolved via ARCHETYPE_INDUSTRY_TAGS).
   */
  archetypes?: IndustryArchetype[];
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
 * v1.3 — does a workflow belong to the buyer's selected engine archetype?
 *
 *  - Horizontal workflows (no `industries` AND no `archetypes`) always match.
 *  - A workflow matches if it directly targets the archetype (`archetypes`),
 *    or if any of its 15-tag `industries` roll up to that archetype via the
 *    ARCHETYPE_INDUSTRY_TAGS map in lib/industries.ts.
 *
 * The archetype→tags map is passed in (rather than imported) to keep this
 * module free of a circular dependency with lib/industries.ts.
 */
export function workflowMatchesArchetype(
  uc: UseCase,
  archetype: string,
  tagsForArchetype: (a: string) => readonly IndustryTag[],
): boolean {
  const hasTagSignal = (uc.industries?.length ?? 0) > 0;
  const hasArchetypeSignal = (uc.archetypes?.length ?? 0) > 0;
  if (!hasTagSignal && !hasArchetypeSignal) return true; // horizontal
  if (uc.archetypes?.includes(archetype as IndustryArchetype)) return true;
  const tags = new Set(tagsForArchetype(archetype));
  return (uc.industries ?? []).some((t) => tags.has(t));
}

/**
 * Workflows available for a tier AND tailored to the selected industry
 * archetype. Horizontal workflows always appear; industry-specific ones
 * appear only for their archetype. This is what the Assess form should call
 * so a financial-services buyer never sees "Field-Service Dispatch".
 */
export function workflowsForTierAndIndustry(
  tier: WorkflowTier,
  archetype: string,
  tagsForArchetype: (a: string) => readonly IndustryTag[],
): UseCase[] {
  return workflowsForTier(tier).filter((u) =>
    workflowMatchesArchetype(u, archetype, tagsForArchetype),
  );
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
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "simple",
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
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "moderate",
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
    regulatoryFlags: ["FERPA", "GDPR", "EU_AI_Act"], complexity: "moderate",
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

  // ═══════════════════════════════════════════════════════════════════
  // v1.3 ADDITIONS — horizontal (cross-industry) workflows
  // ═══════════════════════════════════════════════════════════════════

  // ─── AI Platform & Governance (NEW category — maps to Enterprise
  //     Control + Reliability & Safety pillars; the 2026 buying centers) ──
  {
    id: "multi_agent_orchestrator",
    label: "Multi-Agent Orchestration & Handoff",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "AI Platform & Governance", subcategory: "Orchestration",
    description: "Coordinate teams of specialised agents (A2A/MCP) with planning, hand-offs, and shared memory across a multi-step goal.",
    tier: "advanced", industries: [],
    commonInputs: ["agent registry", "tool catalog", "shared memory store"],
    regulatoryFlags: ["EU_AI_Act", "SOC2"], complexity: "complex",
  },
  {
    id: "deep_research_agent",
    label: "Autonomous Deep Research Agent",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "AI Platform & Governance", subcategory: "Research",
    description: "Fan-out, recurse, and synthesise across open web plus private data into a cited, decision-ready report.",
    tier: "guided", industries: [],
    commonInputs: ["open web", "internal documents", "data-room"],
    regulatoryFlags: [], complexity: "complex",
  },
  {
    id: "agent_observability",
    label: "AI Agent & LLM Observability",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "AI Platform & Governance", subcategory: "Observability",
    description: "Trace, evaluate, and monitor agent/LLM runs for drift, cost, latency, hallucination, and tool-call failures.",
    tier: "advanced", industries: [],
    commonInputs: ["traces", "eval datasets", "production logs"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "complex",
  },
  {
    id: "ai_governance_attestation",
    label: "AI Governance & Model-Risk Attestation",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "AI Platform & Governance", subcategory: "Governance",
    description: "Maintain a model inventory, map controls to EU AI Act / NIST RMF, and produce audit-ready risk evidence.",
    tier: "advanced", industries: [],
    commonInputs: ["model inventory", "control matrix", "risk register"],
    regulatoryFlags: ["EU_AI_Act", "ISO_27001", "SOC2"], complexity: "complex",
  },
  {
    id: "prompt_red_team",
    label: "AI Red-Teaming & Safety Evaluation",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "AI Platform & Governance", subcategory: "Safety",
    description: "Adversarially probe models/agents for jailbreaks, prompt injection, data leakage, and unsafe tool use pre-deployment.",
    tier: "advanced", industries: [],
    commonInputs: ["attack library", "model endpoints", "safety policies"],
    regulatoryFlags: ["EU_AI_Act", "SOC2"], complexity: "complex",
  },
  {
    id: "synthetic_data_generation",
    label: "Synthetic Data Generation",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "AI Platform & Governance", subcategory: "Data",
    description: "Generate statistically faithful, privacy-preserving synthetic datasets for model training, testing, and sharing.",
    tier: "advanced", industries: [],
    commonInputs: ["source datasets", "schema", "privacy constraints"],
    regulatoryFlags: ["GDPR", "HIPAA"], complexity: "complex",
  },

  // ─── Data (additions) ──────────────────────────────────────────────
  {
    id: "knowledge_graph_builder",
    label: "Knowledge Graph / GraphRAG Construction",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Data", subcategory: "Engineering",
    description: "Extract entities and relations to build and maintain an enterprise knowledge graph powering GraphRAG retrieval.",
    tier: "advanced", industries: [],
    commonInputs: ["documents", "ontology", "data sources"],
    regulatoryFlags: [], complexity: "complex",
  },
  {
    id: "data_catalog_steward",
    label: "Autonomous Data Catalog & Metadata Steward",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Data", subcategory: "Engineering",
    description: "Auto-classify, document, tag sensitivity, and maintain lineage across the data estate for governed self-serve.",
    tier: "advanced", industries: [],
    commonInputs: ["table metadata", "lineage graph", "sensitivity policies"],
    regulatoryFlags: ["SOC2", "GDPR"], complexity: "moderate",
  },

  // ─── Revenue (additions) ───────────────────────────────────────────
  {
    id: "sdr_outbound_agent",
    label: "Autonomous SDR / Outbound Agent",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Revenue", subcategory: "Sales",
    description: "Prospect, sequence, reply, and book meetings autonomously with sentiment-aware follow-up and human escalation.",
    tier: "advanced", industries: [],
    commonInputs: ["CRM", "intent signals", "messaging library"],
    regulatoryFlags: ["GDPR", "CCPA"], complexity: "complex",
  },
  {
    id: "deal_desk_assistant",
    label: "Deal Desk & Quote-to-Cash Assistant",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Revenue", subcategory: "Sales",
    description: "Assemble quotes, apply approval/discount policy, and progress quote-to-cash with guardrailed exceptions.",
    tier: "advanced", industries: [],
    commonInputs: ["price book", "approval matrix", "CRM opportunities"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },
  {
    id: "crm_hygiene_agent",
    label: "CRM Hygiene & Activity-Logging Agent",
    riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "supervised_agent",
    category: "Revenue", subcategory: "Sales",
    description: "Auto-log interactions, enrich records, dedupe, and keep pipeline and contact data continuously accurate.",
    tier: "guided", industries: [],
    commonInputs: ["email/calendar", "CRM records", "enrichment sources"],
    regulatoryFlags: ["GDPR"], complexity: "moderate",
  },
  {
    id: "meeting_prep_agent",
    label: "Sales Meeting Prep & Briefing Agent",
    riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "advisory_only",
    category: "Revenue", subcategory: "Sales",
    description: "Generate pre-meeting briefs, battlecards, and talking points from CRM, prior calls, and live account signals.",
    tier: "quick", industries: [],
    commonInputs: ["CRM", "call recordings", "account news"],
    regulatoryFlags: [], complexity: "simple",
  },
  {
    id: "rev_forecasting",
    label: "Revenue / Pipeline Forecasting",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Revenue", subcategory: "Sales",
    description: "Predict bookings and pipeline conversion with explainable drivers and scenario rollups for RevOps.",
    tier: "advanced", industries: [],
    commonInputs: ["pipeline history", "win/loss", "rep activity"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },

  // ─── Finance (additions) ───────────────────────────────────────────
  {
    id: "treasury_cash_forecasting",
    label: "Treasury & Cash-Flow Forecasting Agent",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Finance", subcategory: "Treasury",
    description: "Produce 13-week and rolling cash forecasts from ERP and bank feeds with liquidity and covenant alerts.",
    tier: "advanced", industries: [],
    commonInputs: ["ERP", "bank feeds", "AP/AR aging"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },
  {
    id: "spend_analysis_agent",
    label: "Spend Analytics & Procurement Intelligence",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Finance", subcategory: "Procurement",
    description: "Classify spend, surface savings and maverick spend, and recommend consolidation across categories and suppliers.",
    tier: "guided", industries: [],
    commonInputs: ["AP ledger", "PO data", "supplier master"],
    regulatoryFlags: ["SOX"], complexity: "moderate",
  },
  {
    id: "due_diligence_agent",
    label: "M&A / Due-Diligence Document Analysis",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Finance", subcategory: "Corporate Development",
    description: "Process data-room documents at volume to extract risks, obligations, and red-flags into a diligence summary.",
    tier: "advanced", industries: [],
    commonInputs: ["data-room", "contracts", "financial statements"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },
  {
    id: "earnings_communications",
    label: "Earnings & Investor Communications Drafting",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Finance", subcategory: "FP&A",
    description: "Draft earnings scripts, investor Q&A, and disclosures grounded in financial results with review controls.",
    tier: "advanced", industries: [],
    commonInputs: ["financial results", "prior disclosures", "analyst questions"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },

  // ─── HR (additions — EU AI Act high-risk employment) ───────────────
  {
    id: "workforce_planning",
    label: "Strategic Workforce Planning Agent",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "HR", subcategory: "Planning",
    description: "Model headcount, skills supply/demand, and a blended employee-contingent-agent workforce against scenarios.",
    tier: "advanced", industries: [],
    commonInputs: ["HRIS", "skills taxonomy", "financial plan"],
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "performance_review_assist",
    label: "Performance Review Synthesis",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "HR", subcategory: "Talent",
    description: "Synthesise performance evidence and feedback into calibrated, bias-checked draft reviews for manager edit.",
    tier: "advanced", industries: [],
    commonInputs: ["performance data", "peer feedback", "goals"],
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "comp_benchmarking",
    label: "Compensation Benchmarking & Pay-Equity",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "HR", subcategory: "Talent",
    description: "Benchmark pay to market and surface pay-equity gaps with explainable, auditable recommendations.",
    tier: "advanced", industries: [],
    commonInputs: ["comp data", "market surveys", "job architecture"],
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "succession_planning",
    label: "Succession Planning Agent",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "HR", subcategory: "Talent",
    description: "Identify successors and readiness gaps for critical roles from performance, skills, and mobility data.",
    tier: "advanced", industries: [],
    commonInputs: ["performance data", "skills graph", "mobility history"],
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "skills_inference",
    label: "Skills Inference & Talent Ontology",
    riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "advisory_only",
    category: "HR", subcategory: "L&D",
    description: "Infer employee skills from work artefacts and maintain a skills graph powering mobility and learning.",
    tier: "advanced", industries: [],
    commonInputs: ["work artefacts", "role data", "skills taxonomy"],
    regulatoryFlags: ["GDPR"], complexity: "moderate",
  },

  // ─── Engineering (additions) ───────────────────────────────────────
  {
    id: "aiops_self_healing",
    label: "Agentic SRE / AIOps Self-Healing",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Engineering", subcategory: "Operations",
    description: "Closed-loop detect-diagnose-remediate of production incidents with verification and controlled autonomy.",
    tier: "advanced", industries: [],
    commonInputs: ["alerts", "logs", "runbooks", "deploy history"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "complex",
  },
  {
    id: "legacy_code_modernization",
    label: "Legacy Code Modernization & Migration",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Engineering", subcategory: "Modernization",
    description: "Translate and refactor legacy codebases to modern languages/frameworks with test parity checks.",
    tier: "advanced", industries: [],
    commonInputs: ["legacy source", "tests", "target framework"],
    regulatoryFlags: ["SOC2"], complexity: "complex",
  },
  {
    id: "api_design_generator",
    label: "API & Spec Design Generation",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Engineering", subcategory: "QA",
    description: "Generate OpenAPI/GraphQL specs, contracts, and stubs from requirements with consistency linting.",
    tier: "advanced", industries: [],
    commonInputs: ["requirements", "existing schemas", "style guide"],
    regulatoryFlags: ["SOC2"], complexity: "moderate",
  },
  {
    id: "devex_onboarding_assistant",
    label: "Developer Onboarding & Codebase Q&A",
    riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "advisory_only",
    category: "Engineering", subcategory: "QA",
    description: "Answer questions over a codebase, architecture, and runbooks to ramp new engineers fast.",
    tier: "guided", industries: [],
    commonInputs: ["source code", "architecture docs", "runbooks"],
    regulatoryFlags: [], complexity: "simple",
  },

  // ─── IT / Security (additions) ─────────────────────────────────────
  {
    id: "finops_optimizer",
    label: "FinOps Cloud-Cost Optimization Agent",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "IT", subcategory: "FinOps",
    description: "Autonomously rightsize, schedule, and remediate cloud waste across AWS/Azure/GCP via IaC with guardrails.",
    tier: "advanced", industries: [],
    commonInputs: ["cloud billing", "utilization metrics", "IaC"],
    regulatoryFlags: ["SOC2"], complexity: "complex",
  },
  {
    id: "cloud_security_posture",
    label: "Cloud Security Posture Management Agent",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "IT", subcategory: "Security",
    description: "Continuously assess cloud/identity misconfigurations, prioritise by exploitability, and propose fixes.",
    tier: "advanced", industries: [],
    commonInputs: ["cloud config", "identity graph", "threat intel"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "complex",
  },

  // ─── Operations (additions) ────────────────────────────────────────
  {
    id: "process_mining_agent",
    label: "Process Mining & Automation Discovery",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Operations", subcategory: "BPM",
    description: "Mine system event logs to map as-is processes and rank high-ROI automation and bottleneck candidates.",
    tier: "guided", industries: [],
    commonInputs: ["event logs", "system APIs", "process catalog"],
    regulatoryFlags: [], complexity: "moderate",
  },
  {
    id: "rpa_agent_orchestration",
    label: "Computer-Use / Agentic RPA Orchestration",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Operations", subcategory: "BPM",
    description: "Drive legacy UIs and APIs with judgment-and-exception-handling agents replacing brittle rule-based bots.",
    tier: "advanced", industries: [],
    commonInputs: ["process specs", "UI flows", "exception logs"],
    regulatoryFlags: ["SOX"], complexity: "complex",
  },

  // ─── Productivity (additions) ──────────────────────────────────────
  {
    id: "brand_voice_governance",
    label: "Brand Voice & Content Governance",
    riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "human_in_loop",
    category: "Productivity", subcategory: "Content",
    description: "Enforce brand voice, claims, and compliance guardrails across AI-generated content at scale before publish.",
    tier: "guided", industries: [],
    commonInputs: ["brand guidelines", "claims library", "content drafts"],
    regulatoryFlags: [], complexity: "moderate",
  },

  // ═══════════════════════════════════════════════════════════════════
  // v1.3 ADDITIONS — industry-specific workflows (target archetype directly)
  // ═══════════════════════════════════════════════════════════════════

  // ─── Regulated Financial ───────────────────────────────────────────
  {
    id: "model_risk_validation",
    label: "Model Risk Validation & Documentation",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Financial Services", subcategory: "Model Risk",
    description: "Validate, document and monitor predictive/credit/pricing models per SR 26-2 materiality-based MRM with audit-ready evidence.",
    tier: "advanced", archetypes: ["regulated_financial"], industries: ["financial_services"],
    commonInputs: ["model inventory", "validation tests", "regulatory guidance"],
    regulatoryFlags: ["EU_AI_Act", "BASEL_III", "SOX"], complexity: "complex",
  },
  {
    id: "regulatory_reporting_automation",
    label: "Regulatory & Transaction Reporting",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Financial Services", subcategory: "Compliance",
    description: "Assemble and validate regulatory filings (call reports, MiFID/EMIR transaction reporting) with reconciliation and exception flags.",
    tier: "advanced", archetypes: ["regulated_financial"], industries: ["financial_services"],
    commonInputs: ["source systems", "reporting taxonomy", "reconciliations"],
    regulatoryFlags: ["MiFID_II", "FINRA", "SOX"], complexity: "complex",
  },
  {
    id: "esg_climate_risk_disclosure",
    label: "ESG & Climate-Risk Disclosure Analysis",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Financial Services", subcategory: "Risk",
    description: "Extract, classify and quality-check ESG/climate exposure data and draft regulator-grade climate-risk disclosures.",
    tier: "advanced", archetypes: ["regulated_financial"], industries: ["financial_services"],
    commonInputs: ["exposure data", "disclosure frameworks", "counterparty data"],
    regulatoryFlags: ["EU_AI_Act", "SOX"], complexity: "complex",
  },
  {
    id: "aml_alert_adjudication",
    label: "AML Alert Adjudication & SAR Drafting",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Financial Services", subcategory: "Compliance",
    description: "Triage transaction-monitoring alerts, assemble case evidence and draft Suspicious Activity Reports with full decision trail.",
    tier: "advanced", archetypes: ["regulated_financial"], industries: ["financial_services"],
    commonInputs: ["transaction alerts", "KYC data", "watchlists"],
    regulatoryFlags: ["FINRA", "BASEL_III", "GDPR"], complexity: "complex",
  },
  {
    id: "complaints_conduct_analytics",
    label: "Complaints & Conduct-Risk Analytics",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Financial Services", subcategory: "Conduct",
    description: "Classify customer complaints and comms for conduct/mis-selling risk and surface systemic issues for compliance review.",
    tier: "guided", archetypes: ["regulated_financial"], industries: ["financial_services"],
    commonInputs: ["complaints", "call/chat transcripts", "policy library"],
    regulatoryFlags: ["MiFID_II", "GDPR", "EU_AI_Act"], complexity: "moderate",
  },

  // ─── Health & Life Sciences ────────────────────────────────────────
  {
    id: "ambient_clinical_documentation",
    label: "Ambient Clinical Documentation",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Health", subcategory: "Clinical",
    description: "Generate structured clinical notes from ambient patient-encounter audio for clinician review and EHR write-back.",
    tier: "quick", archetypes: ["health_life_sciences"], industries: ["healthcare"],
    commonInputs: ["encounter audio", "EHR context", "note templates"],
    regulatoryFlags: ["HIPAA", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "regulatory_submission_authoring",
    label: "Regulatory Submission & Dossier Authoring",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Health", subcategory: "Pharma",
    description: "Draft and assemble regulatory submission sections (protocols, CSRs, eCTD modules) under GxP/CSA validation and FDA-EMA GMLP principles.",
    tier: "advanced", archetypes: ["health_life_sciences"], industries: ["pharma_life_sciences"],
    commonInputs: ["study data", "templates", "regulatory guidance"],
    regulatoryFlags: ["FDA_21CFR11", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "medical_imaging_triage",
    label: "Medical Imaging Triage & Prioritisation",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Health", subcategory: "Clinical",
    description: "Prioritise and pre-read diagnostic imaging studies to flag urgent findings for radiologist confirmation.",
    tier: "advanced", archetypes: ["health_life_sciences"], industries: ["healthcare"],
    commonInputs: ["imaging studies", "priors", "clinical context"],
    regulatoryFlags: ["HIPAA", "FDA_21CFR11", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "clinical_trial_matching",
    label: "Clinical Trial Patient Matching",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Health", subcategory: "Pharma",
    description: "Match patient records to trial eligibility criteria and surface candidates for investigator review.",
    tier: "advanced", archetypes: ["health_life_sciences"], industries: ["pharma_life_sciences", "healthcare"],
    commonInputs: ["patient records", "trial criteria", "EHR"],
    regulatoryFlags: ["HIPAA", "FDA_21CFR11", "GDPR"], complexity: "complex",
  },
  {
    id: "payer_provider_appeals",
    label: "Claims Denial Appeal Drafting",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Health", subcategory: "RCM",
    description: "Draft evidence-backed denial appeals from clinical notes, payer policies and precedent for billing-team review.",
    tier: "advanced", archetypes: ["health_life_sciences"], industries: ["healthcare"],
    commonInputs: ["clinical notes", "payer policies", "denial codes"],
    regulatoryFlags: ["HIPAA"], complexity: "complex",
  },

  // ─── Legal & Professional ──────────────────────────────────────────
  {
    id: "legal_matter_intake",
    label: "Legal Matter Intake & Triage",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Legal", subcategory: "Operations",
    description: "Classify and route inbound legal requests (review, redline, drafting) to the right workflow and owner with SLA tracking.",
    tier: "guided", archetypes: ["legal_professional"], industries: ["legal"],
    commonInputs: ["intake requests", "matter taxonomy", "SLA matrix"],
    regulatoryFlags: ["GDPR", "SOC2"], complexity: "moderate",
  },
  {
    id: "high_volume_contract_review",
    label: "High-Volume Contract Review & Redline",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Legal", subcategory: "Contracts",
    description: "Extract key terms, detect risky clauses and auto-redline against playbooks across large contract volumes for attorney sign-off.",
    tier: "guided", archetypes: ["legal_professional"], industries: ["legal"],
    commonInputs: ["contracts", "clause playbook", "precedent library"],
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "self_serve_nda",
    label: "Self-Serve NDA Generation",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Legal", subcategory: "Contracts",
    description: "Generate and negotiate standard NDAs from approved templates to cut legal intake, with escalation on non-standard terms.",
    tier: "guided", archetypes: ["legal_professional"], industries: ["legal"],
    commonInputs: ["NDA templates", "fallback positions", "counterparty terms"],
    regulatoryFlags: ["GDPR"], complexity: "moderate",
  },
  {
    id: "litigation_forecasting",
    label: "Litigation Outcome & Risk Forecasting",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Legal", subcategory: "Litigation",
    description: "Estimate case outcomes, exposure and settlement ranges from matter facts and precedent for litigation strategy.",
    tier: "advanced", archetypes: ["legal_professional"], industries: ["legal"],
    commonInputs: ["matter facts", "precedent", "docket data"],
    regulatoryFlags: ["EU_AI_Act"], complexity: "complex",
  },
  {
    id: "regulatory_obligation_mapping",
    label: "Regulatory Obligation Mapping",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "Legal", subcategory: "Compliance",
    description: "Map regulatory texts to internal obligations and controls and flag gaps as regulations change.",
    tier: "advanced", archetypes: ["legal_professional"], industries: ["legal"],
    commonInputs: ["regulatory texts", "obligation register", "control matrix"],
    regulatoryFlags: ["EU_AI_Act", "GDPR"], complexity: "complex",
  },
  {
    id: "legal_research_memo",
    label: "Legal Research & Memo Drafting",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Legal", subcategory: "Research",
    description: "Research authorities and draft cited legal memos grounded in a curated, jurisdiction-aware corpus for attorney review.",
    tier: "guided", archetypes: ["legal_professional"], industries: ["legal"],
    commonInputs: ["case law corpus", "matter facts", "jurisdiction"],
    regulatoryFlags: ["EU_AI_Act"], complexity: "complex",
  },

  // ─── Public Sector & Education ─────────────────────────────────────
  {
    id: "benefits_fraud_detection",
    label: "Benefits & Payments Fraud Detection",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "Public Sector", subcategory: "Integrity",
    description: "Detect improper payments and benefits fraud via anomaly and network analysis across program and identity data.",
    tier: "advanced", archetypes: ["public_sector_education"], industries: ["public_sector"],
    commonInputs: ["program data", "identity data", "payment records"],
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "complex",
  },
  {
    id: "foia_records_redaction",
    label: "FOIA / Records Request Processing & Redaction",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Public Sector", subcategory: "Service",
    description: "Locate responsive records, auto-redact PII/exempt content and assemble FOIA/records-request responses with an audit trail.",
    tier: "advanced", archetypes: ["public_sector_education"], industries: ["public_sector"],
    commonInputs: ["records repositories", "exemption rules", "request text"],
    regulatoryFlags: ["GDPR"], complexity: "moderate",
  },
  {
    id: "procurement_bid_anomaly",
    label: "Public Procurement Bid Anomaly Detection",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Public Sector", subcategory: "Integrity",
    description: "Detect collusion, conflicts of interest and pricing anomalies across tenders and contract data to support audits.",
    tier: "advanced", archetypes: ["public_sector_education"], industries: ["public_sector"],
    commonInputs: ["tender data", "supplier registry", "contract history"],
    regulatoryFlags: ["GDPR"], complexity: "moderate",
  },
  {
    id: "permit_license_processing",
    label: "Permit & License Application Processing",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Public Sector", subcategory: "Service",
    description: "Validate permit/license applications against eligibility rules and route exceptions with full case-management audit trail.",
    tier: "guided", archetypes: ["public_sector_education"], industries: ["public_sector"],
    commonInputs: ["applications", "eligibility rules", "case management"],
    regulatoryFlags: ["GDPR", "EU_AI_Act"], complexity: "moderate",
  },
  {
    id: "student_early_warning",
    label: "At-Risk Student Early-Warning",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Education", subcategory: "Student Success",
    description: "Predict students at risk of attrition from engagement and performance signals to trigger advisor intervention.",
    tier: "guided", archetypes: ["public_sector_education"], industries: ["education"],
    commonInputs: ["LMS engagement", "grades", "attendance"],
    regulatoryFlags: ["FERPA", "GDPR", "EU_AI_Act"], complexity: "moderate",
  },
  {
    id: "admissions_screening",
    label: "Admissions Application Screening",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Education", subcategory: "Enrollment",
    description: "Score and summarise admissions applications against criteria with bias monitoring and human-decision sign-off.",
    tier: "advanced", archetypes: ["public_sector_education"], industries: ["education"],
    commonInputs: ["applications", "rubrics", "historical decisions"],
    regulatoryFlags: ["FERPA", "GDPR", "EU_AI_Act"], complexity: "complex",
  },

  // ─── Critical Infrastructure & Defence ─────────────────────────────
  {
    id: "ot_ics_anomaly_detection",
    label: "OT / ICS Anomaly & Threat Detection",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "Critical Infrastructure", subcategory: "OT Security",
    description: "Detect anomalous behaviour and intrusions across SCADA/ICS and OT networks for safety and grid integrity.",
    tier: "advanced", archetypes: ["critical_infrastructure_defence"], industries: ["energy_utilities"],
    commonInputs: ["OT network traffic", "historian data", "threat intel"],
    regulatoryFlags: ["IEC_62443", "NERC_CIP", "ISO_27001"], complexity: "complex",
  },
  {
    id: "grid_load_forecasting",
    label: "Grid Load & Outage Forecasting",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "Critical Infrastructure", subcategory: "Grid",
    description: "Forecast electricity load, DER behaviour and outage risk for grid balancing and reliability.",
    tier: "advanced", archetypes: ["critical_infrastructure_defence"], industries: ["energy_utilities"],
    commonInputs: ["smart-meter data", "weather", "DER telemetry"],
    regulatoryFlags: ["NERC_CIP", "ISO_27001"], complexity: "complex",
  },
  {
    id: "defence_document_handling",
    label: "CUI Document Handling & Classification",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Critical Infrastructure", subcategory: "Defence",
    description: "Classify, control and summarise controlled-unclassified-information documents in air-gapped / CMMC-compliant environments.",
    tier: "advanced", archetypes: ["critical_infrastructure_defence"], industries: ["aerospace_defence"],
    commonInputs: ["CUI documents", "classification guides", "access policy"],
    regulatoryFlags: ["ITAR", "CMMC", "NIST_800_171"], complexity: "complex",
  },
  {
    id: "isr_intel_triage",
    label: "ISR & Intelligence Report Triage",
    riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Critical Infrastructure", subcategory: "Defence",
    description: "Triage, summarise and prioritise multi-source intelligence/ISR feeds for analyst review in mission-support workflows.",
    tier: "advanced", archetypes: ["critical_infrastructure_defence"], industries: ["aerospace_defence"],
    commonInputs: ["ISR feeds", "intel reports", "geospatial data"],
    regulatoryFlags: ["ITAR", "CMMC"], complexity: "complex",
  },
  {
    id: "physical_security_monitoring",
    label: "Critical-Asset Physical Security Monitoring",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Critical Infrastructure", subcategory: "OT Security",
    description: "Detect intrusions and safety events from video/sensor feeds at critical facilities with operator confirmation.",
    tier: "advanced", archetypes: ["critical_infrastructure_defence"], industries: ["energy_utilities"],
    commonInputs: ["video feeds", "sensor data", "access logs"],
    regulatoryFlags: ["IEC_62443", "ISO_27001"], complexity: "complex",
  },
  {
    id: "nerc_compliance_evidence",
    label: "Critical-Infra Compliance Evidence Assembly",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "human_in_loop",
    category: "Critical Infrastructure", subcategory: "Compliance",
    description: "Collect and assemble audit-ready compliance evidence for critical-infrastructure regimes with control-gap flagging.",
    tier: "advanced", archetypes: ["critical_infrastructure_defence"], industries: ["energy_utilities"],
    commonInputs: ["control matrix", "system exports", "audit history"],
    regulatoryFlags: ["NERC_CIP", "IEC_62443", "ISO_27001"], complexity: "moderate",
  },

  // ─── Enterprise Software & Digital Product ─────────────────────────
  {
    id: "autonomous_sre_remediation",
    label: "Autonomous SRE Remediation",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Enterprise Software", subcategory: "Operations",
    description: "Diagnose production incidents and execute supervised remediation/runbook actions with rollback and audit logging.",
    tier: "advanced", archetypes: ["enterprise_software"], industries: ["technology_software"],
    commonInputs: ["alerts", "runbooks", "deploy history"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "complex",
  },
  {
    id: "continuous_compliance_evidence",
    label: "Continuous Compliance Evidence Collection",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Enterprise Software", subcategory: "Compliance",
    description: "Continuously collect control evidence and detect config drift to maintain SOC2/ISO 27001 audit readiness.",
    tier: "guided", archetypes: ["enterprise_software"], industries: ["technology_software"],
    commonInputs: ["system exports", "control matrix", "config state"],
    regulatoryFlags: ["SOC2", "ISO_27001", "GDPR"], complexity: "moderate",
  },
  {
    id: "sbom_secrets_scanning",
    label: "SBOM & Secrets Leak Detection",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Enterprise Software", subcategory: "Security",
    description: "Scan dependencies, generate SBOMs and detect leaked secrets/vulnerable packages across CI/CD with remediation guidance.",
    tier: "guided", archetypes: ["enterprise_software"], industries: ["technology_software"],
    commonInputs: ["dependency manifests", "CI/CD pipelines", "secret scanners"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "moderate",
  },
  {
    id: "ai_soc_alert_triage",
    label: "AI-SOC Alert Triage & Enrichment",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "advisory_only",
    category: "Enterprise Software", subcategory: "Security",
    description: "Triage, correlate and enrich security alerts at machine speed and recommend response actions for SOC analyst sign-off.",
    tier: "advanced", archetypes: ["enterprise_software"], industries: ["technology_software"],
    commonInputs: ["SIEM", "threat intel", "asset inventory"],
    regulatoryFlags: ["SOC2", "ISO_27001"], complexity: "complex",
  },
  {
    id: "ai_agent_governance",
    label: "AI Agent Governance & Guardrails",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop",
    category: "Enterprise Software", subcategory: "Governance",
    description: "Monitor and constrain autonomous agents (tool use, delegation scope, action approval) and log decisions for audit and AI-Act conformity.",
    tier: "advanced", archetypes: ["enterprise_software"], industries: ["technology_software"],
    commonInputs: ["agent logs", "permission policies", "tool catalog"],
    regulatoryFlags: ["EU_AI_Act", "SOC2", "ISO_27001"], complexity: "complex",
  },
  {
    id: "release_change_risk",
    label: "Release & Change-Risk Assessment",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Enterprise Software", subcategory: "Operations",
    description: "Assess code/config changes for blast radius and risk and gate deployments with evidence for change management.",
    tier: "guided", archetypes: ["enterprise_software"], industries: ["technology_software"],
    commonInputs: ["change diffs", "dependency graph", "incident history"],
    regulatoryFlags: ["SOC2"], complexity: "moderate",
  },

  // ─── Industrial & Physical Operations ──────────────────────────────
  {
    id: "supply_chain_digital_twin",
    label: "Supply-Chain Digital-Twin Simulation",
    riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Manufacturing", subcategory: "Supply Chain",
    description: "Simulate supply-network scenarios and auto-reschedule orders/shipments and rebalance inventory under disruption.",
    tier: "advanced", archetypes: ["industrial_physical_ops"], industries: ["manufacturing", "transport_logistics"],
    commonInputs: ["network model", "inventory", "demand signals"],
    regulatoryFlags: ["ISO_27001"], complexity: "complex",
  },
  {
    id: "route_fleet_optimisation",
    label: "Route & Fleet Optimisation",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Manufacturing", subcategory: "Logistics",
    description: "Optimise delivery routes and fleet allocation in real time against demand, traffic and cost/emissions constraints.",
    tier: "guided", archetypes: ["industrial_physical_ops"], industries: ["transport_logistics"],
    commonInputs: ["orders", "GPS/traffic", "fleet capacity"],
    regulatoryFlags: ["ISO_27001"], complexity: "moderate",
  },
  {
    id: "warehouse_robotics_orchestration",
    label: "Warehouse Robotics Orchestration",
    riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "supervised_agent",
    category: "Manufacturing", subcategory: "Logistics",
    description: "Coordinate multi-agent robot fleets and respond to incidents for picking, sorting and inventory.",
    tier: "advanced", archetypes: ["industrial_physical_ops"], industries: ["transport_logistics", "manufacturing"],
    commonInputs: ["WMS", "robot telemetry", "order flow"],
    regulatoryFlags: ["IEC_62443", "ISO_27001"], complexity: "complex",
  },
  {
    id: "inbound_logistics_doc_processing",
    label: "Logistics Document Processing",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "supervised_agent",
    category: "Manufacturing", subcategory: "Logistics",
    description: "Extract and validate data from bills of lading, customs and freight documents to automate inbound/outbound logistics.",
    tier: "guided", archetypes: ["industrial_physical_ops"], industries: ["transport_logistics"],
    commonInputs: ["BoL", "customs forms", "freight invoices"],
    regulatoryFlags: ["ISO_27001"], complexity: "moderate",
  },
  {
    id: "warranty_returns_analytics",
    label: "Warranty & Returns Analytics",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Manufacturing", subcategory: "Quality",
    description: "Detect failure patterns and fraud across warranty claims and returns to inform quality and reverse-logistics decisions.",
    tier: "guided", archetypes: ["industrial_physical_ops"], industries: ["manufacturing", "retail_consumer"],
    commonInputs: ["warranty claims", "returns data", "product telemetry"],
    regulatoryFlags: ["ISO_27001"], complexity: "moderate",
  },
  {
    id: "field_service_copilot",
    label: "Field-Service Technician Copilot",
    riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "advisory_only",
    category: "Manufacturing", subcategory: "Field Service",
    description: "Guide technicians with diagnostics, manuals and parts lookup on-site and capture structured service records.",
    tier: "guided", archetypes: ["industrial_physical_ops"], industries: ["manufacturing", "energy_utilities"],
    commonInputs: ["equipment manuals", "asset history", "parts catalog"],
    regulatoryFlags: ["ISO_27001"], complexity: "moderate",
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
