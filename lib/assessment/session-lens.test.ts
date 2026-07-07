// Phase 3 Wave 3 (Interrogate) — firewall + honesty tests.
// The buyer's context is a PERSONAL LENS: it may re-weight + explain, but it must
// never rewrite a canonical 0–5 score, conjure evidence, or lift a thin vendor.

import { describe, it, expect } from "vitest";
import { DOMAIN_TO_PILLAR, type DomainId, type EvidenceGrade } from "../types";
import {
  ASSESSMENT_DOMAINS,
  type DomainScore,
  type DomainBand,
  type DomainBandLabel,
} from "./domain-rubric";
import {
  DEFAULT_DOMAIN_WEIGHTS,
  normalizeWeights,
  activeDomains,
  type DomainWeights,
} from "./composite";
import {
  applyContextLens,
  buildSessionLens,
  buildEvidenceSnapshot,
  THIN_SCORE,
  type SessionLensVendorInput,
} from "./session-lens";
import { parseContextLens, type WeightAdjustment } from "../agents/composite-lens";

function scored(domain: DomainId, score: number, opts: { grade?: EvidenceGrade; conf?: number; lowConf?: boolean; url?: string } = {}): DomainScore {
  const grade: EvidenceGrade = opts.grade ?? "E4";
  return {
    domain,
    pillar: DOMAIN_TO_PILLAR[domain],
    state: "scored",
    score,
    band: Math.round(score) as DomainBand,
    bandLabel: "enterprise_ready" as DomainBandLabel,
    confidence: opts.conf ?? 80,
    lowConfidence: opts.lowConf ?? false,
    bestGrade: grade,
    evidenceCount: 2,
    citations: opts.url ? [{ sourceUrl: opts.url, evidenceGrade: grade, capturedAt: "2026-06-01T00:00:00.000Z" }] : [],
  };
}
function insufficient(domain: DomainId): DomainScore {
  return { domain, pillar: DOMAIN_TO_PILLAR[domain], state: "insufficient_evidence" };
}

const allScored = (score = 4): DomainScore[] => ASSESSMENT_DOMAINS.map((d) => scored(d, score, { url: `https://ex.com/${d}` }));

const adj = (domain: DomainId, weightDelta: number, decisive = false): WeightAdjustment => ({
  domain,
  weightDelta,
  decisive,
  rationale: `context nudges ${domain}`,
  citations: [],
});

