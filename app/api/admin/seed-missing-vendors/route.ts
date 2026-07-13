import { NextResponse } from "next/server";
import { getPrisma, hasDatabase } from "../../../../lib/prisma";
import { ENTITIES } from "../../../../lib/intelligence/entities";
import { ADMIN_OPEN } from "../../../../lib/availability";

export const dynamic = "force-dynamic";

function marketPositionFromScore(score: number): string {
  if (score >= 85) return "leader";
  if (score >= 75) return "contender";
  if (score >= 65) return "participant";
  return "emerging";
}

function categoryFromRole(role: string): string {
  const map: Record<string, string> = {
    "Platform Vendor": "Enterprise AI platform",
    "Model Provider": "Frontier model API",
    "Application Vendor": "Enterprise AI application",
    "Infrastructure Player": "AI infrastructure",
    "Investor": "Strategic AI investor",
    "Hardware Provider": "AI hardware",
    "Data & Services Provider": "Data & AI services",
    "Cloud / Hosting Provider": "Cloud AI hosting",
    "Sovereign / Regional AI": "Sovereign AI provider",
    "Regulator / Policy Actor": "Policy actor",
    "Open-Source Ecosystem": "Open-source AI",
    "Vertical Specialist": "Vertical AI specialist",
  };
  return map[role] ?? "Enterprise AI";
}

function riskCountFromLevel(risk: string): string[] {
  if (risk === "high") return ["Elevated risk profile", "Limited enterprise evidence", "Concentration risk"];
  if (risk === "medium") return ["Standard risk considerations"];
  return [];
}

