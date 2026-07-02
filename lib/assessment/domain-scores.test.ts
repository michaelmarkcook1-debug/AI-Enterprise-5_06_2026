// Confidence-scale regression (2026-07 audit): EvidenceRecord.confidence is
// written 0-1 by the LLM classifier (lib/agents/evidence-classifier.ts — Zod
// schema enforces min(0).max(1)), but the rubric's confidence blend and its own
// null-fallback branch (domain-rubric.ts) are both on a 0-100 scale. Before the
// fix, groupByDomain() passed the raw 0-1 value straight through, silently
// deflating every displayed domain confidence to ~45-51% platform-wide.
import { describe, it, expect } from "vitest";
import { groupByDomain, type RawEvidenceRow } from "./domain-scores";

function row(over: Partial<RawEvidenceRow> = {}): RawEvidenceRow {
  return {
    domain: "data_security_privacy",
    evidenceGrade: "E3",
    rawScore: 60,
    confidence: 0.72,
    capturedAt: new Date("2026-06-01"),
    sourceUrl: "https://example.com/a",
    ...over,
  };
}

describe("groupByDomain — confidence scale (0-1 DB value -> 0-100 rubric value)", () => {
  it("scales a stored 0-1 confidence up to 0-100", () => {
    const grouped = groupByDomain([row({ confidence: 0.72 })]);
    const out = grouped.get("data_security_privacy")!;
    expect(out[0].confidence).toBeCloseTo(72, 5);
  });

  it("preserves null (no confidence) — never invents a value", () => {
    const grouped = groupByDomain([row({ confidence: null })]);
    expect(grouped.get("data_security_privacy")![0].confidence).toBeNull();
  });

  it("scales every row in a domain consistently, matching the rubric's own null-fallback units", () => {
    // domain-rubric.ts's fallback is EVIDENCE_MODIFIER * freshnessFactor * 100 —
    // i.e. already 0-100. A scored row must land in the same range.
    const grouped = groupByDomain([row({ confidence: 0.5 }), row({ confidence: 0.95 })]);
    const out = grouped.get("data_security_privacy")!;
    expect(out[0].confidence).toBeCloseTo(50, 5);
    expect(out[1].confidence).toBeCloseTo(95, 5);
    for (const r of out) expect(r.confidence!).toBeLessThanOrEqual(100);
  });

  it("excludes non-framework domains (market_position) from the scorecard", () => {
    const grouped = groupByDomain([row({ domain: "market_position" as never })]);
    expect(grouped.has("market_position" as never)).toBe(false);
  });
});
