// Phase 3 Assessment — category-aware DEFAULT domain weights (deterministic).
// ──────────────────────────────────────────────────────────────────────────
// The framework ships ONE tiered default weighting over the 12 assessment
// domains (DEFAULT_DOMAIN_WEIGHTS). That even-handed default is correct for a
// generic enterprise-AI buyer, but it is NOT correct for every market: a buyer
// choosing a FRONTIER MODEL API weights the model itself (quality, agentic
// capability), its unit economics, and its governance posture far more heavily
// than, say, capital resilience — and a generic-even split buries model quality
// at ~1/12 of the score.
//
// This module lets a category OVERRIDE the framework default with a principled,
// DOCUMENTED profile. Rules:
//   • The framework default (DEFAULT_DOMAIN_WEIGHTS) is the fallback for any
//     category without an explicit profile — nothing changes for them.
//   • A profile may ACTIVATE a category-scoped domain (e.g. model_quality) that
//     is absent from the framework default. Such a domain is scored, weighted,
//     and counted in coverage ONLY for categories whose profile includes it —
//     so coverage stays /12 everywhere except where the category genuinely adds
//     a 13th axis (the composite iterates the active set; see composite.ts).
//   • Weights are RAW (need not sum to 1) — normalizeWeights renormalizes them.
//   • These set CATEGORY weights by rationale, never vendor-targeting: apply the
//     weights and accept the resulting order.
//
// Pure data + pure helpers: no DB, no LLM, no mutation.

import { DEFAULT_DOMAIN_WEIGHTS, ASSESSMENT_COVERAGE_FLOOR, type DomainWeights } from "./composite";
import { DOMAIN_LABEL } from "./domain-labels";
import { ARENA_ELO_SOURCE_URL } from "../system/elo-fetch";

export interface CategoryWeightProfile {
  /** Raw per-domain weights for this category (renormalized on use). May include
   *  category-scoped domains (model_quality) absent from the framework default. */
  weights: Partial<DomainWeights>;
  /** Plain-English WHY this category leans the way it does — surfaced verbatim in
   *  the public methodology note (transparent rubric design, not hidden tuning). */
  rationale: string;
}

// ── Per-category default profiles ────────────────────────────────────────────
// Add a category here to give it a bespoke default weighting. Everything else
// inherits the framework even-tiered default.
export const CATEGORY_DOMAIN_WEIGHTS: Record<string, CategoryWeightProfile> = {
  // FRONTIER MODEL API — the model is the product. Lead on model quality
  // (Arena human-preference Elo) + agentic capability; weight governance and
  // unit economics heavily (the real enterprise-adoption gates for a model API);
  // de-emphasise capital resilience (at the API layer a buyer can switch models,
  // so strategic dependency bites less than for a platform commitment). Sums to
  // 1.00 as written; renormalized on use regardless.
  frontier_model_api: {
    weights: {
      model_quality: 0.13, // NEW capability axis — the defining input for a model category
      governance_compliance: 0.12, // ↑ EU AI Act / auditability = the enterprise adoption gate
      agentic_autonomy: 0.10, // ↑ agentic capability is the live frontier of model differentiation
      data_security_privacy: 0.10, // near baseline (was .11) — data handling still central for APIs
      cost_finops: 0.09, // ↑ token economics / FinOps is decisive in model-API selection
      strategic_value: 0.08, // near baseline (.09)
      model_reliability: 0.07, // factuality/hallucination — distinct from raw quality, still core
      identity_access: 0.06, // near baseline (.09), compressed to fund the model-quality axis
      security_threat: 0.06, // near baseline (.08)
      integration_architecture: 0.06, // near baseline (.08)
      vendor_maturity_lockin: 0.05, // near baseline (.07)
      capital_resilience: 0.04, // ↓ de-emphasised at the API layer (kept non-trivial: frontier-lab
      //                            financial viability is still a real diligence item)
      workforce_adoption: 0.04, // ↓ least relevant to a raw model-API choice (a deployment concern)
    },
    rationale:
      "A frontier model API is judged first on the model itself, so model quality (Arena human-preference Elo) and agentic capability lead, with governance/auditability and unit economics (cost/TCO) weighted heavily as the real enterprise-adoption gates; capital resilience is de-emphasised because at the API layer a buyer can switch models more readily than they can replace a platform.",
  },
};

