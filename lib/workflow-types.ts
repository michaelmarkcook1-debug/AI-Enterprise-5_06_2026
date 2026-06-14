// Workflow-type taxonomy + per-type vendor scoring.
// ──────────────────────────────────────────────────
// The 75 enterprise AI workflows in lib/use-cases.ts consolidate into
// FOUR primary modes of use. The Assessment results are now organised
// around these four types: for each type we show the single best AI
// vendor, and the user can expand to the full ranked list per type.
//
// This module is PURE (type-only imports) so the client ResultsView
// component can import it without dragging server modules into the
// browser bundle.
//
// How per-type ranking works:
//   Every VendorResult from the scoring engine carries a
//   `pillarScores: Record<PillarId, number>` (0–100). Each workflow
//   type weights the six pillars differently to reflect what that mode
//   of use actually demands (e.g. Decision Intelligence leans on
//   reliability + control; Build & Operate leans on integration +
//   reliability). The per-type fit score is the weighted sum of the
//   vendor's pillar scores under that type's weight profile. Ranking
//   by that score yields a distinct "best vendor" per type from the
//   SAME assessment run — no engine changes, no extra API calls.

import type { PillarId } from "./types";

export type WorkflowTypeId =
  | "knowledge_communication"
  | "decision_intelligence"
  | "process_automation"
  | "build_operate";

export interface WorkflowType {
  id: WorkflowTypeId;
  label: string;
  shortLabel: string;
  tagline: string;
  description: string;
  /** Pillar weight profile — MUST sum to 1.0. */
  weights: Record<PillarId, number>;
  /** Tailwind accent classes for the type card. */
  accent: {
    bar: string;
    chip: string;
    ring: string;
    text: string;
    softBg: string;
  };
}

export const WORKFLOW_TYPES: WorkflowType[] = [
  {
    id: "knowledge_communication",
    label: "Knowledge & Communication",
    shortLabel: "Knowledge",
    tagline: "Generate answers, content, and conversations",
    description:
      "Produce answers, documents, or dialogue grounded in a corpus or context — assistants, search, content, customer conversations, drafting.",
    // Leans on business-fit (does the model answer the use case well) and
    // integration (RAG / connectors), with market strength (model quality).
    weights: {
      business_fit: 0.28,
      integration_ops: 0.2,
      reliability_safety: 0.16,
      market_strength: 0.16,
      enterprise_control: 0.12,
      vendor_resilience: 0.08,
    },
    accent: {
      bar: "bg-violet-500",
      chip: "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200",
      ring: "ring-violet-400/60",
      text: "text-violet-700 dark:text-violet-300",
      softBg: "bg-violet-50/70 dark:bg-violet-950/30",
    },
  },
  {
    id: "decision_intelligence",
    label: "Decision Intelligence",
    shortLabel: "Decisions",
    tagline: "Interpret data to inform a decision",
    description:
      "Score, predict, and explain — analytics copilots, risk models, forecasting, fraud, underwriting, anything that interprets data to inform a human or downstream decision.",
    // Reliability (accuracy) + enterprise control (governance of
    // decisions) dominate; business-fit and data integration matter.
    weights: {
      reliability_safety: 0.28,
      enterprise_control: 0.22,
      business_fit: 0.18,
      integration_ops: 0.14,
      vendor_resilience: 0.1,
      market_strength: 0.08,
    },
    accent: {
      bar: "bg-emerald-500",
      chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
      ring: "ring-emerald-400/60",
      text: "text-emerald-700 dark:text-emerald-300",
      softBg: "bg-emerald-50/70 dark:bg-emerald-950/30",
    },
  },
  {
    id: "process_automation",
    label: "Process Automation",
    shortLabel: "Automation",
    tagline: "Execute multi-step processes with oversight",
    description:
      "Run multi-step business processes end-to-end with human oversight — ticket triage, AP/AR, claims, KYC, document workflows, agentic orchestration.",
    // Integration (orchestration) + reliability (failure propagation) +
    // enterprise control (audit) are the load-bearing pillars.
    weights: {
      integration_ops: 0.26,
      reliability_safety: 0.22,
      enterprise_control: 0.2,
      business_fit: 0.14,
      vendor_resilience: 0.1,
      market_strength: 0.08,
    },
    accent: {
      bar: "bg-amber-500",
      chip: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
      ring: "ring-amber-400/60",
      text: "text-amber-700 dark:text-amber-300",
      softBg: "bg-amber-50/70 dark:bg-amber-950/30",
    },
  },
  {
    id: "build_operate",
    label: "Build & Operate Systems",
    shortLabel: "Build & Operate",
    tagline: "Engineer, monitor, and secure systems",
    description:
      "Engineer, monitor, or secure code, infrastructure, and physical systems — coding copilots, observability, security triage, predictive maintenance, quality inspection.",
    // Integration (toolchain / infra) + reliability (security &
    // correctness) lead; market strength reflects coding-model quality.
    weights: {
      integration_ops: 0.26,
      reliability_safety: 0.24,
      market_strength: 0.16,
      enterprise_control: 0.16,
      business_fit: 0.1,
      vendor_resilience: 0.08,
    },
    accent: {
      bar: "bg-sky-500",
      chip: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
      ring: "ring-sky-400/60",
      text: "text-sky-700 dark:text-sky-300",
      softBg: "bg-sky-50/70 dark:bg-sky-950/30",
    },
  },
];

