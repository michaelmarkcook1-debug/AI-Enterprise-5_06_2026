import { describe, it, expect } from "vitest";
import { DOMAIN_TO_PILLAR, type DomainId } from "../types";
import { ASSESSMENT_DOMAINS, type DomainScore, type DomainCitation, type DomainBand, type DomainBandLabel } from "../assessment/domain-rubric";
import { DEFAULT_DOMAIN_WEIGHTS, type DomainWeights } from "../assessment/composite";
import type { VendorScorecard } from "../assessment/domain-scores";
import { buildProcurementPackData, type BuildPackInput } from "./procurement-pack";

function scored(domain: DomainId, score: number, citations: DomainCitation[] = []): DomainScore {
  return {
    domain,
    pillar: DOMAIN_TO_PILLAR[domain],
    state: "scored",
    score,
    band: Math.round(score) as DomainBand,
    bandLabel: "enterprise_ready" as DomainBandLabel,
    confidence: 80,
    lowConfidence: false,
    bestGrade: "E4",
    evidenceCount: citations.length || 1,
    citations,
  };
}
function insufficient(domain: DomainId): DomainScore {
  return { domain, pillar: DOMAIN_TO_PILLAR[domain], state: "insufficient_evidence" };
}

const CIT_A = { sourceUrl: "https://a.example.com", evidenceGrade: "E4" as const, capturedAt: "2026-06-01T00:00:00.000Z" };
const CIT_B = { sourceUrl: "https://b.example.com", evidenceGrade: "E3" as const, capturedAt: "2026-05-01T00:00:00.000Z" };

function scorecard(domains: DomainScore[], totalEvidenceRows = 10): VendorScorecard {
  return {
    vendorId: "v1",
    domains,
    scoredCount: domains.filter((d) => d.state === "scored").length,
    insufficientCount: domains.filter((d) => d.state === "insufficient_evidence").length,
    hasAnyEvidence: domains.some((d) => d.state === "scored"),
    totalEvidenceRows,
    modelQuality: null,
    modelQualityCoding: null,
    devSentiment: null,
  };
}

function baseInput(overrides: Partial<BuildPackInput> = {}): BuildPackInput {
  const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, 4, [CIT_A, CIT_B]));
  return {
    kind: "category",
    title: "Test Pack",
    categoryId: null,
    categoryName: null,
    asOfDate: "2026-07-01",
    generatedAt: "2026-07-07T12:00:00.000Z",
    weights: DEFAULT_DOMAIN_WEIGHTS,
    weightingLabel: "Framework default weighting",
    vendors: [{ vendorId: "v1", vendorName: "Acme AI", vendorSlug: "acme-ai", scorecard: scorecard(domains) }],
    ...overrides,
  };
}

