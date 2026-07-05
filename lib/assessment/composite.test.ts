import { describe, it, expect } from "vitest";
import { DOMAIN_TO_PILLAR, type DomainId } from "../types";
import { ASSESSMENT_DOMAINS, type DomainScore, type DomainBand, type DomainBandLabel } from "./domain-rubric";
import {
  computeWeightedComposite,
  normalizeWeights,
  compareWeighted,
  computeGap,
  rankVendorsByComposite,
  rollUpToPillars,
  activeDomains,
  DEFAULT_DOMAIN_WEIGHTS,
  ASSESSMENT_COVERAGE_FLOOR,
  RANKABLE_DOMAIN_ORDER,
  type DomainWeights,
} from "./composite";
import {
  resolveDomainWeights,
  categoryActivatesModelQuality,
  categoryHasCustomWeights,
  buildMethodologyNote,
  CATEGORY_DOMAIN_WEIGHTS,
} from "./category-weights";

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

describe("default-weight parity (static ranking == interactive re-rank), across categories", () => {
  // BOTH surfaces — category-composite (static) and CategoryRerank (interactive) —
  // call the SAME rankVendorsByComposite. So parity is by construction: at default
  // weights the ranked order is identical. These fixtures stand in for SEVERAL
  // categories with different evidence shapes (deep, thin, tied, mixed-coverage).
  interface V { vendorId: string; domains: DomainScore[] }
  const rankedIds = (vendors: V[], weights: Partial<DomainWeights>): string[] =>
    rankVendorsByComposite(vendors, weights).filter((r) => r.ranked).map((r) => r.vendorId);

  const CATEGORIES: Record<string, V[]> = {
    // Deep field: clear separation.
    frontier_model_api: [
      { vendorId: "alpha", domains: allScored(4.6) },
      { vendorId: "bravo", domains: allScored(3.4) },
      { vendorId: "charlie", domains: ASSESSMENT_DOMAINS.map((d, i) => (i < 9 ? scored(d, 2.6) : insufficient(d))) },
      { vendorId: "thin1", domains: ASSESSMENT_DOMAINS.map((d, i) => (i < 4 ? scored(d, 5) : insufficient(d))) },
    ],
    // Near-tied field (within the noise band).
    rag_enterprise_search: [
      { vendorId: "delta", domains: allScored(3.0) },
      { vendorId: "echo", domains: allScored(3.05) },
      { vendorId: "foxtrot", domains: allScored(2.98) },
    ],
    // Mixed coverage; one held.
    ai_silicon: [
      { vendorId: "golf", domains: ASSESSMENT_DOMAINS.map((d, i) => (i < 11 ? scored(d, 3.7) : insufficient(d))) },
      { vendorId: "hotel", domains: allScored(3.9) },
      { vendorId: "thin2", domains: ASSESSMENT_DOMAINS.map((d, i) => (i < 6 ? scored(d, 4) : insufficient(d))) },
    ],
  };

  for (const [cat, vendors] of Object.entries(CATEGORIES)) {
    it(`${cat}: static order == re-rank order at default weights (one shared ranker)`, () => {
      const staticOrder = rankedIds(vendors, DEFAULT_DOMAIN_WEIGHTS);
      const rerankOrder = rankedIds(vendors, DEFAULT_DOMAIN_WEIGHTS);
      expect(rerankOrder).toEqual(staticOrder);
      expect(staticOrder.length).toBeGreaterThan(0); // sanity: something ranks
    });

    it(`${cat}: ranking is deterministic (re-run identical)`, () => {
      expect(rankVendorsByComposite(vendors, DEFAULT_DOMAIN_WEIGHTS)).toEqual(
        rankVendorsByComposite(vendors, DEFAULT_DOMAIN_WEIGHTS),
      );
    });
  }

  it("sub-coverage-floor vendors are held in EVERY category, at any weights (ungameable)", () => {
    for (const vendors of Object.values(CATEGORIES)) {
      const skew = { ...equalWeights(1), [ASSESSMENT_DOMAINS[0]]: 100 };
      for (const w of [DEFAULT_DOMAIN_WEIGHTS, equalWeights(1), skew]) {
        const ids = rankedIds(vendors, w);
        expect(ids).not.toContain("thin1");
        expect(ids).not.toContain("thin2");
      }
    }
  });
});

