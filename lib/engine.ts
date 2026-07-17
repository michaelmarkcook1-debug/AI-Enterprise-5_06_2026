// Deterministic scoring engine. Pure functions. No I/O. No randomness.
// Implements spec §12 (formula), §13 (risk engine), §10 (industry weights),
// §11 (adoption logic), §18 (output schema).

import {
  AssessmentInput,
  AssessmentResult,
  DOMAIN_TO_PILLAR,
  DomainId,
  EVIDENCE_MODIFIER,
  EvidenceItem,
  IndustryProfile,
  NewsAdjustment,
  PILLARS,
  PillarBreakdown,
  PillarId,
  RecommendationBand,
  RISK_PENALTY,
  RiskFlag,
  Vendor,
  VendorResult,
} from "./types";
import { getIndustry, industryMaturityScore } from "./industries";
import {
  deriveWorkflowRiskProfile,
  regulatoryEvidenceGapPenalty,
  autonomyConflictPenalty,
  type WorkflowRiskProfile,
} from "./workflow-risk";
import {
  applyTierWeightDelta,
  deriveTierOverlay,
  buyerConcentration,
  type TierAdjustment,
} from "./tier-overlay";

// v1.3 — opportunity-value context. Turns the Opportunity tier from a
// vendor-fit list into a value-aware view: a rough value-at-stake band × an
// expected-uplift band yields a coarse priority. Does NOT reorder vendors
// (value is opportunity-level, not vendor-level) — it contextualises the run.
const VALUE_AT_STAKE_MIDPOINT: Record<string, number> = {
  lt_250k: 125_000, "250k_1m": 625_000, "1m_5m": 3_000_000, "5m_25m": 15_000_000, gt_25m: 40_000_000,
};
const UPLIFT_MIDPOINT: Record<string, number> = {
  lt_10: 0.05, "10_25": 0.175, "25_50": 0.375, gt_50: 0.6,
};

function deriveOpportunityContext(input: AssessmentInput): {
  valueAtStake?: string;
  expectedUplift?: string;
  estimatedAnnualValue?: number;
  priority: "low" | "medium" | "high" | "flagship";
} | null {
  if (input.valueAtStake == null && input.expectedUplift == null) return null;
  const base = input.valueAtStake ? VALUE_AT_STAKE_MIDPOINT[input.valueAtStake] : undefined;
  const uplift = input.expectedUplift ? UPLIFT_MIDPOINT[input.expectedUplift] : undefined;
  const estimatedAnnualValue = base != null && uplift != null ? Math.round(base * uplift) : base;
  const v = estimatedAnnualValue ?? 0;
  const priority = v >= 5_000_000 ? "flagship" : v >= 1_000_000 ? "high" : v >= 250_000 ? "medium" : "low";
  return { valueAtStake: input.valueAtStake, expectedUplift: input.expectedUplift, estimatedAnnualValue, priority };
}

export const SCORING_RULE_VERSION = "v1.2.0";

// Stable hash for context — used for run reproducibility (spec §16 vendor_scores.context_hash)
export function hashContext(input: AssessmentInput): string {
  const ordered = JSON.stringify(input, Object.keys(input).sort());
  let h = 5381;
  for (let i = 0; i < ordered.length; i++) h = ((h << 5) + h + ordered.charCodeAt(i)) | 0;
  return `ctx_${(h >>> 0).toString(16)}`;
}

// Freshness modifier: full credit ≤ 90 days, decays to 0.7 by 365.
// `asOf` MUST default to the live clock — a hardcoded date freezes the decay so
// evidence never ages (the P0 "frozen clock" defect). Pass an explicit `asOf`
// only in tests that need a deterministic reference point.
//
// AGE IS RESOLVED TO WHOLE DAYS, deliberately. This decay is defined by day-scale
// thresholds (90 / 365), so evidence read at 09:00 and at 17:00 on the same day is
// equally fresh — carrying the fractional remainder would assert a precision the
// model does not have. It also had a real cost: because the default `asOf` is
// evaluated per call, that fractional tail let the wall clock leak into every
// score, so two runs on identical input produced different numbers (~1e-8 apart)
// and a single run dated its first vendor against a different instant than its
// last. Flooring removes the false precision, and determinism follows from it —
// evidence still ages, one day at a time. See "determinism (spec §22)".
export function freshnessFactor(capturedAt: string, asOf: Date = new Date()): number {
  const days = Math.max(0, Math.floor((asOf.getTime() - new Date(capturedAt).getTime()) / 86_400_000));
  if (days <= 90) return 1.0;
  if (days >= 365) return 0.7;
  return 1.0 - 0.3 * ((days - 90) / (365 - 90));
}

