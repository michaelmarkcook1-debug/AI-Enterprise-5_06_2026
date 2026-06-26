// Live market-share = evidence-derived category-PRESENCE share.
// ───────────────────────────────────────────────────────────────────────────
// REPLACES the old seed-baseline-tilt (which rewrote the hardcoded
// MARKET_SHARE_ESTIMATES seed with its seed source string). There is no real
// measured-share feed, so each run we recompute a directional category-presence
// estimate for every evidenced vendor from the REAL ingested signals
// (verified-evidence depth + production references + deployment depth + momentum)
// via lib/system/market-presence.ts, and stamp an HONEST, non-seed source.
//
// Category MEMBERSHIP (which category a vendor competes in) reuses the curated
// taxonomy embedded in MARKET_SHARE_ESTIMATES — a structural analyst assignment,
// NOT the fabricated share numbers, which we discard. Vendors with no curated
// membership are reported (uncovered) rather than guessed; vendors with no real
// signal are omitted (insufficient evidence), never floated at 0.

import { getPrisma, hasDatabase } from "../prisma";
import { MARKET_SHARE_ESTIMATES } from "../intelligence/seed";
import { marketShareChangePct } from "../intelligence/metrics";
import { isSeedSignedSource } from "../intelligence/provenance";
import { getDeliveryReachByVendor, type DeliveryReach } from "../delivery/repository";
import {
  computePresenceShares,
  PRESENCE_SOURCE,
  PRESENCE_METHODOLOGY,
  type VendorSignal,
} from "./market-presence";

export interface MarketShareMovementResult {
  skipped: boolean;
  reason?: string;
  rowsUpdated: number;
  seedRowsDeleted: number;
  vendorsCovered: number;
  uncoveredVendorIds: string[];
  topMovers: { vendorId: string; categoryId: string; to: number; changePct: number }[];
}

