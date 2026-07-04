// You-vs-cohort — the directional gap read (corrected spec §3).
// ──────────────────────────────────────────────────────────────
// Compares the user's SELF-ASSESSED maturity (their C6 input) against the
// cohort's analyst-curated maturity anchor (a labelled reading of the cited
// survey stats). Deterministic, display-only, and explicitly DIRECTIONAL:
// a self-assessment and a survey anchor are not the same instrument, so the
// output is ahead/at/behind with the gap named — never a score.

import { MATURITY_LEVELS, type MaturityId } from "../usecase-front-door";
import type { SegmentBenchmark } from "./segment-benchmarks";

export interface CohortPosition {
  position: "ahead" | "at" | "behind";
  /** Signed ladder distance (user − cohort): +1 = one rung ahead. */
  gap: number;
  userLabel: string;
  cohortLabel: string;
  /** The honesty framing rendered with the verdict. */
  caveat: string;
}

const ladder: MaturityId[] = MATURITY_LEVELS.map((m) => m.id);

export function youVsCohort(userMaturity: MaturityId, benchmark: SegmentBenchmark): CohortPosition | null {
  const u = ladder.indexOf(userMaturity);
  const c = ladder.indexOf(benchmark.cohortMaturityAnchor);
  if (u < 0 || c < 0) return null;
  const gap = u - c;
  return {
    position: gap > 0 ? "ahead" : gap < 0 ? "behind" : "at",
    gap,
    userLabel: MATURITY_LEVELS[u].label,
    cohortLabel: MATURITY_LEVELS[c].label,
    caveat:
      "Directional comparison — your self-assessed maturity against an analyst-curated reading of the cohort's cited survey data. Not a measured ranking.",
  };
}
