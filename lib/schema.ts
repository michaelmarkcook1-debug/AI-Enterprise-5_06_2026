import { z } from "zod";

const oneToFive = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const AssessmentInputSchema = z.object({
  industry: z.enum([
    "regulated_financial",
    "health_life_sciences",
    "legal_professional",
    "public_sector_education",
    "critical_infrastructure_defence",
    "enterprise_software",
    "industrial_physical_ops",
    "commercial_enterprise",
  ]),
  region: z.string().optional(),
  orgSize: z.enum(["smb", "mid_market", "enterprise", "global_enterprise"]),
  aiMaturity: z.enum(["exploring", "piloting", "scaling", "operating"]).optional(),
  primaryObjectives: z.array(z.string()).min(1),
  useCases: z.array(z.string()).min(1),
  dataSensitivity: oneToFive,
  riskTolerance: oneToFive,
  autonomyAppetite: z.enum(["advisory_only", "human_in_loop", "supervised_agent", "autonomous"]),
  ecosystem: z.array(z.string()),
  deploymentPreference: z.enum(["saas", "vpc", "on_prem", "sovereign", "hybrid"]),
  budgetSensitivity: oneToFive,
  vendorIds: z.array(z.string()),

  // ─── v1.2 Guided fields (previously stripped — now wired through) ───
  governanceStrictness: oneToFive.optional(),
  integrationDepth: z.enum(["shallow", "moderate", "deep", "core_system"]).optional(),
  humanReviewModel: z.enum(["no_review", "sampling", "approval_gate", "dual_approval"]).optional(),
  lockInTolerance: z.enum(["averse", "cautious", "comfortable", "indifferent"]).optional(),
  dataResidency: z.enum(["no_constraint", "us_only", "eu_only", "uk_only", "apac_only", "sovereign_required"]).optional(),

  // ─── v1.2 Advanced fields (previously stripped — now wired through) ───
  switchingCostTolerance: oneToFive.optional(),
  sovereigntyRequirement: z.enum(["none", "soft", "hard"]).optional(),
  rfpCycle: z.enum(["informal", "structured", "formal_rfp", "public_procurement"]).optional(),
  stackAppetite: z.enum(["single_vendor", "two_to_three", "best_of_breed"]).optional(),
  concentrationRiskTolerance: z.enum(["avoid_concentration", "balanced", "accept_concentration"]).optional(),
  tcoHorizon: z.enum(["1_year", "3_year", "5_year", "10_year"]).optional(),
  negotiationPower: z.enum(["low", "medium", "high"]).optional(),
  requiredCertifications: z.array(z.enum([
    "soc2_type2", "iso_27001", "iso_42001",
    "hipaa", "fedramp_moderate", "fedramp_high",
    "pci_dss", "gdpr_eu_dpa",
    "eu_ai_act_high_risk", "uk_gov_g_cloud",
    "cmmc_l2", "nist_800_171", "nerc_cip", "iec_62443", "fedramp_high_il5",
  ])).optional(),
  outputMode: z.enum(["executive", "buyer", "technical", "procurement"]).optional(),

  // ─── v1.3 Opportunity (Quick) — value & ROI ───
  valueAtStake: z.enum(["lt_250k", "250k_1m", "1m_5m", "5m_25m", "gt_25m"]).optional(),
  expectedUplift: z.enum(["lt_10", "10_25", "25_50", "gt_50"]).optional(),

  // ─── v1.3 Strategy (Guided) — build-vs-buy + readiness ───
  buildVsBuy: z.enum(["buy_saas", "buy_configure", "build_on_platform", "build_from_scratch", "undecided"]).optional(),
  dataReadiness: oneToFive.optional(),
  changeSponsorship: z.enum(["none", "mid_level", "exec", "board"]).optional(),

  // ─── v1.3 Procurement (Advanced) — model-quality, cost, IP, exit ───
  useCaseRiskClass: z.enum(["minimal", "limited", "high_risk", "prohibited_adjacent"]).optional(),
  maxHallucinationTolerance: z.enum(["zero", "low", "moderate", "best_effort"]).optional(),
  evalEvidenceRequired: z.array(z.enum(["independent_eval", "red_team_report", "model_card", "safety_eval"])).optional(),
  expectedConsumption: z.enum(["pilot", "department", "business_unit", "enterprise_wide"]).optional(),
  acceptablePricingModels: z.array(z.enum(["per_seat", "per_token", "committed_use", "flat_platform", "outcome_based"])).optional(),
  costCeiling: z.enum(["lt_100k", "100k_500k", "500k_2m", "2m_10m", "gt_10m"]).optional(),
  ipAndDataRights: z.array(z.enum(["no_training_on_data", "output_ip_owned", "ip_indemnification", "audit_rights"])).optional(),
  exitRequirements: z.array(z.enum(["contractual_offramp", "open_format_export", "model_config_portability", "parallel_run"])).optional(),
  incumbentAnnualSpend: z.enum(["none", "lt_250k", "250k_1m", "1m_5m", "gt_5m"]).optional(),
  renewalWindow: z.enum(["lt_3mo", "3_6mo", "6_12mo", "gt_12mo", "no_incumbent"]).optional(),
  qualifiedAlternatives: z.number().int().min(0).max(50).optional(),

  // ─── v1.3 Infrastructure ───
  selectedSystemsOfRecord: z.array(z.string()).optional(),
});

export type AssessmentInputDTO = z.infer<typeof AssessmentInputSchema>;
