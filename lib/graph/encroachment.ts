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
export const NODE_TO_SLUG: Record<string, string> = {
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

// Roles too COARSE to imply head-to-head product competition (2026-07 audit):
// a shared "Infrastructure Player" tag made data-centre operators (xAI, Oracle)
// read as NVIDIA's silicon rivals, and "Investor" is a capital axis, not a
// product layer. Overlap must be in a genuine product-competition layer.
const OVERLAP_EXCLUDED_ROLES = new Set(["Infrastructure Player", "Investor"]);

/**
 * Derive `threatens` edges from `depends_on` edges + role overlap. Each output
 * edge X→Y means "X (Y's dependent) is positioned to encroach on Y". Confidence
 * is capped (it's an inference, not the dependency's own grade) and the source
 * URLs of the underlying dependency are carried through for traceability.
 *
 * 2026-07 audit hardening:
 *  - subsidiary edges never derive encroachment (ownership ≠ competition);
 *  - both sides resolve through NODE_TO_SLUG — same underlying entity ⇒ skip
 *    (kills "Alphabet encroaches on Google DeepMind" self-edges);
 *  - overlap must be in a product layer (see OVERLAP_EXCLUDED_ROLES);
 *  - reciprocal pairs collapse to the single stronger direction, annotated as
 *    mutual, instead of two independent max-strength arrows.
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
    // Ownership is not competition — a parent/subsidiary link never encroaches.
    if (dep.relationshipType === "subsidiary") continue;
    const dependent = dep.fromVendorId; // Y depends on…
    const provider = dep.toVendorId; // …X
    if (dependent === provider) continue;
    // Same underlying entity under two node ids (deepmind→google, nemotron→
    // nvidia): a firm cannot encroach on itself.
    const slugA = NODE_TO_SLUG[dependent];
    const slugB = NODE_TO_SLUG[provider];
    if (slugA && slugB && slugA === slugB) continue;

    const rolesY = rolesByNodeId.get(dependent);
    const rolesX = rolesByNodeId.get(provider);
    if (!rolesX || !rolesY) continue;
    const shared = rolesX.filter(
      (r) => rolesY.includes(r) && !OVERLAP_EXCLUDED_ROLES.has(r),
    );
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

  // Collapse reciprocal pairs (A→B and B→A): keep the stronger direction
  // (deterministic tie-break), annotate it as mutual — one arrow per rivalry,
  // never two independent "eating each other's lunch" claims at equal weight.
  const out = new Map<string, DependencyEdge>();
  for (const e of seen.values()) {
    const reverseKey = `${e.toVendorId}->${e.fromVendorId}`;
    const reverse = seen.get(reverseKey);
    if (!reverse) {
      out.set(`${e.fromVendorId}->${e.toVendorId}`, e);
      continue;
    }
    // Reciprocal exists — keep the stronger (tie → lexicographic from-id).
    const keep =
      e.strength !== reverse.strength
        ? e.strength > reverse.strength ? e : reverse
        : e.fromVendorId < reverse.fromVendorId ? e : reverse;
    const pairKey = `${keep.fromVendorId}->${keep.toVendorId}`;
    if (!out.has(pairKey) && !out.has(`${keep.toVendorId}->${keep.fromVendorId}`)) {
      out.set(pairKey, {
        ...keep,
        rationale: `${keep.rationale} (Reciprocal dependency exists — mutual encroachment potential; showing the stronger direction.)`,
      });
    }
  }

  return [...out.values()].sort(
    (a, b) => b.strength - a.strength || a.fromVendorId.localeCompare(b.fromVendorId),
  );
}
