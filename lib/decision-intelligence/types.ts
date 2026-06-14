// Shared Decision Intelligence types and helpers.
// ─────────────────────────────────────────────────
// Used across Demonstrate, Monitor, Assess, Understand, and Query
// so scores, risks, and evidence labels are consistent.

export type EvidenceGrade = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";
export type DataStatus = "live" | "verified" | "documented" | "estimated" | "seed" | "unknown";
export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export type DecisionStatus =
  | "Defensible"
  | "Defensible with Conditions"
  | "Pilot First"
  | "Reassess"
  | "Do Not Proceed";

export interface DecisionScore {
  label: string;
  value: number;
  confidence: number;
  evidenceGrade: EvidenceGrade;
  status: DataStatus;
  reason: string;
}

export interface BoardAssumption {
  id: string;
  title: string;
  description: string;
  linkedVendorIds: string[];
  status: "Stable" | "Watch" | "At Risk" | "Broken";
  failureTrigger: string;
  currentSignal: string;
  recommendedAction: string;
  confidence: number;
  evidenceGrade: EvidenceGrade;
}

export interface RecommendationDrift {
  id: string;
  label: string;
  vendorIds: string[];
  originalScore: number;
  currentScore: number;
  drift: number;
  reason: string;
  severity: "Stable" | "Watch" | "Reassess This Quarter" | "Reassess Now";
  recommendedAction: string;
}

export interface EnterpriseRisk {
  id: string;
  risk: string;
  category: string;
  severity: RiskLevel;
  likelihood: RiskLevel;
  mitigation: string;
  owner: string;
  status: "Open" | "Mitigated" | "Monitoring";
}

export interface CompetitorProfile {
  peer: string;
  maturity: "Exploring" | "Piloting" | "Scaling" | "Advanced";
  useCases: string[];
  knownVendors: string[];
  implication: string;
}

export interface BusinessCase {
  businessProblem: string;
  intendedOutcomes: string[];
  productivityImpact: string;
  costReductionPotential: string;
  revenuePotential: string;
  cxExImpact: string;
  confidence: number;
  evidenceGrade: EvidenceGrade;
  status: DataStatus;
}

export interface KPI {
  metric: string;
  baseline: string;
  target: string;
  owner: string;
  cadence: string;
  method: string;
}

/* ─── Scoring helpers ─────────────────────────────────── */

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateDrift(originalScore: number, currentScore: number): number {
  return Math.round(currentScore - originalScore);
}

export function driftSeverity(drift: number): RecommendationDrift["severity"] {
  if (drift <= -20) return "Reassess Now";
  if (drift <= -10) return "Reassess This Quarter";
  if (drift <= -5) return "Watch";
  return "Stable";
}

export function averageScore(scores: number[]): number {
  if (!scores.length) return 0;
  return clampScore(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case "Critical": return "text-red-700 dark:text-red-300";
    case "High": return "text-rose-700 dark:text-rose-300";
    case "Medium": return "text-amber-700 dark:text-amber-300";
    case "Low": return "text-emerald-700 dark:text-emerald-300";
  }
}

export function statusColor(status: DecisionStatus): string {
  switch (status) {
    case "Defensible": return "text-emerald-700 dark:text-emerald-300";
    case "Defensible with Conditions": return "text-sky-700 dark:text-sky-300";
    case "Pilot First": return "text-amber-700 dark:text-amber-300";
    case "Reassess": return "text-rose-700 dark:text-rose-300";
    case "Do Not Proceed": return "text-red-700 dark:text-red-300";
  }
}