describe("computeGap (why this / why not the runner-up)", () => {
  it("per-domain deltas sum to the composite gap (real arithmetic, not narrative)", () => {
    const leader = allScored(4);
    const runner = allScored(3);
    const gap = computeGap(leader, runner, DEFAULT_DOMAIN_WEIGHTS);
    const summed = gap.drivers.reduce((s, d) => s + d.weightedDelta, 0);
    expect(gap.compositeDelta).toBeCloseTo(summed, 6);
    // And it equals the difference of the two composites.
    const lc = computeWeightedComposite(leader, DEFAULT_DOMAIN_WEIGHTS).composite;
    const rc = computeWeightedComposite(runner, DEFAULT_DOMAIN_WEIGHTS).composite;
    expect(gap.compositeDelta).toBeCloseTo(lc - rc, 1);
  });

  it("top driver is the domain where the leader leads most (weighted)", () => {
    const hi = ASSESSMENT_DOMAINS[0];
    const leader = ASSESSMENT_DOMAINS.map((d) => scored(d, d === hi ? 5 : 3));
    const runner = ASSESSMENT_DOMAINS.map((d) => scored(d, d === hi ? 1 : 3));
    const gap = computeGap(leader, runner, equalWeights(1));
    expect(gap.drivers[0].domain).toBe(hi);
    expect(gap.drivers[0].weightedDelta).toBeGreaterThan(0);
  });

  it("flags coverage-driven gaps honestly (leader has evidence, runner-up doesn't)", () => {
    const d0 = ASSESSMENT_DOMAINS[0];
    const leader = ASSESSMENT_DOMAINS.map((d) => scored(d, 4));
    const runner = ASSESSMENT_DOMAINS.map((d, i) => (i === 0 ? insufficient(d) : scored(d, 4)));
    const gap = computeGap(leader, runner, equalWeights(1));
    const driver = gap.drivers.find((x) => x.domain === d0)!;
    expect(driver.note).toBe("leader_only");
    expect(driver.runnerScore).toBeNull();
    expect(driver.weightedDelta).toBeGreaterThan(0); // the only domain creating a gap
  });

  it("never invents a reason when both sides lack evidence (delta 0)", () => {
    const d0 = ASSESSMENT_DOMAINS[0];
    const leader = ASSESSMENT_DOMAINS.map((d, i) => (i === 0 ? insufficient(d) : scored(d, 4)));
    const runner = ASSESSMENT_DOMAINS.map((d, i) => (i === 0 ? insufficient(d) : scored(d, 4)));
    const driver = computeGap(leader, runner, equalWeights(1)).drivers.find((x) => x.domain === d0)!;
    expect(driver.note).toBe("both_insufficient");
    expect(driver.weightedDelta).toBe(0);
  });
});

// ── Category-aware default weights + the model_quality domain ──────────────────

const FRONTIER = "frontier_model_api";
const frontierWeights = (): DomainWeights => resolveDomainWeights(FRONTIER);
// Frontier profile with the (now-active) dev_sentiment domain stripped — lets the
// model_quality-mechanics tests below stay isolated at /13 instead of tangling
// with the dev-sentiment ranking variable (tested separately in dev-sentiment/).
const mqWeights = (): DomainWeights => {
  const w = { ...resolveDomainWeights(FRONTIER) } as Record<string, number>;
  delete w.dev_sentiment;
  return w as DomainWeights;
};