// Aggregate evidence per domain into a domain capability score.
function scoreDomain(evidence: EvidenceItem[], strictness: number): {
  score: number;
  evidenceCount: number;
  confidence: number;
} {
  if (evidence.length === 0) return { score: 0, evidenceCount: 0, confidence: 0 };
  let weightedSum = 0;
  let weightTotal = 0;
  let confidenceSum = 0;
  for (const ev of evidence) {
    const evMod = EVIDENCE_MODIFIER[ev.grade];
    const fresh = freshnessFactor(ev.capturedAt);
    const effective = evMod * fresh;
    // Strictness penalises low-grade evidence in strict industries.
    const strictnessAdj = ev.grade <= "E2" ? Math.max(0.5, 2 - strictness) : 1;
    const w = effective * strictnessAdj;
    weightedSum += ev.rawScore * w;
    weightTotal += w;
    confidenceSum += effective * 100;
  }
  const score = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const confidence = confidenceSum / evidence.length;
  return { score, evidenceCount: evidence.length, confidence };
}

// Dynamic context-aware pillar weights (spec §10 + §7).
// v1.1.0 — accepts an optional workflow-risk profile so weights use
// the EFFECTIVE data sensitivity / reliability requirement derived
// from the selected use cases, not just the dialled slider values.
// When no profile is passed, behaviour is identical to v1.0.0.
function dynamicWeights(
  industry: IndustryProfile,
  input: AssessmentInput,
  profile?: WorkflowRiskProfile,
): Record<PillarId, number> {
  const weights = { ...industry.weights };
  // Data sensitivity bumps Enterprise Control — use the effective
  // value when a workflow profile is supplied so regulatory regimes
  // implicitly tighten enterprise-control weighting.
  const effectiveSensitivity = profile?.effectiveDataSensitivity ?? input.dataSensitivity;
  const sensBump = (effectiveSensitivity - 3) * 0.02;
  weights.enterprise_control += sensBump;
  // Reliability requirement tilt — if the selected workflows demand
  // higher reliability than the buyer's risk tolerance would suggest,
  // load more weight onto reliability_safety.
  const effectiveReliability = profile?.effectiveReliabilityRequirement ?? 3;
  const reliabilityBump = Math.max(0, effectiveReliability - 3) * 0.012;
  weights.reliability_safety += reliabilityBump;
  weights.market_strength -= reliabilityBump;
  // Risk tolerance: low tolerance → more weight on Reliability & Control, less on Market Strength.
  const riskAdj = (3 - input.riskTolerance) * 0.015;
  weights.reliability_safety += riskAdj;
  weights.market_strength -= riskAdj;
  // Autonomy appetite shifts Integration & Ops (agentic controls).
  if (input.autonomyAppetite === "supervised_agent" || input.autonomyAppetite === "autonomous") {
    weights.integration_ops += 0.03;
    weights.reliability_safety += 0.02;
    weights.business_fit -= 0.025;
    weights.market_strength -= 0.025;
  }
  // Budget sensitivity → cost weight loaded into integration_ops.
  if (input.budgetSensitivity >= 4) {
    weights.integration_ops += 0.02;
    weights.market_strength -= 0.02;
  }
  // Normalise to 1.0
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(weights) as PillarId[]) weights[k] = Math.max(0, weights[k] / sum);
  return weights;
}

