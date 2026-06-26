// Delivery-partnership graph projection (pure, deterministic, no LLM, no DB).
// ───────────────────────────────────────────────────────────────────────────
// Embeds the IT-services / GSI delivery layer into the ecosystem graph as a
// SEPARATE node layer (delivery_partner) joined to the ai_vendor layer by typed
// "delivery_partnership" edges. This is PROJECTION, not fabrication: every edge
// carries the curated partnership's tier + evidence + provenance + source
// verbatim (lib/delivery/seed). The three partnership tiers are preserved and
// NEVER merged. There is NO path from a delivery edge to a vendor score
// (firewall) — edge strength is a delivery-channel signal only.
//
// Encroachment: a platform-integrator HYBRID (an SI that also owns its own AI
// platform — IBM Consulting/watsonx) which delivers a RIVAL vendor's model is
// structurally positioned to migrate that client onto its own platform. We flag
// those edges as a DERIVED, labeled encroachment signal (never as stated fact),
// and exclude the hybrid's delivery of its OWN parent model (that's not a threat).

import {
  DELIVERY_PARTNERS,
  DELIVERY_PARTNERSHIPS,
  type DeliveryPartnerKind,
  type PartnershipTier,
  type EvidenceTierPartnership,
  type PartnershipProvenance,
} from "../delivery/seed";

/** Platform-hybrid SI → the AI vendor id of its OWN model (self-delivery, not encroachment). */
export const HYBRID_PARENT_VENDOR: Record<string, string> = {
  "ibm-consulting": "ibm",
};

const TIER_STRENGTH: Record<PartnershipTier, number> = {
  direct_named: 1.0,
  cloud_certified: 0.75,
  observed_implementer: 0.5,
};
const EVIDENCE_STRENGTH: Record<EvidenceTierPartnership, number> = {
  strong: 1.0,
  moderate: 0.6,
  plausible_unverified: 0.3,
};

const TIER_LABEL: Record<PartnershipTier, string> = {
  direct_named: "direct named partner",
  cloud_certified: "cloud-certified integrator",
  observed_implementer: "observed implementer",
};

export type DeliveryNodeLayer = "delivery_partner" | "ai_vendor";

export interface DeliveryGraphNode {
  id: string;
  label: string;
  layer: DeliveryNodeLayer;
  /** delivery_partner nodes only. */
  kind?: DeliveryPartnerKind;
  platformHybrid?: boolean;
  /** Edges touching this node. */
  degree: number;
}

export interface DeliveryGraphEdge {
  partnerId: string;
  partnerName: string;
  vendorId: string;
  kind: "delivery_partnership";
  partnershipTier: PartnershipTier;
  evidenceTier: EvidenceTierPartnership;
  provenance: PartnershipProvenance;
  /** 0–100, tier × evidence. Delivery-channel strength only — never a vendor score. */
  strength: number;
  source: string | null;
  /** Platform-hybrid SI delivering a RIVAL model → derived encroachment signal. */
  encroachment: boolean;
  rationale: string;
}

export interface DeliveryGraph {
  nodes: DeliveryGraphNode[];
  edges: DeliveryGraphEdge[];
  /** Hybrids and the rival vendors they deliver (the encroachment summary). */
  encroachers: { partnerId: string; partnerName: string; vendorIds: string[] }[];
}

const PARTNER_BY_ID = new Map(DELIVERY_PARTNERS.map((p) => [p.id, p]));

/**
 * Project the curated delivery partnerships into a two-layer graph. Deterministic
 * and stable: same input → same output, ordered by strength then id.
 */
export function buildDeliveryGraph(): DeliveryGraph {
  const degree = new Map<string, number>();
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);

  const edges: DeliveryGraphEdge[] = DELIVERY_PARTNERSHIPS.map((p) => {
    const partner = PARTNER_BY_ID.get(p.deliveryPartnerId);
    const isHybrid = partner?.platformHybrid ?? false;
    const ownVendor = HYBRID_PARENT_VENDOR[p.deliveryPartnerId];
    const encroachment = isHybrid && p.aiVendorId !== ownVendor;
    const strength = Math.round(TIER_STRENGTH[p.partnershipTier] * EVIDENCE_STRENGTH[p.evidenceTier] * 100);
    const partnerName = partner?.name ?? p.deliveryPartnerId;
    const rationale = encroachment
      ? `Derived signal: ${partnerName} is a platform-integrator hybrid (owns its own AI platform) yet delivers ${p.aiVendorId} as an ${TIER_LABEL[p.partnershipTier]} — positioned to migrate clients onto its own platform.`
      : `${partnerName} delivers ${p.aiVendorId} (${TIER_LABEL[p.partnershipTier]}, ${p.evidenceTier} evidence).`;
    bump(p.deliveryPartnerId);
    bump(p.aiVendorId);
    return {
      partnerId: p.deliveryPartnerId,
      partnerName,
      vendorId: p.aiVendorId,
      kind: "delivery_partnership" as const,
      partnershipTier: p.partnershipTier,
      evidenceTier: p.evidenceTier,
      provenance: p.provenance,
      strength,
      source: p.source,
      encroachment,
      rationale,
    };
  });

  const partnerIds = new Set(edges.map((e) => e.partnerId));
  const vendorIds = new Set(edges.map((e) => e.vendorId));
  const nodes: DeliveryGraphNode[] = [
    ...[...partnerIds].map((id) => {
      const partner = PARTNER_BY_ID.get(id);
      return {
        id,
        label: partner?.name ?? id,
        layer: "delivery_partner" as const,
        kind: partner?.kind,
        platformHybrid: partner?.platformHybrid ?? false,
        degree: degree.get(id) ?? 0,
      };
    }),
    ...[...vendorIds].map((id) => ({
      id,
      label: id,
      layer: "ai_vendor" as const,
      degree: degree.get(id) ?? 0,
    })),
  ].sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));

  // Encroachment summary: each hybrid → the rival vendors it delivers.
  const encMap = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!e.encroachment) continue;
    const set = encMap.get(e.partnerId) ?? new Set<string>();
    set.add(e.vendorId);
    encMap.set(e.partnerId, set);
  }
  const encroachers = [...encMap.entries()]
    .map(([partnerId, set]) => ({
      partnerId,
      partnerName: PARTNER_BY_ID.get(partnerId)?.name ?? partnerId,
      vendorIds: [...set].sort(),
    }))
    .sort((a, b) => b.vendorIds.length - a.vendorIds.length || a.partnerId.localeCompare(b.partnerId));

  edges.sort(
    (a, b) =>
      b.strength - a.strength ||
      a.partnerId.localeCompare(b.partnerId) ||
      a.vendorId.localeCompare(b.vendorId),
  );

  return { nodes, edges, encroachers };
}