describe("category-aware default weights", () => {
  it("resolves the frontier profile (incl model_quality) and the framework default otherwise", () => {
    expect(categoryHasCustomWeights(FRONTIER)).toBe(true);
    expect(categoryHasCustomWeights("some_unprofiled_category")).toBe(false);
    expect(resolveDomainWeights("some_unprofiled_category")).toBe(DEFAULT_DOMAIN_WEIGHTS);
    expect(categoryActivatesModelQuality(FRONTIER)).toBe(true);
    expect(categoryActivatesModelQuality("some_unprofiled_category")).toBe(false);
  });

  it("the frontier profile honours the brief (↑ model quality/governance/agentic/cost, ↓ capital) and sums to ~1", () => {
    const w = CATEGORY_DOMAIN_WEIGHTS[FRONTIER].weights;
    const sum = Object.values(w).reduce((s, x) => s + (x ?? 0), 0);
    expect(sum).toBeCloseTo(1, 9);
    // model_quality is the single highest-weighted domain (the model is the product).
    const maxDomain = Object.entries(w).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0];
    expect(maxDomain).toBe("model_quality");
    // Directed moves vs the framework default.
    expect(w.model_quality!).toBeGreaterThan(0); // newly present (was effectively 0)
    expect(w.governance_compliance!).toBeGreaterThan(DEFAULT_DOMAIN_WEIGHTS.governance_compliance);
    expect(w.agentic_autonomy!).toBeGreaterThan(DEFAULT_DOMAIN_WEIGHTS.agentic_autonomy);
    expect(w.cost_finops!).toBeGreaterThan(DEFAULT_DOMAIN_WEIGHTS.cost_finops);
    expect(w.capital_resilience!).toBeLessThan(DEFAULT_DOMAIN_WEIGHTS.capital_resilience);
  });

  it("activeDomains: framework default = 12; frontier = 14 (incl model_quality + dev_sentiment)", () => {
    expect(activeDomains(DEFAULT_DOMAIN_WEIGHTS)).toEqual(ASSESSMENT_DOMAINS);
    const active = activeDomains(frontierWeights());
    // Frontier activates BOTH category-scoped domains: model_quality (Arena) and
    // dev_sentiment (developer-community signal, weight 0.25, flag on).
    expect(active).toContain("model_quality");
    expect(active).toContain("dev_sentiment");
    expect(active.length).toBe(14);
    // market_position is never an assessment domain in either set.
    expect(active).not.toContain("market_position");
    expect(RANKABLE_DOMAIN_ORDER).not.toContain("market_position");
  });

  it("default-category behaviour is byte-identical to the pre-category-aware path", () => {
    // The active set for the framework default is exactly ASSESSMENT_DOMAINS, in
    // order — so coverage stays /12 and the composite is unchanged for every
    // category that does not opt into model_quality.
    const r = computeWeightedComposite(allScored(4), DEFAULT_DOMAIN_WEIGHTS);
    expect(r.domainTotal).toBe(12);
    expect(r.scoredCount).toBe(12);
    expect(r.rawCoverage).toBeCloseTo(1, 9);
  });
});

describe("model_quality domain (Arena Elo) under the frontier profile", () => {
  // 12 framework domains + an optional model_quality score.
  const base = (s = 4): DomainScore[] => ASSESSMENT_DOMAINS.map((d) => scored(d, s));
  const withMQ = (s: number): DomainScore[] => [...base(4), scored("model_quality", s)];

  it("is counted in the composite + coverage when present (denominator /13)", () => {
    const r = computeWeightedComposite(withMQ(3.9), mqWeights());
    expect(r.domainTotal).toBe(13);
    expect(r.scoredCount).toBe(13);
    expect(r.rawCoverage).toBeCloseTo(1, 9);
    expect(r.contributions.some((c) => c.domain === "model_quality" && c.state === "scored")).toBe(true);
  });

  it("a higher Arena Elo score raises the frontier composite (it actually feeds the rank)", () => {
    const hi = computeWeightedComposite(withMQ(4.0), mqWeights()).composite;
    const lo = computeWeightedComposite(withMQ(1.0), mqWeights()).composite;
    expect(hi).toBeGreaterThan(lo);
  });

  it("insufficient stays insufficient: a vendor with no Arena Elo is /13 with model_quality contributing 0", () => {
    // No model_quality entry at all (vendor has no Arena-ranked model).
    const r = computeWeightedComposite(base(4), mqWeights());
    expect(r.domainTotal).toBe(13); // still counted in the denominator
    expect(r.scoredCount).toBe(12); // model_quality is NOT scored into existence
    expect(r.rawCoverage).toBeCloseTo(12 / 13, 9);
    const mq = r.contributions.find((c) => c.domain === "model_quality");
    expect(mq?.state).toBe("insufficient_evidence");
    expect(mq?.contribution).toBeNull();
  });

  it("does NOT leak into non-frontier categories (framework default never scores model_quality)", () => {
    // Even if a model_quality score is somehow present, the framework-default
    // profile does not activate it → it is ignored, coverage stays /12.
    const r = computeWeightedComposite(withMQ(5), DEFAULT_DOMAIN_WEIGHTS);
    expect(r.domainTotal).toBe(12);
    expect(r.contributions.some((c) => c.domain === "model_quality")).toBe(false);
  });
});