function strategicFitBonus(vendor: Vendor, input: AssessmentInput): number {
  let bonus = 0;
  // Legacy ecosystem tokens (back-compat).
  const ecoOverlap = vendor.ecosystemFit.filter((e) => input.ecosystem.includes(e)).length;
  bonus += Math.min(4, ecoOverlap * 1.5);
  // v1.3 — structured layered-infra native overlap (deterministic set intersection).
  const native = vendor.ecosystemNative ?? [];
  const nativeOverlap = native.filter((e) => input.ecosystem.includes(e)).length;
  bonus += Math.min(3, nativeOverlap * 1.5);
  // v1.3 — industry systems-of-record fit. A native Epic / Murex / Guidewire
  // connector is far more discriminating than a generic cloud match, so each
  // SoR match is worth more (3 pts) — but the overall fit bonus stays capped
  // at 10 so it tilts rather than vetoes the evidence-driven score.
  const sorSelected = input.selectedSystemsOfRecord ?? [];
  const sorOverlap = (vendor.supportedSystemsOfRecord ?? []).filter((s) => sorSelected.includes(s)).length;
  bonus += Math.min(5, sorOverlap * 3);
  const ucOverlap = vendor.useCaseFit.filter((u) => input.useCases.includes(u)).length;
  bonus += Math.min(3, ucOverlap * 1.5);
  if (vendor.supportedDeployments.includes(input.deploymentPreference)) bonus += 1;
  return Math.min(10, bonus);
}

function sectorAdoptionFitBonus(vendor: Vendor, input: AssessmentInput): number {
  const adoption = vendor.industryAdoption.find((a) => a.industry === input.industry);
  if (!adoption) return 0;
  const refScore = Math.min(5, adoption.productionReferenceCount / 4);
  const depthScore = (adoption.deploymentDepthScore / 100) * 5;
  return Math.min(10, refScore + depthScore);
}

// Risk evaluation — fatal blockers exclude; severe/moderate apply penalties.
function evaluateRisks(
  vendor: Vendor,
  input: AssessmentInput,
  industry: IndustryProfile,
): { triggered: RiskFlag[]; penalty: number; excluded: boolean; excludedReason?: string } {
  const triggered: RiskFlag[] = [];
  let penalty = 0;
  let excluded = false;
  let excludedReason: string | undefined;

  for (const r of vendor.risks) {
    const fatalHere =
      r.severity === "fatal" ||
      (r.fatalInIndustries && r.fatalInIndustries.includes(input.industry));
    if (fatalHere) {
      triggered.push({ ...r, severity: "fatal" });
      excluded = true;
      excludedReason = excludedReason ?? r.description;
    } else {
      triggered.push(r);
      // Risk tolerance scales penalty: lower tolerance → larger penalty
      const toleranceMult = 1 + (3 - input.riskTolerance) * 0.15;
      penalty += RISK_PENALTY[r.severity] * toleranceMult;
    }
  }

  // Industry blocker domain check — if vendor has zero E3+ evidence in a fatal blocker domain,
  // treat as severe risk (or fatal in strict regulated industries).
  for (const d of industry.fatalBlockerDomains) {
    const hasStrong = vendor.evidence.some(
      (e) => e.domain === d && (e.grade === "E3" || e.grade === "E4" || e.grade === "E5"),
    );
    if (!hasStrong) {
      const isStrict = industry.evidenceStrictness >= 1.2;
      const flag: RiskFlag = {
        id: `${vendor.id}_blocker_${d}`,
        vendorId: vendor.id,
        severity: isStrict ? "fatal" : "severe",
        description: `No verified evidence (E3+) in ${d.replace(/_/g, " ")} — industry-critical control area`,
        domain: d,
      };
      triggered.push(flag);
      if (isStrict) {
        excluded = true;
        excludedReason = excludedReason ?? flag.description;
      } else {
        penalty += RISK_PENALTY.severe;
      }
    }
  }

  return { triggered, penalty, excluded, excludedReason };
}

