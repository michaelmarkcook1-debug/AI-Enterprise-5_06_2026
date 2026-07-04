// Database seed — NON-DESTRUCTIVE.
// ────────────────────────────────
// Historically this script `deleteMany()`'d ten tables and recreated them.
// Four of those tables (intelligence_vendors, vendor_momentum,
// vendor_capabilities, intelligence_news_items) are written by the daily cron
// pipeline, so the wipe destroyed accumulated evidence/news/derived scores.
//
// It now upserts the vendor universe via the shared idempotent loader and adds
// everything else additively (createMany skipDuplicates / guarded inserts). It
// never deletes. Safe to run repeatedly against production.

import { EVIDENCE_MODIFIER, type DomainId } from "../lib/types";
import { SCORING_RULE_VERSION } from "../lib/engine";
import { getPrisma } from "../lib/prisma";
import { getIntelligenceAssessmentVendors } from "../lib/intelligence/assessment-adapter";
import { loadVendorUniverse } from "../lib/intelligence/load-universe";
import {
  EVIDENCE_SOURCES,
  NEWS_ITEMS,
  WATCHLISTS,
} from "../lib/intelligence/seed";

const prisma = getPrisma();

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  const vendors = getIntelligenceAssessmentVendors();

  // 1. Intelligence spine — idempotent, non-destructive upsert of the full
  //    vendor universe + role/infra metadata + pillar/market/momentum/capability
  //    rows. updateScores:true because the seed establishes the baseline.
  const loadResult = await loadVendorUniverse(prisma, { updateScores: true });

  // 2. News / watchlists / evidence sources — additive only (skip existing).
  await prisma.intelligenceNewsItem.createMany({
    data: NEWS_ITEMS.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      publishedAt: new Date(item.publishedAt),
      vendors: item.vendors,
      categories: item.categories,
      impactScore: item.impactScore,
      confidenceScore: item.confidenceScore,
      affectedPillars: item.affectedPillars,
      whyItMatters: item.whyItMatters,
      suggestedScoreImpact: toJson(item.suggestedScoreImpact),
      relatedVendors: item.relatedVendors,
      sentiment: item.sentiment,
    })),
    skipDuplicates: true,
  });

  await prisma.watchlist.createMany({
    data: WATCHLISTS.map((watchlist) => ({
      ...watchlist,
      alertRules: toJson(watchlist.alertRules),
      createdAt: new Date(watchlist.createdAt),
    })),
    skipDuplicates: true,
  });

  await prisma.evidenceSource.createMany({
    data: EVIDENCE_SOURCES.map((source) => ({
      ...source,
      capturedAt: new Date(source.capturedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.scoringRule.upsert({
    where: { version: SCORING_RULE_VERSION },
    update: { active: true },
    create: {
      version: SCORING_RULE_VERSION,
      active: true,
      triggerCondition: { scope: "global" },
      weightChanges: { source: "code:lib/engine.ts" },
      penalties: { source: "code:lib/engine.ts" },
      blockers: { source: "code:lib/industries.ts" },
    },
  });

  // 3. Assessment-vendor source — vendorProfile upsert + additive evidence/risk/
  //    adoption (no deletes, so any approved/curated rows survive a reseed).
  for (const vendor of vendors) {
    await prisma.vendorProfile.upsert({
      where: { id: vendor.id },
      update: {
        name: vendor.name,
        category: vendor.category,
        website: vendor.website,
        hq: vendor.hq,
        ownership: vendor.ownership,
        summary: vendor.summary,
        supportedDeployments: vendor.supportedDeployments,
        ecosystemFit: vendor.ecosystemFit,
        useCaseFit: vendor.useCaseFit,
        active: true,
      },
      create: {
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        website: vendor.website,
        hq: vendor.hq,
        ownership: vendor.ownership,
        summary: vendor.summary,
        supportedDeployments: vendor.supportedDeployments,
        ecosystemFit: vendor.ecosystemFit,
        useCaseFit: vendor.useCaseFit,
        active: true,
      },
    });

    await prisma.evidenceRecord.createMany({
      data: vendor.evidence.map((evidence) => ({
        id: evidence.id,
        vendorId: vendor.id,
        sourceUrl: evidence.sourceUrl,
        capturedAt: new Date(evidence.capturedAt),
        excerpt: evidence.excerpt,
        // model_quality AND dev_sentiment are synthesized (read-time) category-
        // scoped domains, never stored EvidenceRecords — neither is in the Prisma
        // DomainId enum, and the seed/adapter never emits them. Narrow the TS
        // union to the persisted set.
        domain: evidence.domain as Exclude<DomainId, "model_quality" | "dev_sentiment">,
        subfactor: evidence.subfactor,
        evidenceGrade: evidence.grade,
        rawScore: evidence.rawScore,
        confidence: EVIDENCE_MODIFIER[evidence.grade] * 100,
        freshnessDays: evidence.freshnessDays,
        reviewStatus: "curated",
      })),
      skipDuplicates: true,
    });

    await prisma.riskFlagRecord.createMany({
      data: vendor.risks.map((risk) => ({
        id: risk.id,
        vendorId: vendor.id,
        severity: risk.severity,
        description: risk.description,
        domain: risk.domain as Exclude<DomainId, "model_quality" | "dev_sentiment">,
        isFatalIfTriggered: risk.isFatalIfTriggered ?? false,
        fatalInIndustries: risk.fatalInIndustries ?? [],
      })),
      skipDuplicates: true,
    });

    // vendor_industry_adoption has no stable unique key → guard on count so a
    // reseed doesn't duplicate rows but also never deletes existing ones.
    const adoptionCount = await prisma.vendorIndustryAdoption.count({ where: { vendorId: vendor.id } });
    if (adoptionCount === 0) {
      await prisma.vendorIndustryAdoption.createMany({
        data: vendor.industryAdoption.map((adoption) => ({
          vendorId: vendor.id,
          industry: adoption.industry,
          productionReferenceCount: adoption.productionReferenceCount,
          deploymentDepthScore: adoption.deploymentDepthScore,
          confidence: adoption.confidence,
        })),
      });
    }
  }

  console.log(
    `Seeded intelligence spine (${loadResult.vendorsUpserted} vendors, ${loadResult.pillarsUpserted} pillar rows, ` +
    `${loadResult.momentumCreated} new momentum rows, ${loadResult.capabilitiesCreated} new capability rows) ` +
    `and ${vendors.length} assessment profiles — non-destructive.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
