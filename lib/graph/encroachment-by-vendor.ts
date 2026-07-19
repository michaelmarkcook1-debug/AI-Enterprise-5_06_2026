// Per-vendor, DIRECTIONAL encroachment reads for the shortlist monitor.
// ─────────────────────────────────────────────────────────────────────────────
// The graph derives encroachment as node→node `threatens` edges
// (deriveEncroachmentEdges). Every existing consumer — the vendor profile's
// Dependencies tab, the Monitor's graph alerts — filters those edges to "any
// edge touching this vendor" and shows them undifferentiated. The shortlist
// scorecard needs the two directions kept APART:
//   • encroachesOn  — this vendor is positioned to eat someone else's lunch
//   • encroachedBy  — someone else is positioned to eat THIS vendor's lunch
// and both keyed back to /vendors slugs (the edges key on exposure node ids).
//
// This is the packaging the flagship cross-shortlist signal needs: intersect a
// vendor's encroach targets with the REST of the user's shortlist and you get
// "competes with your Cursor" — a read no analyst house sells, and one that is
// fully defensible because it is just the (already cited, already E2-capped,
// already "derived, not a stated fact") edge set, re-projected. No new claim is
// manufactured here; we only re-slice what deriveEncroachmentEdges produced.

import { projectExposureToDependencyEdges, type DependencyEdge } from "./dependency-projection";
import { deriveEncroachmentEdges, buildRolesByNodeId, NODE_TO_SLUG } from "./encroachment";

/** One directional encroachment relation, resolved to the OTHER party's /vendors slug. */
export interface EncroachmentRelation {
  /** The other vendor in the relation, as a /vendors slug (never a node id). */
  vendorSlug: string;
  /** The derived rationale carried through from the underlying edge. */
  rationale: string;
  /** Source URLs of the dependency the inference rests on (traceability). */
  sourceUrls: string[];
  /** Edge strength (≤70 — a derived inference) and confidence (≤40, E2). */
  strength: number;
  confidence: number;
}

export interface VendorEncroachment {
  /** Vendors THIS vendor is positioned to encroach on (it is the threatener). */
  encroachesOn: EncroachmentRelation[];
  /** Vendors positioned to encroach on THIS vendor (it is the threatened). */
  encroachedBy: EncroachmentRelation[];
  /** false when the vendor has no node in the graph at all → honest "not mapped". */
  mapped: boolean;
}

const EMPTY: VendorEncroachment = { encroachesOn: [], encroachedBy: [], mapped: false };

/** The exposure node ids that resolve to a given /vendors slug (one slug can span
 *  several nodes, e.g. google ← GOOGL + deepmind). */
function nodesForSlug(slug: string): Set<string> {
  return new Set(
    Object.entries(NODE_TO_SLUG)
      .filter(([, s]) => s === slug)
      .map(([nodeId]) => nodeId),
  );
}

/** Keep the strongest relation per counterparty slug (a slug can be reached via
 *  more than one node pairing); deterministic order, strongest first. */
function dedupeBySlug(rels: EncroachmentRelation[]): EncroachmentRelation[] {
  const best = new Map<string, EncroachmentRelation>();
  for (const r of rels) {
    const cur = best.get(r.vendorSlug);
    if (!cur || r.strength > cur.strength) best.set(r.vendorSlug, r);
  }
  return [...best.values()].sort(
    (a, b) => b.strength - a.strength || a.vendorSlug.localeCompare(b.vendorSlug),
  );
}

/**
 * PURE: split a set of already-derived `threatens` edges into per-vendor
 * directional relations, keyed by /vendors slug. Injectable `derived` makes this
 * deterministically testable without touching the exposure map. A vendor with no
 * graph node returns `mapped:false` (honest absence — the graph tracks the model/
 * infra stack, not every vendor a user might shortlist, e.g. a GSI).
 */
export function splitEncroachmentByVendor(
  derived: DependencyEdge[],
  slugs: string[],
): Map<string, VendorEncroachment> {
  const out = new Map<string, VendorEncroachment>();
  for (const slug of slugs) {
    const nodes = nodesForSlug(slug);
    if (nodes.size === 0) {
      out.set(slug, { ...EMPTY });
      continue;
    }
    const encroachesOn: EncroachmentRelation[] = [];
    const encroachedBy: EncroachmentRelation[] = [];
    for (const e of derived) {
      const fromSlug = NODE_TO_SLUG[e.fromVendorId]; // threatener
      const toSlug = NODE_TO_SLUG[e.toVendorId]; // threatened
      const rel = (vendorSlug: string): EncroachmentRelation => ({
        vendorSlug,
        rationale: e.rationale,
        sourceUrls: e.sourceUrls,
        strength: e.strength,
        confidence: e.confidence,
      });
      // This vendor is the threatener (its node is on the `from` side).
      if (nodes.has(e.fromVendorId) && toSlug && toSlug !== slug) {
        encroachesOn.push(rel(toSlug));
      }
      // This vendor is the threatened (its node is on the `to` side).
      else if (nodes.has(e.toVendorId) && fromSlug && fromSlug !== slug) {
        encroachedBy.push(rel(fromSlug));
      }
    }
    out.set(slug, {
      encroachesOn: dedupeBySlug(encroachesOn),
      encroachedBy: dedupeBySlug(encroachedBy),
      mapped: true,
    });
  }
  return out;
}

/** Live read: derive from the real exposure map, then split per vendor. */
export function encroachmentForVendors(slugs: string[]): Map<string, VendorEncroachment> {
  const derived = deriveEncroachmentEdges(projectExposureToDependencyEdges(), buildRolesByNodeId());
  return splitEncroachmentByVendor(derived, slugs);
}
