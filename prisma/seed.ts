import { EVIDENCE_MODIFIER } from "../lib/types";
import { SCORING_RULE_VERSION } from "../lib/engine";
import { getPrisma } from "../lib/prisma";
import { getIntelligenceAssessmentVendors } from "../lib/intelligence/assessment-adapter";
import {
  CAPABILITIES,
  EVIDENCE_SOURCES,
  INTELLIGENCE_VENDORS,
  MARKET_CATEGORIES,
  MARKET_SHARE_ESTIMATES,
  NEWS_ITEMS,
  VENDOR_CAPABILITIES,
  VENDOR_MOMENTUM,
  VENDOR_PILLAR_SCORES,
  WATCHLISTS,
} from "../lib/intelligence/seed";

const prisma = getPrisma();

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  const vendors = getIntelligenceAssessmentVendors();

  await prisma.$transaction(async (tx) => {
    await tx.evidenceSource.deleteMany();
    await tx.watchlist.deleteMany();
    await tx.vendorCapability.deleteMany();
    await tx.capability.deleteMany();
    await tx.intelligenceNewsItem.deleteMany();
    await tx.vendorMomentum.deleteMany();
    await tx.marketShareEstimate.deleteMany();
    await tx.marketCategory.deleteMany();
    await tx.intelligencePillarScore.deleteMany();
    await tx.intelligenceVendor.deleteMany();

    await tx.intelligenceVendor.createMany({
      data: INTELLIGENCE_VENDORS.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        slug: vendor.slug,
        category: vendor.category,
        description: vendor.description,
        headquarters: vendor.headquarters,
        ownershipType: vendor.ownershipType,
        supportedIndustries: vendor.supportedIndustries,
        supportedUseCases: vendor.supportedUseCases,
        supportedEcosystems: vendor.supportedEcosystems,
        deploymentOptions: vendor.deploymentOptions,
        autonomyLevelMax: vendor.autonomyLevelMax,
        overallScore: vendor.overallScore,
        confidenceScore: vendor.confidenceScore,
        marketPosition: vendor.marketPosition,
        strategy: vendor.strategy,
        productCapabilities: vendor.productCapabilities,
        enterpriseControls: vendor.enterpriseControls,
        agenticCapability: vendor.agenticCapability,
        industryStrength: toJson(vendor.industryStrength),
        riskProfile: vendor.riskProfile,
        analystInterpretation: vendor.analystInterpretation,
        lastUpdated: new Date(vendor.lastUpdated),
      })),
    });

    await tx.intelligencePillarScore.createMany({ data: VENDOR_PILLAR_SCORES });
    await tx.marketCategory.createMany({ data: MARKET_CATEGORIES });
    await tx.marketShareEstimate.createMany({
      data: MARKET_SHARE_ESTIMATES.map((estimate) => ({
        ...estimate,
        sourceDate: new Date(estimate.sourceDate),
      })),
    });
    await tx.vendorMomentum.createMany({ data: VENDOR_MOMENTUM });
    await tx.intelligenceNewsItem.createMany({
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
    });
    await tx.capability.createMany({ data: CAPABILITIES });
    await tx.vendorCapability.createMany({
      data: VENDOR_CAPABILITIES.map((capability) => ({
        ...capability,
        lastVerified: new Date(capability.lastVerified),
      })),
    });
    await tx.watchlist.createMany({
      data: WATCHLISTS.map((watchlist) => ({
        ...watchlist,
        alertRules: toJson(watchlist.alertRules),
        createdAt: new Date(watchlist.createdAt),
      })),
    });
    await tx.evidenceSource.createMany({
      data: EVIDENCE_SOURCES.map((source) => ({
        ...source,
        capturedAt: new Date(source.capturedAt),
      })),
    });

    await tx.scoringRule.upsert({
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

    for (const vendor of vendors) {
      await tx.vendorProfile.upsert({
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

      await tx.evidenceRecord.deleteMany({ where: { vendorId: vendor.id } });
      await tx.riskFlagRecord.deleteMany({ where: { vendorId: vendor.id } });
      await tx.vendorIndustryAdoption.deleteMany({ where: { vendorId: vendor.id } });

      await tx.evidenceRecord.createMany({
        data: vendor.evidence.map((evidence) => ({
          id: evidence.id,
          vendorId: vendor.id,
          sourceUrl: evidence.sourceUrl,
          capturedAt: new Date(evidence.capturedAt),
          excerpt: evidence.excerpt,
          domain: evidence.domain,
          subfactor: evidence.subfactor,
          evidenceGrade: evidence.grade,
          rawScore: evidence.rawScore,
          confidence: EVIDENCE_MODIFIER[evidence.grade] * 100,
          freshnessDays: evidence.freshnessDays,
          reviewStatus: "curated",
        })),
      });

      await tx.riskFlagRecord.createMany({
        data: vendor.risks.map((risk) => ({
          id: risk.id,
          vendorId: vendor.id,
          severity: risk.severity,
          description: risk.description,
          domain: risk.domain,
          isFatalIfTriggered: risk.isFatalIfTriggered ?? false,
          fatalInIndustries: risk.fatalInIndustries ?? [],
        })),
      });

      await tx.vendorIndustryAdoption.createMany({
        data: vendor.industryAdoption.map((adoption) => ({
          vendorId: vendor.id,
          industry: adoption.industry,
          productionReferenceCount: adoption.productionReferenceCount,
          deploymentDepthScore: adoption.deploymentDepthScore,
          confidence: adoption.confidence,
        })),
      });
    }
  });

  console.log(`Seeded ${INTELLIGENCE_VENDORS.length} AI Enterpise intelligence vendors and ${vendors.length} assessment profiles.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
