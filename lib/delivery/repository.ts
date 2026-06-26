// Delivery-partnership repository — read / load / reach signal.
// ───────────────────────────────────────────────────────────────────────────
// The curated analyst roster SHOWS (it is structural reference data with its own
// provenance label, like the category taxonomy — NOT fabricated scores), so the
// read MERGES the in-memory seed (always present, labeled "Analyst-curated") with
// any DB rows (which may be news_confirmed upgrades). DB rows win per
// (partner, tier) key; DB-only rows (added from a real cited item) are appended.
// Reads NEVER write a vendor score (firewall): scoring reads reach FORWARD only.

import { getPrisma, hasDatabase } from "../prisma";
import {
  DELIVERY_PARTNERS,
  DELIVERY_PARTNERSHIPS,
  PARTNERSHIP_SOURCE,
  type DeliveryPartnerSeed,
  type DeliveryPartnershipSeed,
  type PartnershipTier,
  type EvidenceTierPartnership,
  type PartnershipProvenance,
} from "./seed";

const PARTNER_BY_ID = new Map<string, DeliveryPartnerSeed>(DELIVERY_PARTNERS.map((p) => [p.id, p]));

export interface DeliveryPartnershipRow {
  deliveryPartnerId: string;
  partnerName: string;
  partnerKind: DeliveryPartnerSeed["kind"];
  platformHybrid: boolean;
  aiVendorId: string;
  partnershipTier: PartnershipTier;
  evidenceTier: EvidenceTierPartnership;
  provenance: PartnershipProvenance;
  source: string | null;
  sourceUrls: string[];
  implementationAreas: string[];
  industries: string[];
  regions: string[];
  lastVerified: string | null;
  /** Set only by a real cited "partnership ended" item. Null = active. */
  endedAt: string | null;
}

