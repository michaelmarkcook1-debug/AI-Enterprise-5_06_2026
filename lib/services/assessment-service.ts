import { hashContext, runAssessment } from "../engine";
import { getPrisma, hasDatabase } from "../prisma";
import { listVendorProfiles } from "../repositories/vendor-profiles";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import type { AssessmentInput, AssessmentResult, VendorResult } from "../types";

type AssessmentWriteClient = Pick<PrismaClient, "assessmentRun">;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toScoringResultCreate(
  result: VendorResult,
  contextHash: string,
  generatedAt: string,
): Prisma.ScoringResultCreateWithoutAssessmentRunInput {
  return {
    vendor: { connect: { id: result.vendorId } },
    contextHash,
    rank: result.rank,
    pillarScoresJson: toJson(result.pillarScores),
    pillarBreakdownJson: toJson(result.pillarBreakdown),
    finalScore: result.finalScore,
    confidenceScore: result.confidenceScore,
    recommendationBand: result.recommendationBand,
    topStrengths: result.topStrengths,
    topRisks: result.topRisks,
    missingEvidence: result.missingEvidence,
    validationSteps: result.validationSteps,
    industryRationale: result.industryRationale,
    evidenceIds: result.evidenceIds,
    riskFlagsTriggeredJson: toJson(result.riskFlagsTriggered),
    excluded: result.excluded,
    excludedReason: result.excludedReason,
    bonusesJson: toJson(result.bonuses),
    penaltiesJson: toJson(result.penalties),
    generatedAt: new Date(generatedAt),
  };
}

export async function persistAssessmentResult(
  input: AssessmentInput,
  result: AssessmentResult,
  vendorSet: string[],
  client: AssessmentWriteClient = getPrisma(),
): Promise<string> {
  const contextHash = hashContext(input);
  const run = await client.assessmentRun.create({
    data: {
      engineRunId: result.runId,
      contextHash,
      scoringRuleVersion: result.scoringRuleVersion,
      inputsJson: toJson(input),
      vendorSet,
      outputJson: toJson(result),
      status: "completed",
      completedAt: new Date(result.generatedAt),
      scoringResults: {
        create: result.ranking.map((vendorResult) =>
          toScoringResultCreate(vendorResult, contextHash, result.generatedAt),
        ),
      },
    },
  });

  return run.id;
}

export async function scoreAndPersistAssessment(input: AssessmentInput): Promise<AssessmentResult> {
  if (!hasDatabase()) {
    const vendors = await listVendorProfiles();
    return runAssessment(input, vendors);
  }
  const client = getPrisma();
  const vendors = await listVendorProfiles(client);
  const result = runAssessment(input, vendors);
  const vendorSet = result.ranking.map((vendorResult) => vendorResult.vendorId);
  try {
    await persistAssessmentResult(input, result, vendorSet, client);
  } catch (err) {
    console.error("[assessment-service] persistence failed; returning result anyway", err);
  }
  return result;
}

export async function getPersistedAssessmentResult(
  id: string,
  client?: Pick<PrismaClient, "assessmentRun">,
): Promise<Prisma.JsonValue | null> {
  if (!client && !hasDatabase()) return null;
  const c = client ?? getPrisma();
  const run = await c.assessmentRun.findFirst({
    where: {
      OR: [{ id }, { engineRunId: id }],
    },
    orderBy: { createdAt: "desc" },
    select: { outputJson: true },
  });

  return run?.outputJson ?? null;
}

/**
 * v1.3 — the most recent completed assessment run, typed as an AssessmentResult.
 * Lets Monitor and Demonstrate surface the latest assessment's outputs
 * (opportunity value, EU AI Act risk class, concentration, scoring rationale)
 * without the lossy vendor-id-only shortlist hand-off. Returns null when there
 * is no database or no completed run yet.
 */
export async function getLatestAssessmentResult(
  client?: Pick<PrismaClient, "assessmentRun">,
): Promise<AssessmentResult | null> {
  if (!client && !hasDatabase()) return null;
  try {
    const c = client ?? getPrisma();
    const run = await c.assessmentRun.findFirst({
      where: { status: "completed" },
      orderBy: { createdAt: "desc" },
      select: { outputJson: true },
    });
    return (run?.outputJson as unknown as AssessmentResult) ?? null;
  } catch {
    return null;
  }
}
