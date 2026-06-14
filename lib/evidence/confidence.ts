/**
 * Confidence calculator — derives a 0-100 confidence score from the raw
 * fields of an evidence record. Used by every connector's normalisation step.
 */

import type { EvidenceGrade } from "../types";
import type { FreshnessStatus } from "./freshness";

const GRADE_BASE: Record<EvidenceGrade, number> = {
  E0: 0, E1: 35, E2: 60, E3: 78, E4: 88, E5: 96,
};

export function confidenceFor(args: {
  evidenceGrade: EvidenceGrade;
  freshness: FreshnessStatus;
  corroboratingSources?: number;
  contradictingSources?: number;
  baselineFloor?: number;
}): number {
  let score = GRADE_BASE[args.evidenceGrade] ?? 50;
  if (args.freshness === "stale") score -= 15;
  if (args.freshness === "unknown") score -= 10;
  score += Math.min(8, (args.corroboratingSources ?? 0) * 2);
  score -= Math.min(15, (args.contradictingSources ?? 0) * 5);
  const floor = args.baselineFloor ?? 0;
  return Math.max(0, Math.min(100, Math.max(score, floor)));
}