/** Distinct curated (vendorId, categoryId) memberships — taxonomy only. */
function curatedMemberships(): { vendorId: string; categoryId: string }[] {
  const seen = new Set<string>();
  const out: { vendorId: string; categoryId: string }[] = [];
  for (const e of MARKET_SHARE_ESTIMATES) {
    const key = `${e.vendorId}__${e.categoryId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ vendorId: e.vendorId, categoryId: e.categoryId });
  }
  return out;
}

export async function deriveMarketShareMovement(now: Date = new Date()): Promise<MarketShareMovementResult> {
  if (!hasDatabase()) {
    return { skipped: true, reason: "no_database", rowsUpdated: 0, seedRowsDeleted: 0, vendorsCovered: 0, uncoveredVendorIds: [], topMovers: [] };
  }
  const prisma = getPrisma();

  // ── Real per-vendor signals ────────────────────────────────────────────────
  const [evGroups, momRows, profiles, allVendors, existing, deliveryReach] = await Promise.all([
    prisma.evidenceRecord.groupBy({ by: ["vendorId"], where: { reviewStatus: "analyst_verified" }, _count: { _all: true } }),
    prisma.vendorMomentum.findMany({ where: { period: "rolling_30d" }, select: { vendorId: true, momentumScore: true } }),
    prisma.vendorProfile.findMany({ include: { industryAdoption: true } }).catch(() => []),
    prisma.intelligenceVendor.findMany({ select: { id: true } }),
    prisma.marketShareEstimate.findMany({ select: { vendorId: true, categoryId: true, estimatedShare: true, source: true } }),
    getDeliveryReachByVendor().catch(() => new Map<string, DeliveryReach>()),
  ]);

  const verifiedEvidence = new Map<string, number>(evGroups.map((g) => [g.vendorId, g._count._all]));
  const momentum = new Map<string, number>(momRows.map((r) => [r.vendorId, r.momentumScore]));
  const prodRefs = new Map<string, number>();
  const deployDepth = new Map<string, number>();
  for (const p of profiles as { id: string; industryAdoption: { productionReferenceCount: number; deploymentDepthScore: number }[] }[]) {
    const refs = p.industryAdoption.reduce((s, a) => s + (a.productionReferenceCount ?? 0), 0);
    const depths = p.industryAdoption.map((a) => a.deploymentDepthScore ?? 0).filter((d) => d > 0);
    prodRefs.set(p.id, refs);
    deployDepth.set(p.id, depths.length ? depths.reduce((s, d) => s + d, 0) / depths.length : 0);
  }

  const signals = new Map<string, VendorSignal>();
  for (const v of allVendors) {
    signals.set(v.id, {
      verifiedEvidence: verifiedEvidence.get(v.id) ?? 0,
      productionReferences: prodRefs.get(v.id) ?? 0,
      deploymentDepth: deployDepth.get(v.id) ?? 0,
      momentum: momentum.get(v.id) ?? 0,
      // Curated/analyst-graded delivery reach — enriches a present vendor's estimate
      // but never floats an evidence-less one (see market-presence hasRealSignal).
      deliveryReach: deliveryReach.get(v.id)?.reachRaw ?? 0,
    });
  }

  // ── Compute real presence shares over the curated taxonomy ─────────────────
  const memberships = curatedMemberships();
  const shares = computePresenceShares(memberships, signals);

  // Coverage report: which of the 47 vendors got at least one share.
  const covered = new Set(shares.map((s) => s.vendorId));
  const uncoveredVendorIds = allVendors.map((v) => v.id).filter((id) => !covered.has(id)).sort();

  const prevShare = new Map<string, number>(
    existing.map((e) => [`${e.vendorId}__${e.categoryId}`, e.estimatedShare]),
  );
  const movers: MarketShareMovementResult["topMovers"] = [];
  let rowsUpdated = 0;

  for (const s of shares) {
    const baseline = prevShare.get(`${s.vendorId}__${s.categoryId}`);
    const prev = baseline ?? s.share;
    const changePct = marketShareChangePct(s.share, prev);
    try {
      await prisma.marketShareEstimate.upsert({
        where: { vendorId_categoryId: { vendorId: s.vendorId, categoryId: s.categoryId } },
        create: {
          vendorId: s.vendorId,
          categoryId: s.categoryId,
          estimatedShare: s.share,
          previousEstimate: prev,
          changePct,
          confidence: s.confidence,
          source: PRESENCE_SOURCE,
          sourceDate: now,
          methodology: PRESENCE_METHODOLOGY,
        },
        update: {
          estimatedShare: s.share,
          previousEstimate: prev,
          changePct,
          confidence: s.confidence,
          source: PRESENCE_SOURCE,
          sourceDate: now,
          methodology: PRESENCE_METHODOLOGY,
        },
      });
      rowsUpdated += 1;
      if (Math.abs(changePct) >= 1) movers.push({ vendorId: s.vendorId, categoryId: s.categoryId, to: s.share, changePct });
    } catch {
      // Skip a single row (e.g. missing IntelligenceVendor FK) rather than abort.
    }
  }

  // ── Drop any leftover SEED-signed rows so only real-derived rows remain ─────
  let seedRowsDeleted = 0;
  const seedKeys = existing
    .filter((e) => isSeedSignedSource(e.source))
    .map((e) => ({ vendorId: e.vendorId, categoryId: e.categoryId }));
  for (const k of seedKeys) {
    // Only delete if we did NOT just write a real row for this pair.
    if (covered.has(k.vendorId) && shares.some((s) => s.vendorId === k.vendorId && s.categoryId === k.categoryId)) continue;
    try {
      await prisma.marketShareEstimate.delete({ where: { vendorId_categoryId: { vendorId: k.vendorId, categoryId: k.categoryId } } });
      seedRowsDeleted += 1;
    } catch {
      /* row already gone / replaced */
    }
  }

  movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  return {
    skipped: false,
    rowsUpdated,
    seedRowsDeleted,
    vendorsCovered: covered.size,
    uncoveredVendorIds,
    topMovers: movers.slice(0, 15),
  };
}
