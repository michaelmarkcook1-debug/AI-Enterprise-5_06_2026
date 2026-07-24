// Flattened alliance rows for the /alliances workspace.
// ───────────────────────────────────────────────────────────────────────────
// Joins the curated delivery seed (partner × vendor × tier, with the seed's own
// industry/region/implementation-area tags) to the fact-checked cited spotlights.
// Pure + deterministic, no DB. Provenance stays separated on every row:
//   • tier/evidence/industries/regions/areas → analyst-curated seed (directional)
//   • spotlight                              → source-cited, named publisher
// Nothing here feeds a vendor score (delivery firewall preserved).

import {
  DELIVERY_PARTNERS,
  DELIVERY_PARTNERSHIPS,
  type PartnershipTier,
  type EvidenceTierPartnership,
  type DeliveryPartnerKind,
} from "./seed";
import { HYBRID_PARENT_VENDOR } from "../graph/delivery-projection";
import { ALLIANCE_SPOTLIGHTS, type AllianceProofPoint } from "./alliance-highlights";

export interface AllianceRowSpotlight {
  relationship: string;
  summary: string;
  proofPoints: AllianceProofPoint[];
  publisher: string;
  url: string;
  asOf: string;
  evidence: "verified" | "partial";
}

export interface AllianceRow {
  key: string;
  partnerId: string;
  partnerName: string;
  partnerKind: DeliveryPartnerKind;
  platformHybrid: boolean;
  vendorId: string;
  vendorName: string;
  tier: PartnershipTier;
  evidence: EvidenceTierPartnership;
  /** Platform-hybrid SI delivering a RIVAL model — derived signal, labelled in UI. */
  encroachment: boolean;
  industries: string[];
  regions: string[];
  areas: string[];
  spotlight: AllianceRowSpotlight | null;
}

export const TIER_LABEL: Record<PartnershipTier, string> = {
  direct_named: "Direct named partner",
  cloud_certified: "Cloud-certified integrator",
  observed_implementer: "Observed implementer",
};

export const KIND_LABEL: Record<DeliveryPartnerKind, string> = {
  global_si: "Global SI",
  platform_hybrid: "Platform hybrid",
  strategy_consultancy: "Strategy consultancy",
  regional_si: "Regional SI",
};

const PARTNER_BY_ID = new Map(DELIVERY_PARTNERS.map((p) => [p.id, p]));
const SPOTLIGHT_BY_KEY = new Map(
  ALLIANCE_SPOTLIGHTS.filter((s) => s.partnerId).map((s) => [
    `${s.partnerId}|${s.vendorId}`,
    {
      relationship: s.relationship,
      summary: s.summary,
      proofPoints: s.proofPoints,
      publisher: s.publisher,
      url: s.url,
      asOf: s.asOf,
      evidence: s.evidence,
    } satisfies AllianceRowSpotlight,
  ]),
);

/** Every curated partnership as a display row, spotlight attached where one exists. */
export function buildAllianceRows(vendorNames: Record<string, string>): AllianceRow[] {
  return DELIVERY_PARTNERSHIPS.map((p) => {
    const partner = PARTNER_BY_ID.get(p.deliveryPartnerId);
    const platformHybrid = partner?.platformHybrid ?? false;
    const key = `${p.deliveryPartnerId}|${p.aiVendorId}`;
    return {
      key,
      partnerId: p.deliveryPartnerId,
      partnerName: partner?.name ?? p.deliveryPartnerId,
      partnerKind: partner?.kind ?? "global_si",
      platformHybrid,
      vendorId: p.aiVendorId,
      vendorName: vendorNames[p.aiVendorId] ?? p.aiVendorId,
      tier: p.partnershipTier,
      evidence: p.evidenceTier,
      encroachment: platformHybrid && p.aiVendorId !== HYBRID_PARENT_VENDOR[p.deliveryPartnerId],
      industries: p.industries,
      regions: p.regions,
      areas: p.implementationAreas,
      spotlight: SPOTLIGHT_BY_KEY.get(key) ?? null,
    };
  }).sort(
    (a, b) => a.partnerName.localeCompare(b.partnerName) || a.vendorName.localeCompare(b.vendorName),
  );
}

/**
 * Cited alliances that do NOT correspond to a curated channel row — either the
 * integrator is outside the 21-house roster, or the seed carries no such edge.
 * Reported openly rather than silently dropped from the counts.
 */
export function citedOffChannel(rows: AllianceRow[]): string[] {
  const present = new Set(rows.map((r) => r.key));
  return ALLIANCE_SPOTLIGHTS.filter(
    (s) => !s.partnerId || !present.has(`${s.partnerId}|${s.vendorId}`),
  ).map((s) => `${s.partnerName} × ${s.vendorName}`);
}

/** Counts measured off the rows themselves — never authored constants. */
export function summariseRows(rows: AllianceRow[]) {
  const byVendor = new Map<string, number>();
  // Deliberately a string-keyed record: the client `Summary` type consumes it as
  // Record<string, number>, and a literal-keyed record is not assignable to that.
  const byTier: Record<string, number> = {
    direct_named: 0,
    cloud_certified: 0,
    observed_implementer: 0,
  };
  const partners = new Set<string>();
  for (const r of rows) {
    byVendor.set(r.vendorId, (byVendor.get(r.vendorId) ?? 0) + 1);
    byTier[r.tier] += 1;
    partners.add(r.partnerId);
  }
  const vendorCoverage = [...byVendor.entries()]
    .map(([vendorId, count]) => ({
      vendorId,
      vendorName: rows.find((r) => r.vendorId === vendorId)?.vendorName ?? vendorId,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.vendorName.localeCompare(b.vendorName));

  return {
    links: rows.length,
    partners: partners.size,
    vendors: byVendor.size,
    spotlit: rows.filter((r) => r.spotlight).length,
    encroaching: rows.filter((r) => r.encroachment).length,
    vendorCoverage,
    byTier,
  };
}