function missingEvidencePenalty(vendor: Vendor, weights: Record<PillarId, number>): {
  penalty: number;
  missing: string[];
} {
  const missing: string[] = [];
  let penalty = 0;
  // Exclude model_quality (synthesized read-time capability domain) — the legacy
  // engine scores only the persisted framework + market domains.
  const allDomains = (Object.keys(DOMAIN_TO_PILLAR) as DomainId[]).filter((d) => d !== "model_quality");
  for (const d of allDomains) {
    const pillar = DOMAIN_TO_PILLAR[d];
    const w = weights[pillar];
    const has = vendor.evidence.some((e) => e.domain === d);
    if (!has) {
      const cost = w * 25; // proportional to pillar weight
      penalty += cost;
      if (w >= 0.15) missing.push(`No evidence for ${d.replace(/_/g, " ")}`);
    }
  }
  return { penalty, missing };
}

function adoptionFrictionPenalty(industry: IndustryProfile, input: AssessmentInput): number {
  const score = industryMaturityScore(industry);
  // Base friction; scaled down by user's stated AI maturity.
  const base = (100 - score) * 0.05;
  const maturityDiscount =
    input.aiMaturity === "scaling" ? 0.5 : input.aiMaturity === "operating" ? 0.3 : input.aiMaturity === "piloting" ? 0.8 : 1.0;
  let friction = base * maturityDiscount;
  // v1.3 — weak data readiness is the #1 cited cause of pilot failure; weak
  // change sponsorship is the #2. Both raise adoption friction; strong signals
  // lower it. These refine the prior reliance on aiMaturity alone.
  if (input.dataReadiness != null) {
    friction *= input.dataReadiness <= 2 ? 1.4 : input.dataReadiness >= 4 ? 0.85 : 1.0;
  }
  if (input.changeSponsorship != null) {
    friction *= input.changeSponsorship === "none" ? 1.4
      : input.changeSponsorship === "mid_level" ? 1.15
      : input.changeSponsorship === "board" ? 0.8
      : 0.9; // exec
  }
  return friction;
}

function recommendationBand(finalScore: number, excluded: boolean, fatalRisks: number): RecommendationBand {
  if (excluded || fatalRisks > 0) return "not_recommended";
  if (finalScore >= 75) return "enterprise_scale";
  if (finalScore >= 60) return "controlled_deployment";
  if (finalScore >= 45) return "pilot_only";
  return "not_recommended";
}

// v1.3 — model-quality gate. When the buyer states a strict hallucination
// tolerance, a vendor with weak model-reliability evidence cannot be cleared
// for the top deployment bands regardless of overall score — a procurement
// pass/fail, not just a weight tilt.
const BAND_RANK: Record<RecommendationBand, number> = {
  not_recommended: 0, pilot_only: 1, controlled_deployment: 2, enterprise_scale: 3,
};
const BAND_BY_RANK: RecommendationBand[] = ["not_recommended", "pilot_only", "controlled_deployment", "enterprise_scale"];

function capBandForQualityBar(
  band: RecommendationBand,
  input: AssessmentInput,
  reliabilityScore: number,
): RecommendationBand {
  const tol = input.maxHallucinationTolerance;
  if (tol !== "zero" && tol !== "low") return band;
  // zero-tolerance demands strong reliability; low-tolerance demands moderate.
  const ceilingRank =
    tol === "zero"
      ? (reliabilityScore >= 80 ? 3 : reliabilityScore >= 65 ? 2 : 1)
      : (reliabilityScore >= 60 ? 3 : reliabilityScore >= 45 ? 2 : 1);
  return BAND_RANK[band] <= ceilingRank ? band : BAND_BY_RANK[ceilingRank];
}

