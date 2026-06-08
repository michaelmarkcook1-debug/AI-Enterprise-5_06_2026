// Idempotent vendor-universe loader.
// ───────────────────────────────────
// Upserts the full vendor universe (INTELLIGENCE_VENDORS) + role/infra metadata
// + the structural facts folded in from entities.ts (modelsOwned, hosted, infra
// exposure, investor/hardware relationships, CIO interpretation, data caveats)
// into the intelligence spine. Also upserts pillar scores, market categories,
// market-share estimates, the capability catalog, and creates momentum +
// vendor-capability rows for vendors that don't have them yet.
//
// NON-DESTRUCTIVE: no deleteMany. By default it PRESERVES cron-derived scalars
// (overallScore, confidenceScore on existing rows, and any existing momentum /
// vendor-capability rows the daily pipeline owns). Pass { updateScores: true }
// to also overwrite overallScore/confidenceScore from the seed (e.g. a first
// load or a deliberate reset).
//
// Safe to run against production repeatedly.

import type { PrismaClient } from "../../generated/prisma/client";
import {
  INTELLIGENCE_VENDORS,
  VENDOR_PILLAR_SCORES,
  VENDOR_MOMENTUM,
  MARKET_CATEGORIES,
  MARKET_SHARE_ESTIMATES,
  CAPABILITIES,
  VENDOR_CAPABILITIES,
} from "./seed";
import { ENTITIES } from "./entities";

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function entityFor(id: string) {
  return ENTITIES.find((e) => e.id === id || e.slug === id);
}

export interface LoadResult {
  vendorsUpserted: number;
  pillarsUpserted: number;
  momentumCreated: number;
  marketCategoriesUpserted: number;
  marketSharesUpserted: number;
  capabilitiesCreated: number;
}

type Db = Pick<
  PrismaClient,
  | "capability"
  | "marketCategory"
  | "intelligenceVendor"
  | "intelligencePillarScore"
  | "vendorMomentum"
  | "marketShareEstimate"
  | "vendorCapability"
>;

export async function loadVendorUniverse(
  prisma: Db,
  { updateScores = false }: { updateScores?: boolean } = {},
): Promise<LoadResult> {
  // 1. Capability catalog (static reference data).
  for (const cap of CAPABILITIES) {
    await prisma.capability.upsert({
      where: { id: cap.id },
      update: { name: cap.name, category: cap.category, description: cap.description },
      create: cap,
    });
  }

  // 2. Market categories (FK target for market-share rows).
  let marketCategoriesUpserted = 0;
  for (const cat of MARKET_CATEGORIES) {
    await prisma.marketCategory.upsert({
      where: { id: cat.id },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
    marketCategoriesUpserted++;
  }

  // 3. Vendors — editorial + role/infra + structural folded from entities.ts.
  let vendorsUpserted = 0;
  for (const v of INTELLIGENCE_VENDORS) {
    const e = entityFor(v.id);
    const editorial = {
      name: v.name,
      slug: v.slug,
      category: v.category,
      description: v.description,
      headquarters: v.headquarters,
      ownershipType: v.ownershipType,
      supportedIndustries: v.supportedIndustries,
      supportedUseCases: v.supportedUseCases,
      supportedEcosystems: v.supportedEcosystems,
      deploymentOptions: v.deploymentOptions,
      autonomyLevelMax: v.autonomyLevelMax,
      marketPosition: v.marketPosition,
      strategy: v.strategy,
      productCapabilities: v.productCapabilities,
      enterpriseControls: v.enterpriseControls,
      agenticCapability: v.agenticCapability,
      industryStrength: toJson(v.industryStrength),
      riskProfile: v.riskProfile,
      analystInterpretation: v.analystInterpretation,
      lastUpdated: new Date(v.lastUpdated),
      // role + infra metadata (from seed) ───────────────────
      roleTags: v.roleTags ?? [],
      infraBand: v.infraBand ?? null,
      infraBandSecondary: v.infraBandSecondary ?? null,
      // structural facts folded from the entity model ───────
      modelsOwned: e?.modelsOwned ?? [],
      hostedThirdParty: e?.hostedThirdParty ?? [],
      infrastructureExposure: e?.infrastructureExposure ?? [],
      investorRelationships: e?.investorRelationships ?? [],
      hardwareDependencies: e?.hardwareDependencies ?? [],
      cioInterpretation: e?.cioInterpretation ?? null,
      dataCaveats: e?.dataCaveats ?? null,
      evidenceGrade: e?.evidenceGrade ?? null,
    };
    const scores = { overallScore: v.overallScore, confidenceScore: v.confidenceScore };

    await prisma.intelligenceVendor.upsert({
      where: { id: v.id },
      // Preserve live-derived scores on existing rows unless updateScores.
      update: updateScores ? { ...editorial, ...scores } : editorial,
      create: { id: v.id, ...editorial, ...scores },
    });
    vendorsUpserted++;
  }

  // 4. Pillar scores — deterministic seed values; safe to upsert.
  let pillarsUpserted = 0;
  for (const p of VENDOR_PILLAR_SCORES) {
    await prisma.intelligencePillarScore.upsert({
      where: { vendorId_pillar: { vendorId: p.vendorId, pillar: p.pillar } },
      update: {
        capabilityScore: p.capabilityScore,
        evidenceGrade: p.evidenceGrade,
        confidence: p.confidence,
        strengths: p.strengths,
        risks: p.risks,
        missingEvidence: p.missingEvidence,
      },
      create: p,
    });
    pillarsUpserted++;
  }

  // 5. Momentum — create only when missing (the daily pipeline owns updates).
  let momentumCreated = 0;
  for (const m of VENDOR_MOMENTUM) {
    const existing = await prisma.vendorMomentum.findUnique({
      where: { vendorId_period: { vendorId: m.vendorId, period: m.period } },
    });
    if (!existing) {
      await prisma.vendorMomentum.create({ data: m });
      momentumCreated++;
    }
  }

  // 6. Market-share estimates — deterministic seed values; safe to upsert.
  let marketSharesUpserted = 0;
  for (const s of MARKET_SHARE_ESTIMATES) {
    await prisma.marketShareEstimate.upsert({
      where: { vendorId_categoryId: { vendorId: s.vendorId, categoryId: s.categoryId } },
      update: {
        estimatedShare: s.estimatedShare,
        previousEstimate: s.previousEstimate,
        changePct: s.changePct,
        confidence: s.confidence,
        source: s.source,
        sourceDate: new Date(s.sourceDate),
        methodology: s.methodology,
      },
      create: { ...s, sourceDate: new Date(s.sourceDate) },
    });
    marketSharesUpserted++;
  }

  // 7. Vendor capabilities — create missing only (the projector owns existing).
  const capRows = VENDOR_CAPABILITIES.map((c) => ({ ...c, lastVerified: new Date(c.lastVerified) }));
  const capResult = await prisma.vendorCapability.createMany({ data: capRows, skipDuplicates: true });

  return {
    vendorsUpserted,
    pillarsUpserted,
    momentumCreated,
    marketCategoriesUpserted,
    marketSharesUpserted,
    capabilitiesCreated: capResult.count,
  };
}
