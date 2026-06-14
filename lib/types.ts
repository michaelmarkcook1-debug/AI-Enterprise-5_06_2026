// Enterprise AI Platform Ranking Engine — Core Type Model
// Source: Product Spec v1.0, Sections 8–13, 16, 18.
// Six user-facing pillars; 12-domain backend; E0–E5 evidence grading.

export type PillarId =
  | "business_fit"
  | "enterprise_control"
  | "reliability_safety"
  | "integration_ops"
  | "vendor_resilience"
  | "market_strength";

export const PILLARS: { id: PillarId; label: string; defaultWeight: number }[] = [
  { id: "business_fit", label: "Business Fit", defaultWeight: 0.15 },
  { id: "enterprise_control", label: "Enterprise Control", defaultWeight: 0.25 },
  { id: "reliability_safety", label: "Reliability & Safety", defaultWeight: 0.15 },
  { id: "integration_ops", label: "Integration & Operations", defaultWeight: 0.15 },
  { id: "vendor_resilience", label: "Vendor Resilience", defaultWeight: 0.15 },
  { id: "market_strength", label: "Market Strength", defaultWeight: 0.15 },
];

// 12 backend domains (spec §9). Each maps to one primary pillar.
export type DomainId =
  | "strategic_value"
  | "data_security_privacy"
  | "identity_access"
  | "model_reliability"
  | "governance_compliance"
  | "security_threat"
  | "integration_architecture"
  | "agentic_autonomy"
  | "cost_finops"
  | "workforce_adoption"
  | "vendor_maturity_lockin"
  | "capital_resilience"
  | "market_position";

export const DOMAIN_TO_PILLAR: Record<DomainId, PillarId> = {
  strategic_value: "business_fit",
  data_security_privacy: "enterprise_control",
  identity_access: "enterprise_control",
  model_reliability: "reliability_safety",
  governance_compliance: "enterprise_control",
  security_threat: "reliability_safety",
  integration_architecture: "integration_ops",
  agentic_autonomy: "integration_ops",
  cost_finops: "integration_ops",
  workforce_adoption: "business_fit",
  vendor_maturity_lockin: "vendor_resilience",
  capital_resilience: "vendor_resilience",
  market_position: "market_strength",
};

// Evidence grading (spec §12.3)
export type EvidenceGrade = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";
export const EVIDENCE_MODIFIER: Record<EvidenceGrade, number> = {
  E0: 0.0,
  E1: 0.4,
  E2: 0.6,
  E3: 0.75,
  E4: 0.9,
  E5: 1.0,
};

export type RiskSeverity = "fatal" | "severe" | "moderate" | "low";
export const RISK_PENALTY: Record<RiskSeverity, number> = {
  fatal: 100, // exclusion handled separately
  severe: 18,
  moderate: 8,
  low: 3,
};

export type RecommendationBand =
  | "not_recommended"
  | "pilot_only"
  | "controlled_deployment"
  | "enterprise_scale";

export type IndustryArchetype =
  | "regulated_financial"
  | "health_life_sciences"
  | "legal_professional"
  | "public_sector_education"
  | "critical_infrastructure_defence"
  | "enterprise_software"
  | "industrial_physical_ops"
  | "commercial_enterprise";

export type DeploymentPreference = "saas" | "vpc" | "on_prem" | "sovereign" | "hybrid";

export type AutonomyAppetite = "advisory_only" | "human_in_loop" | "supervised_agent" | "autonomous";

export type AdoptionMaturityBand = "nascent" | "emerging" | "developing" | "mainstream" | "advanced";

// User input — context that drives scoring (spec §7)
/* ─── Guided tier additional inputs ─────────────────────────────── */

export type GovernanceStrictness = 1 | 2 | 3 | 4 | 5;
export type IntegrationDepth = "shallow" | "moderate" | "deep" | "core_system";
export type HumanReviewModel = "no_review" | "sampling" | "approval_gate" | "dual_approval";
export type LockInTolerance = "averse" | "cautious" | "comfortable" | "indifferent";
export type DataResidency = "no_constraint" | "us_only" | "eu_only" | "uk_only" | "apac_only" | "sovereign_required";

/* ─── Advanced tier additional inputs ───────────────────────────── */

export type SwitchingCostTolerance = 1 | 2 | 3 | 4 | 5;
export type SovereigntyRequirement = "none" | "soft" | "hard";
export type RfpCycle = "informal" | "structured" | "formal_rfp" | "public_procurement";
export type StackAppetite = "single_vendor" | "two_to_three" | "best_of_breed";
export type ConcentrationRiskTolerance = "avoid_concentration" | "balanced" | "accept_concentration";
export type TcoHorizon = "1_year" | "3_year" | "5_year" | "10_year";
export type NegotiationPower = "low" | "medium" | "high";
export type RequiredCertification =
  | "soc2_type2" | "iso_27001" | "iso_42001"
  | "hipaa" | "fedramp_moderate" | "fedramp_high"
  | "pci_dss" | "gdpr_eu_dpa"
  | "eu_ai_act_high_risk" | "uk_gov_g_cloud";
export type OutputMode = "executive" | "buyer" | "technical" | "procurement";