/**
 * The DEFAULT domain weights for a category: its bespoke profile if one exists,
 * otherwise the framework even-tiered default (the 12 domains). Returned RAW
 * (callers renormalize). This is the single resolver every ranking surface uses
 * so the static order and the interactive re-rank share one category default.
 */
export function resolveDomainWeights(categoryId: string): DomainWeights {
  const profile = CATEGORY_DOMAIN_WEIGHTS[categoryId];
  if (!profile) return DEFAULT_DOMAIN_WEIGHTS;
  return profile.weights as DomainWeights;
}

/** True when the category's profile is a bespoke override (not the framework default). */
export function categoryHasCustomWeights(categoryId: string): boolean {
  return !!CATEGORY_DOMAIN_WEIGHTS[categoryId];
}

/** True when the category activates the (category-scoped) model_quality domain. */
export function categoryActivatesModelQuality(categoryId: string): boolean {
  return (resolveDomainWeights(categoryId).model_quality ?? 0) > 0;
}

/** The category's documented rationale, or null when it uses the framework default. */
export function getCategoryWeightRationale(categoryId: string): string | null {
  return CATEGORY_DOMAIN_WEIGHTS[categoryId]?.rationale ?? null;
}

// ── Per-category methodology note (transparency) ─────────────────────────────

/** Generic methodology shared by every category (the deterministic mechanics). */
const GENERIC_METHODOLOGY =
  `Vendors are ranked within the category by a weighted composite (0–5) of the framework's ` +
  `evidence-graded assessment domains. Each domain's 0–5 score is capped by the strength of its ` +
  `evidence (you cannot reach the top bands without audit-grade proof), and a domain with ` +
  `insufficient evidence contributes zero while still counting toward coverage — so re-weighting ` +
  `can never conjure a score or hide thin evidence. A vendor must have at least ` +
  `${Math.round(ASSESSMENT_COVERAGE_FLOOR * 100)}% domain coverage to be ranked; below that it is ` +
  `held as "insufficient evidence", never floated on a default. When composites sit within the ` +
  `noise band the order is shown as tiers, not a false-precision 1–N list. Market share is context, ` +
  `not the rank.`;

/**
 * The public methodology note for a category — documents the per-category
 * weighting AND its rationale, then the shared mechanics. Deterministic string.
 */
export function buildMethodologyNote(categoryId: string): string {
  const weights = resolveDomainWeights(categoryId);
  const rationale = getCategoryWeightRationale(categoryId);

  // Sorted, percent-formatted active weighting (raw weights → percentages).
  const entries = Object.entries(weights).filter(([, w]) => (w ?? 0) > 0) as [string, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0) || 1;
  const ranked = [...entries].sort((a, b) => b[1] - a[1]);
  const weightList = ranked
    .map(([d, w]) => `${DOMAIN_LABEL[d as keyof typeof DOMAIN_LABEL] ?? d} ${Math.round((w / total) * 100)}%`)
    .join(", ");

  const header = rationale
    ? `Category-specific weighting (${entries.length} domains): ${weightList}. Why this weighting: ${rationale}`
    : `Framework default weighting (${entries.length} domains, evenly tiered): ${weightList}.`;

  const modelQualityNote = categoryActivatesModelQuality(categoryId)
    ? ` Model quality is a real, source-cited signal here: the top-2 average Arena human-preference Elo ` +
      `per vendor (${ARENA_ELO_SOURCE_URL}, LMArena methodology), graded E4 and band-capped — it is a ` +
      `capability proxy, not a factuality audit, and vendors with no Arena-ranked model show insufficient ` +
      `evidence on this domain rather than a default.`
    : "";

  return `${header}${modelQualityNote} ${GENERIC_METHODOLOGY}`;
}
