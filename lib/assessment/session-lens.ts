// Phase 3 Assessment — Wave 3 (Interrogate): pure session-lens builder.
// ─────────────────────────────────────────────────────────────────────────────
// Takes the LLM's context-derived weight DELTAS and produces the SessionLens: the
// buyer's personal, session-local view (adjusted weights + what changed + which
// domains their context made decisive + which are thin for each vendor). It reuses
// Wave-2's computeWeightedComposite unchanged; it only re-weights and explains.
//
// FIREWALL (why this is safe): PURE — no prisma, no LLM, no network, no mutation.
// It reads DomainScore[] (canonical 0–5 scores) and never alters them; a lens
// changes weights + prose only, never a stored score or another user's view. The
// score-writer firewall test pins this module read-only. The SessionLens is the
// handoff W4 (prep kit) consumes: weak+decisive domains become "ask the vendor"
// questions — thin evidence stays an honest gap, never a fabricated answer.

import {
  computeWeightedComposite,
  normalizeWeights,
  activeDomains,
  ASSESSMENT_COVERAGE_FLOOR,
  type DomainWeights,
} from "./composite";
import { type DomainScore } from "./domain-rubric";
import { DOMAIN_LABEL } from "./domain-labels";
import type { DomainId } from "../types";
import type { WeightAdjustment, DomainEvidenceSnapshot } from "../agents/composite-lens";

const GRADE_RANK: Record<string, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };

/**
 * Build the READ-ONLY per-domain evidence snapshot the lens cites against. For
 * each active domain it surfaces the best-evidenced view across the in-scope
 * vendors (highest evidence grade first) and up to 3 real, de-duplicated
 * citations — so the model has genuine sourceUrls to reference and cannot need to
 * invent one. Domains with no scored evidence in scope are marked insufficient
 * with no citations. Pure; reads DomainScore[] only, never mutates.
 */
export function buildEvidenceSnapshot(
  active: DomainId[],
  vendors: SessionLensVendorInput[],
): DomainEvidenceSnapshot[] {
  return active.map((domain) => {
    const scored = vendors
      .map((v) => v.domains.find((d) => d.domain === domain))
      .filter((d): d is Extract<DomainScore, { state: "scored" }> => d?.state === "scored")
      .sort((a, b) => (GRADE_RANK[b.bestGrade] ?? 0) - (GRADE_RANK[a.bestGrade] ?? 0));
    const best = scored[0];
    const citations: DomainEvidenceSnapshot["citations"] = [];
    const seen = new Set<string>();
    for (const s of scored) {
      for (const c of s.citations) {
        if (seen.has(c.sourceUrl)) continue;
        seen.add(c.sourceUrl);
        citations.push({ sourceUrl: c.sourceUrl, evidenceGrade: c.evidenceGrade, capturedAt: c.capturedAt });
        if (citations.length >= 3) break;
      }
      if (citations.length >= 3) break;
    }
    return {
      domain,
      label: DOMAIN_LABEL[domain],
      state: best ? "scored" : "insufficient_evidence",
      score: best ? best.score : null,
      bestGrade: best ? best.bestGrade : null,
      citations,
    };
  });
}

/** A scored domain at/below this 0–5 score is "thin" for the buyer's purposes
 *  (framework band ≤ "pilot with limitations") — decisive + thin ⇒ ask the vendor. */
export const THIN_SCORE = 2.5;

/**
 * Apply the lens's weight deltas onto a base profile. Deltas are clamped to
 * [-0.1, 0.1], added to each active domain's base weight, floored at 0, then
 * renormalised to sum 1 over the SAME active set. A delta for an INACTIVE domain
 * is ignored — the lens can re-emphasise but never expand scope (no domain is
 * scored into existence, coverage is untouched). Pure; never mutates inputs.
 */
export function applyContextLens(base: DomainWeights, adjustments: WeightAdjustment[]): DomainWeights {
  const active = activeDomains(base);
  const activeSet = new Set<DomainId>(active);
  const deltaByDomain = new Map<DomainId, number>();
  for (const a of adjustments) {
    if (!activeSet.has(a.domain)) continue; // can't nudge an inactive domain
    const d = Math.max(-0.1, Math.min(0.1, a.weightDelta));
    deltaByDomain.set(a.domain, (deltaByDomain.get(a.domain) ?? 0) + d);
  }
  const adjusted = {} as DomainWeights;
  for (const d of active) {
    adjusted[d] = Math.max(0, (base[d] ?? 0) + (deltaByDomain.get(d) ?? 0));
  }
  return normalizeWeights(adjusted);
}

export interface DomainLensEntry {
  domain: DomainId;
  baseWeight: number; // normalised 0–1 (category/framework default)
  adjustedWeight: number; // normalised 0–1 (after the buyer's context)
  weightDelta: number; // adjustedWeight − baseWeight
  decisive: boolean; // context made this domain pivotal
  rationale: string | null; // cited "why", from the lens (draft)
  citations: { sourceUrl: string; evidenceGrade: string; capturedAt?: string }[];
}