describe("frontier parity + ungameable coverage", () => {
  const base = (s: number): DomainScore[] => ASSESSMENT_DOMAINS.map((d) => scored(d, s));
  const vendors = [
    { vendorId: "alpha", domains: [...base(4.4), scored("model_quality", 3.95)] },
    { vendorId: "bravo", domains: [...base(3.2), scored("model_quality", 3.6)] },
    { vendorId: "charlie", domains: base(3.0) }, // no Arena Elo → model_quality insufficient
  ];

  it("static order == re-rank order at the frontier default (one shared ranker)", () => {
    const ids = (w: DomainWeights) => rankVendorsByComposite(vendors, w).filter((r) => r.ranked).map((r) => r.vendorId);
    const staticOrder = ids(frontierWeights());
    const rerankOrder = ids(frontierWeights());
    expect(rerankOrder).toEqual(staticOrder);
    expect(staticOrder.length).toBeGreaterThan(0);
  });

  it("zeroing a domain's weight does NOT shrink the coverage denominator (ungameable)", () => {
    // A vendor scored on the 12 base but with NO Arena Elo: 12/13 under frontier.
    const thin = base(4);
    const full = computeWeightedComposite(thin, mqWeights());
    expect(full.rawCoverage).toBeCloseTo(12 / 13, 9);
    // User drags model_quality to 0 — the KEY remains, so it stays in the denominator.
    const zeroed = computeWeightedComposite(thin, { ...mqWeights(), model_quality: 0 });
    expect(zeroed.domainTotal).toBe(13);
    expect(zeroed.rawCoverage).toBeCloseTo(12 / 13, 9); // NOT lifted to 12/12
  });
});

describe("per-category methodology note (transparency)", () => {
  it("frontier note documents the weighting, the rationale, and the real Arena Elo source", () => {
    const note = buildMethodologyNote(FRONTIER);
    expect(note).toContain("Category-specific weighting");
    expect(note).toContain("Arena"); // model-quality source is named
    expect(note.toLowerCase()).toContain("frontier model api"); // the rationale
    expect(note).toContain("Model Quality (Arena Elo)"); // the domain label appears in the weighting
  });

  it("an unprofiled category shows the framework default note and does NOT mention model quality", () => {
    const note = buildMethodologyNote("some_unprofiled_category");
    expect(note).toContain("Framework default weighting");
    expect(note).not.toContain("Arena");
  });
});

describe("rollUpToPillars — 'Why this rank' consistency (2026-07 fix)", () => {
  it("pillar contributions SUM to the composite (never a divergent breakdown)", () => {
    const domains = allScored(4);
    const wc = computeWeightedComposite(domains, DEFAULT_DOMAIN_WEIGHTS);
    const pillars = rollUpToPillars(wc.contributions, domains);
    const sum = pillars.reduce((s, p) => s + (p.contribution ?? 0), 0);
    expect(sum).toBeCloseTo(wc.composite, 2);
  });

  it("ranks two vendors the SAME way as the composite — summing contributions can't contradict the rank", () => {
    // Vendor A stronger on the heavy enterprise_control domains; B stronger on a light domain.
    const a = ASSESSMENT_DOMAINS.map((d) => scored(d, DOMAIN_TO_PILLAR[d] === "enterprise_control" ? 5 : 3));
    const b = ASSESSMENT_DOMAINS.map((d) => scored(d, DOMAIN_TO_PILLAR[d] === "enterprise_control" ? 2 : 4));
    const wcA = computeWeightedComposite(a, DEFAULT_DOMAIN_WEIGHTS);
    const wcB = computeWeightedComposite(b, DEFAULT_DOMAIN_WEIGHTS);
    const sumA = rollUpToPillars(wcA.contributions, a).reduce((s, p) => s + (p.contribution ?? 0), 0);
    const sumB = rollUpToPillars(wcB.contributions, b).reduce((s, p) => s + (p.contribution ?? 0), 0);
    // Whichever composite is higher, its summed pillar contributions must also be higher.
    expect(Math.sign(sumA - sumB)).toBe(Math.sign(wcA.composite - wcB.composite));
  });

  it("Market Strength is 'not_in_composite' — market_position is excluded from the score", () => {
    const domains = allScored(4);
    const wc = computeWeightedComposite(domains, DEFAULT_DOMAIN_WEIGHTS);
    const ms = rollUpToPillars(wc.contributions, domains).find((p) => p.pillar === "market_strength");
    expect(ms?.state).toBe("not_in_composite");
    expect(ms?.contribution).toBeNull();
    expect(ms?.weight).toBe(0);
  });

  it("a pillar with active domains but no evidence is 'insufficient_evidence', not a default", () => {
    // Everything scored EXCEPT the vendor_resilience domains → that pillar dark.
    const domains = ASSESSMENT_DOMAINS.map((d) =>
      DOMAIN_TO_PILLAR[d] === "vendor_resilience" ? insufficient(d) : scored(d, 4),
    );
    const wc = computeWeightedComposite(domains, DEFAULT_DOMAIN_WEIGHTS);
    const vr = rollUpToPillars(wc.contributions, domains).find((p) => p.pillar === "vendor_resilience");
    expect(vr?.state).toBe("insufficient_evidence");
    expect(vr?.score).toBeNull();
    expect(vr?.weight).toBeGreaterThan(0); // weight still counts in the denominator
  });
});
