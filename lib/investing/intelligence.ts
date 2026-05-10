import {
  FINANCIAL_METRICS,
  INDIRECT_EXPOSURES,
  INVESTMENT_PROVIDERS,
  IPO_EVIDENCE_QUALITY,
  IPO_FORECASTS,
  IPO_FORECAST_WARNING,
  IPO_PROFILES,
  MISSING_IPO_DATA_CHECKLISTS,
  POST_IPO_FLUCTUATION_BANDS,
  VALUATION_METRICS,
} from "./seed";
import type { IndirectExposure, IPOEvidenceQuality, IPOForecast, IPOProfile, InvestmentProviderProfile, MissingIPODataChecklist, PostIPOFluctuationBand } from "./types";

export interface IpoForecastRow {
  forecast: IPOForecast;
  provider: InvestmentProviderProfile;
  evidenceQuality: IPOEvidenceQuality | null;
  bands: PostIPOFluctuationBand[];
  missingData: MissingIPODataChecklist[];
  monthLevelForecastEnabled: boolean;
}

export const INVESTING_WARNING =
  "This module is for market intelligence and hypothetical scenario modelling only. It is not financial advice. Outputs are based on estimated or seed assumptions unless explicitly marked verified. Future returns are not guaranteed.";

export const PRIVATE_ACCESS_WARNING = "Private companies and IPO watchlist providers may not be directly investable by retail users.";
export const INDIRECT_EXPOSURE_WARNING = "Indirect exposure is not the same as direct ownership of the private AI provider.";

export function getInvestmentProvider(slug: string) {
  return INVESTMENT_PROVIDERS.find((provider) => provider.slug === slug || provider.id === slug || provider.providerId === slug) ?? null;
}

export function listPublicInvestmentProviders() {
  return INVESTMENT_PROVIDERS.filter((provider) =>
    provider.investabilityStatus === "public_direct" || provider.investabilityStatus === "public_indirect" || provider.investabilityStatus === "etf_indirect",
  );
}

export function listInvestmentProviderScores() {
  return INVESTMENT_PROVIDERS
    .filter((provider) => provider.exposureType !== "cash")
    .map((provider) => ({
      provider,
      aiProviderQualityScore: calculateAiProviderQualityScore(provider),
      investmentAttractivenessScore: calculateInvestmentAttractivenessScore(provider),
      consumerInvestmentPotential: calculateConsumerInvestmentPotential(provider),
      privateIpoInvestmentPotential: calculatePrivateIpoInvestmentPotential(provider),
      retailAccessPenalty: calculateRetailAccessPenalty(provider),
      hypePenalty: calculateHypePenalty(provider),
      watchlistOnly: isWatchlistOnly(provider),
      doNotRankReason: doNotRankReason(provider),
    }))
    .sort((a, b) => b.consumerInvestmentPotential - a.consumerInvestmentPotential);
}

