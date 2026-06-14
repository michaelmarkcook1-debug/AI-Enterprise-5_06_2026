import { DEFAULT_RISK_SHOCK, DEFAULT_SIMULATION_INPUT, INDIRECT_EXPOSURES, INVESTMENT_PROVIDERS, IPO_PROFILES } from "./seed";
import { deriveSignalAdjustedDelta } from "../market-signals/engine";
import type {
  ExposureType,
  AllocationValidation,
  ChartData,
  IndirectExposure,
  InvestmentProviderProfile,
  IPOProfile,
  RiskShock,
  ScenarioAssumption,
  ScenarioName,
  ShockEvent,
  SimulationHolding,
  SimulationInput,
  SimulationPortfolio,
  SimulationResult,
  SimulationState,
} from "./types";

const EXPOSURE_RETURNS: Record<ExposureType, Record<ScenarioName, number>> = {
  public_platform: { bull: 0.18, base: 0.09, bear: -0.05, stress: -0.18 },
  ai_infrastructure: { bull: 0.25, base: 0.11, bear: -0.1, stress: -0.28 },
  enterprise_workflow_ai: { bull: 0.2, base: 0.08, bear: -0.08, stress: -0.22 },
  data_analytics_ai: { bull: 0.22, base: 0.09, bear: -0.09, stress: -0.25 },
  indirect_private_exposure: { bull: 0.24, base: 0.07, bear: -0.16, stress: -0.34 },
  ipo_watch: { bull: 0.35, base: 0.08, bear: -0.25, stress: -0.5 },
  private_inaccessible: { bull: 0, base: 0, bear: 0, stress: 0 },
  cash: { bull: 0.03, base: 0.03, bear: 0.03, stress: 0.03 },
};

const RISK_PROFILE_MULTIPLIER: Record<SimulationInput["riskProfile"], number> = {
  conservative: 0.82,
  balanced: 1,
  aggressive: 1.15,
  speculative: 1.32,
};

// Geopolitical / global news climate. The four levels reflect the
// market-implied "VIX-like" risk regime as captured by news flow,
// regulatory headlines, and macro stress. Each level applies a small
// drag on annual return and amplifies regulatory + capex shock penalties.
const GLOBAL_RISK_CLIMATE_MULTIPLIER: Record<NonNullable<SimulationInput["globalRiskClimate"]>, {
  returnDrag: number; // basis-point drag on annual return per holding (decimal)
  shockAmplifier: number; // multiplies shock penalty (1 = neutral)
  regulatoryTilt: number; // additional regulatory penalty per holding
  label: string;
}> = {
  calm: { returnDrag: 0.005, shockAmplifier: 0.85, regulatoryTilt: 0, label: "Calm" },
  elevated: { returnDrag: 0, shockAmplifier: 1.0, regulatoryTilt: 0.0008, label: "Elevated" },
  tense: { returnDrag: -0.012, shockAmplifier: 1.18, regulatoryTilt: 0.0022, label: "Tense" },
  crisis: { returnDrag: -0.028, shockAmplifier: 1.42, regulatoryTilt: 0.0048, label: "Crisis" },
};

export function globalRiskClimateMultiplier(climate: SimulationInput["globalRiskClimate"]) {
  return GLOBAL_RISK_CLIMATE_MULTIPLIER[climate ?? "elevated"];
}

const PRIVATE_EXPOSURE_OPTIONS_BY_UNIVERSE: Record<SimulationInput["investmentUniverse"], SimulationInput["includePrivateExposure"][]> = {
  public_only: ["no"],
  public_and_indirect: ["indirect_only", "no"],
  ipo_watch: ["ipo_watchlist"],
  speculative_all: ["ipo_watchlist", "indirect_only", "no"],
  single_stock: ["no"],
};

const DEFAULT_PRIVATE_EXPOSURE_BY_UNIVERSE: Record<SimulationInput["investmentUniverse"], SimulationInput["includePrivateExposure"]> = {
  public_only: "no",
  public_and_indirect: "indirect_only",
  ipo_watch: "ipo_watchlist",
  speculative_all: "ipo_watchlist",
  single_stock: "no",
};

export function listInvestmentProviders() {
  return INVESTMENT_PROVIDERS;
}

export function listIpoWatch() {
  return IPO_PROFILES;
}

export function listIndirectExposures() {
  return INDIRECT_EXPOSURES;
}

export function getDefaultSimulationInput(): SimulationInput {
  return { ...DEFAULT_SIMULATION_INPUT };
}

export function compatiblePrivateExposureOptions(investmentUniverse: SimulationInput["investmentUniverse"]) {
  return [...PRIVATE_EXPOSURE_OPTIONS_BY_UNIVERSE[investmentUniverse]];
}

export function defaultPrivateExposureForUniverse(investmentUniverse: SimulationInput["investmentUniverse"]) {
  return DEFAULT_PRIVATE_EXPOSURE_BY_UNIVERSE[investmentUniverse];
}

export function isPrivateExposureCompatible(
  investmentUniverse: SimulationInput["investmentUniverse"],
  includePrivateExposure: SimulationInput["includePrivateExposure"],
) {
  return PRIVATE_EXPOSURE_OPTIONS_BY_UNIVERSE[investmentUniverse].includes(includePrivateExposure);
}

