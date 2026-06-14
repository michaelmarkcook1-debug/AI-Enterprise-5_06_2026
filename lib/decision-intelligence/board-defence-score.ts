// Board Defence Score — quality-weighted.
// ─────────────────────────────────────────
// Replaces the old completeness meter (populated-sections ÷ 6 × 100), which
// showed "100" whenever every section merely had content — overstating
// quality to a board reader. Rebuilt as a weighted blend of the QUALITY of
// the defence (product decision: Mic, 10 Jun 2026):
//
//   30%  Shortlist strength   — mean vendor overall score
//   25%  Evidence confidence  — mean vendor confidence score
//   15%  Momentum alignment   — mean vendor momentum (50 = neutral default)
//   15%  Reputation coverage  — share of shortlist with reputation data
//   15%  Context completeness — share of scope fields provided
//
// Returns 0 with no shortlist: there is no defence to score.
// Deterministic, no fabricated inputs; each component is reportable so the
// UI can show WHY the score is what it is.

export interface BoardDefenceInput {
  vendors: { overallScore: number; confidenceScore: number; momentumScore?: number; hasReputation: boolean }[];
  scope: { industries: number; useCases: number; hasRegion: boolean; hasDataSensitivity: boolean; hasCostSensitivity: boolean };
}

export interface BoardDefenceBreakdown {
  score: number;
  components: {
    shortlistStrength: number;
    evidenceConfidence: number;
    momentumAlignment: number;
    reputationCoverage: number;
    contextCompleteness: number;
  };
}

const WEIGHTS = {
  shortlistStrength: 0.3,
  evidenceConfidence: 0.25,
  momentumAlignment: 0.15,
  reputationCoverage: 0.15,
  contextCompleteness: 0.15,
} as const;

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function boardDefenceScore(input: BoardDefenceInput): BoardDefenceBreakdown {
  const { vendors, scope } = input;
  if (vendors.length === 0) {
    return { score: 0, components: { shortlistStrength: 0, evidenceConfidence: 0, momentumAlignment: 0, reputationCoverage: 0, contextCompleteness: 0 } };
  }
  const components = {
    shortlistStrength: Math.round(mean(vendors.map((v) => v.overallScore))),
    evidenceConfidence: Math.round(mean(vendors.map((v) => v.confidenceScore))),
    momentumAlignment: Math.round(mean(vendors.map((v) => v.momentumScore ?? 50))),
    reputationCoverage: Math.round((vendors.filter((v) => v.hasReputation).length / vendors.length) * 100),
    contextCompleteness: Math.round(
      ([scope.industries > 0, scope.useCases > 0, scope.hasRegion, scope.hasDataSensitivity, scope.hasCostSensitivity]
        .filter(Boolean).length / 5) * 100,
    ),
  };
  const score = Math.round(
    components.shortlistStrength * WEIGHTS.shortlistStrength
    + components.evidenceConfidence * WEIGHTS.evidenceConfidence
    + components.momentumAlignment * WEIGHTS.momentumAlignment
    + components.reputationCoverage * WEIGHTS.reputationCoverage
    + components.contextCompleteness * WEIGHTS.contextCompleteness,
  );
  return { score, components };
}
