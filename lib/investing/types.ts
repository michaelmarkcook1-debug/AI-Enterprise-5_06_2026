import type { EvidenceGrade } from "@/lib/types";

export type ExposureType =
  | "public_platform"
  | "ai_infrastructure"
  | "enterprise_workflow_ai"
  | "data_analytics_ai"
  | "indirect_private_exposure"
  | "ipo_watch"
  | "private_inaccessible"
  | "cash";

export type ExposureClass =
  | "core_public_ai_platform"
  | "ai_infrastructure_enabler"
  | "enterprise_workflow_ai"
  | "data_analytics_ai_layer"
  | "frontier_private_ai_lab"
  | "vertical_ai_specialist"
  | "ai_infrastructure_ipo"
  | "defensive_enterprise_ai"
  | "sovereign_ai"
  | "enterprise_search_work_ai"
  | "indirect_exposure"
  | "private_inaccessible"
  | "etf_or_fund_exposure"
  | "cash";

export type PublicStatus = "public" | "private" | "cash";

export type InvestabilityStatus =
  | "public_direct"
  | "public_indirect"
  | "ipo_watch"
  | "private_inaccessible"
  | "accredited_only"
  | "etf_indirect"
  | "not_legitimately_accessible"
  | "cash";

export type ScenarioName = "bull" | "base" | "bear" | "stress";
export type RiskProfile = "conservative" | "balanced" | "aggressive" | "speculative";
export type AllocationStyle = "manual" | "model_guided" | "thesis_based" | "single_stock";
export type InvestmentUniverse = "public_only" | "public_and_indirect" | "ipo_watch" | "speculative_all" | "single_stock";
export type Region = "US" | "Europe" | "Global";
export type IncludePrivateExposure = "no" | "indirect_only" | "ipo_watchlist";
export type RebalanceFrequency = "none" | "quarterly" | "annually";
export type GlobalRiskClimate = "calm" | "elevated" | "tense" | "crisis";
export type IpoPricingRisk = "low" | "medium" | "medium_high" | "high";
export type PostIpoForecast =
  | "compounder_candidate"
  | "pop_and_fade_risk"
  | "wait_for_lockup_candidate"
  | "trading_ipo"
  | "avoid_until_s1_clarity";
export type DataStatus = "seed" | "estimated" | "inferred" | "documented" | "tested" | "verified" | "stale" | "disputed" | "unknown" | "unsupported";
export type TruthDataStatus = DataStatus;
export type SourceStatus = "source_backed" | "source_needed" | "uncertain" | "requires_validation" | "unknown";
export type FreshnessStatus = "fresh" | "stale" | "unknown";

export interface InvestorToolNav {
  id: string;
  label: string;
  route: string;
  children?: InvestorToolNav[];
}

export type ProductCategory =
  | "enterprise_assistant"
  | "model_api"
  | "foundation_model"
  | "coding_agent"
  | "agent_platform"
  | "agent_runtime"
  | "agent_governance"
  | "enterprise_search"
  | "rag_knowledge"
  | "governance_control"
  | "security_control"
  | "ai_development_platform"
  | "data_ai_platform"
  | "cloud_ai_platform"
  | "workflow_ai"
  | "crm_ai"
  | "hr_ai"
  | "legal_ai"
  | "finance_ai"
  | "developer_ai"
  | "security_ai"
  | "ai_infrastructure"
  | "ai_compute"
  | "ai_networking"
  | "semiconductor_equipment"
  | "sovereign_ai"
  | "investment_exposure"
  | "ipo_watch"
  | "indirect_exposure"
  | "other";

export interface ProductScope {
  id: string;
  vendorId: string;
  vendorName: string;
  productName: string;
  productCategory: ProductCategory;
  productDescription: string;
  measurementScope: string;
  includedInModules: string[];
  productType: string;
  moduleCoverage: string[];
  measuredInModules: string[];
  sourceStatus: SourceStatus;
  sourceName: string;
  sourceUrl?: string;
  evidenceGrade: EvidenceGrade;
  evidenceStatus: TruthDataStatus;
  confidenceScore: number;
  sourceIds: string[];
  truthRecordIds: string[];
  uncertaintyNote: string;
  lastVerified: string;
  includeInAssessment: boolean;
  includeInMarketIntelligence: boolean;
  includeInInvestorTools: boolean;
  includeInSimulator: boolean;
}

export interface InvestmentProviderProfile {
  id: string;
  providerId: string;
  name: string;
  slug: string;
  ticker: string | null;
  exposureClass: ExposureClass;
  exposureType: ExposureType;
  publicStatus: PublicStatus;
  investabilityStatus: InvestabilityStatus;
  aiProviderQualityScore: number;
  aiRevenueExposureScore: number;
  investmentAttractivenessScore: number;
  shortTermCatalystScore: number;
  longTermHoldScore: number;
  speculativeUpsideScore: number;
  ipoReadinessScore: number;
  ipoPricingRisk: IpoPricingRisk;
  retailAccessScore: number;
  valuationRiskScore: number;
  liquidityRiskScore: number;
  capexRiskScore: number;
  regulatoryRiskScore: number;
  infrastructureDependencyScore: number;
  aiCapitalEfficiencyScore: number;
  hypePenalty: number;
  evidenceConfidence: number;
  evidenceGrade: EvidenceGrade;
  keyThesis: string;
  mainRisk: string;
  dataStatus: DataStatus;
  lastUpdated: string;
  productScopeIds: string[];
}