export function getSeedPortfolio(input: Partial<SimulationInput> = {}): SimulationPortfolio {
  const normalised = normaliseInput(input);
  if (normalised.allocationStyle === "manual" || normalised.allocationStyle === "single_stock") {
    return getManualPortfolio(normalised);
  }

  const providers = selectUniverseProviders(normalised);
  const ranked = [...providers].sort((a, b) => modelScore(b, normalised) - modelScore(a, normalised));
  const portfolioProviders = ranked.slice(0, normalised.riskProfile === "speculative" ? 10 : 8);
  const cashWeight = clamp(normalised.cashReservePct, 0, 50);
  const investableWeight = 100 - cashWeight;
  const providerScores = portfolioProviders.map((provider) => Math.max(1, modelScore(provider, normalised)));
  const totalProviderScore = providerScores.reduce((sum, score) => sum + score, 0) || 1;

  const holdings: SimulationHolding[] = portfolioProviders.map((provider, index) => {
    const weightPct = round((providerScores[index] / totalProviderScore) * investableWeight, 2);
    return {
      providerId: provider.id,
      ticker: provider.ticker,
      name: provider.name,
      weightPct,
      amount: round((normalised.startingCapital * weightPct) / 100, 2),
      exposureType: provider.exposureType,
      investabilityStatus: provider.investabilityStatus,
      isDirectlyInvestable: isDirectlyInvestable(provider),
      confidence: provider.evidenceConfidence,
      evidenceGrade: provider.evidenceGrade,
      warning: holdingWarning(provider, normalised),
    };
  });

  if (cashWeight > 0) {
    holdings.push({
      providerId: "cash",
      ticker: null,
      name: "Cash reserve",
      weightPct: cashWeight,
      amount: round((normalised.startingCapital * cashWeight) / 100, 2),
      exposureType: "cash",
      investabilityStatus: "cash",
      isDirectlyInvestable: true,
      confidence: 90,
      evidenceGrade: "E2",
    });
  }

  return {
    id: "seed_ai_enterpise_investment_simulator",
    name: "AI Enterprise seed model portfolio",
    ...normalised,
    holdings: normaliseWeights(holdings, normalised.startingCapital),
    createdAt: new Date("2026-05-07T00:00:00.000Z").toISOString(),
  };
}

export function createSimulationState(
  input: Partial<SimulationInput> = {},
  providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS,
  shockEvent?: ShockEvent | null,
): SimulationState {
  const normalised = normaliseInput(input);
  const eligibleUniverse = eligibleUniverseFor(normalised, providers);
  const allocationValidation = validateSimulationAllocation(normalised, providers);
  const errors = [...allocationValidation.errors, ...universeErrors(normalised, eligibleUniverse)];
  const shock = shockEvent ? shockEventToRiskShock(shockEvent) : DEFAULT_RISK_SHOCK;
  let portfolio: SimulationPortfolio | null = null;
  let result: SimulationResult | null = null;

  if (errors.length === 0) {
    portfolio = getSeedPortfolio(normalised);
    result = simulatePortfolio(portfolio, providers, shock);
  }

  const stateHash = hashSimulationState({ input: normalised, validation: allocationValidation, shockEvent, portfolio });
  const chartData = result ? chartDataFor(result, stateHash) : [];
  const lastUpdatedAt = new Date().toISOString();

  return {
    input: normalised,
    eligibleUniverse,
    selectedHoldings: portfolio?.holdings ?? selectedManualHoldings(normalised, providers),
    allocationValidation,
    scenarioAssumptions: result?.assumptions ?? [],
    shocks: shockEvent ? [shockEvent] : [],
    computedPaths: result ? {
      bullPath: result.bullPath,
      basePath: result.basePath,
      bearPath: result.bearPath,
      stressPath: result.stressPath,
    } : null,
    computedScores: result ? {
      aiExposureScore: result.aiExposureScore,
      qualityScore: result.qualityScore,
      speculationScore: result.speculationScore,
      riskScore: result.riskScore,
      confidenceScore: result.confidenceScore,
    } : null,
    chartData,
    evidenceStatus: "seed",
    errors,
    lastUpdatedAt,
    stateHash,
    portfolio,
    result,
  };
}

