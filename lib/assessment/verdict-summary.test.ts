import { describe, it, expect } from "vitest";
import { ASSESSMENT_DOMAINS, type DomainScore, type DomainBand, type DomainBandLabel } from "./domain-rubric";
import { DOMAIN_TO_PILLAR, type EvidenceGrade } from "../types";
import { summariseVerdict, verdictWhySentence, verdictHeadline, type VerdictSummary } from "./verdict-summary";

function scored(domain: (typeof ASSESSMENT_DOMAINS)[number], score: number): DomainScore {
  const grade: EvidenceGrade = "E4";
  return {
    domain, pillar: DOMAIN_TO_PILLAR[domain], state: "scored",
    score, band: Math.round(score) as DomainBand, bandLabel: "enterprise_ready" as DomainBandLabel,
    confidence: 80, lowConfidence: false, bestGrade: grade, evidenceCount: 2, citations: [],
  };
}
function insufficient(domain: (typeof ASSESSMENT_DOMAINS)[number]): DomainScore {
  return { domain, pillar: DOMAIN_TO_PILLAR[domain], state: "insufficient_evidence" };
}

describe("summariseVerdict", () => {
  it("picks strengths (>=3.5) and weaknesses (<=2.5) from scored domains only", () => {
    const domains = ASSESSMENT_DOMAINS.map((d, i) =>
      i === 0 ? scored(d, 4.8) :
      i === 1 ? scored(d, 4.2) :
      i === 2 ? scored(d, 1.5) :
      i === 3 ? insufficient(d) : // never counted as a weakness — it's a coverage gap
      scored(d, 3.0),
    );
    const summary = summariseVerdict(domains);
    expect(summary.strengths.map((s) => s.domain)).toEqual([ASSESSMENT_DOMAINS[0], ASSESSMENT_DOMAINS[1]]);
    expect(summary.weaknesses.map((w) => w.domain)).toEqual([ASSESSMENT_DOMAINS[2]]);
    expect(summary.weaknesses.some((w) => w.domain === ASSESSMENT_DOMAINS[3])).toBe(false);
  });

  it("caps at 2 per side even with more qualifying domains", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, 4.9));
    const summary = summariseVerdict(domains);
    expect(summary.strengths.length).toBeLessThanOrEqual(2);
  });

  it("is pure — never mutates its input", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, 3.8));
    const snapshot = JSON.stringify(domains);
    summariseVerdict(domains);
    expect(JSON.stringify(domains)).toBe(snapshot);
  });
});

describe("verdictHeadline — the profile headline must match the category surfaces, never a shadow number", () => {
  // A global 12-domain summary whose composite/order DISAGREES with the category
  // basis — the exact real-world shape that caused the prod contradiction:
  //   category:  Anthropic 3.39 > OpenAI 3.34   (winner: Anthropic)
  //   global:    OpenAI 3.31   > Anthropic 2.87  (winner: OpenAI  ← flipped)
  const anthropicGlobal: VerdictSummary = { composite: 2.87, coverage: 1, confidence: 80, strengths: [], weaknesses: [] };
  const openaiGlobal: VerdictSummary = { composite: 3.31, coverage: 1, confidence: 78, strengths: [], weaknesses: [] };

  it("uses the in-category composite (not the global fallback) when the vendor is ranked", () => {
    const h = verdictHeadline({ assessmentComposite: 3.39, compositeConfidence: 82, domainCoverage: 1 }, anthropicGlobal);
    expect(h.composite).toBe(3.39); // the category number every other surface shows
    expect(h.composite).not.toBe(anthropicGlobal.composite); // NOT the global 2.87
    expect(h.basis).toBe("category");
  });

  it("preserves the category winner across two profiles — the flipped global order can never surface", () => {
    const anthropic = verdictHeadline({ assessmentComposite: 3.39, compositeConfidence: 82, domainCoverage: 1 }, anthropicGlobal);
    const openai = verdictHeadline({ assessmentComposite: 3.34, compositeConfidence: 79, domainCoverage: 1 }, openaiGlobal);
    // Both headlines are on the category basis → Anthropic > OpenAI, matching /category and /compare.
    expect(anthropic.composite! > openai.composite!).toBe(true);
    // Guard against the regression: had we used the global fallback, OpenAI (3.31) would beat Anthropic (2.87).
    expect(openaiGlobal.composite > anthropicGlobal.composite).toBe(true);
  });

  it("takes confidence AND coverage from the SAME (category) basis — never a mixed-basis header", () => {
    const h = verdictHeadline({ assessmentComposite: 3.39, compositeConfidence: 82, domainCoverage: 0.92 }, anthropicGlobal);
    expect(h.confidence).toBe(82); // category confidence, not the global 80
    expect(h.coverage).toBe(0.92); // category coverage
  });

  it("falls back to the global summary only when the vendor has NO live category ranking", () => {
    const h = verdictHeadline(null, anthropicGlobal);
    expect(h.composite).toBe(2.87);
    expect(h.basis).toBe("global"); // no category number exists to contradict here
  });

  it("falls back to global when a standing exists but its composite is null (held/incomplete)", () => {
    const h = verdictHeadline({ assessmentComposite: null, compositeConfidence: null, domainCoverage: 0 }, anthropicGlobal);
    expect(h.composite).toBe(2.87);
    expect(h.basis).toBe("global");
  });

  it("returns honest nulls when neither a category standing nor a global summary is available", () => {
    const h = verdictHeadline(null, null);
    expect(h).toEqual({ composite: null, confidence: null, coverage: null, basis: "none" });
  });
});

describe("verdictWhySentence", () => {
  it("names both strengths and weaknesses when present", () => {
    const domains = ASSESSMENT_DOMAINS.map((d, i) => (i === 0 ? scored(d, 4.9) : i === 1 ? scored(d, 1.0) : scored(d, 3.0)));
    const s = verdictWhySentence(summariseVerdict(domains));
    expect(s).toContain("Strong on");
    expect(s).toContain("thinner on");
  });

  it("gives an honest, non-forced sentence when nothing is decisive either way", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, 3.0));
    const s = verdictWhySentence(summariseVerdict(domains));
    expect(s.toLowerCase()).toContain("no domain scores clearly");
  });
});