export interface FinancialMetric {
  providerId: string;
  metricName: string;
  value: number | string;
  period: string;
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  confidence: number;
  capturedAt: string;
}

export interface ValuationMetric {
  providerId: string;
  marketCap?: number;
  enterpriseValue?: number;
  evRevenue?: number;
  evGrossProfit?: number;
  evFcf?: number;
  peRatio?: number;
  pegRatio?: number;
  capexRevenue?: number;
  sbcRevenue?: number;
  rpoGrowth?: number;
  fcfMargin?: number;
  valuationDate: string;
  confidence: number;
}

export interface SimulationHolding {
  providerId: string;
  ticker?: string | null;
  name?: string;
  weightPct: number;
  amount: number;
  exposureType: ExposureType;
  investabilityStatus?: InvestabilityStatus;
  isDirectlyInvestable: boolean;
  confidence: number;
  evidenceGrade?: EvidenceGrade;
  warning?: string;
}

export interface SimulationPortfolio {
  id: string;
  name: string;
  startingCapital: number;
  horizonYears: number;
  riskProfile: RiskProfile;
  allocationStyle: AllocationStyle;
  investmentUniverse: InvestmentUniverse;
  region: Region;
  includePrivateExposure: IncludePrivateExposure;
  rebalanceFrequency: RebalanceFrequency;
  cashReservePct: number;
  globalRiskClimate?: GlobalRiskClimate;
  applySignalOverlay?: boolean;
  holdings: SimulationHolding[];
  createdAt: string;
}

export interface ScenarioAssumption {
  scenario: ScenarioName;
  providerId: string;
  annualReturnSeed: number;
  revenueGrowthImpact: number;
  marginImpact: number;
  multipleImpact: number;
  aiShareImpact: number;
  catalystImpact: number;
  riskPenalty: number;
  shockPenalty: number;
}

export interface ScenarioPoint {
  year: number;
  value: number;
}

export interface SimulationInput {
  startingCapital: number;
  horizonYears: number;
  riskProfile: RiskProfile;
  allocationStyle: AllocationStyle;
  investmentUniverse: InvestmentUniverse;
  region: Region;
  includePrivateExposure: IncludePrivateExposure;
  rebalanceFrequency: RebalanceFrequency;
  cashReservePct: number;
  selectedVendorIds?: string[];
  manualAllocations?: Record<string, number>;
  globalRiskClimate?: GlobalRiskClimate;
  applySignalOverlay?: boolean;
}

export interface SimulationResult {
  portfolioId: string;
  bullPath: ScenarioPoint[];
  basePath: ScenarioPoint[];
  bearPath: ScenarioPoint[];
  stressPath: ScenarioPoint[];
  bullValue: number;
  baseValue: number;
  bearValue: number;
  stressValue: number;
  worstDrawdown: number;
  aiExposureScore: number;
  qualityScore: number;
  speculationScore: number;
  riskScore: number;
  confidenceScore: number;
  contributionByHolding: { providerId: string; contribution: number }[];
  riskByHolding: { providerId: string; risk: number }[];
  assumptions: ScenarioAssumption[];
}

export interface AllocationValidation {
  isValid: boolean;
  totalAllocationPct: number;
  cashReservePct: number;
  investedAllocationPct: number;
  errors: string[];
  warnings: string[];
}

export interface ShockEvent {
  shockId: string;
  shockType: string;
  shockLabel: string;
  shockDescription: string;
  shockYear: number;
  shockQuarter: number;
  severity: number;
  affectedProviderIds: string[];
  affectedExposureClasses: ExposureClass[];
  parameterImpacts: RiskShock;
  displayMessage: string;
  randomSeed: string;
}

export interface ChartData {
  chartId: string;
  chartType: string;
  simulationStateHash: string;
  data: unknown;
  generatedAt: string;
  sourceIds: string[];
  confidenceScore: number;
  dataStatus: TruthDataStatus;
}

export interface SimulationState {
  input: SimulationInput;
  eligibleUniverse: InvestmentProviderProfile[];
  selectedHoldings: SimulationHolding[];
  allocationValidation: AllocationValidation;
  scenarioAssumptions: ScenarioAssumption[];
  shocks: ShockEvent[];
  computedPaths: Pick<SimulationResult, "bullPath" | "basePath" | "bearPath" | "stressPath"> | null;
  computedScores: Pick<SimulationResult, "aiExposureScore" | "qualityScore" | "speculationScore" | "riskScore" | "confidenceScore"> | null;
  chartData: ChartData[];
  evidenceStatus: TruthDataStatus;
  errors: string[];
  lastUpdatedAt: string;
  stateHash: string;
  portfolio: SimulationPortfolio | null;
  result: SimulationResult | null;
}