export function getInvestmentDashboard() {
  const scored = listInvestmentProviderScores();
  const publicProviders = scored.filter((row) => row.provider.publicStatus === "public");
  const ipoWatch = IPO_PROFILES.map((profile) => ({
    profile,
    provider: getInvestmentProvider(profile.providerId),
  })).filter((row): row is { profile: IPOProfile; provider: InvestmentProviderProfile } => Boolean(row.provider));

  return {
    generatedAt: new Date().toISOString(),
    warning: INVESTING_WARNING,
    cards: {
      topLongTerm: maxBy(scored, (row) => row.provider.longTermHoldScore),
      highestCatalyst: maxBy(scored, (row) => row.provider.shortTermCatalystScore),
      highestSpeculative: maxBy(scored, (row) => row.provider.speculativeUpsideScore),
      highestValuationRisk: maxBy(scored, (row) => row.provider.valuationRiskScore),
      highestInfrastructureDependency: maxBy(scored, (row) => row.provider.infrastructureDependencyScore),
      strongestIpoWatch: maxBy(ipoWatch, (row) => row.profile.readinessScore),
      bestWorkflowSoftware: maxBy(scored.filter((row) => row.provider.exposureClass === "enterprise_workflow_ai"), (row) => row.consumerInvestmentPotential),
      mostOverhyped: maxBy(scored, (row) => row.hypePenalty + Math.max(0, 70 - row.provider.evidenceConfidence)),
    },
    corePublicPlatforms: publicProviders.filter((row) => row.provider.exposureClass === "core_public_ai_platform"),
    shortTermCatalysts: [...scored].sort((a, b) => b.provider.shortTermCatalystScore - a.provider.shortTermCatalystScore).slice(0, 8),
    longTermHolds: [...scored].sort((a, b) => b.provider.longTermHoldScore - a.provider.longTermHoldScore).slice(0, 8),
    speculativeWatchlist: [...scored].sort((a, b) => b.privateIpoInvestmentPotential - a.privateIpoInvestmentPotential).slice(0, 10),
    infrastructureExposure: scored.filter((row) => row.provider.exposureClass === "ai_infrastructure_enabler" || row.provider.exposureClass === "ai_infrastructure_ipo"),
    workflowExposure: scored.filter((row) => row.provider.exposureClass === "enterprise_workflow_ai" || row.provider.exposureClass === "vertical_ai_specialist"),
    dataAnalyticsExposure: scored.filter((row) => row.provider.exposureClass === "data_analytics_ai_layer"),
    ipoRumourMonitor: ipoWatch.sort((a, b) => b.profile.rumourQualityScore - a.profile.rumourQualityScore),
    ipoForecasts: listIpoForecastRows(),
    indirectExposurePreview: INDIRECT_EXPOSURES.slice(0, 6),
    alerts: investmentAlerts(scored),
  };
}

export function getInvestmentBriefing() {
  const dashboard = getInvestmentDashboard();
  return {
    generatedAt: dashboard.generatedAt,
    type: "weekly AI investment brief",
    executiveSummary: [
      "Public platform exposure remains the clearest retail-access path, but category leadership still needs valuation discipline.",
      "IPO-watch names carry high AI-provider quality but remain watchlist-only until access, float, and financial disclosure improve.",
      "Infrastructure exposure has the highest AI revenue linkage and also the highest capex-cycle sensitivity.",
    ],
    whoIsGaining: dashboard.shortTermCatalysts.slice(0, 5).map((row) => `${row.provider.name}: catalyst ${row.provider.shortTermCatalystScore}/100, confidence ${row.provider.evidenceConfidence}/100.`),
    whoIsWeakening: dashboard.alerts.slice(0, 5),
    majorCatalysts: dashboard.shortTermCatalysts.slice(0, 4).map((row) => row.provider.keyThesis),
    valuationWarnings: dashboard.longTermHolds.filter((row) => row.provider.valuationRiskScore >= 65).map((row) => `${row.provider.name}: valuation-sensitive, requires evidence validation.`),
    ipoWatchChanges: dashboard.ipoRumourMonitor.slice(0, 5).map((row) => `${row.provider.name}: ${row.profile.rumourStage}, ${row.profile.postIpoForecast.replace(/_/g, " ")}.`),
    confidenceNotes: [INVESTING_WARNING, PRIVATE_ACCESS_WARNING, INDIRECT_EXPOSURE_WARNING],
    suggestedMonitoringActions: [
      "Monitor S-1/F-1 disclosures before upgrading private names from watchlist-only.",
      "Track AI revenue conversion and gross-margin proof before treating product momentum as financial momentum.",
      "Validate indirect exposure edges because cloud or compute revenue linkage is diluted by broader public-company revenue bases.",
    ],
  };
}