describe("buildProcurementPackData", () => {
  it("is pure and deterministic — identical input produces identical output", () => {
    const a = buildProcurementPackData(baseInput());
    const b = buildProcurementPackData(baseInput());
    expect(a).toEqual(b);
  });

  it("never drops an insufficient-evidence domain into a scored shape", () => {
    const domains = [insufficient("strategic_value"), ...ASSESSMENT_DOMAINS.slice(1).map((d) => scored(d, 4))];
    const pack = buildProcurementPackData(baseInput({ vendors: [{ vendorId: "v1", vendorName: "Acme AI", vendorSlug: "acme-ai", scorecard: scorecard(domains) }] }));
    const row = pack.vendors[0]!.domains.find((d) => d.domain === "strategic_value")!;
    expect(row.state).toBe("insufficient_evidence");
    expect(row.score).toBeNull();
    expect(row.bandText).toBeNull();
    expect(row.citations).toEqual([]);
    expect(row.topSource).toBeNull();
  });

  it("topSource is the freshest citation (citations are already newest-first from the rubric)", () => {
    const domains = [scored("strategic_value", 4, [CIT_A, CIT_B]), ...ASSESSMENT_DOMAINS.slice(1).map((d) => scored(d, 4))];
    const pack = buildProcurementPackData(baseInput({ vendors: [{ vendorId: "v1", vendorName: "Acme AI", vendorSlug: "acme-ai", scorecard: scorecard(domains) }] }));
    const row = pack.vendors[0]!.domains.find((d) => d.domain === "strategic_value")!;
    expect(row.topSource).toBe(CIT_A.sourceUrl);
  });

  it("flags weightingIsDefault correctly", () => {
    const atDefault = buildProcurementPackData(baseInput({ weights: DEFAULT_DOMAIN_WEIGHTS }));
    expect(atDefault.weightingIsDefault).toBe(true);

    const customWeights: Partial<DomainWeights> = { ...DEFAULT_DOMAIN_WEIGHTS, strategic_value: 0.9 };
    const custom = buildProcurementPackData(baseInput({ weights: customWeights }));
    expect(custom.weightingIsDefault).toBe(false);
  });

  it("weight% shown per domain reflects the pack's weighting, not a recomputed default", () => {
    const heavy: Partial<DomainWeights> = Object.fromEntries(ASSESSMENT_DOMAINS.map((d) => [d, d === "strategic_value" ? 10 : 1])) as Partial<DomainWeights>;
    const pack = buildProcurementPackData(baseInput({ weights: heavy }));
    const row = pack.vendors[0]!.domains.find((d) => d.domain === "strategic_value")!;
    expect(row.weightPct).toBeGreaterThan(row.defaultWeightPct);
  });

  it("composite reflects the SAME weights object used for the displayed weight%, never a mismatch", () => {
    const skewed: Partial<DomainWeights> = Object.fromEntries(ASSESSMENT_DOMAINS.map((d) => [d, d === "strategic_value" ? 100 : 0])) as Partial<DomainWeights>;
    const domains = [scored("strategic_value", 5), insufficient(ASSESSMENT_DOMAINS[1]!), ...ASSESSMENT_DOMAINS.slice(2).map((d) => scored(d, 1))];
    const pack = buildProcurementPackData(baseInput({ weights: skewed, vendors: [{ vendorId: "v1", vendorName: "Acme AI", vendorSlug: "acme-ai", scorecard: scorecard(domains) }] }));
    // Weight is concentrated entirely on strategic_value (scored 5) — composite should be very close to 5.
    expect(pack.vendors[0]!.composite).toBeGreaterThan(4.5);
  });

  it("carries the shortlist note through to the vendor row", () => {
    const pack = buildProcurementPackData(baseInput({ vendors: [{ vendorId: "v1", vendorName: "Acme AI", vendorSlug: "acme-ai", note: "worth a POC", scorecard: scorecard(ASSESSMENT_DOMAINS.map((d) => scored(d, 4))) }] }));
    expect(pack.vendors[0]!.note).toBe("worth a POC");
  });

  it("uses the real per-vendor totalEvidenceRows, not a fabricated count", () => {
    const pack = buildProcurementPackData(baseInput({ vendors: [{ vendorId: "v1", vendorName: "Acme AI", vendorSlug: "acme-ai", scorecard: scorecard(ASSESSMENT_DOMAINS.map((d) => scored(d, 4)), 468) }] }));
    expect(pack.vendors[0]!.totalEvidenceRows).toBe(468);
  });

  it("category methodology note is the real buildMethodologyNote output when a categoryId is given", () => {
    const pack = buildProcurementPackData(baseInput({ categoryId: "frontier_model_api" }));
    expect(pack.methodologyNote.length).toBeGreaterThan(20);
    expect(pack.methodologyNote).toMatch(/evidence/i);
  });

  it("generatedAt is echoed verbatim — never computed internally from the current time", () => {
    const pack = buildProcurementPackData(baseInput({ generatedAt: "2020-01-01T00:00:00.000Z" }));
    expect(pack.generatedAt).toBe("2020-01-01T00:00:00.000Z");
  });
});