export function simulatePortfolio(
  portfolio: SimulationPortfolio,
  providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS,
  shock: RiskShock = DEFAULT_RISK_SHOCK,
): SimulationResult {
  validatePortfolio(portfolio, providers);

  const climate = portfolio.globalRiskClimate ?? "elevated";
  const assumptions = portfolio.holdings.flatMap((holding) =>
    (["bull", "base", "bear", "stress"] as ScenarioName[]).map((scenario) =>
      scenarioAssumptionForHolding(holding, scenario, providers, portfolio.riskProfile, shock, climate),
    ),
  );
  const pathFor = (scenario: ScenarioName) => scenarioPath(portfolio, providers, scenario, shock, climate);
  const bullPath = pathFor("bull");
  const basePath = pathFor("base");
  const bearPath = pathFor("bear");
  const stressPath = pathFor("stress");

  return {
    portfolioId: portfolio.id,
    bullPath,
    basePath,
    bearPath,
    stressPath,
    bullValue: lastValue(bullPath),
    baseValue: lastValue(basePath),
    bearValue: lastValue(bearPath),
    stressValue: lastValue(stressPath),
    worstDrawdown: worstDrawdown([bullPath, basePath, bearPath, stressPath]),
    aiExposureScore: portfolioAiExposureScore(portfolio, providers),
    qualityScore: portfolioQualityScore(portfolio, providers),
    speculationScore: portfolioSpeculationScore(portfolio, providers),
    riskScore: portfolioRiskScore(portfolio, providers),
    confidenceScore: portfolioConfidenceScore(portfolio, providers),
    contributionByHolding: contributionByHolding(portfolio, providers),
    riskByHolding: riskByHolding(portfolio, providers),
    assumptions,
  };
}

export function applyRiskShock(input: Partial<SimulationInput>, shock: Partial<RiskShock>) {
  const portfolio = getSeedPortfolio(input);
  return simulatePortfolio(portfolio, INVESTMENT_PROVIDERS, { ...DEFAULT_RISK_SHOCK, ...shock });
}

export function validatePortfolio(portfolio: SimulationPortfolio, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS) {
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const totalWeight = round(portfolio.holdings.reduce((sum, holding) => sum + holding.weightPct, 0), 2);
  if (Math.abs(totalWeight - 100) > 0.25) {
    throw new Error(`Portfolio weights must total 100%. Current total: ${totalWeight}%`);
  }

  portfolio.holdings.forEach((holding) => {
    const provider = providerById.get(holding.providerId);
    if (!provider) throw new Error(`Unknown provider: ${holding.providerId}`);
    if ((provider.investabilityStatus === "private_inaccessible" || provider.investabilityStatus === "not_legitimately_accessible") && holding.isDirectlyInvestable) {
      throw new Error(`${provider.name} is private inaccessible and cannot be treated as a direct holding.`);
    }
  });
}

export function eligibleUniverseFor(input: Partial<SimulationInput>, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS) {
  return selectUniverseProviders(normaliseInput(input), providers);
}

export function validateSimulationAllocation(input: Partial<SimulationInput>, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS): AllocationValidation {
  const normalised = normaliseInput(input);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (normalised.allocationStyle !== "manual" && normalised.allocationStyle !== "single_stock") {
    return {
      isValid: true,
      totalAllocationPct: 100,
      cashReservePct: normalised.cashReservePct,
      investedAllocationPct: 100 - normalised.cashReservePct,
      errors,
      warnings,
    };
  }

  const eligibleIds = new Set(eligibleUniverseFor(normalised, providers).map((provider) => provider.id));
  const manualAllocations = normalised.manualAllocations ?? {};
  const selectedVendorIds = normalised.selectedVendorIds ?? [];
  const investedAllocationPct = round(selectedVendorIds.reduce((sum, providerId) => sum + Number(manualAllocations[providerId] ?? 0), 0), 2);
  const totalAllocationPct = round(investedAllocationPct + normalised.cashReservePct, 2);
  const totalDelta = round(totalAllocationPct - 100, 2);

  if (selectedVendorIds.length === 0) {
    if (normalised.allocationStyle === "single_stock") {
      errors.push("Pick a single ticker to model. Single-stock mode allocates 100% of capital to one public-direct holding.");
    } else {
      errors.push(`Select at least one eligible ${labelInvestmentUniverse(normalised.investmentUniverse)} provider before running a manual allocation.`);
    }
  } else if (normalised.allocationStyle === "single_stock" && selectedVendorIds.length > 1) {
    errors.push("Single-stock mode allows exactly one ticker. Remove additional selections.");
  } else if (Math.abs(totalDelta) > 0.5) {
    const adjustment = formatPercent(Math.abs(totalDelta));
    errors.push(totalDelta < 0
      ? `Manual allocations are ${adjustment}% short. Add vendor allocation so holdings total 100%. Current total: ${formatPercent(totalAllocationPct)}%.`
      : `Manual allocations are ${adjustment}% over. Reduce vendor allocation so holdings total 100%. Current total: ${formatPercent(totalAllocationPct)}%.`);
  }

  selectedVendorIds.forEach((providerId) => {
    const provider = providers.find((item) => item.id === providerId);
    if (!provider) {
      errors.push(`Unknown provider selected: ${providerId}.`);
      return;
    }
    if (!eligibleIds.has(providerId)) errors.push(`${provider.name} is not eligible for ${normalised.investmentUniverse}.`);
    if (normalised.investmentUniverse === "public_only" && provider.publicStatus !== "public") errors.push("Public Only universe cannot include private providers.");
    if (normalised.investmentUniverse === "ipo_watch" && provider.publicStatus === "public") errors.push("Universe error: IPO Watch cannot include public direct holdings. Select Public + Indirect for public exposure to private AI providers.");
    if (normalised.investmentUniverse === "public_and_indirect" && provider.publicStatus !== "public") errors.push("Public + Indirect allocations must be to public instruments only.");
    if (provider.publicStatus === "private") warnings.push(`${provider.name} is not directly investable unless an IPO/access event occurs.`);
  });

  return {
    isValid: errors.length === 0,
    totalAllocationPct,
    cashReservePct: normalised.cashReservePct,
    investedAllocationPct,
    errors,
    warnings,
  };
}