export async function POST(request: Request) {
  const isOpen = ADMIN_OPEN || process.env.ADMIN_API_OPEN === "1";
  if (!isOpen) {
    const authHeader = request.headers.get("authorization");
    const expected = process.env.CRON_SECRET ?? process.env.ADMIN_API_TOKEN;
    if (!expected || authHeader !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!hasDatabase()) {
    return NextResponse.json({ error: "No DATABASE_URL" }, { status: 500 });
  }

  const prisma = getPrisma();

  const existingVendors = await prisma.intelligenceVendor.findMany({ select: { id: true } });
  const existingIds = new Set(existingVendors.map((v) => v.id));

  const toDbId = (id: string) => id.startsWith("vendor_") ? id : `vendor_${id}`;

  const missing = ENTITIES.filter((e) => !existingIds.has(toDbId(e.id)));
  const existing = ENTITIES.filter((e) => existingIds.has(toDbId(e.id)));

  const results: string[] = [];
  const updated: string[] = [];
  const errors: string[] = [];

  for (const e of existing) {
    const dbId = toDbId(e.id);
    const allRoles = [e.primaryRole, ...e.secondaryRoles];
    try {
      await prisma.intelligenceVendor.update({
        where: { id: dbId },
        data: {
          roleTags: allRoles,
          infraBand: e.infraBand ?? null,
          infraBandSecondary: e.infraBandSecondary ?? null,
          modelsOwned: e.modelsOwned,
          hostedThirdParty: e.hostedThirdParty,
          infrastructureExposure: e.infrastructureExposure,
          investorRelationships: e.investorRelationships,
          hardwareDependencies: e.hardwareDependencies,
          cioInterpretation: e.cioInterpretation,
          dataCaveats: e.dataCaveats,
          evidenceGrade: e.evidenceGrade ?? null,
        },
      });
      updated.push(dbId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`update ${dbId}: ${msg}`);
    }
  }

  if (missing.length === 0) {
    return NextResponse.json({ status: "ok", message: "All vendors already in DB", updated: updated.length, totalInDb: existingIds.size });
  }
  const today = new Date();

  for (const e of missing) {
    const dbId = e.id.startsWith("vendor_") ? e.id : `vendor_${e.id}`;
    const allRoles = [e.primaryRole, ...e.secondaryRoles];

    try {
      await prisma.intelligenceVendor.create({
        data: {
          id: dbId,
          name: e.name,
          slug: e.slug,
          category: categoryFromRole(e.primaryRole),
          description: e.cioInterpretation || `${e.name} — ${e.primaryRole}`,
          headquarters: null,
          ownershipType: e.ownership,
          supportedIndustries: [],
          supportedUseCases: [],
          supportedEcosystems: e.infrastructureExposure,
          deploymentOptions: [],
          autonomyLevelMax: "supervised_agent",
          // overallScore is the RAW market primitive (the read path blends it via
          // rankingLeadership). Persist marketLeadership, NOT the already-blended
          // leadershipScore, or the adapter blends it a second time.
          overallScore: e.marketLeadership,
          confidenceScore: e.confidence,
          marketPosition: marketPositionFromScore(e.marketLeadership),
          strategy: e.cioInterpretation || `${e.name} operates as a ${e.primaryRole.toLowerCase()}.`,
          productCapabilities: [...e.modelsOwned, ...e.infrastructureExposure].filter(Boolean),
          enterpriseControls: [],
          agenticCapability: "See analyst interpretation for capability context.",
          industryStrength: [],
          analystInterpretation: e.cioInterpretation || "",
          riskProfile: riskCountFromLevel(e.risk),
          lastUpdated: today,
          roleTags: allRoles,
          infraBand: e.infraBand ?? null,
          infraBandSecondary: e.infraBandSecondary ?? null,
          modelsOwned: e.modelsOwned,
          hostedThirdParty: e.hostedThirdParty,
          infrastructureExposure: e.infrastructureExposure,
          investorRelationships: e.investorRelationships,
          hardwareDependencies: e.hardwareDependencies,
          cioInterpretation: e.cioInterpretation,
          dataCaveats: e.dataCaveats,
          evidenceGrade: e.evidenceGrade ?? null,
        },
      });

      await prisma.vendorMomentum.create({
        data: {
          vendorId: dbId,
          period: "2026-W23",
          momentumScore: e.momentum,
          newsVelocity: e.innovation,
          productVelocity: e.momentum * 0.8,
          adoptionSignal: e.usageShare * 3,
          hiringSignal: 50,
          customerSignal: e.confidence * 0.7,
          partnerSignal: Math.min(100, 50 + e.investorRelationships.length * 10),
          marketShareMovement: e.deltas.adoption,
          riskSignal: e.risk === "high" ? 70 : e.risk === "medium" ? 45 : 25,
          confidence: e.confidence,
        },
      });

      const grade = (e.evidenceGrade ?? "E2") as "E0" | "E1" | "E2" | "E3" | "E4" | "E5";
      await prisma.intelligencePillarScore.create({
        data: {
          vendorId: dbId,
          pillar: "enterprise_control",
          capabilityScore: e.readiness,
          evidenceGrade: grade,
          confidence: e.confidence,
          strengths: [],
          risks: [],
          missingEvidence: [],
        },
      });

      await prisma.marketShareEstimate.create({
        data: {
          vendorId: dbId,
          categoryId: "cloud_ai_platform",
          estimatedShare: e.usageShare,
          confidence: e.confidence,
          source: "static_seed",
          sourceDate: today,
          methodology: "Directional estimate from static seed data",
          changePct: 0,
        },
      });

      await prisma.vendorRankingSnapshot.create({
        data: {
          vendorId: dbId,
          snapshotDate: today,
          overallScore: e.marketLeadership,
          momentumScore: e.momentum,
          confidenceScore: e.confidence,
          rank: 0,
          trackedVendors: ENTITIES.length,
          source: "seed",
        },
      });

      results.push(dbId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${dbId}: ${msg}`);
    }
  }

  return NextResponse.json({
    status: errors.length === 0 ? "ok" : "partial",
    inserted: results.length,
    updated: updated.length,
    failed: errors.length,
    insertedIds: results,
    errors: errors.length > 0 ? errors : undefined,
    totalInDb: existingIds.size + results.length,
  });
}
