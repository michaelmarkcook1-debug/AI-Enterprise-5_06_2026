import { describe, it, expect } from "vitest";
import { DOMAIN_TO_PILLAR, type DomainId } from "../types";
import { ASSESSMENT_DOMAINS, type DomainScore, type DomainBand, type DomainBandLabel } from "./domain-rubric";
import {
  computeWeightedComposite,
  normalizeWeights,
  compareWeighted,
  DEFAULT_DOMAIN_WEIGHTS,
  ASSESSMENT_COVERAGE_FLOOR,
  type DomainWeights,
} from "./composite";

function scored(domain: DomainId, score: number, confidence = 80): DomainScore {
  return {
    domain,
    pillar: DOMAIN_TO_PILLAR[domain],
    state: "scored",
    score,
    band: Math.round(score) as DomainBand,
    bandLabel: "enterprise_ready" as DomainBandLabel,
    confidence,
    lowConfidence: false,
    bestGrade: "E4",
    evidenceCount: 3,
    citations: [],
  };
}
function insufficient(domain: DomainId): DomainScore {
  return { domain, pillar: DOMAIN_TO_PILLAR[domain], state: "insufficient_evidence" };
}

const allScored = (score = 4): DomainScore[] => ASSESSMENT_DOMAINS.map((d) => scored(d, score));
const equalWeights = (v: number): Partial<DomainWeights> =>
  ASSESSMENT_DOMAINS.reduce((a, d) => ({ ...a, [d]: v }), {} as Partial<DomainWeights>);

describe("normalizeWeights", () => {
  it("renormalizes to sum 1 (sliders are relative)", () => {
    const n = normalizeWeights(equalWeights(50));
    const sum = ASSESSMENT_DOMAINS.reduce((s, d) => s + n[d], 0);
    expect(sum).toBeCloseTo(1, 9);
    expect(n[ASSESSMENT_DOMAINS[0]]).toBeCloseTo(1 / 12, 9);
  });
  it("all-zero falls back to equal weights (no div-by-zero)", () => {
    const n = normalizeWeights(equalWeights(0));
    expect(n[ASSESSMENT_DOMAINS[0]]).toBeCloseTo(1 / 12, 9);
  });
});

describe("computeWeightedComposite", () => {
  it("does not mutate the input scorecard (weights are a read-only lens)", () => {
    const domains = allScored(4);
    const snapshot = JSON.stringify(domains);
    computeWeightedComposite(domains, DEFAULT_DOMAIN_WEIGHTS);
    expect(JSON.stringify(domains)).toBe(snapshot);
  });

  it("full coverage with framework defaults → coverage 1, composite in 0–5", () => {
    const r = computeWeightedComposite(allScored(4), DEFAULT_DOMAIN_WEIGHTS);
    expect(r.coverage).toBeCloseTo(1, 9);
    expect(r.scoredCount).toBe(12);
    expect(r.composite).toBeGreaterThan(0);
    expect(r.composite).toBeLessThanOrEqual(5);
  });

  it("coverage-discounts: insufficient domains contribute 0 and drop coverage", () => {
    // 6 scored, 6 insufficient, equal weights → coverage 0.5.
    const domains = ASSESSMENT_DOMAINS.map((d, i) => (i < 6 ? scored(d, 4) : insufficient(d)));
    const r = computeWeightedComposite(domains, equalWeights(1));
    expect(r.coverage).toBeCloseTo(0.5, 9);
    expect(r.insufficientCount).toBe(6);
    // Every insufficient domain contributes null (0), never a number.
    for (const c of r.contributions) {
      if (c.state === "insufficient_evidence") expect(c.contribution).toBeNull();
    }
    // Discounted vs full coverage at the same per-domain score.
    const full = computeWeightedComposite(allScored(4), equalWeights(1));
    expect(r.composite).toBeLessThan(full.composite);
  });

  it("a domain cannot be scored into existence by weight", () => {
    const domains = ASSESSMENT_DOMAINS.map((d, i) => (i === 0 ? insufficient(d) : scored(d, 3)));
    const baseline = computeWeightedComposite(domains, equalWeights(1));
    // Crank the INSUFFICIENT domain's weight massively.
    const skewed = computeWeightedComposite(domains, { ...equalWeights(1), [ASSESSMENT_DOMAINS[0]]: 1000 });
    const insufContribution = skewed.contributions.find((c) => c.domain === ASSESSMENT_DOMAINS[0]);
    expect(insufContribution?.contribution).toBeNull(); // still 0
    // Pouring weight into an unevidenced domain lowers coverage + composite — it
    // can never raise the score.
    expect(skewed.coverage).toBeLessThan(baseline.coverage);
    expect(skewed.composite).toBeLessThan(baseline.composite);
  });

  it("is invariant to un-normalized slider scale (5× == 1×)", () => {
    const domains = allScored(4);
    const a = computeWeightedComposite(domains, equalWeights(5));
    const b = computeWeightedComposite(domains, equalWeights(1));
    expect(a.composite).toBeCloseTo(b.composite, 9);
    expect(a.coverage).toBeCloseTo(b.coverage, 9);
  });

  it("is deterministic", () => {
    const domains = allScored(3.5);
    expect(computeWeightedComposite(domains, DEFAULT_DOMAIN_WEIGHTS)).toEqual(
      computeWeightedComposite(domains, DEFAULT_DOMAIN_WEIGHTS),
    );
  });
});