export interface VendorLensEntry {
  vendorId: string;
  baseComposite: number; // 0–5 under base weights
  adjustedComposite: number; // 0–5 under the buyer's lens
  compositeDelta: number; // adjusted − base
  rawCoverage: number; // evidenced domains / active domains (weight-independent)
  ranked: boolean; // meets the coverage floor
  /** Domains the buyer's context made DECISIVE that are ALSO weak/thin for this
   *  vendor (insufficient, low-score, or low-confidence). This is the honest
   *  "we couldn't evidence X — ask the vendor" list W4 turns into questions. */
  weakDecisiveDomains: DomainId[];
}

export interface SessionLensVendorInput {
  vendorId: string;
  domains: DomainScore[];
}

export interface SessionLens {
  scope: { kind: "vendor" | "category"; id: string };
  baseWeights: DomainWeights; // normalised
  adjustedWeights: DomainWeights; // normalised
  domainLens: DomainLensEntry[]; // per active domain, canonical order
  vendorLens: VendorLensEntry[]; // one per vendor in scope
  overallNote: string; // draft-framed "what your context changed"
  insufficientContext: boolean; // context too thin → identity lens
  /** Slider-scale (0–100) adjusted weights, keyed by active domain, for the
   *  client to feed straight into the existing Wave-2 island `setSliders`. */
  adjustedSliders: Record<DomainId, number>;
}

/** A scored domain is "thin" (an ask-the-vendor candidate) when its evidence is
 *  insufficient, its score sits at/below the thin band, or it is low-confidence. */
function isThin(d: DomainScore | undefined): boolean {
  if (!d || d.state !== "scored") return true; // absent/insufficient ⇒ thin
  return d.score <= THIN_SCORE || d.lowConfidence;
}

/**
 * Build the SessionLens from the base weights, the lens's adjustments, and the
 * in-scope vendor scorecards. Deterministic and side-effect-free — it computes
 * base-vs-adjusted composites via the SAME Wave-2 engine and reports the deltas.
 * The canonical DomainScore[] inputs are read, never mutated.
 */
export function buildSessionLens(args: {
  scope: { kind: "vendor" | "category"; id: string };
  baseWeights: DomainWeights;
  adjustments: WeightAdjustment[];
  vendors: SessionLensVendorInput[];
  overallNote: string;
  insufficientContext: boolean;
}): SessionLens {
  const baseNorm = normalizeWeights(args.baseWeights);
  const adjustedWeights = applyContextLens(args.baseWeights, args.adjustments);
  const active = activeDomains(args.baseWeights);

  const adjByDomain = new Map<DomainId, WeightAdjustment>(args.adjustments.map((a) => [a.domain, a]));

  const domainLens: DomainLensEntry[] = active.map((domain) => {
    const adj = adjByDomain.get(domain);
    const baseWeight = baseNorm[domain] ?? 0;
    const adjustedWeight = adjustedWeights[domain] ?? 0;
    return {
      domain,
      baseWeight,
      adjustedWeight,
      weightDelta: Math.round((adjustedWeight - baseWeight) * 1000) / 1000,
      decisive: Boolean(adj?.decisive),
      rationale: adj?.rationale ?? null,
      citations: adj?.citations ?? [],
    };
  });

  const decisiveDomains = new Set<DomainId>(domainLens.filter((d) => d.decisive).map((d) => d.domain));

  const vendorLens: VendorLensEntry[] = args.vendors.map((v) => {
    const byDomain = new Map<DomainId, DomainScore>(v.domains.map((d) => [d.domain, d]));
    const base = computeWeightedComposite(v.domains, args.baseWeights);
    const adjusted = computeWeightedComposite(v.domains, adjustedWeights);
    const weakDecisiveDomains = [...decisiveDomains].filter((d) => isThin(byDomain.get(d)));
    return {
      vendorId: v.vendorId,
      baseComposite: base.composite,
      adjustedComposite: adjusted.composite,
      compositeDelta: Math.round((adjusted.composite - base.composite) * 100) / 100,
      rawCoverage: adjusted.rawCoverage, // weight-independent — identical to base
      ranked: adjusted.scoredCount > 0 && adjusted.rawCoverage >= ASSESSMENT_COVERAGE_FLOOR,
      weakDecisiveDomains,
    };
  });

  const adjustedSliders = active.reduce((acc, d) => {
    acc[d] = Math.round((adjustedWeights[d] ?? 0) * 100);
    return acc;
  }, {} as Record<DomainId, number>);

  return {
    scope: args.scope,
    baseWeights: baseNorm,
    adjustedWeights,
    domainLens,
    vendorLens,
    overallNote: args.overallNote,
    insufficientContext: args.insufficientContext,
    adjustedSliders,
  };
}
