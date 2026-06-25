# Shared Types and Helpers

## Objective

Create reusable types and helpers so scores and evidence labels are consistent across pages.

## Suggested File

```text
lib/decision-intelligence/types.ts
lib/decision-intelligence/scoring.ts
lib/decision-intelligence/seed.ts
```

## Types

```ts
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
```

## Helper Functions

```ts
export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateDrift(originalScore: number, currentScore: number): number {
  return Math.round(currentScore - originalScore);
}

export function driftSeverity(drift: number) {
  if (drift <= -20) return "Reassess Now";
  if (drift <= -10) return "Reassess This Quarter";
  if (drift <= -5) return "Watch";
  return "Stable";
}

export function averageScore(scores: number[]): number {
  if (!scores.length) return 0;
  return clampScore(scores.reduce((a, b) => a + b, 0) / scores.length);
}
```

## Acceptance Criteria

- Shared types exist.
- New pages use shared score and risk structures where possible.
- Evidence status is consistent.
- No page invents an unlabeled score.