describe("applyContextLens", () => {
  it("does not mutate the base weights or the adjustments", () => {
    const base = { ...DEFAULT_DOMAIN_WEIGHTS };
    const baseSnap = JSON.stringify(base);
    const adjustments = [adj("data_security_privacy", 0.08, true)];
    const adjSnap = JSON.stringify(adjustments);
    applyContextLens(base, adjustments);
    expect(JSON.stringify(base)).toBe(baseSnap);
    expect(JSON.stringify(adjustments)).toBe(adjSnap);
  });

  it("renormalizes to sum 1 over the active domains", () => {
    const out = applyContextLens(DEFAULT_DOMAIN_WEIGHTS, [adj("cost_finops", 0.1)]);
    const sum = activeDomains(DEFAULT_DOMAIN_WEIGHTS).reduce((s, d) => s + out[d], 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it("clamps a runaway delta to +0.1 (can't seize the whole weight budget)", () => {
    const clamped = applyContextLens(DEFAULT_DOMAIN_WEIGHTS, [adj("cost_finops", 5)]);
    const honest = applyContextLens(DEFAULT_DOMAIN_WEIGHTS, [adj("cost_finops", 0.1)]);
    expect(clamped.cost_finops).toBeCloseTo(honest.cost_finops, 9);
  });

  it("raising a domain increases its normalized share", () => {
    const before = normalizeWeights(DEFAULT_DOMAIN_WEIGHTS).governance_compliance;
    const after = applyContextLens(DEFAULT_DOMAIN_WEIGHTS, [adj("governance_compliance", 0.1, true)]).governance_compliance;
    expect(after).toBeGreaterThan(before);
  });

  it("ignores a delta for a domain NOT active in the profile (can't add a domain)", () => {
    // model_quality is absent from DEFAULT_DOMAIN_WEIGHTS → inactive.
    const out = applyContextLens(DEFAULT_DOMAIN_WEIGHTS, [adj("model_quality" as DomainId, 0.1)]);
    expect(out.model_quality).toBeUndefined();
    expect(activeDomains(out)).toEqual(activeDomains(DEFAULT_DOMAIN_WEIGHTS));
  });

  it("APPLIES a model_quality delta when the profile activates it (frontier categories)", () => {
    // Regression for the review finding: frontier profiles include model_quality
    // in the active set, so the lens must be able to re-weight it.
    const frontierBase = { ...DEFAULT_DOMAIN_WEIGHTS, model_quality: 0.08 } as DomainWeights;
    expect(activeDomains(frontierBase)).toContain("model_quality");
    const before = normalizeWeights(frontierBase).model_quality;
    const after = applyContextLens(frontierBase, [adj("model_quality", 0.1, true)]).model_quality;
    expect(after).toBeGreaterThan(before);
  });
});

describe("buildSessionLens — the firewall", () => {
  it("NEVER mutates the canonical domain scores (weights are a read-only lens)", () => {
    const vendors: SessionLensVendorInput[] = [{ vendorId: "a", domains: allScored(4) }];
    const snap = JSON.stringify(vendors);
    buildSessionLens({
      scope: { kind: "vendor", id: "a" },
      baseWeights: DEFAULT_DOMAIN_WEIGHTS,
      adjustments: [adj("data_security_privacy", 0.1, true), adj("cost_finops", -0.05)],
      vendors,
      overallNote: "x",
      insufficientContext: false,
    });
    expect(JSON.stringify(vendors)).toBe(snap);
  });

  it("insufficient stays insufficient; re-weighting cannot score it into existence", () => {
    const domains = ASSESSMENT_DOMAINS.map((d, i) => (i < 8 ? scored(d, 4) : insufficient(d)));
    const lens = buildSessionLens({
      scope: { kind: "vendor", id: "a" },
      baseWeights: DEFAULT_DOMAIN_WEIGHTS,
      // pour weight onto an insufficient domain
      adjustments: [adj(ASSESSMENT_DOMAINS[10], 0.1, true)],
      vendors: [{ vendorId: "a", domains }],
      overallNote: "x",
      insufficientContext: false,
    });
    const v = lens.vendorLens[0];
    // rawCoverage is weight-independent → still 8/N, unchanged by the lens.
    expect(v.rawCoverage).toBeCloseTo(8 / ASSESSMENT_DOMAINS.length, 9);
  });

  it("a decisive + thin domain surfaces as 'ask the vendor', never a guess", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) =>
      d === "governance_compliance" ? insufficient(d) : scored(d, 4),
    );
    const lens = buildSessionLens({
      scope: { kind: "vendor", id: "a" },
      baseWeights: DEFAULT_DOMAIN_WEIGHTS,
      adjustments: [adj("governance_compliance", 0.1, true)],
      vendors: [{ vendorId: "a", domains }],
      overallNote: "x",
      insufficientContext: false,
    });
    expect(lens.vendorLens[0].weakDecisiveDomains).toContain("governance_compliance");
  });

  it("a decisive domain with a strong score is NOT flagged thin", () => {
    const lens = buildSessionLens({
      scope: { kind: "vendor", id: "a" },
      baseWeights: DEFAULT_DOMAIN_WEIGHTS,
      adjustments: [adj("data_security_privacy", 0.1, true)],
      vendors: [{ vendorId: "a", domains: allScored(4.5) }],
      overallNote: "x",
      insufficientContext: false,
    });
    expect(lens.vendorLens[0].weakDecisiveDomains).not.toContain("data_security_privacy");
  });

  it("a low-score decisive domain (≤ thin band) IS flagged", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) =>
      d === "cost_finops" ? scored(d, THIN_SCORE - 0.5) : scored(d, 4),
    );
    const lens = buildSessionLens({
      scope: { kind: "vendor", id: "a" },
      baseWeights: DEFAULT_DOMAIN_WEIGHTS,
      adjustments: [adj("cost_finops", 0.1, true)],
      vendors: [{ vendorId: "a", domains }],
      overallNote: "x",
      insufficientContext: false,
    });
    expect(lens.vendorLens[0].weakDecisiveDomains).toContain("cost_finops");
  });

  it("re-weighting cannot lift a held (thin-coverage) vendor into ranked", () => {
    // 5/12 evidenced → rawCoverage ≈ 0.42 < 0.6 floor.
    const domains = ASSESSMENT_DOMAINS.map((d, i) => (i < 5 ? scored(d, 5) : insufficient(d)));
    const lens = buildSessionLens({
      scope: { kind: "category", id: "c" },
      baseWeights: DEFAULT_DOMAIN_WEIGHTS,
      // concentrate ALL possible weight on the 5 evidenced domains
      adjustments: ASSESSMENT_DOMAINS.slice(0, 5).map((d) => adj(d, 0.1, true)),
      vendors: [{ vendorId: "a", domains }],
      overallNote: "x",
      insufficientContext: false,
    });
    expect(lens.vendorLens[0].ranked).toBe(false);
  });

  it("adjustedSliders cover the active domains and match the adjusted weights", () => {
    const lens = buildSessionLens({
      scope: { kind: "vendor", id: "a" },
      baseWeights: DEFAULT_DOMAIN_WEIGHTS,
      adjustments: [adj("integration_architecture", 0.08, true)],
      vendors: [{ vendorId: "a", domains: allScored(4) }],
      overallNote: "x",
      insufficientContext: false,
    });
    expect(Object.keys(lens.adjustedSliders).sort()).toEqual([...ASSESSMENT_DOMAINS].sort());
    for (const d of ASSESSMENT_DOMAINS) {
      expect(lens.adjustedSliders[d]).toBe(Math.round(lens.adjustedWeights[d] * 100));
    }
  });

  it("a real lens actually moves the composite (interrogation isn't a no-op)", () => {
    // Vendor strong on security, weak on cost. A lens that emphasizes security
    // should raise its composite vs the default weighting.
    const domains = ASSESSMENT_DOMAINS.map((d) =>
      d === "data_security_privacy" ? scored(d, 5) : d === "cost_finops" ? scored(d, 1) : scored(d, 3),
    );
    const lens = buildSessionLens({
      scope: { kind: "vendor", id: "a" },
      baseWeights: DEFAULT_DOMAIN_WEIGHTS,
      adjustments: [adj("data_security_privacy", 0.1, true), adj("cost_finops", -0.1)],
      vendors: [{ vendorId: "a", domains }],
      overallNote: "x",
      insufficientContext: false,
    });
    expect(lens.vendorLens[0].adjustedComposite).toBeGreaterThan(lens.vendorLens[0].baseComposite);
  });
});

