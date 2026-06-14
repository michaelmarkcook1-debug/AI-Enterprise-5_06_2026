// Strategic vendor scores — SINGLE SOURCE OF TRUTH.
// ───────────────────────────────────────────────────
// These heuristic scores were previously computed inline in TWO places in
// app/understand/page.tsx (the "Strategic sustainability overview" panel and
// the "Strategic vendor intelligence" table). The two copies had already
// drifted: the overview's encroachment formula treated only "vertical" and
// "Legal" categories as niche, while the table also treated "Financial" as
// niche. Result: the "Highest disruption risk" headline could name a
// different vendor than the table beneath it.
//
// Canonical resolution (CONFIRMED by Mic, 10 Jun 2026): the table version
// (including "Financial") is kept,
// because the heuristic's stated intent is "higher for niche/vertical" and
// financial-services AI is a vertical niche in this taxonomy.
//
// Provenance: these are ESTIMATED scores derived from seed pillar data
// (overall score, momentum, confidence, market position, ownership,
// category). Surfaces that render them must keep the SeedDataBadge until
// live evidence replaces the inputs. No fabricated data: inputs are the
// vendor record itself; the formulas are transparent below.

export interface StrategicScoreInput {
  overallScore: number;
  confidenceScore: number;
  marketPosition?: string;
  ownershipType?: string;
  category: string;
}

export interface StrategicScores {
  sustainability: number;
  encroachment: number;
  dependency: number;
  optionality: number;
  viability: number;
}

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** Case-insensitive category check — "Cloud AI platform" matches "Platform".
 *  Case sensitivity removed per product decision (Mic, 10 Jun 2026). */
const inCategory = (category: string, term: string) => category.toLowerCase().includes(term.toLowerCase());

/** Strategic sustainability: moat + market position + momentum. */
export function sustainabilityScore(v: StrategicScoreInput, momentumScore: number): number {
  return Math.min(100, Math.round(
    v.overallScore * 0.3 + momentumScore * 0.25 + v.confidenceScore * 0.2
    + (v.marketPosition === "Leader" ? 20 : v.marketPosition === "Strong performer" ? 12 : 5)
    + 5, // base
  ));
}

/** Platform encroachment risk: higher for niche/vertical, lower for platforms. */
export function encroachmentScore(v: StrategicScoreInput, momentumScore: number): number {
  return clamp(
    100 - v.overallScore * 0.4 - momentumScore * 0.2
    + (inCategory(v.category, "vertical") || inCategory(v.category, "legal") || inCategory(v.category, "financial") ? 25 : 0)
    - (inCategory(v.category, "platform") || inCategory(v.category, "cloud") ? 15 : 0),
  );
}

/** Dependency risk: infrastructure vendors low, app vendors high. */
export function dependencyScore(v: StrategicScoreInput): number {
  return clamp(
    60 - v.overallScore * 0.15
    + (v.ownershipType === "private" ? 15 : 0)
    - (inCategory(v.category, "infrastructure") || inCategory(v.category, "cloud") ? 20 : 0)
    + (inCategory(v.category, "workflow") || inCategory(v.category, "vertical") ? 20 : 0),
  );
}

/** Optionality: high for open/multi-cloud, low for proprietary. */
export function optionalityScore(v: StrategicScoreInput): number {
  return clamp(
    v.overallScore * 0.3 + v.confidenceScore * 0.2
    + (v.ownershipType === "public" ? 10 : 0)
    + (inCategory(v.category, "platform") ? 15 : 5)
    + 10, // base
  );
}

/** Viability: overall + momentum + confidence. */
export function viabilityScore(v: StrategicScoreInput, momentumScore: number): number {
  return Math.min(100, Math.round(
    v.overallScore * 0.4 + momentumScore * 0.3 + v.confidenceScore * 0.3,
  ));
}

/** All five scores in one call. Default momentum is 50 (neutral) when no momentum row exists. */
export function strategicScores(v: StrategicScoreInput, momentumScore = 50): StrategicScores {
  return {
    sustainability: sustainabilityScore(v, momentumScore),
    encroachment: encroachmentScore(v, momentumScore),
    dependency: dependencyScore(v),
    optionality: optionalityScore(v),
    viability: viabilityScore(v, momentumScore),
  };
}