export interface AssessmentInput {
  industry: IndustryArchetype;
  region?: string;
  orgSize: "smb" | "mid_market" | "enterprise" | "global_enterprise";
  aiMaturity?: "exploring" | "piloting" | "scaling" | "operating";
  primaryObjectives: string[]; // e.g. ["productivity","customer_service"]
  useCases: string[]; // taxonomy ids
  dataSensitivity: 1 | 2 | 3 | 4 | 5;
  riskTolerance: 1 | 2 | 3 | 4 | 5;
  autonomyAppetite: AutonomyAppetite;
  ecosystem: string[]; // e.g. ["microsoft","salesforce","aws"]
  deploymentPreference: DeploymentPreference;
  budgetSensitivity: 1 | 2 | 3 | 4 | 5;
  vendorIds: string[]; // explicit set; if empty -> recommend

  /* ─── v1.2 Guided fields (all optional) ───────────────────────── */

  /** 1 = light-touch, 5 = SOX-strict end-to-end controls. */
  governanceStrictness?: GovernanceStrictness;
  /** How much of the org's stack the AI workflow touches. */
  integrationDepth?: IntegrationDepth;
  /** How outputs are reviewed before they affect the business. */
  humanReviewModel?: HumanReviewModel;
  /** How aversely the buyer treats vendor switching costs. */
  lockInTolerance?: LockInTolerance;
  /** Data-residency constraint inherited from policy or regulation. */
  dataResidency?: DataResidency;

  /* ─── v1.2 Advanced fields (all optional) ─────────────────────── */

  /** 1 = will accept high re-platforming cost, 5 = zero appetite. */
  switchingCostTolerance?: SwitchingCostTolerance;
  /** Sovereignty / nationality requirement on the vendor + their cloud. */
  sovereigntyRequirement?: SovereigntyRequirement;
  /** Procurement ceremony the assessment must support. */
  rfpCycle?: RfpCycle;
  /** How many vendors the buyer wants in the final shortlist. */
  stackAppetite?: StackAppetite;
  /** How much vendor / cloud concentration the buyer will accept. */
  concentrationRiskTolerance?: ConcentrationRiskTolerance;
  /** TCO horizon used for valuation comparisons. */
  tcoHorizon?: TcoHorizon;
  /** Buyer's negotiation leverage with the shortlisted vendors. */
  negotiationPower?: NegotiationPower;
  /** Required vendor certifications (multi-select). */
  requiredCertifications?: RequiredCertification[];
  /** Output mode the results page should render. */
  outputMode?: OutputMode;
}

export interface EvidenceItem {
  id: string;
  vendorId: string;
  domain: DomainId;
  subfactor: string;
  excerpt: string;
  sourceUrl?: string;
  capturedAt: string; // ISO date
  grade: EvidenceGrade;
  // 0-100 raw capability assertion this evidence supports
  rawScore: number;
  // For freshness modifier — days threshold per source category handled in engine
  freshnessDays?: number;
}

export interface RiskFlag {
  id: string;
  vendorId: string;
  severity: RiskSeverity;
  description: string;
  domain: DomainId;
  // If true, exclude this vendor in contexts that fail this blocker
  isFatalIfTriggered?: boolean;
  // Industries where this flag is fatal vs severe
  fatalInIndustries?: IndustryArchetype[];
}

export interface VendorIndustryAdoption {
  industry: IndustryArchetype;
  productionReferenceCount: number;
  deploymentDepthScore: number; // 0-100
  confidence: number; // 0-100
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  website?: string;
  hq?: string;
  ownership: "public" | "private" | "subsidiary";
  summary: string;
  supportedDeployments: DeploymentPreference[];
  ecosystemFit: string[]; // ecosystem tokens this vendor integrates well with
  useCaseFit: string[];
  evidence: EvidenceItem[];
  risks: RiskFlag[];
  industryAdoption: VendorIndustryAdoption[];
}

export interface IndustryProfile {
  id: IndustryArchetype;
  name: string;
  // Pillar weights — must sum to 1.0
  weights: Record<PillarId, number>;
  fatalBlockerDomains: DomainId[]; // weak coverage in these → fatal in this industry
  evidenceStrictness: number; // 1.0 baseline; >1 demands higher grades
  adoption: {
    experimentationPct: number;
    regularUsePct: number;
    productionPct: number;
    scaledPct: number;
    agenticExperimentationPct: number;
    agenticScaledPct: number;
  };
}

// Engine outputs — spec §18

export interface PillarBreakdown {
  pillar: PillarId;
  score: number; // 0-100
  weight: number;
  weightedContribution: number;
  contributingDomains: { domain: DomainId; score: number; evidenceCount: number }[];
}

export interface VendorResult {
  vendorId: string;
  vendorName: string;
  ownership: Vendor["ownership"];
  rank: number;
  finalScore: number; // 0-100
  confidenceScore: number; // 0-100
  recommendationBand: RecommendationBand;
  pillarScores: Record<PillarId, number>;
  pillarBreakdown: PillarBreakdown[];
  topStrengths: string[];
  topRisks: string[];
  missingEvidence: string[];
  validationSteps: string[];
  industryRationale: string;
  evidenceIds: string[];
  riskFlagsTriggered: RiskFlag[];
  excluded: boolean;
  excludedReason?: string;
  bonuses: { strategicFit: number; sectorAdoptionFit: number };
  penalties: { risk: number; missingEvidence: number; adoptionFriction: number };
}

export interface AssessmentResult {
  runId: string;
  generatedAt: string;
  scoringRuleVersion: string;
  inputSummary: AssessmentInput & { industryName: string };
  ranking: VendorResult[];
  comparisonSummary: string;
}