export function calculateAiProviderQualityScore(provider: InvestmentProviderProfile) {
  return clamp(
    provider.aiProviderQualityScore * 0.5
    + provider.aiRevenueExposureScore * 0.12
    + provider.longTermHoldScore * 0.08
    + (100 - provider.regulatoryRiskScore) * 0.08
    + (100 - provider.infrastructureDependencyScore) * 0.08
    + provider.evidenceConfidence * 0.14,
  );
}

export function calculateInvestmentAttractivenessScore(provider: InvestmentProviderProfile) {
  return clamp(
    provider.aiRevenueExposureScore * 0.15
    + provider.longTermHoldScore * 0.12
    + provider.aiCapitalEfficiencyScore * 0.12
    + (100 - provider.liquidityRiskScore) * 0.1
    + (100 - provider.valuationRiskScore) * 0.15
    + provider.shortTermCatalystScore * 0.15
    + provider.retailAccessScore * 0.05
    + (100 - calculateHypePenalty(provider)) * 0.08
    + provider.evidenceConfidence * 0.08,
  );
}

export function calculateConsumerInvestmentPotential(provider: InvestmentProviderProfile) {
  if (doNotRankReason(provider)) return 0;
  const horizonFit = provider.longTermHoldScore * 0.55 + provider.shortTermCatalystScore * 0.25 + provider.speculativeUpsideScore * 0.2;
  return clamp(
    calculateAiProviderQualityScore(provider) * 0.35
    + calculateInvestmentAttractivenessScore(provider) * 0.45
    + horizonFit * 0.2
    - calculateRetailAccessPenalty(provider)
    - calculateHypePenalty(provider) * 0.4,
  );
}

export function calculatePrivateIpoInvestmentPotential(provider: InvestmentProviderProfile) {
  return clamp(
    calculateAiProviderQualityScore(provider) * 0.3
    + provider.ipoReadinessScore * 0.25
    + provider.longTermHoldScore * 0.25
    + provider.speculativeUpsideScore * 0.2
    - provider.valuationRiskScore * 0.18
    - provider.liquidityRiskScore * 0.12
    - calculateRetailAccessPenalty(provider),
  );
}

export function calculateRetailAccessPenalty(provider: InvestmentProviderProfile) {
  switch (provider.investabilityStatus) {
    case "public_direct":
      return 0;
    case "ipo_watch":
      return 3;
    case "public_indirect":
      return 4;
    case "etf_indirect":
      return 4;
    case "accredited_only":
      return 7;
    case "private_inaccessible":
    case "not_legitimately_accessible":
      return 10;
    case "cash":
      return 0;
  }
}

export function calculateHypePenalty(provider: InvestmentProviderProfile) {
  return clamp(
    provider.hypePenalty
    + Math.max(0, provider.valuationRiskScore - 75) * 0.4
    + Math.max(0, 60 - provider.evidenceConfidence) * 0.2
    + (provider.publicStatus === "private" ? Math.max(0, provider.speculativeUpsideScore - provider.retailAccessScore) * 0.08 : 0),
    0,
    50,
  );
}

export function calculateAiCapitalEfficiencyScore(provider: InvestmentProviderProfile) {
  return provider.aiCapitalEfficiencyScore;
}

export function isWatchlistOnly(provider: InvestmentProviderProfile) {
  return provider.publicStatus === "private"
    || provider.investabilityStatus === "ipo_watch"
    || provider.investabilityStatus === "private_inaccessible"
    || provider.evidenceConfidence < 50;
}

export function doNotRankReason(provider: InvestmentProviderProfile) {
  if (provider.investabilityStatus === "not_legitimately_accessible") return "No legitimate consumer access.";
  if (provider.investabilityStatus === "private_inaccessible") return "Private company with no legitimate retail investment route.";
  if (provider.evidenceConfidence < 35) return "Data confidence below investable threshold.";
  if (provider.valuationRiskScore >= 92 && provider.evidenceConfidence < 55) return "Extreme valuation risk with limited financial disclosure.";
  return null;
}

