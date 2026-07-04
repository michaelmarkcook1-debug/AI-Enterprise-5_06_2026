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
// `model_quality` is a category-scoped capability domain (Arena human-preference
// Elo), NOT part of the framework's even 12 — it is activated only by category
// weight profiles that include it (e.g. frontier_model_api) and is SYNTHESIZED
// at read-time from the model_quality pillar (never stored on EvidenceRecord, so
// it needs no DB enum/migration). `market_position` is a market-share dimension,
// also excluded from the 12 framework assessment domains.
export type DomainId =
  | "strategic_value"
  | "data_security_privacy"
  | "identity_access"
  | "model_reliability"
  | "model_quality"
  | "governance_compliance"
  | "security_threat"
  | "integration_architecture"
  | "agentic_autonomy"
  | "cost_finops"
  | "workforce_adoption"
  | "vendor_maturity_lockin"
  | "capital_resilience"
  | "market_position"
  | "dev_sentiment"; // category-scoped (coding models) — developer-community signal

export const DOMAIN_TO_PILLAR: Record<DomainId, PillarId> = {
  strategic_value: "business_fit",
  data_security_privacy: "enterprise_control",
  identity_access: "enterprise_control",
  model_reliability: "reliability_safety",
  model_quality: "reliability_safety",
  governance_compliance: "enterprise_control",
  security_threat: "reliability_safety",
  integration_architecture: "integration_ops",
  agentic_autonomy: "integration_ops",
  cost_finops: "integration_ops",
  workforce_adoption: "business_fit",
  vendor_maturity_lockin: "vendor_resilience",
  capital_resilience: "vendor_resilience",
  market_position: "market_strength",
  dev_sentiment: "market_strength", // developer mindshare is a market-strength signal
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
  | "eu_ai_act_high_risk" | "uk_gov_g_cloud"
  // v1.3 — defence / critical-infrastructure certification regimes
  | "cmmc_l2" | "nist_800_171" | "nerc_cip" | "iec_62443" | "fedramp_high_il5";
export type OutputMode = "executive" | "buyer" | "technical" | "procurement";

/* ─── v1.3 Opportunity (Quick) — value & ROI quantification ─────── */

/** Annual value the buyer believes the use case is worth. */
export type ValueAtStakeBand = "lt_250k" | "250k_1m" | "1m_5m" | "5m_25m" | "gt_25m";
/** Realistic target improvement on the primary objective. */
export type UpliftBand = "lt_10" | "10_25" | "25_50" | "gt_50";

/* ─── v1.3 Strategy (Guided) — build-vs-buy + readiness ─────────── */

export type BuildVsBuy =
  | "buy_saas" | "buy_configure" | "build_on_platform" | "build_from_scratch" | "undecided";
/** 1 = no usable data, 5 = clean / governed / labelled. */
export type DataReadiness = 1 | 2 | 3 | 4 | 5;
export type ChangeSponsorship = "none" | "mid_level" | "exec" | "board";

/* ─── v1.3 Procurement (Advanced) — model-quality, cost, IP, exit ─ */

/** EU AI Act risk classification of the buyer's own use case. */
export type UseCaseRiskClass = "minimal" | "limited" | "high_risk" | "prohibited_adjacent";
export type HallucinationTolerance = "zero" | "low" | "moderate" | "best_effort";
export type EvalEvidence = "independent_eval" | "red_team_report" | "model_card" | "safety_eval";
export type ConsumptionBand = "pilot" | "department" | "business_unit" | "enterprise_wide";
export type PricingModel = "per_seat" | "per_token" | "committed_use" | "flat_platform" | "outcome_based";
export type CostCeilingBand = "lt_100k" | "100k_500k" | "500k_2m" | "2m_10m" | "gt_10m";
export type IpDataRight = "no_training_on_data" | "output_ip_owned" | "ip_indemnification" | "audit_rights";
export type ExitRequirement =
  | "contractual_offramp" | "open_format_export" | "model_config_portability" | "parallel_run";
/** Fact-derived negotiation leverage inputs (replace the self-rated slider). */
export type IncumbentSpendBand = "none" | "lt_250k" | "250k_1m" | "1m_5m" | "gt_5m";
export type RenewalWindow = "lt_3mo" | "3_6mo" | "6_12mo" | "gt_12mo" | "no_incumbent";

/** Vendor-side deployment topologies the engine can match against residency / exit asks. */
export type VendorDeploymentModel = "saas" | "vpc" | "on_prem" | "byoc" | "self_host";

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

  /* ─── v1.3 Opportunity (Quick) — value & ROI ──────────────────── */

  /** Annual value the buyer believes the use case is worth. */
  valueAtStake?: ValueAtStakeBand;
  /** Realistic target improvement on the primary objective. */
  expectedUplift?: UpliftBand;

  /* ─── v1.3 Strategy (Guided) — build-vs-buy + readiness ───────── */

  buildVsBuy?: BuildVsBuy;
  /** Availability + quality + governance of data to feed the use case. */
  dataReadiness?: DataReadiness;
  changeSponsorship?: ChangeSponsorship;

  /* ─── v1.3 Procurement (Advanced) — model-quality, cost, IP, exit ─ */

  /** EU AI Act risk class of the buyer's use case (cascades to certs + FRIA). */
  useCaseRiskClass?: UseCaseRiskClass;
  /** Max acceptable error/hallucination band — parameterises Reliability & Safety. */
  maxHallucinationTolerance?: HallucinationTolerance;
  /** Independent evidence the buyer requires before deployment. */
  evalEvidenceRequired?: EvalEvidence[];
  /** Usage scale, required so the TCO horizon can actually compute. */
  expectedConsumption?: ConsumptionBand;
  /** Pricing models the buyer will accept; others are penalised. */
  acceptablePricingModels?: PricingModel[];
  /** Hard annual budget ceiling for this deployment. */
  costCeiling?: CostCeilingBand;
  /** IP / data-rights the buyer requires in the contract. */
  ipAndDataRights?: IpDataRight[];
  /** Reversibility / exit asks (replace the self-rated switching slider). */
  exitRequirements?: ExitRequirement[];
  /** Fact-derived leverage: incumbent annual spend on the system being replaced. */
  incumbentAnnualSpend?: IncumbentSpendBand;
  /** Fact-derived leverage: how soon the incumbent contract renews. */
  renewalWindow?: RenewalWindow;
  /** Fact-derived leverage: count of qualified alternative vendors. */
  qualifiedAlternatives?: number;

  /* ─── v1.3 Infrastructure ─────────────────────────────────────── */

  /** Industry systems-of-record the buyer runs (Epic, Guidewire, Murex …). */
  selectedSystemsOfRecord?: string[];
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

  /* ─── v1.3 structured signals (replace free-text excerpt scanning) ─
   * The tier overlay previously scanned synthetic evidence excerpts for
   * certifications / regions / multi-cloud, which misfired. These typed
   * fields let the engine match deterministically (set intersection).
   * All optional so existing data and tests keep working. */

  /** Certifications the vendor holds (ids align with RequiredCertification). */
  certifications?: string[];
  /** Deployment topologies the vendor offers. */
  deploymentModels?: VendorDeploymentModel[];
  /** Data-residency regions the vendor can demonstrably serve (us/eu/uk/apac). */
  regions?: string[];
  /** Layered-infrastructure item ids the vendor is natively integrated with. */
  ecosystemNative?: string[];
  /** Industry systems-of-record the vendor has native connectors for. */
  supportedSystemsOfRecord?: string[];
  /** Pricing models the vendor offers (ids align with PricingModel). */
  pricingModels?: string[];
  /** Independent evaluation evidence the vendor publishes (ids align with EvalEvidence). */
  evalEvidence?: string[];
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
  /** v1.4 — bounded market-signal (news) adjustment applied to this vendor's
   *  pillar scores, when fresh high-impact news is supplied to the engine.
   *  Absent when no news signal applied. Capped (±3 pts/pillar) so it tilts,
   *  never flips, an evidence-graded evaluation. */
  newsAdjustment?: NewsAdjustment;
}