export function getWorkflowType(id: WorkflowTypeId): WorkflowType {
  return WORKFLOW_TYPES.find((t) => t.id === id) ?? WORKFLOW_TYPES[0];
}

/**
 * Map every one of the 75 workflow ids to its consolidated type.
 * Anything not listed falls back to knowledge_communication (the
 * broadest mode) so unknown / future ids never break the results UI.
 */
export const WORKFLOW_TYPE_OF: Record<string, WorkflowTypeId> = {
  // ─── A · Knowledge & Communication ─────────────────────────────
  knowledge_assistant: "knowledge_communication",
  meeting_assistant: "knowledge_communication",
  executive_briefing: "knowledge_communication",
  policy_qa: "knowledge_communication",
  translation_localisation: "knowledge_communication",
  customer_service_agent: "knowledge_communication",
  agent_assist: "knowledge_communication",
  voice_ivr: "knowledge_communication",
  sales_research: "knowledge_communication",
  outbound_personalisation: "knowledge_communication",
  rfp_proposal: "knowledge_communication",
  marketing_content: "knowledge_communication",
  competitive_intel: "knowledge_communication",
  hr_helpdesk: "knowledge_communication",
  onboarding_assistant: "knowledge_communication",
  interview_assist: "knowledge_communication",
  ip_landscape: "knowledge_communication",
  tax_research_assistant: "knowledge_communication",
  tutoring_assistant: "knowledge_communication",
  research_synthesis: "knowledge_communication",
  constituent_services: "knowledge_communication",
  patient_intake: "knowledge_communication",
  documentation_generator: "knowledge_communication",

  // ─── B · Decision Intelligence ─────────────────────────────────
  voice_of_customer: "decision_intelligence",
  churn_prediction: "decision_intelligence",
  lead_qualification: "decision_intelligence",
  pricing_optimisation: "decision_intelligence",
  financial_analysis: "decision_intelligence",
  expense_audit: "decision_intelligence",
  demand_forecasting: "decision_intelligence",
  supplier_risk: "decision_intelligence",
  data_analysis: "decision_intelligence",
  text_to_sql: "decision_intelligence",
  kpi_anomaly_explanation: "decision_intelligence",
  ml_feature_engineering: "decision_intelligence",
  clinical_decision_support: "decision_intelligence",
  fraud_detection: "decision_intelligence",
  credit_underwriting: "decision_intelligence",
  trade_surveillance: "decision_intelligence",
  regulatory_change_monitor: "decision_intelligence",
  third_party_risk: "decision_intelligence",
  learning_recommender: "decision_intelligence",
  resume_screening: "decision_intelligence",

  // ─── C · Process Automation ────────────────────────────────────
  tier1_triage: "process_automation",
  campaign_orchestration: "process_automation",
  operations_automation: "process_automation",
  procurement_negotiation: "process_automation",
  field_dispatch: "process_automation",
  ap_invoice_processing: "process_automation",
  ar_collections: "process_automation",
  month_end_close: "process_automation",
  compliance_attestations: "process_automation",
  contract_review: "process_automation",
  ediscovery: "process_automation",
  itsm_agent: "process_automation",
  medical_coding: "process_automation",
  prior_authorisation: "process_automation",
  pharmacovigilance: "process_automation",
  kyc_aml: "process_automation",
  claims_processing: "process_automation",
  grant_review: "process_automation",

  // ─── D · Build & Operate Systems ───────────────────────────────
  code_assistant: "build_operate",
  code_review_agent: "build_operate",
  incident_response: "build_operate",
  log_analysis: "build_operate",
  test_generation: "build_operate",
  vulnerability_triage: "build_operate",
  data_quality_monitor: "build_operate",
  endpoint_security_triage: "build_operate",
  soc_analyst_assist: "build_operate",
  identity_access_review: "build_operate",
  phishing_response: "build_operate",
  predictive_maintenance: "build_operate",
  quality_inspection: "build_operate",
  shop_floor_assist: "build_operate",
};

