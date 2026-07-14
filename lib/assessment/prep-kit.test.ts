// Phase 3 Wave 4 (prep kit) — honesty + firewall tests.
// The kit turns REAL scorecard gaps into questions; it must never mutate the
// scorecard, never fabricate a fact, and turn insufficient evidence into an
// honest "ask them" question.

import { describe, it, expect } from "vitest";
import { DOMAIN_TO_PILLAR, type DomainId, type EvidenceGrade } from "../types";
import { ASSESSMENT_DOMAINS, type DomainScore, type DomainBand, type DomainBandLabel } from "./domain-rubric";
import type { VendorScorecard } from "./domain-scores";
import {
  deriveKitTargets,
  buildDomainDigest,
  buildStaticSections,
  assemblePrepKit,
  fallbackQuestions,
} from "./prep-kit";
import { parsePrepQuestions } from "../agents/prep-kit";

function scored(domain: DomainId, score: number, opts: { lowConf?: boolean } = {}): DomainScore {
  const grade: EvidenceGrade = "E4";
  return {
    domain, pillar: DOMAIN_TO_PILLAR[domain], state: "scored",
    score, band: Math.round(score) as DomainBand, bandLabel: "enterprise_ready" as DomainBandLabel,
    confidence: opts.lowConf ? 30 : 80, lowConfidence: opts.lowConf ?? false,
    bestGrade: grade, evidenceCount: 2, citations: [],
  };
}
function insufficient(domain: DomainId): DomainScore {
  return { domain, pillar: DOMAIN_TO_PILLAR[domain], state: "insufficient_evidence" };
}

function scorecardOf(domains: DomainScore[]): VendorScorecard {
  const scoredCount = domains.filter((d) => d.state === "scored").length;
  return {
    vendorId: "v", domains, scoredCount,
    insufficientCount: domains.length - scoredCount,
    hasAnyEvidence: scoredCount > 0, totalEvidenceRows: scoredCount * 2, modelQuality: null, modelQualityCoding: null, devSentiment: null, marketPosition: null,
  };
}

describe("deriveKitTargets", () => {
  it("flags weak (≤ thin) + low-confidence scored domains, and insufficient domains", () => {
    const domains = ASSESSMENT_DOMAINS.map((d, i) =>
      i === 0 ? scored(d, 1.5) :          // weak by score
      i === 1 ? scored(d, 4, { lowConf: true }) : // weak by confidence
      i === 2 ? insufficient(d) :          // insufficient
      scored(d, 4),
    );
    const t = deriveKitTargets(scorecardOf(domains));
    expect(t.weak).toContain(ASSESSMENT_DOMAINS[0]);
    expect(t.weak).toContain(ASSESSMENT_DOMAINS[1]);
    expect(t.insufficient).toContain(ASSESSMENT_DOMAINS[2]);
    expect(t.contextAdjusted).toBe(false);
    // a strong, high-confidence domain is NOT flagged
    expect(t.weak).not.toContain(ASSESSMENT_DOMAINS[3]);
  });

  it("does not mutate the scorecard (pure)", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, 4));
    const sc = scorecardOf(domains);
    const snap = JSON.stringify(sc);
    deriveKitTargets(sc);
    expect(JSON.stringify(sc)).toBe(snap);
  });

  it("prefers the W3 context-adjusted weak domains when supplied", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, 4));
    // one insufficient so we can check partitioning
    domains[5] = insufficient(ASSESSMENT_DOMAINS[5]);
    const contextWeak: DomainId[] = [ASSESSMENT_DOMAINS[5], ASSESSMENT_DOMAINS[6]];
    const t = deriveKitTargets(scorecardOf(domains), contextWeak);
    expect(t.contextAdjusted).toBe(true);
    expect(t.insufficient).toContain(ASSESSMENT_DOMAINS[5]); // partitioned to insufficient
    expect(t.weak).toContain(ASSESSMENT_DOMAINS[6]); // partitioned to weak
  });
});