export function generateRandomShock(
  horizonYears: number,
  selectedUniverse: SimulationInput["investmentUniverse"],
  riskProfile: SimulationInput["riskProfile"],
  seed = "ai-enterprise-shock",
  providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS,
): ShockEvent {
  const random = seededRandom(`${seed}:${horizonYears}:${selectedUniverse}:${riskProfile}`);
  const shockTypes = [
    "valuation_compression",
    "capex_spike",
    "cloud_growth_slowdown",
    "regulatory_shock",
    "ipo_lockup_selloff",
    "infrastructure_shortage",
    "model_commoditisation",
    "enterprise_adoption_slowdown",
    "security_incident",
    "ai_litigation_event",
    "interest_rate_shock",
    "data_centre_energy_constraint",
  ];
  const shockType = shockTypes[Math.floor(random() * shockTypes.length)] ?? "valuation_compression";
  const shockYear = Math.max(1, Math.min(horizonYears, Math.ceil(random() * Math.max(1, horizonYears))));
  const shockQuarter = Math.max(1, Math.min(4, Math.ceil(random() * 4)));
  const severity = Math.round((riskProfile === "speculative" ? 55 : riskProfile === "aggressive" ? 45 : riskProfile === "conservative" ? 24 : 34) + random() * 22);
  const eligible = eligibleUniverseFor({ investmentUniverse: selectedUniverse, riskProfile, horizonYears }, providers).filter((provider) => provider.exposureType !== "cash");
  const affectedExposureClasses = Array.from(new Set(eligible.filter((provider) => affectedByShock(provider, shockType)).map((provider) => provider.exposureClass)));
  const affectedProviderIds = eligible.filter((provider) => affectedExposureClasses.includes(provider.exposureClass)).map((provider) => provider.id);
  const parameterImpacts = shockParameters(shockType, severity);
  const shockLabel = labelShock(shockType);

  return {
    shockId: `shock_${hashString(`${seed}:${shockType}:${shockYear}:${shockQuarter}:${severity}`)}`,
    shockType,
    shockLabel,
    shockDescription: `${shockLabel} event generated from seed ${seed}.`,
    shockYear,
    shockQuarter,
    severity,
    affectedProviderIds,
    affectedExposureClasses,
    parameterImpacts,
    displayMessage: `Shock applied: ${shockLabel} event in Year ${shockYear} Q${shockQuarter}. Affected: ${affectedExposureClasses.map((item) => item.replace(/_/g, " ")).join(", ") || "current eligible universe"}. Stress-case parameters adjusted by severity ${severity}/100.`,
    randomSeed: seed,
  };
}

export function shockEventToRiskShock(event: ShockEvent | null | undefined): RiskShock {
  return event?.parameterImpacts ?? DEFAULT_RISK_SHOCK;
}

export function calculateScatterDomain(
  points: Array<{ x: number; y: number }>,
  axis: "x" | "y",
  options: { min?: number; max?: number; minSpread?: number; paddingPct?: number; allowOutOfRange?: boolean } = {},
) {
  const values = points.map((point) => axis === "x" ? point.x : point.y).filter((value) => Number.isFinite(value));
  const minBound = options.min ?? 0;
  const maxBound = options.max ?? 100;
  const minSpread = options.minSpread ?? 20;
  const paddingPct = options.paddingPct ?? 0.12;

  if (values.length === 0) return { min: minBound, max: maxBound, expanded: true, reason: "invalid" };

  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 50;
  let min = Math.min(...values);
  let max = Math.max(...values);
  let spread = max - min;
  let expanded = false;

  if (spread < minSpread) {
    min = median - minSpread / 2;
    max = median + minSpread / 2;
    spread = minSpread;
    expanded = true;
  }

  const padding = spread * paddingPct;
  min -= padding;
  max += padding;

  if (!options.allowOutOfRange) {
    min = Math.max(minBound, min);
    max = Math.min(maxBound, max);
  }

  return { min: round(min, 2), max: round(max, 2), expanded, reason: expanded ? "insufficient_spread" : "data_domain" };
}

// NOTE: A second `calculateIndirectExposureScore` lives in `intelligence.ts`.
// The two are NOT a code-duplication bug — the intelligence variant rounds to
// 1 decimal place via its `clamp(value)` (default min=0, max=100, with .toFixed-
// style rounding). This simulator variant returns the unrounded raw score and
// is what the scenario engine consumes downstream so chart bands aren't quantised.
// Both are tested independently. If you change one, change the other deliberately.
export function calculateIndirectExposureScore(exposure: IndirectExposure, providerStrategicImportance = 100) {
  return clamp(
    providerStrategicImportance * exposure.exposureStrength * exposure.revenueLinkage * exposure.confidence
      * (1 - exposure.dilutionPenalty),
    0,
    100,
  );
}

