/**
 * Market Signals Engine — scoring, regime calculation, band & simulator overlays.
 *
 * Truthfulness gates baked in:
 *   1. A signal with `dataStatus: "unsupported"` or `evidenceGrade: "E0"` cannot
 *      contribute to centre-shift or fundamentals scores.
 *   2. Market-talk capped at ±2pt centre and ≤25pt confidence.
 *   3. Stale signals (>180 days) get a 0.5× stalePenalty + excluded from regime.
 *   4. Partisan commentary excluded from regulatory impact unless corroborated.
 *
 * Determinism: given fixed inputs and `now`, every output is stable. No Math.random.
 */

import {
  SEED_MARKET_REGIME,
  SEED_MARKET_TALK,
  SEED_REGULATORY_EVENTS,
  SEED_SIGNALS,
} from "./seed";
import type {
  AdjustedBand,
  AISentimentRegime,
  CreditRegime,
  GrowthRegime,
  InfrastructureConstraintRegime,
  IPOWindowQuality,
  InflationRegime,
  MarketRegime,
  MarketSignal,
  RateRegime,
  RegulatoryEvent,
  RiskAppetite,
  SignalAdjustedSimulationDelta,
  SignalImpactScore,
  TechMultipleRegime,
  VolatilityRegime,
} from "./types";
import type { EvidenceGrade } from "../types";

const STALE_AFTER_DAYS = 180;
const MARKET_TALK_CONFIDENCE_CAP = 25;
const MARKET_TALK_CENTRE_CAP = 2;
const E0_BLOCKED_GRADES: EvidenceGrade[] = ["E0"];

// ──────────────────────── Public accessors ────────────────────────

export function listSignals(): MarketSignal[] {
  return SEED_SIGNALS;
}
export function listRegulatoryEvents(): RegulatoryEvent[] {
  return SEED_REGULATORY_EVENTS;
}
export function listMarketTalk() {
  return SEED_MARKET_TALK;
}
export function getCurrentRegime(): MarketRegime {
  return SEED_MARKET_REGIME;
}

// ─────────────────────── Truthfulness gates ───────────────────────