describe("buildEvidenceSnapshot", () => {
  it("marks unevidenced domains insufficient and surfaces real citations for scored ones", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) =>
      d === "cost_finops" ? insufficient(d) : scored(d, 4, { url: `https://ex.com/${d}` }),
    );
    const snap = buildEvidenceSnapshot(activeDomains(DEFAULT_DOMAIN_WEIGHTS), [{ vendorId: "a", domains }]);
    const cost = snap.find((s) => s.domain === "cost_finops")!;
    expect(cost.state).toBe("insufficient_evidence");
    expect(cost.citations).toHaveLength(0);
    const sec = snap.find((s) => s.domain === "data_security_privacy")!;
    expect(sec.state).toBe("scored");
    expect(sec.citations[0].sourceUrl).toBe("https://ex.com/data_security_privacy");
  });
});

describe("parseContextLens — anti-fabrication guard", () => {
  const active = activeDomains(DEFAULT_DOMAIN_WEIGHTS);
  const snapshot = buildEvidenceSnapshot(active, [
    { vendorId: "a", domains: allScored(4) }, // every domain cites https://ex.com/<domain>
  ]);

  it("drops a citation whose sourceUrl was never in the snapshot (no conjured sources)", () => {
    const raw = {
      adjustments: [
        {
          domain: "data_security_privacy",
          weightDelta: 0.05,
          decisive: true,
          rationale: "ok",
          citations: [
            { sourceUrl: "https://ex.com/data_security_privacy", evidenceGrade: "E4" }, // real
            { sourceUrl: "https://fabricated.example/made-up", evidenceGrade: "E5" }, // invented
          ],
        },
      ],
      overallNote: "note",
      insufficientContext: false,
    };
    const lens = parseContextLens(raw, active, snapshot);
    const urls = lens.adjustments[0].citations.map((c) => c.sourceUrl);
    expect(urls).toContain("https://ex.com/data_security_privacy");
    expect(urls).not.toContain("https://fabricated.example/made-up");
  });

  it("drops an adjustment for an inactive domain and clamps deltas", () => {
    const raw = {
      adjustments: [
        { domain: "model_quality", weightDelta: 0.05, decisive: true, rationale: "x", citations: [] }, // inactive
        { domain: "cost_finops", weightDelta: 9, decisive: false, rationale: "y", citations: [] }, // clamp
      ],
      overallNote: "n",
      insufficientContext: false,
    };
    const lens = parseContextLens(raw, active, snapshot);
    expect(lens.adjustments.find((a) => a.domain === ("model_quality" as DomainId))).toBeUndefined();
    const cost = lens.adjustments.find((a) => a.domain === "cost_finops")!;
    expect(cost.weightDelta).toBe(0.1);
  });

  it("empty adjustments ⇒ insufficientContext true (honest under-claim)", () => {
    const lens = parseContextLens({ adjustments: [], overallNote: "", insufficientContext: false }, active, snapshot);
    expect(lens.insufficientContext).toBe(true);
  });

  it("KEEPS a model_quality adjustment when model_quality is in the active set", () => {
    // Regression: the tool enum now allows model_quality; parse must keep it when active.
    const frontierActive = [...active, "model_quality" as DomainId];
    const raw = {
      adjustments: [{ domain: "model_quality", weightDelta: 0.05, decisive: true, rationale: "frontier", citations: [] }],
      overallNote: "n",
      insufficientContext: false,
    };
    const lens = parseContextLens(raw, frontierActive, snapshot);
    expect(lens.adjustments.find((a) => a.domain === ("model_quality" as DomainId))).toBeDefined();
  });
});
