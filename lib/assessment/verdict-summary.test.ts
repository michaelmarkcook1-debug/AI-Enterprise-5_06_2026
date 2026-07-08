import { describe, it, expect } from "vitest";
import { ASSESSMENT_DOMAINS, type DomainScore, type DomainBand, type DomainBandLabel } from "./domain-rubric";
import { DOMAIN_TO_PILLAR, type EvidenceGrade } from "../types";
import { summariseVerdict, verdictWhySentence } from "./verdict-summary";

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