export function classifyIpoForecast(profile: Pick<IPOProfile, "readinessScore" | "pricingRisk" | "lockupRisk">) {
  if (profile.readinessScore >= 84 && (profile.pricingRisk === "low" || profile.pricingRisk === "medium")) {
    return "compounder_candidate";
  }
  if (profile.pricingRisk === "high" && profile.lockupRisk >= 80) return "wait_for_lockup_candidate";
  if (profile.readinessScore >= 82) return "trading_ipo";
  if (profile.readinessScore < 62 || profile.pricingRisk === "high") return "avoid_until_s1_clarity";
  return "pop_and_fade_risk";
}

export function portfolioAiExposureScore(portfolio: SimulationPortfolio, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS) {
  return weightedProviderScore(portfolio, providers, (provider) => provider.aiRevenueExposureScore * (provider.evidenceConfidence / 100));
}

export function portfolioQualityScore(portfolio: SimulationPortfolio, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS) {
  return weightedProviderScore(portfolio, providers, (provider) => provider.longTermHoldScore);
}

export function portfolioSpeculationScore(portfolio: SimulationPortfolio, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS) {
  return weightedProviderScore(portfolio, providers, (provider) => {
    const accessMultiplier = provider.investabilityStatus === "private_inaccessible" ? 1.35 : provider.investabilityStatus === "ipo_watch" ? 1.2 : 0.85;
    return provider.speculativeUpsideScore * accessMultiplier;
  });
}

export function portfolioConfidenceScore(portfolio: SimulationPortfolio, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS) {
  return weightedProviderScore(portfolio, providers, (provider) => provider.evidenceConfidence);
}

export function portfolioRiskScore(portfolio: SimulationPortfolio, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS) {
  return weightedProviderScore(portfolio, providers, (provider) => providerRisk(provider));
}

function normaliseInput(input: Partial<SimulationInput>): SimulationInput {
  const investmentUniverse = input.investmentUniverse ?? DEFAULT_SIMULATION_INPUT.investmentUniverse;
  const requestedPrivateExposure = input.includePrivateExposure ?? DEFAULT_SIMULATION_INPUT.includePrivateExposure;
  const includePrivateExposure = isPrivateExposureCompatible(investmentUniverse, requestedPrivateExposure)
    ? requestedPrivateExposure
    : defaultPrivateExposureForUniverse(investmentUniverse);

  return {
    ...DEFAULT_SIMULATION_INPUT,
    ...input,
    investmentUniverse,
    includePrivateExposure,
    startingCapital: Math.max(100, input.startingCapital ?? DEFAULT_SIMULATION_INPUT.startingCapital),
    horizonYears: clamp(input.horizonYears ?? DEFAULT_SIMULATION_INPUT.horizonYears, 1, 10),
    cashReservePct: clamp(input.cashReservePct ?? DEFAULT_SIMULATION_INPUT.cashReservePct, 0, 50),
    selectedVendorIds: input.selectedVendorIds ?? DEFAULT_SIMULATION_INPUT.selectedVendorIds ?? [],
    manualAllocations: input.manualAllocations ?? DEFAULT_SIMULATION_INPUT.manualAllocations ?? {},
    globalRiskClimate: input.globalRiskClimate ?? DEFAULT_SIMULATION_INPUT.globalRiskClimate ?? "elevated",
    applySignalOverlay: input.applySignalOverlay ?? DEFAULT_SIMULATION_INPUT.applySignalOverlay ?? false,
  };
}

/**
 * Per-holding signal-adjusted return delta. When the simulator overlay is
 * enabled, this value is added to each scenario's annual return. Truthfulness
 * gates inside the engine prevent low-confidence / unsupported signals from
 * moving centre.
 */
function signalDeltaForHolding(holding: SimulationHolding, baseAnnualReturn: number): number {
  // Cash holdings have no per-vendor signal exposure.
  if (holding.exposureType === "cash" || holding.providerId === "cash") return 0;
  const delta = deriveSignalAdjustedDelta(holding.providerId, baseAnnualReturn, 0.18);
  return delta.signalAdjustedAnnualReturn - delta.baseAnnualReturn;
}

function selectUniverseProviders(input: SimulationInput, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS) {
  return providers.filter((provider) => {
    if (provider.exposureType === "cash") return false;
    if (input.investmentUniverse === "public_only") return provider.investabilityStatus === "public_direct";
    if (input.investmentUniverse === "public_and_indirect") return provider.investabilityStatus === "public_direct";
    if (input.investmentUniverse === "ipo_watch") return provider.publicStatus === "private" || provider.investabilityStatus === "ipo_watch";
    // single_stock allows ONE holding — either a public-direct ticker
    // OR an IPO-watch candidate (pre-IPO private lab modelled as a
    // single-name thesis). Operators asked for IPO-stage names to be
    // individually selectable, not just public equities.
    if (input.investmentUniverse === "single_stock") {
      return provider.investabilityStatus === "public_direct"
        || provider.investabilityStatus === "ipo_watch";
    }
    return provider.investabilityStatus === "public_direct"
      || provider.investabilityStatus === "ipo_watch"
      || provider.exposureClass === "ai_infrastructure_enabler"
      || provider.exposureClass === "ai_infrastructure_ipo";
  });
}