export interface IndirectExposure {
  privateProviderId: string;
  publicTicker: string;
  exposureType: string;
  exposureStrength: number;
  revenueLinkage: number;
  confidence: number;
  dilutionPenalty: number;
  indirectExposureScore?: number;
}

export interface IPOProfile {
  providerId: string;
  rumourStage: "R0" | "R1" | "R2" | "R3" | "R4" | "R5";
  rumourQualityScore: number;
  readinessScore: number;
  pricingRisk: IpoPricingRisk;
  pricingRiskScore: number;
  expectedFloat: number;
  lockupRisk: number;
  lockupExpiryDate?: string;
  insiderSellingAtIPO?: boolean;
  sellingShareholdersPct?: number;
  useOfProceeds?: string;
  dualClassStructure?: boolean;
  firstEarningsDate?: string;
  underwriterSupportRisk?: number;
  postIpoForecast: PostIpoForecast;
  confidence: number;
  nextWatchEvent: string;
  missingEvidence: string[];
}

export type RumourQuality =
  | "R0"
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R0_or_R1"
  | "R0_standalone"
  | "R1_or_R2"
  | "R2_or_R3"
  | "R3_or_R4"
  | "R4_or_R5";

export type IPOFilingStatus =
  | "none"
  | "rumoured"
  | "confidential_reported"
  | "filed"
  | "price_range"
  | "active_marketing";

export type IPOForecastConfidence = "very_low" | "low" | "low_medium" | "medium_low" | "medium" | "medium_high" | "high";

export type IPOForecastStatus =
  | "active_process"
  | "likely_near_term"
  | "plausible_watch"
  | "broad_window_only"
  | "no_reliable_month_estimate"
  | "not_modelled_standalone"
  | "disabled_until_filing"
  | "model_estimate_not_fact";

export type IPOBehaviourForecast =
  | "speculative_ai_infrastructure"
  | "mega_hype_valuation_sensitive"
  | "high_quality_compute_and_valuation_risk"
  | "software_compounder_candidate"
  | "enterprise_ai_valuation_dependent"
  | "vertical_ai_tam_proof_needed"
  | "enterprise_knowledge_layer_watch"
  | "sovereign_ai_strategic_bet"
  | "search_answer_engine_volatility"
  | "enterprise_agentic_watch"
  | "too_early"
  | "spacex_linked_only";

export interface IPOEvidenceQuality {
  providerId: string;
  rumourQuality: RumourQuality;
  sourceIds: string[];
  sourceNames: string[];
  sourceUrls: string[];
  sourceDates: string[];
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  filingStatus: IPOFilingStatus;
  officialFilingUrl?: string;
  hasConfirmedS1: boolean;
  hasConfirmedPriceRange: boolean;
  hasConfirmedFloat: boolean;
  hasConfirmedLockup: boolean;
  hasAuditedFinancials: boolean;
  uncertaintyNote: string;
  forecastPermitted: boolean;
}

export interface IPOForecast {
  providerId: string;
  estimatedIpoMonth: string | null;
  credibleWindowStart: string | null;
  credibleWindowEnd: string | null;
  confidence: IPOForecastConfidence;
  confidenceScore: number;
  rumourQuality: RumourQuality;
  forecastStatus: IPOForecastStatus;
  forecastStatusLabel: string;
  behaviourForecast: IPOBehaviourForecast;
  dataStatus: Extract<DataStatus, "estimated" | "seed" | "unknown" | "unsupported">;
  sourceRequired: boolean;
  sourceIds: string[];
  evidenceGrade: EvidenceGrade;
  sourceNames: string[];
  sourceUrls: string[];
  sourceDates: string[];
  relativeTo: "ipo_offer_price";
  forecastDisabledReason?: string;
  hasVerifiedOfferPrice: boolean;
  warning: string;
  notes: string;
  uncertaintyNotes: string[];
}

export interface PostIPOFluctuationBand {
  providerId: string;
  relativeTo: "ipo_offer_price";
  monthNumber: number;
  lowPct: number;
  highPct: number;
  confidence: IPOForecastConfidence;
  dataStatus: Extract<DataStatus, "estimated" | "seed" | "unknown" | "unsupported">;
  sourceIds: string[];
  uncertaintyNote: string;
}

export interface MissingIPODataChecklist {
  providerId: string;
  missingItem: string;
  importance: "critical" | "high" | "medium";
  blockingStatus: "blocks_month_forecast" | "blocks_price_bands" | "widens_bands" | "lowers_confidence";
  howItChangesForecast: string;
  lastCheckedAt: string;
}

export interface RiskShock {
  valuationCompressionPct: number;
  capexSpikePct: number;
  cloudGrowthSlowdownPct: number;
  regulatoryShockSeverity: number;
  ipoLockupSelloffPct: number;
  infrastructureShortageSeverity: number;
  modelCommoditisationSeverity: number;
  enterpriseAdoptionSlowdownPct: number;
}
