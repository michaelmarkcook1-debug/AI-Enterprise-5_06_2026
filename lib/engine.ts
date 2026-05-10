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

export const SCORING_RULE_VERSION = "v1.0.0";

// Stable hash for context — used for run reproducibility (spec §16 vendor_scores.context_hash)
export function hashContext(input: AssessmentInput): string {
  const ordered = JSON.stringify(input, Object.keys(input).sort());
  let h = 5381;
  for (let i = 0; i < ordered.length; i++) h = ((h << 5) + h + ordered.charCodeAt(i)) | 0;
  return `ctx_${(h >>> 0).toString(16)}`;
}

// Freshness modifier: full credit ≤ 90 days, decays to 0.7 by 365.
function freshnessFactor(capturedAt: string, asOf: Date = new Date("2026-05-07")): number {
  const days = Math.max(0, (asOf.getTime() - new Date(capturedAt).getTime()) / 86_400_000);
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
function dynamicWeights(industry: IndustryProfile, input: AssessmentInput): Record<PillarId, number> {
  const weights = { ...industry.weights };
  // Data sensitivity bumps Enterprise Control.
  const sensBump = (input.dataSensitivity - 3) * 0.02;
  weights.enterprise_control += sensBump;
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
  const ecoOverlap = vendor.ecosystemFit.filter((e) => input.ecosystem.includes(e)).length;
  bonus += Math.min(5, ecoOverlap * 1.5);
  const ucOverlap = vendor.useCaseFit.filter((u) => input.useCases.includes(u)).length;
  bonus += Math.min(4, ucOverlap * 1.5);
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
  const allDomains = Object.keys(DOMAIN_TO_PILLAR) as DomainId[];
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
  return base * maturityDiscount;
}

function recommendationBand(finalScore: number, excluded: boolean, fatalRisks: number): RecommendationBand {
  if (excluded || fatalRisks > 0) return "not_recommended";
  if (finalScore >= 75) return "enterprise_scale";
  if (finalScore >= 60) return "controlled_deployment";
  if (finalScore >= 45) return "pilot_only";
  return "not_recommended";
}

function buildPillarBreakdown(
  vendor: Vendor,
  weights: Record<PillarId, number>,
  industry: IndustryProfile,
): { breakdown: PillarBreakdown[]; pillarScores: Record<PillarId, number>; confidence: number } {
  const allDomains = Object.keys(DOMAIN_TO_PILLAR) as DomainId[];
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
): VendorResult {
  const { breakdown, pillarScores, confidence } = buildPillarBreakdown(vendor, weights, industry);
  const sfBonus = strategicFitBonus(vendor, input);
  const saBonus = sectorAdoptionFitBonus(vendor, input);
  const { triggered, penalty: riskPenalty, excluded, excludedReason } = evaluateRisks(vendor, input, industry);
  const { penalty: mePenalty, missing } = missingEvidencePenalty(vendor, weights);
  const adoptionFriction = adoptionFrictionPenalty(industry, input);

  const baseScore = breakdown.reduce((s, b) => s + b.weightedContribution, 0);
  // Apply confidence as a soft modifier on the base (verified evidence raises ceiling).
  const confidenceBlend = 0.7 + 0.3 * (confidence / 100);
  const adjustedBase = baseScore * confidenceBlend;
  const finalRaw = adjustedBase + sfBonus + saBonus - riskPenalty - mePenalty - adoptionFriction;
  const finalScore = excluded ? 0 : Math.max(0, Math.min(100, finalRaw));

  const fatalCount = triggered.filter((r) => r.severity === "fatal").length;

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    ownership: vendor.ownership,
    rank: 0, // assigned after sort
    finalScore,
    confidenceScore: confidence,
    recommendationBand: recommendationBand(finalScore, excluded, fatalCount),
    pillarScores,
    pillarBreakdown: breakdown,
    topStrengths: topItems(strengthsFromBreakdown(breakdown), 4),
    topRisks: risksToText(triggered),
    missingEvidence: missing.slice(0, 5),
    validationSteps: validationStepsFor(missing, triggered),
    industryRationale: industryRationaleText(industry, weights),
    evidenceIds: vendor.evidence.map((e) => e.id),
    riskFlagsTriggered: triggered,
    excluded,
    excludedReason,
    bonuses: { strategicFit: sfBonus, sectorAdoptionFit: saBonus },
    penalties: { risk: riskPenalty, missingEvidence: mePenalty, adoptionFriction },
  };
}

export function runAssessment(
  input: AssessmentInput,
  vendors: Vendor[],
  runIdSeed: string = hashContext(input),
): AssessmentResult {
  const industry = getIndustry(input.industry);
  const weights = dynamicWeights(industry, input);
  const selected = input.vendorIds.length > 0
    ? vendors.filter((v) => input.vendorIds.includes(v.id))
    : vendors;

  const results = selected
    .map((v) => scoreVendor(v, input, weights, industry))
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
  };
}
