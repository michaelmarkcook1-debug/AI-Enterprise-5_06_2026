// Live entity adapter — single source of truth for the Query-v2 view.
// ───────────────────────────────────────────────────────────────────
// Builds the `Entity[]` the Query-v2 page consumes from the DATABASE spine
// instead of the static `entities.ts` roster. Structural facts (roles, infra
// band, models owned, relationships, interpretation) come straight from the
// intelligence_vendors columns; measured numbers (leadership, momentum, reach,
// innovation, readiness, usage share, deltas, movement) are DERIVED at read-time
// from live primitives — overall/confidence scores, vendor momentum, pillar
// scores, market-share estimates, and ranking-snapshot diffs — so the surface is
// dynamic on live ingestion.
//
// Falls back to the static ENTITIES roster when the database isn't configured,
// mirroring the repository's seed-fallback pattern.

import { getPrisma, hasDatabase } from "../prisma";
import {
  type Entity,
  type Role,
  type Ownership,
  type InfraBand,
  ENTITIES,
  rolesFor,
  roleLeadership,
} from "./entities";

const KNOWN_ROLES: Role[] = [
  "Platform Vendor", "Model Provider", "Application Vendor", "Infrastructure Player",
  "Investor", "Hardware Provider", "Data & Services Provider", "Cloud / Hosting Provider",
  "Sovereign / Regional AI", "Regulator / Policy Actor", "Open-Source Ecosystem", "Vertical Specialist",
];
const KNOWN_BANDS: InfraBand[] = ["silicon", "cloud_compute", "neocloud", "inference", "data_platform"];

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const asRole = (s: string): Role | null => (KNOWN_ROLES.includes(s as Role) ? (s as Role) : null);
const asBand = (s: string | null): InfraBand | undefined =>
  s && KNOWN_BANDS.includes(s as InfraBand) ? (s as InfraBand) : undefined;
const asOwnership = (s: string): Ownership =>
  s === "public" || s === "private" || s === "subsidiary" ? s : "private";

function riskBucket(confidence: number, riskCount: number): Entity["risk"] {
  if (confidence < 55 || riskCount >= 3) return "high";
  if (confidence >= 78 && riskCount <= 1) return "low";
  return "medium";
}

function evidenceFromConfidence(confidence: number): Entity["evidenceGrade"] {
  if (confidence >= 88) return "E4";
  if (confidence >= 75) return "E3";
  if (confidence >= 60) return "E2";
  return "E1";
}

/**
 * Returns the live entity roster derived from the database, or the static
 * ENTITIES fallback when no database is configured.
 */
export async function getEntities(): Promise<Entity[]> {
  if (!hasDatabase()) return ENTITIES;

  try {
    return await getEntitiesFromDB();
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(`[entities-adapter] FALLBACK name=${e.name} message=${e.message}`);
    if ("code" in e) console.error(`[entities-adapter] code=${(e as any).code}`);
    return ENTITIES;
  }
}

