import { describe, expect, it, vi } from "vitest";
import { runAssessment } from "../engine";
import { getSeedVendors } from "../seed-vendors";
import type { AssessmentInput } from "../types";
import { persistAssessmentResult } from "./assessment-service";

interface PersistedScorePayload {
  rank: number;
  finalScore: number;
  confidenceScore: number;
  recommendationBand: string;
  evidenceIds: string[];
  vendor: { connect: { id: string } };
}

interface AssessmentCreatePayload {
  engineRunId: string;
  scoringRuleVersion: string;
  vendorSet: string[];
  scoringResults: { create: PersistedScorePayload[] };
  outputJson: unknown;
}

const baseInput: AssessmentInput = {
  industry: "commercial_enterprise",
  orgSize: "enterprise",
  aiMaturity: "piloting",
  primaryObjectives: ["productivity"],
  useCases: ["knowledge_assistant"],
  dataSensitivity: 3,
  riskTolerance: 3,
  autonomyAppetite: "human_in_loop",
  ecosystem: ["microsoft"],
  deploymentPreference: "saas",
  budgetSensitivity: 3,
  vendorIds: [],
};

describe("assessment persistence service", () => {
  it("stores one assessment run with one score row per ranked vendor", async () => {
    const result = runAssessment(baseInput, getSeedVendors().slice(0, 2));
    const create = vi.fn(async () => ({ id: "db_run_1" }));
    const client = { assessmentRun: { create } } as unknown as Parameters<typeof persistAssessmentResult>[3];

    const persistedRunId = await persistAssessmentResult(
      baseInput,
      result,
      result.ranking.map((vendor) => vendor.vendorId),
      client,
    );

    expect(persistedRunId).toBe("db_run_1");
    expect(create).toHaveBeenCalledOnce();

    const firstCall = create.mock.calls[0] as unknown as [{ data: AssessmentCreatePayload }];
    const payload = firstCall[0].data;
    expect(payload.engineRunId).toBe(result.runId);
    expect(payload.scoringRuleVersion).toBe(result.scoringRuleVersion);
    expect(payload.vendorSet).toEqual(result.ranking.map((vendor) => vendor.vendorId));
    expect(payload.scoringResults.create).toHaveLength(result.ranking.length);
    expect(payload.scoringResults.create[0]).toMatchObject({
      rank: result.ranking[0].rank,
      finalScore: result.ranking[0].finalScore,
      confidenceScore: result.ranking[0].confidenceScore,
      recommendationBand: result.ranking[0].recommendationBand,
      evidenceIds: result.ranking[0].evidenceIds,
    });
    expect(payload.scoringResults.create[0].vendor.connect.id).toBe(result.ranking[0].vendorId);
    expect(payload.outputJson).toMatchObject({ runId: result.runId });
  });
});
