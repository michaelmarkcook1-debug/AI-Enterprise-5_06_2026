import { EVIDENCE_MODIFIER, RISK_PENALTY, type EvidenceGrade, type RiskSeverity } from "../types";
import type { Vendor, VendorMomentum } from "./types";

export interface MomentumSignals {
  newsVelocity: number;
  productVelocity: number;
  adoptionSignal: number;
  partnerSignal: number;
  marketShareMovement: number;
  customerSignal: number;
  riskSignal: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function evidenceConfidenceFromGrade(grade: EvidenceGrade): number {
  return Math.round(EVIDENCE_MODIFIER[grade] * 100);
}

export function evidenceStatusFromGrade(grade: EvidenceGrade): "inferred" | "documented" | "tested" | "verified" {
  if (grade === "E0" || grade === "E1") return "inferred";
  if (grade === "E2") return "documented";
  if (grade === "E3") return "tested";
  return "verified";
}

export function calculateRiskPenalty(severity: RiskSeverity, riskTolerance: 1 | 2 | 3 | 4 | 5): number {
  if (severity === "fatal") return RISK_PENALTY.fatal;
  const toleranceMultiplier = 1 + (3 - riskTolerance) * 0.15;
  return Math.max(0, RISK_PENALTY[severity] * toleranceMultiplier);
}

export function calculateMarketMomentum(signals: MomentumSignals): number {
  const positive =
    signals.newsVelocity * 0.16 +
    signals.productVelocity * 0.18 +
    signals.adoptionSignal * 0.18 +
    signals.partnerSignal * 0.12 +
    signals.marketShareMovement * 0.14 +
    signals.customerSignal * 0.14;
  const riskDrag = signals.riskSignal * 0.12;
  return Math.round(clamp(positive - riskDrag));
}

export function marketShareChangePct(current: number, previous?: number): number {
  if (previous === undefined || previous === 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export type MomentumStatus = "surging" | "advancing" | "steady" | "softening";

export function momentumStatus(score: number): MomentumStatus {
  if (score >= 72) return "surging";
  if (score >= 58) return "advancing";
  if (score >= 42) return "steady";
  return "softening";
}

export type MarketMoverStatus = "gaining" | "watch" | "declining";

export function marketMoverStatus(changePct: number): MarketMoverStatus {
  if (changePct >= 10) return "gaining";
  if (changePct <= -10) return "declining";
  return "watch";
}

export type RiskStatus = "high" | "medium" | "watch";

export function calculateVendorRiskScore(
  vendor: Pick<Vendor, "confidenceScore" | "riskProfile">,
  momentum?: Pick<VendorMomentum, "riskSignal">,
): number {
  const evidenceDrag = Math.max(0, 75 - vendor.confidenceScore) * 0.9;
  const riskProfileLoad = vendor.riskProfile.length * 16;
  const signalLoad = momentum ? momentum.riskSignal * 0.35 : 0;
  return Math.round(clamp(evidenceDrag + riskProfileLoad + signalLoad));
}

export function riskStatusForVendor(
  vendor: Pick<Vendor, "confidenceScore" | "riskProfile">,
  momentum?: Pick<VendorMomentum, "riskSignal">,
): RiskStatus {
  const score = calculateVendorRiskScore(vendor, momentum);
  if (score >= 55) return "high";
  if (score >= 32) return "medium";
  return "watch";
}