async function getEntitiesFromDB(): Promise<Entity[]> {
  const prisma = getPrisma();
  const [rows, momentum, pillars, shares, snapshots] = await Promise.all([
    prisma.intelligenceVendor.findMany(),
    prisma.vendorMomentum.findMany(),
    prisma.intelligencePillarScore.findMany({ where: { pillar: "enterprise_control" } }),
    prisma.marketShareEstimate.findMany({ select: { vendorId: true, estimatedShare: true } }),
    prisma.vendorRankingSnapshot.findMany({ orderBy: { snapshotDate: "desc" }, select: { vendorId: true, overallScore: true, momentumScore: true, rank: true } }),
  ]);

  // Latest momentum row per vendor (period sorts lexically; W-weeks are safe).
  const momentumByVendor = new Map<string, (typeof momentum)[number]>();
  for (const m of momentum) {
    const cur = momentumByVendor.get(m.vendorId);
    if (!cur || m.period > cur.period) momentumByVendor.set(m.vendorId, m);
  }
  const controlPillarByVendor = new Map(pillars.map((p) => [p.vendorId, p.capabilityScore]));

  // Raw market-share sum per vendor → normalised to a global usage share.
  const rawShareByVendor = new Map<string, number>();
  for (const s of shares) rawShareByVendor.set(s.vendorId, (rawShareByVendor.get(s.vendorId) ?? 0) + s.estimatedShare);
  const totalRawShare = [...rawShareByVendor.values()].reduce((a, b) => a + b, 0) || 1;

  // Two most-recent snapshots per vendor (already sorted desc) for deltas.
  const snapsByVendor = new Map<string, Array<(typeof snapshots)[number]>>();
  for (const s of snapshots) {
    const arr = snapsByVendor.get(s.vendorId) ?? [];
    if (arr.length < 2) { arr.push(s); snapsByVendor.set(s.vendorId, arr); }
  }

  const entities: Entity[] = rows.map((v) => {
    const roleTags = (v.roleTags ?? []).map(asRole).filter((r): r is Role => r !== null);
    const primaryRole: Role = roleTags[0] ?? "Application Vendor";
    const secondaryRoles = roleTags.slice(1);

    const mom = momentumByVendor.get(v.id);
    const momentumScore = mom?.momentumScore ?? 50;
    const newsVelocity = mom?.newsVelocity ?? momentumScore;

    const leadershipScore = clamp(v.overallScore);
    const confidence = clamp(v.confidenceScore);
    const innovation = clamp(0.5 * momentumScore + 0.5 * newsVelocity);
    const controlPillar = controlPillarByVendor.get(v.id) ?? confidence;
    const readiness = clamp(0.6 * controlPillar + 0.4 * confidence);

    const usageShare = Math.round(((rawShareByVendor.get(v.id) ?? 0) / totalRawShare) * 1000) / 10;

    // Ecosystem reach: structural richness + breadth, scaled.
    const reachRaw = 40
      + (v.hostedThirdParty?.length ?? 0) * 4
      + (v.infrastructureExposure?.length ?? 0) * 3
      + (v.modelsOwned?.length ?? 0) * 3
      + (v.investorRelationships?.length ?? 0) * 3
      + (v.hardwareDependencies?.length ?? 0) * 2
      + (v.supportedEcosystems?.length ?? 0) * 2;
    const ecosystemReach = clamp(reachRaw);

    // Deltas from the two most-recent ranking snapshots (0 when no history).
    const [latest, prev] = snapsByVendor.get(v.id) ?? [];
    const dLeadership = latest && prev ? Math.round(latest.overallScore - prev.overallScore) : 0;
    const dAdoption = latest && prev ? Math.round(latest.momentumScore - prev.momentumScore) : 0;
    const dRank = latest && prev ? prev.rank - latest.rank : 0; // rank up (smaller) = positive

    return {
      id: v.id,
      name: v.name,
      slug: v.slug,
      ownership: asOwnership(v.ownershipType),
      primaryRole,
      secondaryRoles,
      leadershipScore,
      momentum: clamp(momentumScore),
      ecosystemReach,
      risk: riskBucket(confidence, v.riskProfile?.length ?? 0),
      confidence,
      usageShare,
      innovation,
      readiness,
      movement: { dx: dLeadership, dy: dAdoption },
      deltas: {
        leadership: dLeadership,
        reach: Math.max(0, dRank),
        adoption: dAdoption,
        infrastructure: dRank,
        risk: 0,
      },
      modelsOwned: v.modelsOwned ?? [],
      hostedThirdParty: v.hostedThirdParty ?? [],
      infrastructureExposure: v.infrastructureExposure ?? [],
      investorRelationships: v.investorRelationships ?? [],
      hardwareDependencies: v.hardwareDependencies ?? [],
      cioInterpretation: v.cioInterpretation ?? v.analystInterpretation ?? "",
      evidenceGrade: (v.evidenceGrade as Entity["evidenceGrade"]) ?? evidenceFromConfidence(confidence),
      dataCaveats: v.dataCaveats ?? "Directional, evidence-labelled estimate derived from live signals.",
      infraBand: asBand(v.infraBand),
      infraBandSecondary: asBand(v.infraBandSecondary),
    };
  });

  // Sort by leadership so the default selection mirrors the old roster.
  return entities.sort((a, b) => b.leadershipScore - a.leadershipScore);
}

// ── Derived layer-winners (same logic as entities.ts WINNING_BY_LAYER, but
//    computed over the live roster passed in). ──────────────────────────────
const LAYER_DEFS: Array<{ title: string; role: Role; note: string; max: number }> = [
  { title: "Platform Vendors", role: "Platform Vendor", note: "Distribution, cloud control and enterprise-governance depth.", max: 5 },
  { title: "Model Providers", role: "Model Provider", note: "Quality, cadence, deployment paths and model economics.", max: 8 },
  { title: "Application Vendors", role: "Application Vendor", note: "Workflow conversion, domain fit and business-user adoption.", max: 6 },
  { title: "Infrastructure Players", role: "Infrastructure Player", note: "Hosting, scale, deployment and compute access.", max: 6 },
  { title: "Hardware", role: "Hardware Provider", note: "Accelerators, networking, custom silicon and fabrication.", max: 5 },
  { title: "Investors", role: "Investor", note: "Strategic capital, distribution rights and ecosystem influence.", max: 6 },
  { title: "Sovereign / Regional AI", role: "Sovereign / Regional AI", note: "Jurisdiction, data residency and industrial-policy alternatives.", max: 6 },
];

export function computeWinningByLayer(entities: Entity[]): Array<{ title: string; names: string[]; note: string }> {
  return LAYER_DEFS.map((def) => ({
    title: def.title,
    note: def.note,
    names: entities
      .filter((e) => rolesFor(e).includes(def.role))
      // Rank by the role-specific leadership score (falls back to the entity
      // score when no role profile exists) so a multi-role giant only "wins"
      // a layer where it is genuinely strong — same rule as entities.ts.
      .sort((a, b) => roleLeadership(b, def.role) - roleLeadership(a, def.role))
      .slice(0, def.max)
      .map((e) => e.name),
  }));
}