function buildPillarBreakdown(
  vendor: Vendor,
  weights: Record<PillarId, number>,
  industry: IndustryProfile,
): { breakdown: PillarBreakdown[]; pillarScores: Record<PillarId, number>; confidence: number } {
  const allDomains = (Object.keys(DOMAIN_TO_PILLAR) as DomainId[]).filter((d) => d !== "model_quality");
  const byPillar: Record<PillarId, { domain: DomainId; score: number; evidenceCount: number; confidence: number }[]> = {
    business_fit: [], enterprise_control: [], reliability_safety: [], integration_ops: [], vendor_resilience: [], market_strength: [],
  };
  for (const d of allDomains) {
    const ev = vendor.evidence.filter((e) => e.domain === d);
    const r = scoreDomain(ev, industry.evidenceStrictness);
    byPillar[DOMAIN_TO_PILLAR[d]].push({ domain: d, score: r.score, evidenceCount: r.evidenceCount, confidence: r.confidence });
  }
  const breakdown: PillarBreakdown[] = [];
  const pillarScores: Record<PillarId, number> = {
    business_fit: 0, enterprise_control: 0, reliability_safety: 0, integration_ops: 0, vendor_resilience: 0, market_strength: 0,
  };
  let confidenceTotal = 0;
  let confidenceWeight = 0;
  for (const p of PILLARS) {
    const domains = byPillar[p.id];
    const withEvidence = domains.filter((d) => d.evidenceCount > 0);
    const score = withEvidence.length > 0
      ? withEvidence.reduce((s, d) => s + d.score, 0) / withEvidence.length
      : 0;
    pillarScores[p.id] = score;
    const w = weights[p.id];
    breakdown.push({
      pillar: p.id,
      score,
      weight: w,
      weightedContribution: score * w,
      contributingDomains: domains.map((d) => ({ domain: d.domain, score: d.score, evidenceCount: d.evidenceCount })),
    });
    if (withEvidence.length > 0) {
      const cAvg = withEvidence.reduce((s, d) => s + d.confidence, 0) / withEvidence.length;
      confidenceTotal += cAvg * w;
      confidenceWeight += w;
    }
  }
  const confidence = confidenceWeight > 0 ? confidenceTotal / confidenceWeight : 0;
  return { breakdown, pillarScores, confidence };
}

function topItems<T>(items: T[], n: number): T[] {
  return items.slice(0, n);
}

function strengthsFromBreakdown(breakdown: PillarBreakdown[]): string[] {
  return [...breakdown]
    .sort((a, b) => b.score - a.score)
    .filter((b) => b.score >= 60)
    .slice(0, 4)
    .map((b) => `${PILLARS.find((p) => p.id === b.pillar)!.label}: ${b.score.toFixed(0)}/100`);
}

function risksToText(flags: RiskFlag[]): string[] {
  return flags
    .filter((r) => r.severity !== "low")
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 5)
    .map((r) => `[${r.severity.toUpperCase()}] ${r.description}`);
}

function severityRank(s: "fatal" | "severe" | "moderate" | "low"): number {
  return { fatal: 4, severe: 3, moderate: 2, low: 1 }[s];
}

function validationStepsFor(missing: string[], risks: RiskFlag[]): string[] {
  const out: string[] = [];
  for (const r of risks.slice(0, 3)) {
    out.push(`Request third-party evidence (E4/E5) for: ${r.description}`);
  }
  for (const m of missing.slice(0, 3)) out.push(`Vendor questionnaire: ${m}`);
  if (out.length === 0) out.push("Run pilot with telemetry against your top use case");
  return out;
}

function industryRationaleText(industry: IndustryProfile, weights: Record<PillarId, number>): string {
  const top = Object.entries(weights).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const labels = top.map(([k, v]) => `${PILLARS.find((p) => p.id === k as PillarId)!.label} (${(v * 100).toFixed(0)}%)`);
  return `${industry.name} ranking emphasises ${labels.join(" and ")}. Vendors weak in industry-critical control areas are penalised or excluded.`;
}

