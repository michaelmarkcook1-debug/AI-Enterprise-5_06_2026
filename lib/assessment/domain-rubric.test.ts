import { describe, it, expect } from "vitest";
import {
  scoreDomainFromEvidence,
  scoreAllDomains,
  ASSESSMENT_DOMAINS,
  type RubricEvidenceRow,
} from "./domain-rubric";
import type { DomainId, EvidenceGrade } from "../types";

const NOW = new Date("2026-06-01T00:00:00Z");
const FRESH = new Date("2026-05-15T00:00:00Z"); // < 90d → freshness 1.0
const OLD = new Date("2024-12-01T00:00:00Z"); // > 365d → freshness 0.7

function row(
  grade: EvidenceGrade,
  rawScore: number,
  opts: { confidence?: number | null; capturedAt?: Date; sourceUrl?: string | null } = {},
): RubricEvidenceRow {
  return {
    evidenceGrade: grade,
    rawScore,
    confidence: opts.confidence ?? null,
    capturedAt: opts.capturedAt ?? FRESH,
    sourceUrl: opts.sourceUrl ?? null,
  };
}

const D: DomainId = "model_reliability";

describe("scoreDomainFromEvidence", () => {
  it("returns an insufficient-evidence sentinel (no score) when there are no rows", () => {
    const r = scoreDomainFromEvidence(D, [], NOW);
    expect(r.state).toBe("insufficient_evidence");
    expect("score" in r).toBe(false); // never a number, never 0
  });

  it("caps the band by best grade: all-E2 rawScore 100 → ≤ 2.0", () => {
    const r = scoreDomainFromEvidence(D, [row("E2", 100), row("E2", 100)], NOW);
    expect(r.state).toBe("scored");
    if (r.state !== "scored") return;
    expect(r.score).toBeLessThanOrEqual(2.0);
    expect(r.band).toBeLessThanOrEqual(2);
    expect(r.bandLabel).toBe("basic_weak_proof");
    expect(r.bestGrade).toBe("E2");
  });

  it("a high rawScore cannot buy a high band: all-E1 rawScore 100 → ≤ 1.0", () => {
    const r = scoreDomainFromEvidence(D, [row("E1", 100)], NOW);
    expect(r.state).toBe("scored");
    if (r.state !== "scored") return;
    expect(r.score).toBeLessThanOrEqual(1.0);
    expect(r.bandLabel).toBe("claimed_unevidenced");
  });

  it("E5 audit-grade evidence reaches the top band", () => {
    const r = scoreDomainFromEvidence(D, [row("E5", 95)], NOW);
    expect(r.state).toBe("scored");
    if (r.state !== "scored") return;
    expect(r.score).toBeGreaterThanOrEqual(4.0);
    expect(r.score).toBeLessThanOrEqual(5.0);
    expect(r.bestGrade).toBe("E5");
    expect(r.bandLabel).toBe("enterprise_grade");
  });

  it("best grade among mixed rows sets the cap (E2+E4 → cap 4, score > 2)", () => {
    const r = scoreDomainFromEvidence(D, [row("E2", 50), row("E4", 80)], NOW);
    expect(r.state).toBe("scored");
    if (r.state !== "scored") return;
    expect(r.bestGrade).toBe("E4");
    expect(r.score).toBeGreaterThan(2);
  });

  it("weights recent evidence above stale evidence", () => {
    const r = scoreDomainFromEvidence(
      D,
      [row("E4", 90, { capturedAt: FRESH }), row("E4", 30, { capturedAt: OLD })],
      NOW,
    );
    expect(r.state).toBe("scored");
    if (r.state !== "scored") return;
    // Simple mean would put rawScore at 60 → score 3.6; recency-weighting skews
    // toward the fresh high-rawScore row, so the score must exceed the mean.
    expect(r.score).toBeGreaterThan(3.6);
  });

  it("flags low confidence for thin evidence and clears it for deep audit-grade evidence", () => {
    const thin = scoreDomainFromEvidence(D, [row("E2", 80)], NOW);
    expect(thin.state === "scored" && thin.lowConfidence).toBe(true);

    const deep = scoreDomainFromEvidence(
      D,
      Array.from({ length: 8 }, () => row("E5", 90)),
      NOW,
    );
    expect(deep.state).toBe("scored");
    if (deep.state !== "scored") return;
    expect(deep.lowConfidence).toBe(false);
    expect(deep.confidence).toBeLessThan(100);
    expect(deep.confidence).toBeGreaterThan(0);
  });

  it("collects citations from URL'd rows only, deduped, newest first", () => {
    const r = scoreDomainFromEvidence(
      D,
      [
        row("E4", 80, { capturedAt: OLD, sourceUrl: "https://a.example/old" }),
        row("E4", 80, { capturedAt: FRESH, sourceUrl: "https://a.example/new" }),
        row("E4", 80, { capturedAt: NOW, sourceUrl: "https://a.example/new" }), // dup url
        row("E4", 80, { sourceUrl: null }), // no url → not a citation
      ],
      NOW,
    );
    expect(r.state).toBe("scored");
    if (r.state !== "scored") return;
    expect(r.citations.map((c) => c.sourceUrl)).toEqual(["https://a.example/new", "https://a.example/old"]);
  });

  it("is deterministic for the same input and `now`", () => {
    const rows = [row("E3", 70, { sourceUrl: "https://x.example" }), row("E4", 85)];
    expect(scoreDomainFromEvidence(D, rows, NOW)).toEqual(scoreDomainFromEvidence(D, rows, NOW));
  });
});

describe("scoreAllDomains", () => {
  it("returns exactly the 12 framework domains in canonical order", () => {
    const out = scoreAllDomains(new Map(), NOW);
    expect(out).toHaveLength(12);
    expect(out.map((d) => d.domain)).toEqual(ASSESSMENT_DOMAINS);
    expect(ASSESSMENT_DOMAINS).not.toContain("market_position");
  });

  it("scores domains with evidence and marks the rest insufficient", () => {
    const map = new Map<DomainId, RubricEvidenceRow[]>([["cost_finops", [row("E4", 80)]]]);
    const out = scoreAllDomains(map, NOW);
    const cost = out.find((d) => d.domain === "cost_finops");
    const other = out.find((d) => d.domain === "strategic_value");
    expect(cost?.state).toBe("scored");
    expect(other?.state).toBe("insufficient_evidence");
  });
});
