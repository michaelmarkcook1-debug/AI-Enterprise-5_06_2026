import { describe, it, expect } from "vitest";
import {
  scoreDomainFromEvidence,
  scoreAllDomains,
  scoreSovereigntyDomain,
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
  it("returns exactly the 13 framework domains in canonical order (12 + sovereignty_residency)", () => {
    const out = scoreAllDomains(new Map(), NOW);
    expect(out).toHaveLength(ASSESSMENT_DOMAINS.length);
    expect(out.map((d) => d.domain)).toEqual(ASSESSMENT_DOMAINS);
    expect(ASSESSMENT_DOMAINS).toContain("sovereignty_residency");
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

  it("routes sovereignty_residency through scoreSovereigntyDomain, not scoreDomainFromEvidence", () => {
    // A well-evidenced (E4) LOW-safety fact (rawScore 15 — deep in the LOW
    // tier) must score LOW. Under the standard scoreDomainFromEvidence this
    // same E4/rawScore-15 input would floor at 3.0 (grade caps a BAND, never
    // below cap-1) — exactly the bug this domain's own rubric exists to avoid.
    const map = new Map<DomainId, RubricEvidenceRow[]>([
      ["sovereignty_residency", [row("E4", 15, { sourceUrl: "https://example.com/gov-action" })]],
    ]);
    const out = scoreAllDomains(map, NOW);
    const sov = out.find((d) => d.domain === "sovereignty_residency");
    expect(sov?.state).toBe("scored");
    if (sov?.state === "scored") {
      expect(sov.score).toBeLessThan(1.0); // NOT floored at 3.0 by the E4 grade
      expect(sov.bestGrade).toBe("E4"); // grade still reflects real evidence quality
    }
  });
});

describe("scoreSovereigntyDomain — the risk-shaped rubric", () => {
  it("no evidence → insufficient, never a nationality default", () => {
    expect(scoreSovereigntyDomain([], NOW).state).toBe("insufficient_evidence");
  });

  it("CORE PROPERTY: a well-evidenced LOW-safety fact scores LOW, not floored high by its own grade", () => {
    // E5 (independent-audit-tier evidence, e.g. an official government
    // regulatory action) reporting a rawScore of 10 (deep LOW tier) — under
    // scoreDomainFromEvidence this would floor at 4.0 (E5 cap 5, band [4,5]).
    // Here it must land near 0.5, matching the real finding, not the grade.
    const r = scoreSovereigntyDomain([row("E5", 10, { sourceUrl: "https://example.com/regulator" })], NOW);
    expect(r.state).toBe("scored");
    if (r.state === "scored") {
      expect(r.score).toBeLessThan(1.0);
      expect(r.bestGrade).toBe("E5");
      // bandLabel tracks the SCORE's band, not the grade's — a low score must
      // never render a positively-coded label like "enterprise-grade".
      expect(r.bandLabel).not.toBe("enterprise_grade");
    }
  });

  it("a well-evidenced HIGH-safety fact scores HIGH", () => {
    const r = scoreSovereigntyDomain([row("E4", 90, { sourceUrl: "https://example.com/due-process" })], NOW);
    expect(r.state).toBe("scored");
    if (r.state === "scored") expect(r.score).toBeGreaterThan(4.0);
  });

  it("grade still bounds confidence (weak evidence → lower confidence) even though it never bounds direction", () => {
    const weak = scoreSovereigntyDomain([row("E1", 10)], NOW);
    const strong = scoreSovereigntyDomain([row("E5", 10, { sourceUrl: "https://example.com/a" })], NOW);
    expect(weak.state).toBe("scored");
    expect(strong.state).toBe("scored");
    if (weak.state === "scored" && strong.state === "scored") {
      // Same low rawScore either way (both real LOW findings) — grade affects
      // confidence, not the score's direction.
      expect(weak.score).toBeCloseTo(strong.score, 1);
      expect(weak.lowConfidence).toBe(true);
    }
  });

  it("deterministic: identical rows → identical output", () => {
    const rows = [row("E4", 20, { sourceUrl: "https://a.example.com" }), row("E3", 55, { sourceUrl: "https://b.example.com" })];
    expect(scoreSovereigntyDomain(rows, NOW)).toEqual(scoreSovereigntyDomain(rows, NOW));
  });

  it("citations are real, deduped, newest-first — never fabricated", () => {
    const rows = [
      row("E4", 20, { sourceUrl: "https://a.example.com", capturedAt: OLD }),
      row("E3", 55, { sourceUrl: "https://b.example.com", capturedAt: FRESH }),
      row("E2", 40, { sourceUrl: "https://a.example.com", capturedAt: FRESH }), // dup URL
    ];
    const r = scoreSovereigntyDomain(rows, NOW);
    expect(r.state).toBe("scored");
    if (r.state === "scored") {
      expect(r.citations).toHaveLength(2); // deduped
      expect(r.citations[0].sourceUrl).toBe("https://b.example.com"); // newest first
    }
  });
});