export function scoreVendor(
  vendor: Vendor,
  input: AssessmentInput,
  weights: Record<PillarId, number>,
  industry: IndustryProfile,
  profile?: WorkflowRiskProfile,
  tierOverlay?: TierAdjustment,
  newsAdj?: NewsAdjustment,
): VendorResult {
  const { breakdown, pillarScores, confidence } = buildPillarBreakdown(vendor, weights, industry);

  // v1.4 — bounded market-signal (news) nudge. Applied AFTER evidence-based
  // pillar scoring, capped per pillar upstream (±3 pts), so it tilts a
  // calibrated evaluation without flipping it. We mutate the pillar score +
  // its weighted contribution in place so the displayed breakdown, strengths,
  // and the final score all stay internally consistent. Only pillars that
  // already have evidence (score > 0) are nudged — news can't manufacture a
  // score where there's no evidence at all.
  if (newsAdj) {
    for (const b of breakdown) {
      const delta = newsAdj.perPillar[b.pillar];
      if (delta == null || delta === 0 || b.score <= 0) continue;
      const adjusted = Math.max(0, Math.min(100, b.score + delta));
      b.score = adjusted;
      b.weightedContribution = adjusted * b.weight;
      pillarScores[b.pillar] = adjusted;
    }
  }
  const sfBonus = strategicFitBonus(vendor, input);
  const saBonus = sectorAdoptionFitBonus(vendor, input);
  const { triggered, penalty: riskPenalty, excluded, excludedReason } = evaluateRisks(vendor, input, industry);
  const { penalty: mePenalty, missing } = missingEvidencePenalty(vendor, weights);
  const adoptionFriction = adoptionFrictionPenalty(industry, input);

  // v1.1.0 — workflow-risk overlay penalties. Applied softly so the
  // scoring stays interpretable and rank order stays driven by the
  // pillar evidence; these are tilts, not vetoes.
  const regGap = profile
    ? regulatoryEvidenceGapPenalty(vendor.evidence, profile)
    : { penalty: 0, missingDomains: [] };
  const autoConflict = profile ? autonomyConflictPenalty(profile) : 0;
  const workflowOverlayPenalty = regGap.penalty + autoConflict;

  // v1.2.0 — tier overlay. Adds per-vendor bonuses, penalties, and
  // exclusions derived from the Guided + Advanced fields. The weight
  // delta has already been applied to `weights` upstream in
  // runAssessment so we only sum the per-vendor contributions here.
  const tierPen = tierOverlay ? tierOverlay.perVendorPenalty(vendor) : 0;
  const tierBon = tierOverlay ? tierOverlay.perVendorBonus(vendor) : 0;
  const tierExcludedReason = tierOverlay ? tierOverlay.perVendorExclusion(vendor) : null;

  const baseScore = breakdown.reduce((s, b) => s + b.weightedContribution, 0);
  // Apply confidence as a soft modifier on the base (verified evidence raises ceiling).
  const confidenceBlend = 0.7 + 0.3 * (confidence / 100);
  const adjustedBase = baseScore * confidenceBlend;
  const finalRaw = adjustedBase + sfBonus + saBonus + tierBon - riskPenalty - mePenalty - adoptionFriction - workflowOverlayPenalty - tierPen;
  const fullyExcluded = excluded || tierExcludedReason !== null;
  const finalScore = fullyExcluded ? 0 : Math.max(0, Math.min(100, finalRaw));

  const fatalCount = triggered.filter((r) => r.severity === "fatal").length + (tierExcludedReason ? 1 : 0);

  // Surface regulatory evidence gaps as missing-evidence reasoning
  // entries so users see WHY the vendor lost points.
  const overlayMissing = regGap.missingDomains.map(
    (d) => `Lacks E3+ evidence in ${d.replace(/_/g, " ")} (required by ${profile?.regulatoryRegimes.join(", ")})`,
  );

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    ownership: vendor.ownership,
    rank: 0, // assigned after sort
    finalScore,
    confidenceScore: confidence,
    recommendationBand: capBandForQualityBar(
      recommendationBand(finalScore, excluded, fatalCount),
      input,
      pillarScores.reliability_safety,
    ),
    pillarScores,
    pillarBreakdown: breakdown,
    topStrengths: topItems(strengthsFromBreakdown(breakdown), 4),
    topRisks: risksToText(triggered),
    missingEvidence: [...missing, ...overlayMissing].slice(0, 6),
    validationSteps: validationStepsFor([...missing, ...overlayMissing], triggered),
    industryRationale: industryRationaleText(industry, weights),
    evidenceIds: vendor.evidence.map((e) => e.id),
    riskFlagsTriggered: triggered,
    excluded: fullyExcluded,
    excludedReason: excludedReason ?? tierExcludedReason ?? undefined,
    bonuses: { strategicFit: sfBonus, sectorAdoptionFit: saBonus },
    penalties: {
      risk: riskPenalty,
      missingEvidence: mePenalty,
      adoptionFriction,
      // v1.1.0 — surface the overlay component on the result so the UI
      // can show "X pts deducted for regulatory evidence gaps". Extra
      // key on the existing `penalties` map; the type widening is
      // intentional and the existing UI ignores unknown keys.
      ...(workflowOverlayPenalty > 0
        ? { workflowOverlay: workflowOverlayPenalty }
        : {}),
    } as VendorResult["penalties"] & { workflowOverlay?: number },
    // v1.4 — surface the applied news nudge (when any) for transparent output.
    ...(newsAdj && newsAdj.totalAbs > 0 ? { newsAdjustment: newsAdj } : {}),
  };
}