export function financialConfidenceLabel(value: number) {
  if (value >= 75) return "High";
  if (value >= 60) return "Medium";
  if (value >= 42) return "Low";
  return "Very low";
}

export function listFinancialMetrics() {
  return FINANCIAL_METRICS;
}

export function listValuationMetrics() {
  return VALUATION_METRICS;
}

export function listIndirectExposureScores() {
  return INDIRECT_EXPOSURES.map((exposure) => ({
    ...exposure,
    indirectExposureScore: exposure.indirectExposureScore ?? calculateIndirectExposureScore(exposure),
  }));
}

export function listIpoForecastRows(): IpoForecastRow[] {
  return IPO_FORECASTS.map((forecast) => ({
    forecast,
    provider: getInvestmentProvider(forecast.providerId),
    evidenceQuality: IPO_EVIDENCE_QUALITY.find((record) => record.providerId === forecast.providerId) ?? null,
    bands: listPostIpoFluctuationBands(forecast.providerId),
    missingData: listMissingIpoDataChecklist(forecast.providerId),
    monthLevelForecastEnabled: isMonthLevelIpoForecastEnabled(forecast),
  })).filter((row): row is IpoForecastRow => Boolean(row.provider));
}

export function getIpoForecastRow(providerIdOrSlug: string) {
  const provider = getInvestmentProvider(providerIdOrSlug);
  const providerId = provider?.id ?? providerIdOrSlug;
  return listIpoForecastRows().find((row) =>
    row.provider.id === providerId
    || row.provider.providerId === providerId
    || row.provider.slug === providerId
    || row.forecast.providerId === providerId,
  ) ?? null;
}

export function listPostIpoFluctuationBands(providerId: string) {
  return POST_IPO_FLUCTUATION_BANDS.filter((band) => band.providerId === providerId).sort((a, b) => a.monthNumber - b.monthNumber);
}

export function listMissingIpoDataChecklist(providerId: string) {
  return MISSING_IPO_DATA_CHECKLISTS.filter((item) => item.providerId === providerId);
}

export function isMonthLevelIpoForecastEnabled(forecast: IPOForecast) {
  return forecast.estimatedIpoMonth !== null
    && forecast.forecastStatus !== "no_reliable_month_estimate"
    && forecast.forecastStatus !== "not_modelled_standalone"
    && forecast.confidence !== "very_low";
}

export function postIpoModelDisabledReason(forecast: IPOForecast) {
  if (!isMonthLevelIpoForecastEnabled(forecast)) return forecast.forecastDisabledReason ?? "No reliable month-level IPO forecast available.";
  if (forecast.rumourQuality === "R0" || forecast.rumourQuality === "R0_standalone") return "Post-IPO fluctuation model disabled until IPO signal quality improves.";
  return null;
}

export function ipoForecastWarning() {
  return IPO_FORECAST_WARNING;
}

export function calculateIndirectExposureScore(exposure: IndirectExposure, providerStrategicImportance = 100) {
  return clamp(providerStrategicImportance * exposure.exposureStrength * exposure.revenueLinkage * exposure.confidence * (1 - exposure.dilutionPenalty));
}

function investmentAlerts(scored: ReturnType<typeof listInvestmentProviderScores>) {
  return scored.flatMap((row) => {
    const alerts: string[] = [];
    if (row.doNotRankReason) alerts.push(`${row.provider.name}: ${row.doNotRankReason}`);
    if (row.hypePenalty >= 25) alerts.push(`${row.provider.name}: hype/valuation gap requires validation.`);
    if (row.provider.ipoReadinessScore > 70 && row.provider.publicStatus === "private") alerts.push(`${row.provider.name}: IPO-watch only, not ordinary retail-investable.`);
    return alerts;
  }).slice(0, 8);
}


function maxBy<T>(items: T[], score: (item: T) => number): T | null {
  return items.reduce<T | null>((best, item) => best === null || score(item) > score(best) ? item : best, null);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}