function fromSeed(s: DeliveryPartnershipSeed): DeliveryPartnershipRow {
  const partner = PARTNER_BY_ID.get(s.deliveryPartnerId);
  return {
    deliveryPartnerId: s.deliveryPartnerId,
    partnerName: partner?.name ?? s.deliveryPartnerId,
    partnerKind: partner?.kind ?? "global_si",
    platformHybrid: partner?.platformHybrid ?? false,
    aiVendorId: s.aiVendorId,
    partnershipTier: s.partnershipTier,
    evidenceTier: s.evidenceTier,
    provenance: s.provenance,
    source: s.source,
    sourceUrls: [],
    implementationAreas: s.implementationAreas,
    industries: s.industries,
    regions: s.regions,
    lastVerified: null,
    endedAt: null,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromDb(d: any): DeliveryPartnershipRow {
  const partner = PARTNER_BY_ID.get(d.deliveryPartnerId);
  return {
    deliveryPartnerId: d.deliveryPartnerId,
    partnerName: d.deliveryPartner?.name ?? partner?.name ?? d.deliveryPartnerId,
    partnerKind: (d.deliveryPartner?.kind ?? partner?.kind ?? "global_si") as DeliveryPartnerSeed["kind"],
    platformHybrid: d.deliveryPartner?.platformHybrid ?? partner?.platformHybrid ?? false,
    aiVendorId: d.aiVendorId,
    partnershipTier: d.partnershipTier,
    evidenceTier: d.evidenceTier,
    provenance: d.provenance,
    source: d.source ?? null,
    sourceUrls: d.sourceUrls ?? [],
    implementationAreas: d.implementationAreas ?? [],
    industries: d.industries ?? [],
    regions: d.regions ?? [],
    lastVerified: d.lastVerified ? new Date(d.lastVerified).toISOString() : null,
    endedAt: d.endedAt ? new Date(d.endedAt).toISOString() : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const key = (r: { deliveryPartnerId: string; partnershipTier: PartnershipTier }) =>
  `${r.deliveryPartnerId}|${r.partnershipTier}`;

/** Merge seed (base) with DB rows (news_confirmed upgrades win per partner+tier). */
async function mergedRows(where: { aiVendorId?: string }): Promise<DeliveryPartnershipRow[]> {
  const seedRows = (where.aiVendorId
    ? DELIVERY_PARTNERSHIPS.filter((p) => p.aiVendorId === where.aiVendorId)
    : DELIVERY_PARTNERSHIPS
  ).map(fromSeed);

  const byKey = new Map<string, DeliveryPartnershipRow>();
  for (const r of seedRows) byKey.set(`${r.aiVendorId}|${key(r)}`, r);

  if (hasDatabase()) {
    try {
      const dbRows = await getPrisma().deliveryPartnership.findMany({
        where: where.aiVendorId ? { aiVendorId: where.aiVendorId } : undefined,
        include: { deliveryPartner: true },
      });
      for (const d of dbRows) {
        const r = fromDb(d);
        byKey.set(`${r.aiVendorId}|${key(r)}`, r); // DB wins (upgrade)
      }
    } catch {
      /* DB unavailable → curated seed still shows (it's structural reference data). */
    }
  }
  return [...byKey.values()];
}

/** Implementation partners for a vendor, grouped-ready (tiers preserved, labeled). */
export async function getDeliveryPartnershipsForVendor(vendorId: string): Promise<DeliveryPartnershipRow[]> {
  const rows = (await mergedRows({ aiVendorId: vendorId })).filter((r) => !r.endedAt); // active only
  // Deterministic: direct_named first, then cloud_certified, then observed_implementer;
  // within tier, strong evidence first, then partner name.
  const tierRank: Record<PartnershipTier, number> = { direct_named: 0, cloud_certified: 1, observed_implementer: 2 };
  const evRank: Record<EvidenceTierPartnership, number> = { strong: 0, moderate: 1, plausible_unverified: 2 };
  return rows.sort(
    (a, b) =>
      tierRank[a.partnershipTier] - tierRank[b.partnershipTier] ||
      evRank[a.evidenceTier] - evRank[b.evidenceTier] ||
      a.partnerName.localeCompare(b.partnerName),
  );
}

export async function getAllDeliveryPartnerships(): Promise<DeliveryPartnershipRow[]> {
  return mergedRows({});
}

// ── Delivery-reach raw signal per AI vendor (for the scoring engine). ──
const TIER_WEIGHT: Record<PartnershipTier, number> = { direct_named: 2, cloud_certified: 1.5, observed_implementer: 1 };
const EVIDENCE_WEIGHT: Record<EvidenceTierPartnership, number> = { strong: 1, moderate: 0.6, plausible_unverified: 0.3 };

export interface DeliveryReach {
  reachRaw: number; // tier×evidence weighted breadth × region/industry spread bonus
  distinctPartners: number;
  newsConfirmed: number; // count of news_confirmed edges (for provenance-aware confidence)
}

/** Per-vendor delivery-reach raw signal. Deterministic; counts real edges only;
 *  unverified edges are heavily discounted; no fabricated number. */
export async function getDeliveryReachByVendor(): Promise<Map<string, DeliveryReach>> {
  const all = (await getAllDeliveryPartnerships()).filter((r) => !r.endedAt); // active only
  const byVendor = new Map<string, DeliveryPartnershipRow[]>();
  for (const r of all) {
    const arr = byVendor.get(r.aiVendorId);
    if (arr) arr.push(r);
    else byVendor.set(r.aiVendorId, [r]);
  }
  const weight = (r: DeliveryPartnershipRow) => TIER_WEIGHT[r.partnershipTier] * EVIDENCE_WEIGHT[r.evidenceTier];
  const out = new Map<string, DeliveryReach>();
  for (const [vendorId, rows] of byVendor) {
    // One logical relationship = one contribution: collapse to the STRONGEST active
    // row per partner so a stray multi-tier duplicate can't double-count reach.
    const strongestByPartner = new Map<string, DeliveryPartnershipRow>();
    for (const r of rows) {
      const cur = strongestByPartner.get(r.deliveryPartnerId);
      if (!cur || weight(r) > weight(cur)) strongestByPartner.set(r.deliveryPartnerId, r);
    }
    const collapsed = [...strongestByPartner.values()];
    const weighted = collapsed.reduce((s, r) => s + weight(r), 0);
    const regions = new Set(collapsed.flatMap((r) => r.regions));
    const industries = new Set(collapsed.flatMap((r) => r.industries));
    const spreadBonus = Math.min(1.4, 1 + 0.05 * (regions.size + industries.size));
    out.set(vendorId, {
      reachRaw: weighted * spreadBonus,
      distinctPartners: strongestByPartner.size,
      newsConfirmed: collapsed.filter((r) => r.provenance === "news_confirmed").length,
    });
  }
  return out;
}

// ── Seed loader (DB write — activation/pipeline only). Never overwrites a row
//    already upgraded to news_confirmed. Idempotent. ──
export async function loadDeliveryPartnerSeed(): Promise<{ partners: number; partnerships: number }> {
  if (!hasDatabase()) return { partners: 0, partnerships: 0 };
  const prisma = getPrisma();
  for (const p of DELIVERY_PARTNERS) {
    await prisma.deliveryPartner.upsert({
      where: { id: p.id },
      create: { id: p.id, name: p.name, slug: p.slug, kind: p.kind, platformHybrid: p.platformHybrid, source: PARTNERSHIP_SOURCE },
      update: { name: p.name, slug: p.slug, kind: p.kind, platformHybrid: p.platformHybrid },
    });
  }
  let partnerships = 0;
  for (const s of DELIVERY_PARTNERSHIPS) {
    // Find existing by the composite unique; never downgrade a news_confirmed row.
    const existing = await prisma.deliveryPartnership.findUnique({
      where: { deliveryPartnerId_aiVendorId_partnershipTier: { deliveryPartnerId: s.deliveryPartnerId, aiVendorId: s.aiVendorId, partnershipTier: s.partnershipTier } },
    }).catch(() => null);
    if (existing && existing.provenance === "news_confirmed") continue; // preserve upgrade
    await prisma.deliveryPartnership.upsert({
      where: { deliveryPartnerId_aiVendorId_partnershipTier: { deliveryPartnerId: s.deliveryPartnerId, aiVendorId: s.aiVendorId, partnershipTier: s.partnershipTier } },
      create: {
        deliveryPartnerId: s.deliveryPartnerId, aiVendorId: s.aiVendorId, partnershipTier: s.partnershipTier,
        evidenceTier: s.evidenceTier, provenance: "analyst_curated_seed", source: s.source,
        implementationAreas: s.implementationAreas, industries: s.industries, regions: s.regions,
      },
      update: { evidenceTier: s.evidenceTier, source: s.source, implementationAreas: s.implementationAreas, industries: s.industries, regions: s.regions },
    }).catch(() => null);
    partnerships += 1;
  }
  return { partners: DELIVERY_PARTNERS.length, partnerships };
}
