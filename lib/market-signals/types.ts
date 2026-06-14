/**
 * Market Signals Engine — types.
 * Per the addendum (Sections 4, 5, 6, 9, 10).
 */

import type { DataStatus } from "../investing/types";
import type { EvidenceGrade } from "../types";

export type SignalCategory =
  | "macro"
  | "political_regulatory"
  | "market_sentiment"
  | "company_specific"
  | "ai_sector"
  | "financial_market"
  | "energy_infrastructure"
  | "legal_litigation"
  | "ipo_specific"
  | "social_market_talk";

export type SignalDirection = "positive" | "negative" | "mixed" | "neutral" | "unknown";
export type SignalTimeHorizon = "intraday" | "short_term" | "medium_term" | "long_term" | "structural";

export type SignalSourceType =
  | "official_filing"
  | "official_government"
  | "central_bank"
  | "company_release"
  | "exchange"
  | "reputable_news"
  | "analyst_report"
  | "market_data_api"
  | "regulatory_release"
  | "court_filing"
  | "social_media"
  | "search_trend"
  | "forum"
  | "commentary"
  | "internal_estimate";

export type AffectedScoreField =
  | "shortTermCatalystScore"
  | "longTermHoldScore"
  | "speculativeUpsideScore"
  | "ipoReadinessScore"
  | "ipoPricingRiskScore"
  | "postIpoBandWidth"
  | "postIpoBandCenter"
  | "valuationRiskScore"
  | "infrastructureDependencyScore"
  | "aiCapitalEfficiencyScore"
  | "marketMomentumScore"
  | "sentimentScore"
  | "volatilityScore"
  | "riskRadarScore";

export interface MarketSignal {
  id: string;
  signalType: SignalCategory;
  signalCategory: SignalCategory;
  title: string;
  summary: string;
  entityIds: string[];
  entityTypes: ("vendor" | "ticker" | "exposure_class" | "sector" | "country")[];
  vendorIds: string[];
  tickers: string[];
  affectedExposureClasses: string[];
  affectedModules: (
    | "investor_tools"
    | "simulator"
    | "ipo_watch"
    | "vendor_profile"
    | "market_dashboard"
    | "watchlist"
    | "briefing"
  )[];
  sourceId: string;
  sourceName: string;
  sourceUrl?: string;
  sourceType: SignalSourceType;
  sourceDate: string;
  capturedAt: string;
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  dataStatus: DataStatus;
  sentiment: number;
  direction: SignalDirection;
  magnitude: number;
  timeHorizon: SignalTimeHorizon;
  volatilityImpact: number;
  valuationImpact: number;
  revenueImpact: number;
  marginImpact: number;
  ipoWindowImpact: number;
  liquidityImpact: number;
  regulatoryImpact: number;
  infrastructureImpact: number;
  politicalRiskImpact: number;
  notes: string;
  uncertaintyNote: string;
  requiresHumanReview: boolean;
}

export interface SignalImpactScore {
  signalId: string;
  impactScore: number;
  confidenceScore: number;
  affectedScoreFields: AffectedScoreField[];
  explanation: string;
  uncertaintyNote: string;
  components: {
    magnitude: number;
    relevance: number;
    confidence: number;
    recencyWeight: number;
    corroborationWeight: number;
    marketRegimeWeight: number;
    contradictionPenalty: number;
    stalePenalty: number;
  };
}

export type RiskAppetite = "risk_on" | "neutral" | "risk_off";
export type RateRegime = "easing" | "stable" | "tightening" | "uncertain";
export type InflationRegime = "disinflation" | "stable" | "reacceleration" | "shock";
export type GrowthRegime = "expansion" | "softening" | "recession_risk" | "contraction";
export type CreditRegime = "tight" | "normal" | "easy" | "stressed";
export type VolatilityRegime = "low" | "normal" | "elevated" | "stressed";
export type TechMultipleRegime = "compressed" | "neutral" | "expanded" | "bubble_watch";
export type IPOWindowQuality = "open" | "selective" | "difficult" | "closed";
export type AISentimentRegime = "exuberant" | "constructive" | "cautious" | "bearish";
export type InfrastructureConstraintRegime = "loose" | "balanced" | "tight" | "shortage";

export interface MarketRegime {
  id: string;
  periodStart: string;
  periodEnd: string;
  riskAppetite: RiskAppetite;
  rateRegime: RateRegime;
  inflationRegime: InflationRegime;
  growthRegime: GrowthRegime;
  creditRegime: CreditRegime;
  volatilityRegime: VolatilityRegime;
  techMultipleRegime: TechMultipleRegime;
  ipoWindowQuality: IPOWindowQuality;
  aiSentimentRegime: AISentimentRegime;
  infrastructureConstraintRegime: InfrastructureConstraintRegime;
  confidenceScore: number;
  sourceIds: string[];
  uncertaintyNote: string;
  contributingSignalIds: string[];
}

export interface MarketTalkSignal {
  id: string;
  platform: "reddit" | "x" | "forum" | "review_site" | "search_trends" | "youtube" | "tiktok";
  query: string;
  entity: { type: "vendor" | "ticker" | "sector" | "topic"; id: string };
  volumeScore: number;
  sentimentScore: number;
  noveltyScore: number;
  repetitionScore: number;
  botRiskScore: number;
  sourceConfidence: number;
  dataStatus: DataStatus;
  derivedFrom: string[];
  uncertaintyNote: string;
  capturedAt: string;
}

export type RegulatoryEventType =
  | "ai_regulation"
  | "chip_export_control"
  | "antitrust"
  | "privacy_data"
  | "public_procurement"
  | "defence_policy"
  | "tax_policy"
  | "tariff_trade"
  | "election_risk"
  | "energy_permitting"
  | "data_centre_policy";

export interface RegulatoryEvent {
  id: string;
  signalId: string;
  eventType: RegulatoryEventType;
  jurisdiction: string;
  effectiveDate?: string;
  affectedVendorIds: string[];
  affectedExposureClasses: string[];
  impacts: {
    revenueOpportunity: number;
    marginRisk: number;
    marketAccessRisk: number;
    valuationRisk: number;
    ipoWindowRisk: number;
    customerAdoptionRisk: number;
    supplyChainRisk: number;
  };
  isPartisanCommentary: boolean;
  requiresCorroboration: boolean;
  uncertaintyNote: string;
}

export interface AdjustedBand {
  providerId: string;
  baseLowPct: number;
  baseHighPct: number;
  baseCenterPct: number;
  baseWidthPct: number;
  centreShift: number;
  widthExpansion: number;
  eventShockAdjustment: number;
  regimeAdjustment: number;
  confidenceAdjustment: number;
  adjustedLowPct: number;
  adjustedHighPct: number;
  adjustedCenterPct: number;
  adjustedWidthPct: number;
  contributingSignalIds: string[];
  confidenceScore: number;
  dataStatus: DataStatus;
  uncertaintyNote: string;
}

export interface SignalAdjustedSimulationDelta {
  providerId: string;
  baseAnnualReturn: number;
  signalAdjustedAnnualReturn: number;
  baseVolatility: number;
  signalAdjustedVolatility: number;
  components: {
    aiCatalystImpact: number;
    macroImpact: number;
    companySignalImpact: number;
    sectorMomentumImpact: number;
    sentimentImpact: number;
    valuationRiskPenalty: number;
    regulatoryRiskPenalty: number;
    capexRiskPenalty: number;
    confidencePenalty: number;
  };
  contributingSignalIds: string[];
  confidenceScore: number;
  uncertaintyNote: string;
}
