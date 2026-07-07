import { describe, it, expect } from "vitest";
import { scoreMarketPosition } from "./market-position-rubric";
import type { MarketShareEstimate } from "../intelligence/types";
import type { DisclosedAdopter } from "../peer/adopters";

function share(estimatedShare: number): MarketShareEstimate {
  return {
    vendorId: "v1",
    categoryId: "frontier_model_api" as never,
    estimatedShare,
    confidence: 60,
    source: "Evidence-derived adoption-signal estimate",
    sourceDate: "2026-07-01T00:00:00.000Z",
    methodology: "Directional category-presence estimate",
    changePct: 0,
  };
}

function adopter(n: number): DisclosedAdopter {
  return {
    company: { id: `co${n}`, name: `Company ${n}`, industry: "Banking" },
    summary: "Disclosed platform integration",
    status: "disclosed",
    citations: [{ title: `Co${n} press release`, url: `https://example.com/co${n}`, publisher: "Press", tier: "press" }],
  };
}

describe("scoreMarketPosition — real adoption evidence, no fabrication", () => {
  it("neither input present → insufficient_evidence, never a guessed number", () => {
    const r = scoreMarketPosition({ share: undefined, adopters: [], categoryMemberCount: 14 });
    expect(r.state).toBe("insufficient_evidence");
  });

  it("zero disclosed adopters is NOT treated as proof of zero adoption — it just contributes nothing", () => {
    // A vendor with genuinely no share signal either → insufficient (honest gap),
    // not a fabricated low score from the absence itself.
    const r = scoreMarketPosition({ share: undefined, adopters: [], categoryMemberCount: 14 });
    expect(r.state).toBe("insufficient_evidence");
  });

  it("DeepSeek-shaped case: zero disclosed adopters + a real but low share estimate → scores LOW on real grounds, not insufficient, never a dev-sentiment stand-in", () => {
    // ~2% share in a 14-member category (equal split ≈7.1%) → well below baseline.
    const r = scoreMarketPosition({ share: share(2), adopters: [], categoryMemberCount: 14 });
    expect(r.state).toBe("scored");
    if (r.state === "scored") {
      expect(r.score).toBeLessThanOrEqual(1.0); // real, but low
      expect(r.score).toBeGreaterThan(0);
      expect(r.bestGrade).toBe("E2"); // computed estimate only — capped weak
      // No named-fact URL exists for a computed estimate (it's not one external
      // source) — links the published methodology instead of inventing a citation.
      expect(r.citations).toHaveLength(1);
      expect(r.citations[0].sourceUrl).toMatch(/\/insights#market-share-est$/);
    }
  });

  it("adopter tiers are fixed and E4-capped (never above 4.0 without an independent audit tier)", () => {
    const one = scoreMarketPosition({ share: undefined, adopters: [adopter(1)], categoryMemberCount: 14 });
    const three = scoreMarketPosition({ share: undefined, adopters: [adopter(1), adopter(2), adopter(3)], categoryMemberCount: 14 });
    const seven = scoreMarketPosition({
      share: undefined,
      adopters: [1, 2, 3, 4, 5, 6, 7].map(adopter),
      categoryMemberCount: 14,
    });
    for (const r of [one, three, seven]) {
      expect(r.state).toBe("scored");
      if (r.state === "scored") {
        expect(r.bestGrade).toBe("E4");
        expect(r.score).toBeLessThanOrEqual(4.0);
      }
    }
    if (one.state === "scored" && three.state === "scored" && seven.state === "scored") {
      // More real, named adopters → higher score (monotonic, not arbitrary).
      expect(three.score).toBeGreaterThan(one.score);
      expect(seven.score).toBeGreaterThan(three.score);
      expect(seven.score).toBe(4.0); // top adopter tier hits the E4 cap exactly
    }
  });

  it("real adopter citations are carried through verbatim — never invented", () => {
    const r = scoreMarketPosition({ share: undefined, adopters: [adopter(1), adopter(2)], categoryMemberCount: 14 });
    expect(r.state).toBe("scored");
    if (r.state === "scored") {
      expect(r.citations.map((c) => c.sourceUrl)).toEqual(["https://example.com/co1", "https://example.com/co2"]);
      for (const c of r.citations) expect(c.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it("both inputs present → blended score, still E4-capped grade, higher confidence than either alone", () => {
    const both = scoreMarketPosition({ share: share(20), adopters: [adopter(1), adopter(2), adopter(3)], categoryMemberCount: 14 });
    const adoptersOnly = scoreMarketPosition({ share: undefined, adopters: [adopter(1), adopter(2), adopter(3)], categoryMemberCount: 14 });
    expect(both.state).toBe("scored");
    expect(adoptersOnly.state).toBe("scored");
    if (both.state === "scored" && adoptersOnly.state === "scored") {
      expect(both.bestGrade).toBe("E4");
      expect(both.confidence).toBeGreaterThan(adoptersOnly.confidence);
      expect(both.lowConfidence).toBe(false);
      expect(adoptersOnly.lowConfidence).toBe(true);
    }
  });

  it("a dominant category share (well above equal-split baseline) is still capped at E2/2.0 without disclosed adopters", () => {
    // 90% share in a 14-member category — extreme dominance — still capped low:
    // a computed estimate alone can never reach audit-grade evidence standing.
    const r = scoreMarketPosition({ share: share(90), adopters: [], categoryMemberCount: 14 });
    expect(r.state).toBe("scored");
    if (r.state === "scored") {
      expect(r.score).toBeLessThanOrEqual(2.0);
      expect(r.bestGrade).toBe("E2");
    }
  });

  it("deterministic: identical input → byte-identical output", () => {
    const input = { share: share(8), adopters: [adopter(1), adopter(2)], categoryMemberCount: 14 };
    expect(scoreMarketPosition(input)).toEqual(scoreMarketPosition(input));
  });

  it("uniform across vendors: the exact same tier tables apply regardless of vendor identity", () => {
    // Two different "vendors" (just different adopter company names) with the
    // same COUNT of disclosed adopters score identically — the rubric reads
    // evidence shape, never a vendor id.
    const a = scoreMarketPosition({ share: undefined, adopters: [adopter(1), adopter(2)], categoryMemberCount: 14 });
    const b = scoreMarketPosition({
      share: undefined,
      adopters: [{ ...adopter(9), company: { id: "different-co", name: "Totally Different Co", industry: "Pharma" } }, adopter(10)],
      categoryMemberCount: 14,
    });
    expect(a.state).toBe(b.state);
    if (a.state === "scored" && b.state === "scored") expect(a.score).toBe(b.score);
  });
});
