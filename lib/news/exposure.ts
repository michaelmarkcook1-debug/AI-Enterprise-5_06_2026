// "Does this story touch MY ecosystem?" — per-viewer exposure for a news item.
// ───────────────────────────────────────────────────────────────────────────
// The news feed is otherwise identical for every visitor: nothing tells a buyer
// that a headline lands on a vendor they shortlisted, or on something their
// incumbent stack depends on. This computes that, from signals the viewer
// themselves supplied.
//
// TWO TIERS, both evidence-backed:
//   DIRECT   — the item names a vendor in the viewer's watchlist or current
//              stack. No inference at all.
//   INDIRECT — the item names a vendor connected to one of theirs by a CITED
//              dependency edge (lib/graph/dependency-projection). Carries the
//              edge's own rationale and confidence, and is labelled as a derived
//              second-order signal, never as a stated fact.
//
// HONEST DEGRADATION (the rule that matters): no stored viewer context → no
// badge. We never guess an ecosystem from a default segment, an IP, or "most
// buyers". Absence of context produces absence of a badge, not a generic one.
//
// Pure + deterministic: the dependency graph is static, so this does no I/O.

import { projectExposureToDependencyEdges } from "../graph/dependency-projection";
import { NODE_TO_SLUG } from "../graph/encroachment";

export interface ViewerContext {
  /** Vendor slugs the viewer explicitly saved (watchlist). */
  watchlist: string[];
  /** Vendor slugs the viewer named as their incumbent stack. */
  stack: string[];
}

export type ExposureTier = "direct" | "indirect";

export interface NewsExposure {
  tier: ExposureTier;
  /** Short badge text. */
  label: string;
  /** One sentence explaining WHY this lands on them. */
  detail: string;
  /** The viewer's own vendor slugs implicated. */
  yourVendors: string[];
  /** indirect only — confidence of the cited edge that produced the link. */
  confidence?: number;
}

export interface ExposureInput {
  /** Vendor tokens on the item (may carry a `vendor_` prefix). */
  vendors: string[];
  primaryVendorId?: string | null;
}

const bare = (v: string) => v.replace(/^vendor_/, "");

/** slug → dependency-graph node id (first mapping wins, as Monitor does). */
function slugToNodeMap(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [nodeId, slug] of Object.entries(NODE_TO_SLUG)) {
    if (!m.has(slug)) m.set(slug, nodeId);
  }
  return m;
}

/** node id → slug, for naming the other end of an edge. */
function nodeToSlug(nodeId: string): string | null {
  return (NODE_TO_SLUG as Record<string, string>)[nodeId] ?? null;
}

/**
 * Assess how a news item lands on THIS viewer. Returns null when it doesn't —
 * and when we have no context to judge with, which is the same answer.
 */
export function assessNewsExposure(item: ExposureInput, ctx: ViewerContext): NewsExposure | null {
  const mine = new Set<string>([...ctx.watchlist, ...ctx.stack].map(bare).filter(Boolean));
  if (mine.size === 0) return null; // no context → no claim

  const itemVendors = new Set<string>(
    [...(item.vendors ?? []), ...(item.primaryVendorId ? [item.primaryVendorId] : [])]
      .map(bare)
      .filter(Boolean),
  );
  if (itemVendors.size === 0) return null;

  // ── DIRECT ──
  const direct = [...itemVendors].filter((v) => mine.has(v));
  if (direct.length > 0) {
    const inStack = direct.filter((v) => ctx.stack.map(bare).includes(v));
    return {
      tier: "direct",
      label: inStack.length > 0 ? "Affects your stack" : "On your shortlist",
      detail:
        inStack.length > 0
          ? `This names ${inStack.join(", ")}, which you listed as part of your current stack.`
          : `This names ${direct.join(", ")}, which you're tracking.`,
      yourVendors: direct,
    };
  }

  // ── INDIRECT — only via a cited dependency edge between their vendor and this one. ──
  const s2n = slugToNodeMap();
  const myNodes = new Map<string, string>(); // nodeId → my slug
  for (const slug of mine) {
    const node = s2n.get(slug);
    if (node) myNodes.set(node, slug);
  }
  if (myNodes.size === 0) return null;

  const itemNodes = new Map<string, string>(); // nodeId → item slug
  for (const v of itemVendors) {
    const node = s2n.get(v);
    if (node) itemNodes.set(node, v);
  }
  if (itemNodes.size === 0) return null;

  for (const e of projectExposureToDependencyEdges()) {
    if (e.direction !== "depends_on") continue;
    // Their vendor depends on the vendor in the news, or vice versa.
    const mineIsFrom = myNodes.has(e.fromVendorId) && itemNodes.has(e.toVendorId);
    const mineIsTo = myNodes.has(e.toVendorId) && itemNodes.has(e.fromVendorId);
    if (!mineIsFrom && !mineIsTo) continue;

    const myslug = mineIsFrom ? myNodes.get(e.fromVendorId)! : myNodes.get(e.toVendorId)!;
    const otherNode = mineIsFrom ? e.toVendorId : e.fromVendorId;
    const otherSlug = nodeToSlug(otherNode) ?? otherNode;
    return {
      tier: "indirect",
      label: "Touches a dependency",
      detail: mineIsFrom
        ? `${myslug} depends on ${otherSlug} — ${e.rationale}`
        : `${otherSlug} depends on ${myslug} — ${e.rationale}`,
      yourVendors: [myslug],
      confidence: e.confidence,
    };
  }

  return null;
}