export function runAssessment(
  input: AssessmentInput,
  vendors: Vendor[],
  runIdSeed: string = hashContext(input),
  newsAdjustments?: Map<string, NewsAdjustment>,
): AssessmentResult {
  const industry = getIndustry(input.industry);
  // v1.1.0 — derive the workflow-risk overlay once, then thread it
  // through the weight derivation and per-vendor scoring so every
  // step uses the same effective sensitivity / reliability values.
  const profile = deriveWorkflowRiskProfile(
    input.useCases,
    input.dataSensitivity,
    input.riskTolerance,
    input.autonomyAppetite,
  );
  // v1.2.0 — derive tier overlay (Guided + Advanced fields) and apply
  // its weight delta on top of the dynamicWeights output. The per-vendor
  // bonus / penalty / exclusion functions are threaded into scoreVendor.
  const tierOverlay = deriveTierOverlay(input);
  const baseWeights = dynamicWeights(industry, input, profile);
  const weights = applyTierWeightDelta(baseWeights, tierOverlay.weightDelta);
  const selected = input.vendorIds.length > 0
    ? vendors.filter((v) => input.vendorIds.includes(v.id))
    : vendors;

  const results = selected
    .map((v) => scoreVendor(v, input, weights, industry, profile, tierOverlay, newsAdjustments?.get(v.id)))
    .sort((a, b) => {
      if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
      return b.finalScore - a.finalScore;
    })
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const top = results.find((r) => !r.excluded);
  const second = results.filter((r) => !r.excluded)[1];
  const comparisonSummary = top && second
    ? `${top.vendorName} outranks ${second.vendorName} by ${(top.finalScore - second.finalScore).toFixed(1)} pts driven by stronger ${
        Object.entries(top.pillarScores).sort((a, b) => b[1] - a[1])[0][0].replace(/_/g, " ")
      }.`
    : top
    ? `${top.vendorName} is the only viable option in this context.`
    : "No vendors meet minimum thresholds for this context.";

  return {
    runId: `run_${runIdSeed}_${SCORING_RULE_VERSION}`,
    generatedAt: new Date().toISOString(),
    scoringRuleVersion: SCORING_RULE_VERSION,
    inputSummary: { ...input, industryName: industry.name },
    ranking: results,
    comparisonSummary,
    // v1.1.0 — surface the workflow-risk profile on the result so the
    // /results UI can render the "why these effective values?" panel.
    // Extra field; the original AssessmentResult type doesn't declare
    // it so we cast on the way out. The UI checks for presence before
    // rendering, so older consumers still work.
    workflowRiskProfile: profile,
    // v1.2.0 — surface the tier-overlay rationale so the /results UI
    // can render the "which Guided / Advanced inputs changed the
    // scoring" panel. Functions are stripped since they don't survive
    // sessionStorage JSON round-trip; rationale + weightDelta survive.
    tierOverlay: {
      weightDelta: tierOverlay.weightDelta,
      rationale: tierOverlay.rationale,
    },
    // v1.3 — opportunity-value context + buyer-stack concentration caution.
    opportunity: deriveOpportunityContext(input),
    buyerConcentration: buyerConcentration(input),
  } as AssessmentResult & {
    workflowRiskProfile: WorkflowRiskProfile;
    tierOverlay: { weightDelta: Partial<Record<PillarId, number>>; rationale: string[] };
    opportunity: ReturnType<typeof deriveOpportunityContext>;
    buyerConcentration: { topParent: string | null; share: number };
  };
}
