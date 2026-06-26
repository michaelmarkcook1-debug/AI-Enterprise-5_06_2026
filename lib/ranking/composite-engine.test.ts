import { describe, it, expect } from "vitest";
import { PILLARS, type PillarId } from "../types";
import type { VendorPillarScore } from "../intelligence/types";
import {
  scoreVendorComposite,
  pillarHasEvidence,
  evidenceCompletenessBand,
  compareRanked,
  COVERAGE_FLOOR,
  MIN_PILLAR_CONFIDENCE,
} from "./composite-engine";
import type { EvidenceGrade } from "../types";

const VENDOR = { id: "v1", slug: "v1", name: "Vendor One" };

function ps(
  pillar: PillarId,
  opts: Partial<VendorPillarScore> = {},
): VendorPillarScore {
  return {
    vendorId: "v1",
    pillar,
    capabilityScore: 80,
    evidenceGrade: "E3" as EvidenceGrade,
    confidence: 70,
    strengths: [],
    risks: [],
    missingEvidence: [],
    ...opts,
  };
}

/** All six pillars evidenced at the given score/grade/confidence. */
function allPillars(score = 80, grade: EvidenceGrade = "E3", confidence = 70): VendorPillarScore[] {
  return PILLARS.map((p) => ps(p.id, { capabilityScore: score, evidenceGrade: grade, confidence }));
}

describe("pillarHasEvidence (admissibility gate)", () => {
  it("requires E2+ AND confidence >= floor", () => {
    expect(pillarHasEvidence(ps("business_fit", { evidenceGrade: "E0" }))).toBe(false);
    expect(pillarHasEvidence(ps("business_fit", { evidenceGrade: "E1" }))).toBe(false); // unverified claim
    expect(pillarHasEvidence(ps("business_fit", { evidenceGrade: "E2", confidence: MIN_PILLAR_CONFIDENCE }))).toBe(true);
    expect(pillarHasEvidence(ps("business_fit", { evidenceGrade: "E3", confidence: MIN_PILLAR_CONFIDENCE - 1 }))).toBe(false);
    expect(pillarHasEvidence(undefined)).toBe(false);
  });
});

describe("scoreVendorComposite — ranked path", () => {
  it("full coverage at score 80 / conf 100 → composite ≈ 80, all 6 pillars scored", () => {
    const r = scoreVendorComposite(VENDOR, allPillars(80, "E4", 100));
    expect(r.state).toBe("ranked");
    expect(r.composite).toBeCloseTo(80, 5); // blend=1.0, weights sum to 1.0
    expect(r.coverage).toBeCloseTo(1, 5);
    expect(r.evidenceCompleteness).toBe("full");
    expect(r.pillars).toHaveLength(PILLARS.length);
    expect(r.pillars.every((p) => p.state === "scored")).toBe(true);
    // effective weights renormalize to sum 1.
    const sumEffW = r.pillars.reduce((s, p) => s + (p.effectiveWeight ?? 0), 0);
    expect(sumEffW).toBeCloseTo(1, 5);
  });

  it("is deterministic (same input → identical output)", () => {
    const a = scoreVendorComposite(VENDOR, allPillars());
    const b = scoreVendorComposite(VENDOR, allPillars());
    expect(a).toEqual(b);
  });

  it("renormalizes over covered pillars (one dark pillar) without inflating, and NEVER defaults the dark pillar", () => {
    // Drop vendor_resilience (0.15) → coverage 0.85, still ranked.
    const scores = PILLARS.filter((p) => p.id !== "vendor_resilience").map((p) =>
      ps(p.id, { capabilityScore: 80, evidenceGrade: "E3", confidence: 70 }),
    );
    const r = scoreVendorComposite(VENDOR, scores);
    expect(r.state).toBe("ranked");
    expect(r.coverage).toBeCloseTo(0.85, 5);
    // blend = 0.7 + 0.3*0.7 = 0.91 ; composite = 80 * 0.91 = 72.8
    expect(r.composite).toBeCloseTo(72.8, 4);
    const dark = r.pillars.find((p) => p.pillar === "vendor_resilience")!;
    expect(dark.state).toBe("insufficient_evidence");
    expect(dark.capabilityScore).toBeNull(); // never a default value
    expect(dark.contribution).toBeNull();
    expect(dark.effectiveWeight).toBeNull();
  });

  it("compositeConfidence DROPS with thinner coverage (under-claim)", () => {
    const full = scoreVendorComposite(VENDOR, allPillars(80, "E3", 70));
    const partialScores = PILLARS.filter((p) => p.id !== "vendor_resilience").map((p) =>
      ps(p.id, { capabilityScore: 80, evidenceGrade: "E3", confidence: 70 }),
    );
    const partial = scoreVendorComposite(VENDOR, partialScores);
    expect(partial.compositeConfidence!).toBeLessThan(full.compositeConfidence!);
  });
});

describe("scoreVendorComposite — incomplete path (insufficient evidence)", () => {
  it("coverage below floor → incomplete, no composite, no rank", () => {
    // Mandatory Enterprise Control present (0.25) but total coverage 0.25 < 0.60,
    // so the coverage-floor reason applies (not the mandatory-pillar reason).
    const r = scoreVendorComposite(VENDOR, [ps("enterprise_control")]);
    expect(r.state).toBe("incomplete");
    expect(r.composite).toBeNull();
    expect(r.compositeConfidence).toBeNull();
    expect(r.rank).toBeNull();
    expect(r.coverage).toBeLessThan(COVERAGE_FLOOR);
    expect(r.excludedReason).toMatch(/pillar weight/i);
  });

  it("missing mandatory Enterprise Control → incomplete even above coverage floor", () => {
    // Everything except enterprise_control (0.25) → coverage 0.75 ≥ 0.60, but mandatory missing.
    const scores = PILLARS.filter((p) => p.id !== "enterprise_control").map((p) => ps(p.id));
    const r = scoreVendorComposite(VENDOR, scores);
    expect(r.coverage).toBeCloseTo(0.75, 5);
    expect(r.state).toBe("incomplete");
    expect(r.composite).toBeNull();
    expect(r.excludedReason).toMatch(/Enterprise Control/i);
  });

  it("E1-only evidence is never scored (treated as insufficient)", () => {
    const r = scoreVendorComposite(VENDOR, allPillars(90, "E1", 95));
    expect(r.state).toBe("incomplete");
    expect(r.coverage).toBe(0);
    expect(r.pillars.every((p) => p.state === "insufficient_evidence")).toBe(true);
    expect(r.pillars.every((p) => p.capabilityScore === null)).toBe(true);
  });
});

describe("evidenceCompletenessBand + compareRanked", () => {
  it("bands by coverage", () => {
    expect(evidenceCompletenessBand(1)).toBe("full");
    expect(evidenceCompletenessBand(0.85)).toBe("substantial");
    expect(evidenceCompletenessBand(0.6)).toBe("partial");
    expect(evidenceCompletenessBand(0.3)).toBe("insufficient");
  });

  it("ranks higher composite first, deterministic tie-break by vendorId", () => {
    const a = { ...scoreVendorComposite({ id: "a", slug: "a", name: "A" }, allPillars(80, "E3", 70)) };
    const b = { ...scoreVendorComposite({ id: "b", slug: "b", name: "B" }, allPillars(80, "E3", 70)) };
    // identical composites → tie-break to vendorId "a" before "b"
    expect(compareRanked(a, b)).toBeLessThan(0);
  });
});