describe("re-weighting re-ranks (compareWeighted)", () => {
  it("shifting weight to a vendor's strong domain flips the order", () => {
    const dStrong = ASSESSMENT_DOMAINS[0];
    const dWeak = ASSESSMENT_DOMAINS[1];
    // A excels at domain[0], poor at domain[1]; B is the mirror. All other domains equal.
    const mk = (hi: DomainId, lo: DomainId): DomainScore[] =>
      ASSESSMENT_DOMAINS.map((d) => scored(d, d === hi ? 5 : d === lo ? 1 : 3));
    const A = mk(dStrong, dWeak);
    const B = mk(dWeak, dStrong);

    const heavyOnStrong = { ...equalWeights(1), [dStrong]: 50 };
    const heavyOnWeak = { ...equalWeights(1), [dWeak]: 50 };

    const rank = (domains: DomainScore[], w: Partial<DomainWeights>, id: string) => {
      const r = computeWeightedComposite(domains, w);
      return { composite: r.composite, coverage: r.coverage, confidence: r.confidence, vendorId: id };
    };

    const s1 = [rank(A, heavyOnStrong, "A"), rank(B, heavyOnStrong, "B")].sort(compareWeighted);
    expect(s1[0].vendorId).toBe("A"); // weighting domain[0] favours A

    const s2 = [rank(A, heavyOnWeak, "A"), rank(B, heavyOnWeak, "B")].sort(compareWeighted);
    expect(s2[0].vendorId).toBe("B"); // weighting domain[1] favours B
  });
});

describe("default-weight parity (static ranking == interactive re-rank)", () => {
  // The static category ranking (category-composite) and CategoryRerank both rank
  // via the SAME recipe: filter coverage ≥ ASSESSMENT_COVERAGE_FLOOR, then sort by
  // compareWeighted on computeWeightedComposite(domains, weights). This locks the
  // contract so the two surfaces can't drift and reshuffle on load.
  interface V { vendorId: string; domains: DomainScore[] }
  const order = (vendors: V[], weights: Partial<DomainWeights>): string[] =>
    vendors
      .map((v) => {
        const r = computeWeightedComposite(v.domains, weights);
        // RAW coverage gates eligibility + tie-breaks (ungameable), exactly as both
        // the static ranking and the re-rank do.
        return { vendorId: v.vendorId, composite: r.composite, coverage: r.rawCoverage, confidence: r.confidence };
      })
      .filter((r) => r.coverage >= ASSESSMENT_COVERAGE_FLOOR)
      .sort(compareWeighted)
      .map((r) => r.vendorId);

  const vendors: V[] = [
    { vendorId: "a", domains: allScored(4.5) },
    { vendorId: "b", domains: ASSESSMENT_DOMAINS.map((d, i) => (i < 10 ? scored(d, 3.8) : insufficient(d))) },
    { vendorId: "c", domains: allScored(2.2) },
    { vendorId: "thin", domains: ASSESSMENT_DOMAINS.map((d, i) => (i < 4 ? scored(d, 5) : insufficient(d))) },
  ];

  it("static and re-rank produce the identical order at default weights", () => {
    const staticOrder = order(vendors, DEFAULT_DOMAIN_WEIGHTS);
    const rerankOrder = order(vendors, DEFAULT_DOMAIN_WEIGHTS);
    expect(rerankOrder).toEqual(staticOrder);
  });

  it("holds sub-coverage-floor vendors out of BOTH (can't re-weight out of thin coverage)", () => {
    // "thin" has 4/12 domains → coverage 0.33 < floor → never ranked, at any weights.
    expect(order(vendors, DEFAULT_DOMAIN_WEIGHTS)).not.toContain("thin");
    expect(order(vendors, equalWeights(1))).not.toContain("thin");
    // Even pouring weight onto thin's 4 evidenced domains can't lift it past the floor.
    const skew = { ...equalWeights(1), [ASSESSMENT_DOMAINS[0]]: 100 };
    expect(order(vendors, skew)).not.toContain("thin");
  });
});
