// Confidence-scale regression (2026-07 audit): EvidenceRecord.confidence is
// written 0-1 by the LLM classifier (lib/agents/evidence-classifier.ts — Zod
// schema enforces min(0).max(1)), but the rubric's confidence blend and its own
// null-fallback branch (domain-rubric.ts) are both on a 0-100 scale. Before the
// fix, groupByDomain() passed the raw 0-1 value straight through, silently
// deflating every displayed domain confidence to ~45-51% platform-wide.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// Citation-order regression (2026-07): getVendorScorecard/getVendorScorecardsBatch
// sorted evidence by capturedAt DESC alone. Rows sharing the exact same
// timestamp have no guaranteed relative order from Postgres, and that order
// was observed to differ depending on how many OTHER vendors were in the same
// IN (...) batch — so the SAME domain's "top source" citation could differ
// between a 1-vendor export and the full category page for the same vendor.
// A static check (not a live-DB test, consistent with this file's other
// checks) — asserts the ORDER BY itself carries a full, deterministic
// tiebreaker, since a mocked Prisma client can't reproduce Postgres's actual
// (unspecified) tie behavior.
describe("evidence query ordering — deterministic tiebreaker", () => {
  it("both getVendorScorecard and getVendorScorecardsBatch order by capturedAt, then sourceUrl, then id", () => {
    const src = readFileSync(join(process.cwd(), "lib/assessment/domain-scores.ts"), "utf8");
    const orderByBlocks = [...src.matchAll(/orderBy:\s*\[([\s\S]*?)\],/g)];
    expect(orderByBlocks.length, "expected an orderBy array in both evidence queries").toBe(2);
    for (const [, block] of orderByBlocks) {
      expect(block).toMatch(/capturedAt:\s*"desc"/);
      expect(block).toMatch(/sourceUrl:\s*"desc"/);
      expect(block).toMatch(/id:\s*"desc"/);
    }
  });
});