describe("fallbackQuestions (honesty)", () => {
  it("frames insufficient domains as an honest 'ask them', never a fabricated claim", () => {
    const targets = { weak: [] as DomainId[], insufficient: [ASSESSMENT_DOMAINS[4]], contextAdjusted: false };
    const qs = fallbackQuestions(targets);
    const q = qs.find((x) => x.domain === ASSESSMENT_DOMAINS[4])!;
    expect(q.askTheVendor).toBe(true);
    expect(q.question.toLowerCase()).toContain("demonstrate");
    // it asks — it does not assert the vendor lacks the capability
    expect(q.question).not.toMatch(/you (do not|don't|cannot|can't|lack|fail)/i);
  });

  it("produces at least 8 and at most 12 questions", () => {
    const targets = { weak: [ASSESSMENT_DOMAINS[0]], insufficient: [] as DomainId[], contextAdjusted: false };
    const qs = fallbackQuestions(targets);
    expect(qs.length).toBeGreaterThanOrEqual(8);
    expect(qs.length).toBeLessThanOrEqual(12);
  });
});

describe("assemblePrepKit", () => {
  it("includes the tailored questions + all 4 deterministic framework sections", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, 4));
    const sc = scorecardOf(domains);
    const targets = deriveKitTargets(sc);
    const kit = assemblePrepKit({
      vendorId: "v", vendorName: "Acme", scorecard: sc, targets,
      questions: fallbackQuestions({ weak: [ASSESSMENT_DOMAINS[0]], insufficient: [], contextAdjusted: false }),
      source: "stub",
    });
    expect(kit.rfp.items.length).toBeGreaterThan(0);
    expect(kit.poc.items.length).toBeGreaterThan(0);
    expect(kit.referenceBank.items.length).toBeGreaterThan(0);
    expect(kit.readiness.items.length).toBeGreaterThan(0);
    expect(kit.questions.length).toBeGreaterThan(0);
    expect(kit.draftNote.toLowerCase()).toContain("draft");
  });

  it("static sections are identical regardless of vendor (no per-vendor fabrication)", () => {
    const a = buildStaticSections();
    const b = buildStaticSections();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("parsePrepQuestions (anti-fabrication)", () => {
  it("drops questions with an invalid/unknown domain and caps at 12", () => {
    const raw = {
      questions: [
        { domain: "data_security_privacy", question: "Show your data-flow diagram?", rationale: "weak", askTheVendor: false },
        { domain: "not_a_real_domain", question: "invented?", rationale: "x", askTheVendor: false },
        ...Array.from({ length: 15 }, () => ({ domain: "cost_finops", question: "TCO at our volume?", rationale: "r", askTheVendor: false })),
      ],
    };
    const qs = parsePrepQuestions(raw);
    expect(qs.length).toBeLessThanOrEqual(12);
    expect(qs.every((q) => ASSESSMENT_DOMAINS.includes(q.domain as DomainId))).toBe(true);
    expect(qs.find((q) => (q.domain as string) === "not_a_real_domain")).toBeUndefined();
  });

  it("drops empty questions", () => {
    const qs = parsePrepQuestions({ questions: [{ domain: "cost_finops", question: "   ", rationale: "", askTheVendor: false }] });
    expect(qs.length).toBe(0);
  });
});

describe("buildDomainDigest", () => {
  it("marks flagged (weak+insufficient) domains and never leaks a score for insufficient ones", () => {
    const domains = ASSESSMENT_DOMAINS.map((d, i) => (i === 0 ? insufficient(d) : scored(d, 4)));
    const sc = scorecardOf(domains);
    const targets = deriveKitTargets(sc);
    const digest = buildDomainDigest(sc, targets);
    const insuff = digest.find((x) => x.domain === ASSESSMENT_DOMAINS[0])!;
    expect(insuff.state).toBe("insufficient_evidence");
    expect(insuff.score).toBeNull();
    expect(insuff.weak).toBe(true);
  });
});
