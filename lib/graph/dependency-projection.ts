// Dependency-graph projection (pure, deterministic, no LLM, no DB).
// ──────────────────────────────────────────────────────────────────
// Turns the curated, per-edge-source-backed exposure map
// (lib/investing/exposure-map-data.ts) into dependency-graph edges shaped for
// the DependencySignal table and the /dependencies page.
//
// This is PROJECTION, not fabrication: every edge already carries its own
// sourceUrls + confidence tier + one-line summary. We only relabel the
// relationship taxonomy into the dependency "kind" vocabulary and carry the
// provenance through verbatim. Edge direction in the exposure map runs
// left → right = "exposure owner → provider", i.e. the source DEPENDS ON the
// target (e.g. Microsoft depends on OpenAI's models).

import {
  EXPOSURE_EDGES,
  type ConfidenceTier,
  type RelationshipType,
} from "../investing/exposure-map-data";

export type DependencyKind =
  | "compute"
  | "model"
  | "infra"
  | "capital"
  | "distribution"
  | "encroachment";

export type DependencyDirection = "depends_on" | "threatens";
export type EvidenceGradeLiteral = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";

/** Relationship taxonomy → dependency kind. */
const KIND_MAP: Record<RelationshipType, DependencyKind> = {
  investment: "capital",
  subsidiary: "capital",
  cloud: "infra",
  model_hosting: "model",
  commercial_partnership: "distribution",
  supply_chain: "compute",
};

/** Confidence tier → evidence grade. Mirrors the exposure-map verification
 * rules: HIGH = SEC/press/catalog, MEDIUM = public but lower depth, SEED =
 * plausible but unverified. We never grade above E4 here — these are curated
 * public-source edges, not independent audits (E5). */
const GRADE_MAP: Record<ConfidenceTier, EvidenceGradeLiteral> = {
  high: "E4",
  medium: "E3",
  seed: "E1",
};

/** Confidence tier → 0–100 confidence number. */
const CONFIDENCE_MAP: Record<ConfidenceTier, number> = {
  high: 85,
  medium: 60,
  seed: 30,
};

/** Human label for a dependency kind (page copy). */
export const KIND_LABEL: Record<DependencyKind, string> = {
  compute: "Compute / silicon",
  model: "Models",
  infra: "Cloud / infrastructure",
  capital: "Capital / ownership",
  distribution: "Distribution / partnership",
  encroachment: "Encroachment",
};

export interface DependencyEdge {
  fromVendorId: string;
  toVendorId: string;
  kind: DependencyKind;
  direction: DependencyDirection;
  /** 0–100, from the curated strengthScore. */
  strength: number;
  rationale: string;
  sourceUrls: string[];
  /** 0–100. */
  confidence: number;
  evidenceGrade: EvidenceGradeLiteral;
  /** Original relationship type, kept for display/legend. */
  relationshipType: RelationshipType;
}

/**
 * Which node DEPENDS in this relationship. 2026-07 encroachment audit: the old
 * blanket "source depends on target" produced backwards dependencies (and thus
 * backwards encroachment rationales like "NVIDIA relies on xAI for capital" —
 * NVIDIA is xAI's INVESTOR). The base map is authored layout-first
 * (left column → right column), so the semantic dependent varies by type:
 *   investment / subsidiary — capital/ownership flows source→target ⇒ the
 *     TARGET depends (the lab needs the investor's capital; the sub its parent).
 *   cloud / supply_chain    — base edges are authored provider→consumer ⇒ the
 *     TARGET depends (Meta depends on NVIDIA silicon; xAI on OCI).
 *   model_hosting           — the platform consumes the lab's models for its
 *     own products ⇒ the SOURCE depends (Microsoft depends on OpenAI models).
 *   commercial_partnership  — roughly symmetric ⇒ keep SOURCE (status quo).
 * An edge can override explicitly via `dependentId` (the cited dataset does).
 */
const TARGET_DEPENDS: ReadonlySet<RelationshipType> = new Set([
  "investment",
  "subsidiary",
  "cloud",
  "supply_chain",
]);

function dependentOf(e: (typeof EXPOSURE_EDGES)[number]): string {
  if (e.dependentId === e.sourceId || e.dependentId === e.targetId) return e.dependentId;
  return TARGET_DEPENDS.has(e.relationshipType) ? e.targetId : e.sourceId;
}

/**
 * Project the curated exposure edges into dependency-graph edges. Deterministic
 * and stable: same input → same output, ordered by source then target.
 * fromVendorId is ALWAYS the dependent (direction "depends_on" is true by
 * construction); toVendorId is the provider.
 */
export function projectExposureToDependencyEdges(): DependencyEdge[] {
  return EXPOSURE_EDGES.map((e) => {
    const dependent = dependentOf(e);
    const provider = dependent === e.sourceId ? e.targetId : e.sourceId;
    return {
      fromVendorId: dependent,
      toVendorId: provider,
      kind: KIND_MAP[e.relationshipType],
      direction: "depends_on" as const,
      strength: Math.round(Math.max(0, Math.min(1, e.strengthScore)) * 100),
      rationale: e.summary,
      sourceUrls: e.sourceUrls ?? [],
      confidence: CONFIDENCE_MAP[e.confidence],
      evidenceGrade: GRADE_MAP[e.confidence],
      relationshipType: e.relationshipType,
    };
  }).sort((a, b) =>
    a.fromVendorId.localeCompare(b.fromVendorId) || a.toVendorId.localeCompare(b.toVendorId),
  );
}

export interface KindSummary {
  kind: DependencyKind;
  label: string;
  edgeCount: number;
  /** Distinct depended-upon targets, most-depended-upon first. */
  topProviders: { id: string; dependents: number }[];
}

/** Group projected edges by kind for the page's server-rendered summary. */
export function summariseByKind(edges: DependencyEdge[]): KindSummary[] {
  const byKind = new Map<DependencyKind, DependencyEdge[]>();
  for (const e of edges) {
    const list = byKind.get(e.kind) ?? [];
    list.push(e);
    byKind.set(e.kind, list);
  }
  const out: KindSummary[] = [];
  for (const [kind, list] of byKind) {
    const providerCounts = new Map<string, number>();
    for (const e of list) providerCounts.set(e.toVendorId, (providerCounts.get(e.toVendorId) ?? 0) + 1);
    const topProviders = [...providerCounts.entries()]
      .map(([id, dependents]) => ({ id, dependents }))
      .sort((a, b) => b.dependents - a.dependents || a.id.localeCompare(b.id))
      .slice(0, 5);
    out.push({ kind, label: KIND_LABEL[kind], edgeCount: list.length, topProviders });
  }
  return out.sort((a, b) => b.edgeCount - a.edgeCount);
}