function getManualPortfolio(input: SimulationInput, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS): SimulationPortfolio {
  const holdings = selectedManualHoldings(input, providers);
  if (input.cashReservePct > 0) {
    const cash = providers.find((provider) => provider.id === "cash") ?? INVESTMENT_PROVIDERS.find((provider) => provider.id === "cash")!;
    holdings.push({
      providerId: cash.id,
      ticker: cash.ticker,
      name: cash.name,
      weightPct: input.cashReservePct,
      amount: round((input.startingCapital * input.cashReservePct) / 100, 2),
      exposureType: "cash",
      investabilityStatus: "cash",
      isDirectlyInvestable: true,
      confidence: cash.evidenceConfidence,
      evidenceGrade: cash.evidenceGrade,
    });
  }

  return {
    id: "seed_ai_enterprise_manual_simulation",
    name: "AI Enterprise manual allocation simulation",
    ...input,
    holdings,
    createdAt: new Date("2026-05-07T00:00:00.000Z").toISOString(),
  };
}

function selectedManualHoldings(input: SimulationInput, providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS): SimulationHolding[] {
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  return (input.selectedVendorIds ?? [])
    .map((providerId) => providerById.get(providerId))
    .filter((provider): provider is InvestmentProviderProfile => Boolean(provider))
    .map((provider) => {
      const weightPct = round(Number(input.manualAllocations?.[provider.id] ?? 0), 2);
      return {
        providerId: provider.id,
        ticker: provider.ticker,
        name: provider.name,
        weightPct,
        amount: round((input.startingCapital * weightPct) / 100, 2),
        exposureType: provider.exposureType,
        investabilityStatus: provider.investabilityStatus,
        isDirectlyInvestable: isDirectlyInvestable(provider),
        confidence: provider.evidenceConfidence,
        evidenceGrade: provider.evidenceGrade,
        warning: holdingWarning(provider, input),
      };
    });
}

function universeErrors(input: SimulationInput, eligibleUniverse: InvestmentProviderProfile[]) {
  const errors: string[] = [];
  if (input.investmentUniverse === "ipo_watch" && eligibleUniverse.some((provider) => provider.publicStatus === "public")) {
    errors.push("Universe error: IPO Watch cannot include public direct holdings. Select Public + Indirect for public exposure to private AI providers.");
  }
  if (input.investmentUniverse === "public_only" && eligibleUniverse.some((provider) => provider.publicStatus !== "public")) {
    errors.push("Public Only universe cannot include private providers.");
  }
  return errors;
}

function chartDataFor(result: SimulationResult, simulationStateHash: string): ChartData[] {
  const generatedAt = new Date().toISOString();
  const base = {
    simulationStateHash,
    generatedAt,
    sourceIds: ["source_prompt_pack_zero_hallucination_2026_05_07"],
    confidenceScore: result.confidenceScore,
    dataStatus: "seed" as const,
  };
  return [
    { ...base, chartId: "scenario_fan", chartType: "scenario_fan", data: { bullPath: result.bullPath, basePath: result.basePath, bearPath: result.bearPath, stressPath: result.stressPath } },
    { ...base, chartId: "risk_return_scatter", chartType: "scatter", data: result.riskByHolding },
    { ...base, chartId: "allocation_donut", chartType: "donut", data: result.contributionByHolding },
  ];
}

function holdingWarning(provider: InvestmentProviderProfile, input: SimulationInput) {
  if (provider.publicStatus === "private") return "Private companies and IPO watchlist providers may not be directly investable by retail users.";
  if (input.investmentUniverse === "public_and_indirect" && provider.investabilityStatus !== "public_direct") return "Public + Indirect allocations must be to public instruments only.";
  return undefined;
}

function affectedByShock(provider: InvestmentProviderProfile, shockType: string) {
  if (shockType.includes("ipo")) return provider.investabilityStatus === "ipo_watch" || provider.publicStatus === "private";
  if (shockType.includes("capex") || shockType.includes("infrastructure") || shockType.includes("energy")) return provider.exposureClass.includes("infrastructure") || provider.infrastructureDependencyScore > 70;
  if (shockType.includes("regulatory") || shockType.includes("litigation") || shockType.includes("security")) return provider.regulatoryRiskScore > 45 || provider.publicStatus === "private";
  if (shockType.includes("cloud")) return provider.exposureType === "public_platform" || provider.exposureClass.includes("infrastructure");
  return provider.valuationRiskScore > 50 || provider.speculativeUpsideScore > 60;
}

function shockParameters(shockType: string, severity: number): RiskShock {
  const scalar = Math.max(0, Math.min(100, severity));
  return {
    ...DEFAULT_RISK_SHOCK,
    valuationCompressionPct: shockType === "valuation_compression" || shockType === "interest_rate_shock" ? scalar : 0,
    capexSpikePct: shockType === "capex_spike" || shockType === "data_centre_energy_constraint" ? scalar : 0,
    cloudGrowthSlowdownPct: shockType === "cloud_growth_slowdown" ? scalar : 0,
    regulatoryShockSeverity: shockType === "regulatory_shock" || shockType === "ai_litigation_event" || shockType === "security_incident" ? scalar : 0,
    ipoLockupSelloffPct: shockType === "ipo_lockup_selloff" ? scalar : 0,
    infrastructureShortageSeverity: shockType === "infrastructure_shortage" || shockType === "data_centre_energy_constraint" ? scalar : 0,
    modelCommoditisationSeverity: shockType === "model_commoditisation" ? scalar : 0,
    enterpriseAdoptionSlowdownPct: shockType === "enterprise_adoption_slowdown" ? scalar : 0,
  };
}