export function workflowTypeOf(useCaseId: string): WorkflowTypeId {
  return WORKFLOW_TYPE_OF[useCaseId] ?? "knowledge_communication";
}

/* ─── Per-type vendor scoring ────────────────────────────────────── */

/** The minimal vendor shape the per-type ranker needs. */
export interface RankableVendor {
  vendorId: string;
  vendorName: string;
  ownership: string;
  pillarScores: Record<PillarId, number>;
  excluded: boolean;
  recommendationBand: string;
  /** The engine's overall finalScore — used as a deterministic
   *  tie-breaker so equal type-fit scores keep a stable order. */
  finalScore: number;
}

export interface TypeRankedVendor {
  vendorId: string;
  vendorName: string;
  ownership: string;
  excluded: boolean;
  recommendationBand: string;
  /** 0–100 weighted fit for this workflow type. */
  typeScore: number;
  /** 1-based rank within this workflow type. */
  rank: number;
}

/**
 * Weighted fit of one vendor for one workflow type. Excluded vendors
 * return 0 so they always sink to the bottom of the per-type list.
 */
export function typeFitScore(
  vendor: Pick<RankableVendor, "pillarScores" | "excluded">,
  type: WorkflowType,
): number {
  if (vendor.excluded) return 0;
  let sum = 0;
  for (const [pillar, weight] of Object.entries(type.weights) as [PillarId, number][]) {
    sum += (vendor.pillarScores[pillar] ?? 0) * weight;
  }
  return Math.round(sum * 10) / 10;
}

/**
 * Rank all vendors for a single workflow type. Non-excluded vendors
 * sort by typeScore desc (finalScore as tie-break); excluded vendors
 * trail in their original order.
 */
export function rankVendorsForType(
  vendors: RankableVendor[],
  type: WorkflowType,
): TypeRankedVendor[] {
  const scored = vendors.map((v) => ({
    vendor: v,
    typeScore: typeFitScore(v, type),
  }));
  scored.sort((a, b) => {
    if (a.vendor.excluded !== b.vendor.excluded) return a.vendor.excluded ? 1 : -1;
    if (b.typeScore !== a.typeScore) return b.typeScore - a.typeScore;
    return b.vendor.finalScore - a.vendor.finalScore;
  });
  return scored.map((s, i) => ({
    vendorId: s.vendor.vendorId,
    vendorName: s.vendor.vendorName,
    ownership: s.vendor.ownership,
    excluded: s.vendor.excluded,
    recommendationBand: s.vendor.recommendationBand,
    typeScore: s.typeScore,
    rank: i + 1,
  }));
}

/**
 * Which workflow types are "active" for a result — i.e. the buyer
 * selected at least one workflow that maps to them. Used to badge the
 * type the buyer actually scoped, while still showing all four.
 */
export function activeWorkflowTypes(useCaseIds: string[]): Set<WorkflowTypeId> {
  const set = new Set<WorkflowTypeId>();
  for (const id of useCaseIds) set.add(workflowTypeOf(id));
  return set;
}