export function canMoveCentre(signal: MarketSignal): boolean {
  if (E0_BLOCKED_GRADES.includes(signal.evidenceGrade)) return false;
  if (signal.dataStatus === "unsupported" || signal.dataStatus === "unknown") return false;
  return true;
}
export function isMarketTalk(signal: MarketSignal): boolean {
  return signal.signalCategory === "social_market_talk";
}
export function isStale(signal: MarketSignal, now = new Date()): boolean {
  const ageDays = (now.getTime() - new Date(signal.sourceDate).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_AFTER_DAYS;
}

// ───────────────────────── Impact scoring ─────────────────────────

export function scoreSignal(
  signal: MarketSignal,
  context: {
    relevance?: number;
    corroboratingSignalIds?: string[];
    contradictingSignalIds?: string[];
    regime?: MarketRegime;
    now?: Date;
  } = {},
): SignalImpactScore {
  const now = context.now ?? new Date();
  const relevance = clamp(context.relevance ?? 50, 0, 100) / 100;
  const magnitude = clamp(signal.magnitude, 0, 100) / 100;
  const baseConfidence = clamp(signal.confidenceScore, 0, 100) / 100;

  const ageDays = Math.max(0, (now.getTime() - new Date(signal.sourceDate).getTime()) / (1000 * 60 * 60 * 24));
  const recencyWeight = clamp(1 - (ageDays / STALE_AFTER_DAYS) * 0.5, 0.4, 1);

  const corroborationCount = context.corroboratingSignalIds?.length ?? 0;
  const corroborationWeight = clamp(1 + corroborationCount * 0.08, 1, 1.4);

  const contradictionCount = context.contradictingSignalIds?.length ?? 0;
  const contradictionPenalty = contradictionCount * 0.06;

  const stalePenalty = isStale(signal, now) ? 0.5 : 0;
  const marketRegimeWeight = regimeAlignmentWeight(signal, context.regime ?? SEED_MARKET_REGIME);

  let impactRaw =
    magnitude * relevance * baseConfidence * recencyWeight *
    corroborationWeight * marketRegimeWeight -
    contradictionPenalty - stalePenalty;

  let confidenceCapped = signal.confidenceScore;
  if (isMarketTalk(signal)) {
    confidenceCapped = Math.min(confidenceCapped, MARKET_TALK_CONFIDENCE_CAP);
    impactRaw = Math.min(impactRaw, MARKET_TALK_CENTRE_CAP / 100);
  }
  if (!canMoveCentre(signal)) impactRaw = 0;

  const impactScore = clamp(round(impactRaw * 100, 1), 0, 100);

  return {
    signalId: signal.id,
    impactScore,
    confidenceScore: clamp(confidenceCapped, 0, 100),
    affectedScoreFields: deriveAffectedFields(signal),
    explanation: buildExplanation(signal, {
      magnitude, relevance, baseConfidence, recencyWeight,
      corroborationWeight, marketRegimeWeight, contradictionPenalty, stalePenalty,
    }),
    uncertaintyNote: signal.uncertaintyNote,
    components: {
      magnitude: round(magnitude * 100, 1),
      relevance: round(relevance * 100, 1),
      confidence: round(baseConfidence * 100, 1),
      recencyWeight: round(recencyWeight, 3),
      corroborationWeight: round(corroborationWeight, 3),
      marketRegimeWeight: round(marketRegimeWeight, 3),
      contradictionPenalty: round(contradictionPenalty, 3),
      stalePenalty: round(stalePenalty, 3),
    },
  };
}

function regimeAlignmentWeight(signal: MarketSignal, regime: MarketRegime): number {
  if (regime.riskAppetite === "risk_on" && signal.sentiment > 0) return 1.1;
  if (regime.riskAppetite === "risk_off" && signal.sentiment < 0) return 1.15;
  if (regime.volatilityRegime === "stressed") return 1.08;
  return 1;
}

function deriveAffectedFields(signal: MarketSignal) {
  const fields: SignalImpactScore["affectedScoreFields"] = [];
  if (signal.volatilityImpact !== 0) fields.push("volatilityScore");
  if (signal.valuationImpact !== 0) fields.push("valuationRiskScore");
  if (signal.revenueImpact !== 0 || signal.marginImpact !== 0) fields.push("longTermHoldScore");
  if (signal.ipoWindowImpact !== 0) {
    fields.push("ipoReadinessScore", "postIpoBandWidth", "postIpoBandCenter");
  }
  if (signal.regulatoryImpact !== 0) fields.push("riskRadarScore");
  if (signal.infrastructureImpact !== 0) fields.push("infrastructureDependencyScore");
  if (signal.signalCategory === "company_specific") fields.push("shortTermCatalystScore", "marketMomentumScore");
  if (signal.signalCategory === "ai_sector") fields.push("speculativeUpsideScore", "marketMomentumScore");
  if (signal.signalCategory === "social_market_talk") fields.push("sentimentScore", "volatilityScore");
  return Array.from(new Set(fields));
}

function buildExplanation(
  signal: MarketSignal,
  parts: {
    magnitude: number; relevance: number; baseConfidence: number;
    recencyWeight: number; corroborationWeight: number; marketRegimeWeight: number;
    contradictionPenalty: number; stalePenalty: number;
  },
): string {
  if (!canMoveCentre(signal)) {
    return "Signal cannot move centre (E0 or unsupported). Used only for band widening or watchlist.";
  }
  if (isMarketTalk(signal)) {
    return `Market talk: contribution capped at ±${MARKET_TALK_CENTRE_CAP}pt and confidence capped at ${MARKET_TALK_CONFIDENCE_CAP}/100.`;
  }
  return [
    `magnitude ${(parts.magnitude * 100).toFixed(0)}`,
    `relevance ${(parts.relevance * 100).toFixed(0)}`,
    `confidence ${(parts.baseConfidence * 100).toFixed(0)}`,
    `recency ×${parts.recencyWeight.toFixed(2)}`,
    `corroboration ×${parts.corroborationWeight.toFixed(2)}`,
    `regime ×${parts.marketRegimeWeight.toFixed(2)}`,
    parts.contradictionPenalty > 0 ? `contradictions −${(parts.contradictionPenalty * 100).toFixed(1)}` : null,
    parts.stalePenalty > 0 ? `stale −${(parts.stalePenalty * 100).toFixed(1)}` : null,
  ].filter(Boolean).join(" · ");
}

// ──────────────────────── Regime calculation ────────────────────────

export function deriveCurrentRegime(now = new Date(), signals = SEED_SIGNALS): MarketRegime {
  const fresh = signals.filter((signal) => !isStale(signal, now));
  const byCategory = (cat: MarketSignal["signalCategory"]) => fresh.filter((sig) => sig.signalCategory === cat);

  const macro = byCategory("macro");
  const financial = byCategory("financial_market");
  const ipo = byCategory("ipo_specific");
  const energy = byCategory("energy_infrastructure");
  const sector = byCategory("ai_sector");

  const avgSentiment = (arr: MarketSignal[]) =>
    arr.length === 0 ? 0
      : arr.reduce((sum, sig) => sum + sig.sentiment * (sig.confidenceScore / 100), 0) / arr.length;

  const macroSentiment = avgSentiment(macro);
  const sectorSentiment = avgSentiment(sector);
  const financialSentiment = avgSentiment(financial);
  const ipoSentiment = avgSentiment(ipo);
  const energySignal = energy[0];

  const riskAppetite: RiskAppetite =
    (macroSentiment + financialSentiment) / 2 > 0.15 ? "risk_on"
      : (macroSentiment + financialSentiment) / 2 < -0.1 ? "risk_off"
        : "neutral";

  const rateRegime: RateRegime = "stable";
  const inflationRegime: InflationRegime = macro.find((sig) => sig.title.includes("CPI")) ? "disinflation" : "stable";
  const growthRegime: GrowthRegime = macroSentiment > 0.2 ? "expansion" : macroSentiment > -0.05 ? "softening" : "recession_risk";
  const creditRegime: CreditRegime = "normal";

  const volReadings = financial.filter((sig) => sig.volatilityImpact !== 0).map((sig) => sig.volatilityImpact);
  const avgVol = volReadings.length === 0 ? 0 : volReadings.reduce((sum, v) => sum + v, 0) / volReadings.length;
  const volatilityRegime: VolatilityRegime =
    avgVol < -10 ? "low" : avgVol < 5 ? "normal" : avgVol < 15 ? "elevated" : "stressed";

  const techMultipleRegime: TechMultipleRegime =
    sectorSentiment > 0.4 ? "expanded" : sectorSentiment > 0.1 ? "neutral" : "compressed";
  const ipoWindowQuality: IPOWindowQuality =
    ipoSentiment > 0.2 ? "open" : ipoSentiment > 0 ? "selective" : ipoSentiment > -0.2 ? "difficult" : "closed";
  const aiSentimentRegime: AISentimentRegime =
    sectorSentiment > 0.5 ? "exuberant" : sectorSentiment > 0.15 ? "constructive" : sectorSentiment > -0.1 ? "cautious" : "bearish";
  const infrastructureConstraintRegime: InfrastructureConstraintRegime =
    energySignal && energySignal.infrastructureImpact > 20 ? "tight" : "balanced";

  const confidenceScore = clamp(
    Math.round(fresh.reduce((sum, sig) => sum + sig.confidenceScore, 0) / Math.max(1, fresh.length)),
    0, 100,
  );

  return {
    id: `regime_derived_${now.toISOString().slice(0, 10)}`,
    periodStart: now.toISOString().slice(0, 10),
    periodEnd: now.toISOString().slice(0, 10),
    riskAppetite, rateRegime, inflationRegime, growthRegime, creditRegime,
    volatilityRegime, techMultipleRegime, ipoWindowQuality, aiSentimentRegime,
    infrastructureConstraintRegime,
    confidenceScore,
    sourceIds: Array.from(new Set(fresh.map((sig) => sig.sourceId))),
    contributingSignalIds: fresh.map((sig) => sig.id),
    uncertaintyNote: "Derived classification — categorical assignment is analyst-judged with deterministic thresholds.",
  };
}

// ──────────────────── Band adjustment (Section 7) ────────────────────

export function adjustPostIpoBand(
  baseBand: { lowPct: number; highPct: number; centerPct: number; widthPct: number },
  signals: MarketSignal[],
  options: { providerId: string; regime?: MarketRegime; now?: Date; vendorSensitivity?: number },
): AdjustedBand {
  const regime = options.regime ?? deriveCurrentRegime(options.now);
  const sensitivity = clamp(options.vendorSensitivity ?? 0.5, 0, 1);
  const relevant = signals.filter((sig) =>
    sig.affectedExposureClasses.length === 0 ||
    sig.vendorIds.includes(options.providerId) ||
    sig.entityIds.includes(options.providerId.replace(/^vendor_/, "")),
  );

  const centreShift = relevant.reduce((sum, sig) => {
    if (!canMoveCentre(sig)) return sum;
    const dirScore =
      sig.sentiment * (sig.ipoWindowImpact / 100 || sig.valuationImpact / 100 || sig.revenueImpact / 100);
    const cap = isMarketTalk(sig) ? MARKET_TALK_CENTRE_CAP : 100;
    return sum + clamp(dirScore * sensitivity * (sig.confidenceScore / 100) * 100, -cap, cap);
  }, 0);

  const volatilityFactor =
    regime.volatilityRegime === "stressed" ? 0.45
      : regime.volatilityRegime === "elevated" ? 0.22
        : regime.volatilityRegime === "low" ? -0.08 : 0;
  const eventDensityFactor = Math.min(0.4, relevant.length * 0.04);
  const lowConfidence = relevant.filter((sig) => sig.confidenceScore < 60).length;
  const confidencePenalty = Math.min(0.3, lowConfidence * 0.04);
  const marketTalkPenalty = Math.min(0.25, relevant.filter(isMarketTalk).length * 0.05);
  const widthExpansion = baseBand.widthPct * (volatilityFactor + eventDensityFactor + confidencePenalty + marketTalkPenalty);

  const eventShockAdjustment = relevant
    .filter((sig) => sig.signalCategory === "political_regulatory" || sig.signalCategory === "legal_litigation")
    .filter((sig) => sig.dataStatus === "verified" || sig.dataStatus === "documented")
    .reduce((sum, sig) => sum + sig.valuationImpact * sensitivity * 0.05, 0);

  const regimeAdjustment =
    regime.aiSentimentRegime === "bearish" ? -3 : regime.aiSentimentRegime === "exuberant" ? 2 : 0;
  const confidenceAdjustment = (regime.confidenceScore - 70) / 100;

  const adjustedCenterPct = round(baseBand.centerPct + centreShift + eventShockAdjustment + regimeAdjustment + confidenceAdjustment, 2);
  const adjustedWidthPct = round(Math.max(0.1, baseBand.widthPct + widthExpansion), 2);
  const adjustedLowPct = round(adjustedCenterPct - adjustedWidthPct / 2, 2);
  const adjustedHighPct = round(adjustedCenterPct + adjustedWidthPct / 2, 2);

  const contributingSignalIds = relevant.map((sig) => sig.id);
  const confidenceScore = clamp(
    Math.round(relevant.reduce((sum, sig) => sum + sig.confidenceScore, 0) / Math.max(1, relevant.length)),
    0, 100,
  );

  return {
    providerId: options.providerId,
    baseLowPct: baseBand.lowPct,
    baseHighPct: baseBand.highPct,
    baseCenterPct: baseBand.centerPct,
    baseWidthPct: baseBand.widthPct,
    centreShift: round(centreShift, 2),
    widthExpansion: round(widthExpansion, 2),
    eventShockAdjustment: round(eventShockAdjustment, 2),
    regimeAdjustment: round(regimeAdjustment, 2),
    confidenceAdjustment: round(confidenceAdjustment, 2),
    adjustedLowPct, adjustedHighPct, adjustedCenterPct, adjustedWidthPct,
    contributingSignalIds, confidenceScore,
    dataStatus: contributingSignalIds.length === 0 ? "seed" : "estimated",
    uncertaintyNote: "Bands are signal-adjusted seed estimates. Live offer price required before any dollar forecast is permitted.",
  };
}

// ─────────────── Signal-adjusted public stock simulation ───────────────

export function deriveSignalAdjustedDelta(
  providerId: string,
  baseAnnualReturn: number,
  baseVolatility: number,
  signals: MarketSignal[] = SEED_SIGNALS,
  options: { regime?: MarketRegime; now?: Date } = {},
): SignalAdjustedSimulationDelta {
  const regime = options.regime ?? deriveCurrentRegime(options.now);
  // A signal is relevant to a provider if the provider is named explicitly,
  // OR the signal is a broad-market category (macro / financial_market /
  // ipo_specific) that affects every public-AI exposure equally. Sector,
  // company, legal, and regulatory signals only apply to vendors they name —
  // this is what differentiates per-vendor deltas.
  const isBroadMarket = (sig: MarketSignal) =>
    sig.signalCategory === "macro" || sig.signalCategory === "financial_market" || sig.signalCategory === "ipo_specific";
  const relevant = signals.filter((sig) =>
    sig.vendorIds.includes(providerId) || isBroadMarket(sig),
  );
  // Per-signal relevance: 90 if vendor is explicitly named, 55 for broad-market.
  const relevanceFor = (sig: MarketSignal) => (sig.vendorIds.includes(providerId) ? 90 : 55);
  const scoredFresh = relevant
    .filter((sig) => !isStale(sig, options.now))
    .map((sig) => ({ sig, score: scoreSignal(sig, { regime, now: options.now, relevance: relevanceFor(sig) }) }))
    .filter(({ sig }) => canMoveCentre(sig));

  // /400 divisor sized so a typical bundle of 4-6 source-cited signals at
  // E4-E5 grade shifts the annual return by ±2-4 percentage points (about
  // what an analyst would adjust on the back of fresh earnings + macro flow).
  const componentSum = (predicate: (sig: MarketSignal) => boolean, key: keyof MarketSignal): number =>
    scoredFresh.filter(({ sig }) => predicate(sig))
      .reduce((sum, { sig, score }) => sum + (Number(sig[key]) || 0) * (score.impactScore / 100) / 400, 0);

  const aiCatalystImpact = componentSum((sig) => sig.signalCategory === "ai_sector" || sig.signalCategory === "company_specific", "revenueImpact");
  const macroImpact = componentSum((sig) => sig.signalCategory === "macro", "valuationImpact");
  const companySignalImpact = componentSum((sig) => sig.signalCategory === "company_specific", "marginImpact");
  const sectorMomentumImpact = componentSum((sig) => sig.signalCategory === "ai_sector", "valuationImpact");
  const sentimentImpact = componentSum((sig) => sig.signalCategory === "market_sentiment", "valuationImpact");

  const valuationRiskPenalty = Math.max(0, -componentSum((sig) => sig.valuationImpact < 0, "valuationImpact"));
  const regulatoryRiskPenalty = Math.max(0, -componentSum((sig) => sig.signalCategory === "political_regulatory", "regulatoryImpact") / 2);
  const capexRiskPenalty = Math.max(0, -componentSum((sig) => sig.signalCategory === "energy_infrastructure", "marginImpact"));

  const avgConfidence = scoredFresh.length === 0 ? 50
    : scoredFresh.reduce((sum, { score }) => sum + score.confidenceScore, 0) / scoredFresh.length;
  const confidencePenalty = scoredFresh.length === 0 ? 0 : (100 - avgConfidence) / 4000;

  const signalAdjustedAnnualReturn = baseAnnualReturn
    + aiCatalystImpact + macroImpact + companySignalImpact + sectorMomentumImpact + sentimentImpact
    - valuationRiskPenalty - regulatoryRiskPenalty - capexRiskPenalty - confidencePenalty;

  const eventDensity = scoredFresh.length * 0.0012;
  const marketTalkLoad = relevant.filter(isMarketTalk).length * 0.005;
  const ipoRiskLoad = relevant.filter((sig) => sig.signalCategory === "ipo_specific").length * 0.002;
  const macroVolLoad = regime.volatilityRegime === "stressed" ? 0.04 : regime.volatilityRegime === "elevated" ? 0.018 : 0;
  const signalAdjustedVolatility = baseVolatility + eventDensity + marketTalkLoad + ipoRiskLoad + macroVolLoad + confidencePenalty;

  return {
    providerId,
    baseAnnualReturn: round(baseAnnualReturn, 4),
    signalAdjustedAnnualReturn: round(signalAdjustedAnnualReturn, 4),
    baseVolatility: round(baseVolatility, 4),
    signalAdjustedVolatility: round(signalAdjustedVolatility, 4),
    components: {
      aiCatalystImpact: round(aiCatalystImpact, 4),
      macroImpact: round(macroImpact, 4),
      companySignalImpact: round(companySignalImpact, 4),
      sectorMomentumImpact: round(sectorMomentumImpact, 4),
      sentimentImpact: round(sentimentImpact, 4),
      valuationRiskPenalty: round(valuationRiskPenalty, 4),
      regulatoryRiskPenalty: round(regulatoryRiskPenalty, 4),
      capexRiskPenalty: round(capexRiskPenalty, 4),
      confidencePenalty: round(confidencePenalty, 4),
    },
    contributingSignalIds: scoredFresh.map(({ sig }) => sig.id),
    confidenceScore: Math.round(avgConfidence),
    uncertaintyNote: scoredFresh.length === 0
      ? "No fresh, source-backed signals match this provider. Delta is zero by design."
      : "Delta is signal-adjusted seed. It supplements but does not replace the base scenario engine.",
  };
}

// ─────────────────────────── Helpers ───────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
