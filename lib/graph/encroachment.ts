// Encroachment derivation (pure, deterministic, no LLM).
// ───────────────────────────────────────────────────────
// "Who is about to eat whose lunch." Encroachment is an ANALYTICAL INFERENCE,
// never a stated fact — so we derive it ONLY from two real inputs and label it
// as derived:
//   1. a source-backed dependency edge  (Y depends on X)  — from the exposure map
//   2. a role overlap                    (X also operates in Y's layer) — from the
//      vendor role roster (ENTITIES.primaryRole + secondaryRoles)
// When both hold, X (Y's supplier) is positioned to encroach on Y. No overlap or
// no resolved roles → no edge (we under-claim rather than guess).

import { EXPOSURE_NODES } from "../investing/exposure-map-data";
import { ENTITIES } from "../intelligence/entities";
import type { DependencyEdge } from "./dependency-projection";

// Mirrors NODE_TO_VENDOR_SLUG in components/dashboard/ExposureMapHero.tsx —
// resolves exposure node ids to /vendors slugs (and thus to ENTITIES roles).
// Nodes absent here simply yield no encroachment edges (honest under-claim).
const NODE_TO_SLUG: Record<string, string> = {
  MSFT: "microsoft", AMZN: "aws", GOOGL: "google", NVDA: "nvidia", ORCL: "oracle",
  CRM: "salesforce", SNOW: "snowflake",
  openai: "openai", anthropic: "anthropic", deepmind: "google", mistral: "mistral",
  cohere: "cohere", xai: "xai", perplexity: "perplexity", meta: "meta", deepseek: "deepseek",
  alibaba: "alibaba", moonshot: "moonshot", zai: "zai", minimax: "minimax", ai21: "ai21",
  aleph: "aleph", nemotron: "nvidia",
};

/** Map exposure node id → its market roles, via the vendor roster. Static, no DB. */
export function buildRolesByNodeId(): Map<string, string[]> {
  const entityBySlug = new Map(ENTITIES.map((e) => [e.slug, e]));
  const out = new Map<string, string[]>();
  for (const [nodeId, slug] of Object.entries(NODE_TO_SLUG)) {
    const e = entityBySlug.get(slug);
    if (!e) continue;
    out.set(nodeId, [e.primaryRole, ...e.secondaryRoles] as string[]);
  }
  return out;
}

/**
 * Derive `threatens` edges from `depends_on` edges + role overlap. Each output
 * edge X→Y means "X (Y's supplier) is positioned to encroach on Y". Confidence
 * is capped (it's an inference, not the dependency's own grade) and the source
 * URLs of the underlying dependency are carried through for traceability.
 */
export function deriveEncroachmentEdges(
  dependencyEdges: DependencyEdge[],
  rolesByNodeId: Map<string, string[]>,
): DependencyEdge[] {
  const labelById = new Map(EXPOSURE_NODES.map((n) => [n.id, n.label]));
  const label = (id: string) => labelById.get(id) ?? id;
  const seen = new Map<string, DependencyEdge>();

  for (const dep of dependencyEdges) {
    if (dep.direction !== "depends_on") continue;
    const dependent = dep.fromVendorId; // Y depends on…
    const provider = dep.toVendorId; // …X
    if (dependent === provider) continue;

    const rolesY = rolesByNodeId.get(dependent);
    const rolesX = rolesByNodeId.get(provider);
    if (!rolesX || !rolesY) continue;
    const shared = rolesX.filter((r) => rolesY.includes(r));
    if (shared.length === 0) continue;

    // Direction: the DEPENDENT that also operates in its provider's layer is the
    // one positioned to encroach (the customer/distributor that builds its own to
    // displace its supplier — e.g. Microsoft relies on OpenAI yet ships Phi/MAI).
    const key = `${dependent}->${provider}`;
    const edge: DependencyEdge = {
      fromVendorId: dependent, // threatener
      toVendorId: provider, // threatened
      kind: "encroachment",
      direction: "threatens",
      // Capped: it's a derived inference, weaker than the sourced dependency.
      strength: Math.min(Math.round(dep.strength * 0.8), 70),
      rationale: `Derived signal: ${label(dependent)} relies on ${label(provider)} for ${dep.kind} but also operates in the ${shared.join("/")} layer — ${label(dependent)} is positioned to encroach on ${label(provider)}.`,
      sourceUrls: dep.sourceUrls,
      confidence: 40,
      evidenceGrade: "E2",
      relationshipType: dep.relationshipType,
    };
    const existing = seen.get(key);
    if (!existing || edge.strength > existing.strength) seen.set(key, edge);
  }

  return [...seen.values()].sort(
    (a, b) => b.strength - a.strength || a.fromVendorId.localeCompare(b.fromVendorId),
  );
}