function labelShock(shockType: string) {
  return shockType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function labelInvestmentUniverse(investmentUniverse: SimulationInput["investmentUniverse"]) {
  return investmentUniverse.replace(/_/g, " ");
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function hashSimulationState(value: unknown) {
  return hashString(JSON.stringify(value));
}

function seededRandom(seed: string) {
  let state = hashNumber(seed) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hashString(value: string) {
  return hashNumber(value).toString(36);
}

function hashNumber(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function modelScore(provider: InvestmentProviderProfile, input: SimulationInput) {
  const riskPenalty = providerRisk(provider) * (input.riskProfile === "conservative" ? 0.45 : input.riskProfile === "speculative" ? 0.15 : 0.28);
  const ipoBonus = input.investmentUniverse === "ipo_watch" || input.investmentUniverse === "speculative_all" ? provider.ipoReadinessScore * 0.16 : 0;
  const catalystWeight = input.horizonYears <= 3 ? 0.3 : 0.12;
  const longTermWeight = input.horizonYears >= 5 ? 0.34 : 0.18;
  return provider.investmentAttractivenessScore * 0.34
    + provider.shortTermCatalystScore * catalystWeight
    + provider.longTermHoldScore * longTermWeight
    + provider.aiRevenueExposureScore * 0.16
    + ipoBonus
    - riskPenalty;
}

function isDirectlyInvestable(provider: InvestmentProviderProfile) {
  return provider.investabilityStatus === "public_direct" || provider.investabilityStatus === "cash";
}

function normaliseWeights(holdings: SimulationHolding[], startingCapital: number) {
  const total = holdings.reduce((sum, holding) => sum + holding.weightPct, 0) || 1;
  return holdings.map((holding, index) => {
    const weightPct = index === holdings.length - 1
      ? round(100 - holdings.slice(0, -1).reduce((sum, item) => sum + round((item.weightPct / total) * 100, 2), 0), 2)
      : round((holding.weightPct / total) * 100, 2);
    return { ...holding, weightPct, amount: round((startingCapital * weightPct) / 100, 2) };
  });
}

function scenarioPath(
  portfolio: SimulationPortfolio,
  providers: InvestmentProviderProfile[],
  scenario: ScenarioName,
  shock: RiskShock,
  climate: SimulationInput["globalRiskClimate"] = "elevated",
) {
  // Generate monthly resolution so the chart can render hover tooltips
  // that show {month, year, value} per scenario point.
  const totalMonths = portfolio.horizonYears * 12;
  const path = [{ year: 0, value: portfolio.startingCapital }];
  for (let month = 1; month <= totalMonths; month += 1) {
    const yearFraction = month / 12;
    const value = portfolio.holdings.reduce((sum, holding) => {
      const assumption = scenarioAssumptionForHolding(holding, scenario, providers, portfolio.riskProfile, shock, climate);
      const baseReturn = assumption.annualReturnSeed
        + assumption.revenueGrowthImpact
        + assumption.marginImpact
        + assumption.multipleImpact
        + assumption.aiShareImpact
        + assumption.catalystImpact
        - assumption.riskPenalty
        - assumption.shockPenalty;
      const signalDelta = portfolio.applySignalOverlay ? signalDeltaForHolding(holding, baseReturn) : 0;
      const annualReturn = baseReturn + signalDelta;
      // Clamp the growth factor so it can decay toward zero but never goes
      // negative. Without this, scenarios that push annual return below -100%
      // (e.g. stress + crisis climate + signal overlay) cause Math.pow on a
      // negative base with a fractional month exponent to return NaN, which
      // then propagates into chart coordinates.
      const growthFactor = Math.max(0.0001, 1 + annualReturn);
      return sum + holding.amount * Math.pow(growthFactor, yearFraction);
    }, 0);
    path.push({ year: round(yearFraction, 4), value: round(value, 2) });
  }
  return path;
}

function scenarioAssumptionForHolding(
  holding: SimulationHolding,
  scenario: ScenarioName,
  providers: InvestmentProviderProfile[],
  riskProfile: SimulationInput["riskProfile"],
  shock: RiskShock,
  climate: SimulationInput["globalRiskClimate"] = "elevated",
): ScenarioAssumption {
  const provider = providers.find((item) => item.id === holding.providerId) ?? INVESTMENT_PROVIDERS.find((item) => item.id === "cash")!;
  const climateConfig = globalRiskClimateMultiplier(climate);
  const annualReturnSeed = EXPOSURE_RETURNS[holding.exposureType][scenario] * RISK_PROFILE_MULTIPLIER[riskProfile] + climateConfig.returnDrag;
  const revenueGrowthImpact = (provider.aiRevenueExposureScore - 70) / 2000;
  const marginImpact = (provider.longTermHoldScore - 70) / 2500;
  const multipleImpact = (provider.investmentAttractivenessScore - provider.valuationRiskScore) / 2800;
  const aiShareImpact = provider.aiRevenueExposureScore / 5000;
  const catalystImpact = scenario === "bull" ? provider.shortTermCatalystScore / 4000 : scenario === "base" ? provider.shortTermCatalystScore / 9000 : 0;
  const baseRiskPenalty = providerRisk(provider) / (scenario === "stress" ? 460 : scenario === "bear" ? 650 : 1300);
  const climateRegPenalty = (provider.regulatoryRiskScore / 100) * climateConfig.regulatoryTilt;
  const riskPenalty = baseRiskPenalty + climateRegPenalty;
  const shockPenalty = calculateShockPenalty(provider, shock, scenario) * climateConfig.shockAmplifier;
  return { scenario, providerId: provider.id, annualReturnSeed, revenueGrowthImpact, marginImpact, multipleImpact, aiShareImpact, catalystImpact, riskPenalty, shockPenalty };
}

function calculateShockPenalty(provider: InvestmentProviderProfile, shock: RiskShock, scenario: ScenarioName) {
  const scenarioMultiplier = scenario === "stress" ? 1.35 : scenario === "bear" ? 1 : scenario === "base" ? 0.45 : 0.25;
  const penalty =
    (provider.valuationRiskScore / 100) * (shock.valuationCompressionPct / 100) * 0.35
    + (provider.capexRiskScore / 100) * (shock.capexSpikePct / 100) * 0.25
    + (provider.aiRevenueExposureScore / 100) * (shock.cloudGrowthSlowdownPct / 100) * 0.2
    + (provider.regulatoryRiskScore / 100) * (shock.regulatoryShockSeverity / 100) * 0.18
    + (provider.ipoReadinessScore / 100) * (shock.ipoLockupSelloffPct / 100) * 0.18
    + (provider.infrastructureDependencyScore / 100) * (shock.infrastructureShortageSeverity / 100) * 0.18
    + (provider.aiRevenueExposureScore / 100) * (shock.modelCommoditisationSeverity / 100) * 0.16
    + (provider.investmentAttractivenessScore / 100) * (shock.enterpriseAdoptionSlowdownPct / 100) * 0.16;
  return penalty * scenarioMultiplier;
}

function worstDrawdown(paths: { year: number; value: number }[][]) {
  return round(Math.min(...paths.flatMap((path) => drawdowns(path))), 2);
}

export function calculateWorstDrawdown(path: { year: number; value: number }[]) {
  return round(Math.min(...drawdowns(path)), 2);
}

function drawdowns(path: { year: number; value: number }[]) {
  let peak = path[0]?.value ?? 0;
  return path.map((point) => {
    peak = Math.max(peak, point.value);
    return peak === 0 ? 0 : ((point.value - peak) / peak) * 100;
  });
}

function contributionByHolding(portfolio: SimulationPortfolio, providers: InvestmentProviderProfile[]) {
  return portfolio.holdings.map((holding) => {
    const provider = providers.find((item) => item.id === holding.providerId)!;
    const assumption = scenarioAssumptionForHolding(holding, "base", providers, portfolio.riskProfile, DEFAULT_RISK_SHOCK, portfolio.globalRiskClimate);
    const annualReturn = assumption.annualReturnSeed
      + assumption.revenueGrowthImpact
      + assumption.marginImpact
      + assumption.multipleImpact
      + assumption.aiShareImpact
      + assumption.catalystImpact
      - assumption.riskPenalty;
    return {
      providerId: holding.providerId,
      contribution: round((holding.weightPct / 100) * annualReturn * (provider.evidenceConfidence / 100) * 100, 2),
    };
  });
}

function riskByHolding(portfolio: SimulationPortfolio, providers: InvestmentProviderProfile[]) {
  return portfolio.holdings.map((holding) => {
    const provider = providers.find((item) => item.id === holding.providerId)!;
    return { providerId: holding.providerId, risk: round((holding.weightPct / 100) * providerRisk(provider), 2) };
  });
}

function weightedProviderScore(portfolio: SimulationPortfolio, providers: InvestmentProviderProfile[], scorer: (provider: InvestmentProviderProfile) => number) {
  return round(portfolio.holdings.reduce((sum, holding) => {
    const provider = providers.find((item) => item.id === holding.providerId);
    if (!provider) return sum;
    return sum + (holding.weightPct / 100) * scorer(provider);
  }, 0), 1);
}

function providerRisk(provider: InvestmentProviderProfile) {
  return (
    provider.valuationRiskScore * 0.26
    + provider.liquidityRiskScore * 0.18
    + provider.capexRiskScore * 0.15
    + provider.regulatoryRiskScore * 0.14
    + provider.infrastructureDependencyScore * 0.12
    + (100 - provider.evidenceConfidence) * 0.15
  );
}

function lastValue(path: { year: number; value: number }[]) {
  return path[path.length - 1]?.value ?? 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