/** A bounded, time-decayed adjustment to a vendor's pillar scores derived from
 *  fresh news. Produced by lib/intelligence/news-signal.ts and consumed by the
 *  engine; lives here so the engine stays free of intelligence-layer imports. */
export interface NewsAdjustment {
  /** Net delta per pillar after capping (points on the 0-100 pillar scale). */
  perPillar: Partial<Record<PillarId, number>>;
  /** The news items that drove the adjustment, for transparency in outputs. */
  drivers: { title: string; pillars: PillarId[]; delta: number; publishedAt: string }[];
  /** Sum of absolute per-pillar deltas — quick "how much did news move this" gauge. */
  totalAbs: number;
}

export interface AssessmentResult {
  runId: string;
  generatedAt: string;
  scoringRuleVersion: string;
  inputSummary: AssessmentInput & { industryName: string };
  ranking: VendorResult[];
  comparisonSummary: string;

  /* ─── v1.3 outputs (engine attaches these; optional so older runs parse) ─── */

  /** Opportunity-value context derived from valueAtStake × expectedUplift. */
  opportunity?: {
    valueAtStake?: string;
    expectedUplift?: string;
    estimatedAnnualValue?: number;
    priority: "low" | "medium" | "high" | "flagship";
  } | null;
  /** Buyer ecosystem concentration (single-parent lock-in signal). */
  buyerConcentration?: { topParent: string | null; share: number };
  /** Tier-overlay weight deltas + plain-English rationale for the score shifts. */
  tierOverlay?: { weightDelta: Partial<Record<PillarId, number>>; rationale: string[] };
}
