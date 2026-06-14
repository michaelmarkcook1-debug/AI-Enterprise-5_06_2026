// Re-export the simulator under the new Investor Tools namespace.
// Section 5 of the prompt pack consolidates Investment Intelligence + Simulator
// under /investor-tools; legacy /investing imports remain as aliases.

export * from "../investing/simulator";
// Intelligence + types are re-exported but `calculateIndirectExposureScore`
// is defined in both modules — explicitly forward intelligence's wins so we
// don't introduce an ambiguous re-export.
export {
  INVESTING_WARNING,
  PRIVATE_ACCESS_WARNING,
  INDIRECT_EXPOSURE_WARNING,
  getInvestmentProvider,
  listPublicInvestmentProviders,
  listInvestmentProviderScores,
  getInvestmentDashboard,
  getInvestmentBriefing,
  calculateAiProviderQualityScore,
  calculateInvestmentAttractivenessScore,
  calculateConsumerInvestmentPotential,
  calculatePrivateIpoInvestmentPotential,
  calculateRetailAccessPenalty,
  calculateHypePenalty,
  calculateAiCapitalEfficiencyScore,
  isWatchlistOnly,
  doNotRankReason,
  financialConfidenceLabel,
  listFinancialMetrics,
  listValuationMetrics,
  listIndirectExposureScores,
} from "../investing/intelligence";
export type * from "../investing/types";
