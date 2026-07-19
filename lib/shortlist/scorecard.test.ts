import { describe, it, expect } from "vitest";
import {
  buildVendorCard,
  positioningFromCategoryRank,
  applyPositioning,
  computeMomentum,
  applyMomentum,
  type VendorCardInput,
} from "./scorecard";
import type { ScoreHistoryPoint } from "../ranking/score-history";
import type { VendorScorecard } from "../assessment/domain-scores";
import type { DomainScore } from "../assessment/domain-rubric";
import type { DomainId } from "../types";
import type { VendorShield, MarkState } from "../shield/data";
import type { VendorEncroachment } from "../graph/encroachment-by-vendor";

const scored = (domain: string, score: number, low = false): DomainScore =>
  ({
    domain: domain as DomainId,
    pillar: "reliability_safety" as DomainScore["pillar"],
    state: "scored",
    score,
    band: Math.round(score) as never,
    bandLabel: "enterprise_ready" as never,
    confidence: low ? 40 : 80,
    lowConfidence: low,
    bestGrade: "E4" as never,
    evidenceCount: 3,
    citations: [{ sourceUrl: `https://ev/${domain}`, evidenceGrade: "E4" as never, capturedAt: "2026-07-01" }],
  }) as DomainScore;

const insufficient = (domain: string): DomainScore =>
  ({ domain: domain as DomainId, pillar: "reliability_safety" as DomainScore["pillar"], state: "insufficient_evidence" }) as DomainScore;

const scorecard = (domains: DomainScore[], marketPosition: DomainScore | null = null): VendorScorecard => ({
  vendorId: "x",
  domains,
  scoredCount: domains.filter((d) => d.state === "scored").length,
  insufficientCount: domains.filter((d) => d.state !== "scored").length,
  hasAnyEvidence: domains.some((d) => d.state === "scored"),
  totalEvidenceRows: 9,
  modelQuality: null,
  modelQualityCoding: null,
  devSentiment: null,
  marketPosition,
});

const mark = (state: MarkState, withSource = true) => ({
  state,
  note: "…",
  ...(withSource ? { source: { name: "Provider · terms", url: "https://vendor/terms" } } : {}),
});

const shield = (states: [MarkState, MarkState, MarkState, MarkState]): VendorShield => ({
  vendor: "Test",
  slug: "test",
  kind: "hosted-api",
  marks: { training: mark(states[0]), retention: mark(states[1]), indemnity: mark(states[2]), residency: mark(states[3]) },
});

const NO_ENC: VendorEncroachment = { encroachesOn: [], encroachedBy: [], mapped: false };
const entity = { id: "acme", slug: "acme", name: "Acme", primaryRole: "Model Provider" as const };
const base = (over: Partial<VendorCardInput>): VendorCardInput => ({
  entity,
  scorecard: scorecard([]),
  shield: null,
  encroachment: NO_ENC,
  shortlistSlugs: new Set(["acme"]),
  nameBySlug: new Map([["acme", "Acme"]]),
  ...over,
});

describe("buildVendorCard — risk axis", () => {
  it("is clear when the risk domains score high", () => {
    const c = buildVendorCard(base({ scorecard: scorecard([scored("model_reliability", 4.2), scored("security_threat", 4.0)]) }));
    expect(c.risk.state).toBe("clear");
  });
  it("leads with the WORST risk domain (a low security score → watch even if reliability is fine)", () => {
    const c = buildVendorCard(base({ scorecard: scorecard([scored("model_reliability", 4.5), scored("security_threat", 1.4)]) }));
    expect(c.risk.state).toBe("watch");
  });
  it("is insufficient — never clear — when no risk domain is evidenced", () => {
    const c = buildVendorCard(base({ scorecard: scorecard([insufficient("model_reliability"), insufficient("security_threat")]) }));
    expect(c.risk.state).toBe("insufficient");
  });
  it("won't claim clear on a low-confidence read", () => {
    const c = buildVendorCard(base({ scorecard: scorecard([scored("model_reliability", 4.4, true)]) }));
    expect(c.risk.state).toBe("caution");
  });
});

describe("buildVendorCard — privacy axis (Shield + fallback)", () => {
  it("is clear when all four marks are protective", () => {
    const c = buildVendorCard(base({ shield: shield(["protective", "protective", "protective", "protective"]) }));
    expect(c.privacy.state).toBe("clear");
    expect(c.privacy.coverageNote).toBe("4 of 4 marks verified");
  });
  it("is watch when any mark is adverse, and names it", () => {
    const c = buildVendorCard(base({ shield: shield(["adverse", "protective", "protective", "protective"]) }));
    expect(c.privacy.state).toBe("watch");
    expect(c.privacy.summary.toLowerCase()).toContain("training");
  });
  it("falls back to the data_security_privacy domain when out of Shield scope", () => {
    const c = buildVendorCard(base({ shield: null, scorecard: scorecard([scored("data_security_privacy", 4.1)]) }));
    expect(c.privacy.state).toBe("clear");
  });
  it("is insufficient when out of scope AND no privacy evidence (never an optimistic default)", () => {
    const c = buildVendorCard(base({ shield: null, scorecard: scorecard([]) }));
    expect(c.privacy.state).toBe("insufficient");
  });
});

describe("buildVendorCard — encroachment axis (the flagship)", () => {
  const rival = { vendorSlug: "cursor", rationale: "…", sourceUrls: ["https://src"], strength: 55, confidence: 40 };

  it("is WATCH and names the overlap when a rival is also in the shortlist", () => {
    const c = buildVendorCard(base({
      encroachment: { encroachesOn: [rival], encroachedBy: [], mapped: true },
      shortlistSlugs: new Set(["acme", "cursor"]),
      nameBySlug: new Map([["acme", "Acme"], ["cursor", "Cursor"]]),
    }));
    expect(c.encroachment.state).toBe("watch");
    expect(c.encroachment.summary).toContain("Cursor");
    expect(c.encroachment.derived).toBe(true);
    // and it becomes the card headline (answer-first priority), flagged derived
    // so the collapsed view labels the inference too
    expect(c.headline?.text).toContain("Cursor");
    expect(c.headline?.derived).toBe(true);
  });
  it("is only CAUTION when it has edges but none touch the shortlist", () => {
    const c = buildVendorCard(base({
      encroachment: { encroachesOn: [rival], encroachedBy: [], mapped: true },
      shortlistSlugs: new Set(["acme"]), // cursor NOT in the list
      nameBySlug: new Map([["acme", "Acme"]]),
    }));
    expect(c.encroachment.state).toBe("caution");
  });
  it("is clear when mapped with no edges, insufficient when not mapped at all", () => {
    expect(buildVendorCard(base({ encroachment: { encroachesOn: [], encroachedBy: [], mapped: true } })).encroachment.state).toBe("clear");
    expect(buildVendorCard(base({ encroachment: NO_ENC })).encroachment.state).toBe("insufficient");
  });
});

describe("buildVendorCard — positioning + coverage", () => {
  it("is insufficient with a null market position (honest, not faked)", () => {
    expect(buildVendorCard(base({})).positioning.state).toBe("insufficient");
  });
  it("maps a cited market-position band", () => {
    const c = buildVendorCard(base({ scorecard: scorecard([], scored("market_position", 4.3)) }));
    expect(c.positioning.state).toBe("clear");
  });
  it("counts coverage honestly across the four axes", () => {
    const c = buildVendorCard(base({
      scorecard: scorecard([scored("model_reliability", 4)], scored("market_position", 4)),
      shield: shield(["protective", "protective", "protective", "protective"]),
      encroachment: { encroachesOn: [], encroachedBy: [], mapped: true },
    }));
    expect(c.coverage).toEqual({ evidenced: 4, total: 4 });
  });
});

describe("category-rank positioning (follow-up 1)", () => {
  it("maps tiers to states: Leaders→clear, Contenders→caution, Emerging→watch, none→caution", () => {
    expect(positioningFromCategoryRank(1, "Leaders", 12, "Frontier model/API").state).toBe("clear");
    expect(positioningFromCategoryRank(5, "Contenders", 12, "Frontier model/API").state).toBe("caution");
    expect(positioningFromCategoryRank(10, "Emerging", 12, "Frontier model/API").state).toBe("watch");
    expect(positioningFromCategoryRank(3, null, 12, "Frontier model/API").state).toBe("caution");
  });
  it("summary names rank, total, category and tier", () => {
    const r = positioningFromCategoryRank(2, "Leaders", 14, "Frontier model/API");
    expect(r.summary).toContain("#2 of 14");
    expect(r.summary).toContain("Frontier model/API");
    expect(r.summary).toContain("Leaders");
  });
  it("applyPositioning swaps the axis, recomputes coverage, and never mutates the base card", () => {
    // base has a null market position → positioning insufficient (3 of 4 axes here)
    const b = buildVendorCard(base({
      scorecard: scorecard([scored("model_reliability", 4)]),
      shield: shield(["protective", "protective", "protective", "protective"]),
      encroachment: { encroachesOn: [], encroachedBy: [], mapped: true },
    }));
    expect(b.positioning.state).toBe("insufficient");
    expect(b.coverage.evidenced).toBe(3);

    const next = applyPositioning(b, positioningFromCategoryRank(2, "Leaders", 14, "Frontier model/API"));
    expect(next.positioning.state).toBe("clear");
    expect(next.coverage.evidenced).toBe(4); // +1 now that positioning is evidenced
    expect(b.positioning.state).toBe("insufficient"); // base object untouched
    expect(b.coverage.evidenced).toBe(3);
  });
});

describe("computeMomentum — real-snapshot movement (follow-up 2)", () => {
  const pt = (date: string, composite: number | null, source: ScoreHistoryPoint["source"] = "snapshot"): ScoreHistoryPoint => ({
    date, composite, rank: null, pillars: [], source,
  });

  it("returns null with fewer than two real points", () => {
    expect(computeMomentum([])).toBeNull();
    expect(computeMomentum([pt("2026-07-01", 3.2)])).toBeNull();
  });

  it("computes the delta between the two most recent REAL snapshots", () => {
    const m = computeMomentum([pt("2026-06-01", 3.0), pt("2026-06-15", 3.2), pt("2026-07-01", 3.5)]);
    expect(m).toMatchObject({ delta: 0.3, fromDate: "2026-06-15", toDate: "2026-07-01" });
  });

  it("NEVER compares against a reconstructed point — only real snapshots count", () => {
    // A reconstructed point sits between two real ones; it must be skipped, not
    // used as "the previous point" (that would present interpolation as movement).
    const m = computeMomentum([
      pt("2026-05-01", 2.0),
      pt("2026-06-01", 4.0, "reconstructed"), // must be ignored
      pt("2026-07-01", 2.1),
    ]);
    expect(m).toMatchObject({ delta: 0.1, fromDate: "2026-05-01", toDate: "2026-07-01" });
  });

  it("flags material only at/above the 0.15 threshold, in either direction", () => {
    expect(computeMomentum([pt("2026-06-01", 3.0), pt("2026-07-01", 3.10)])!.material).toBe(false);
    expect(computeMomentum([pt("2026-06-01", 3.0), pt("2026-07-01", 3.15)])!.material).toBe(true);
    expect(computeMomentum([pt("2026-06-01", 3.0), pt("2026-07-01", 2.80)])!.material).toBe(true);
  });

  it("null composite points are excluded from the real-snapshot set", () => {
    const m = computeMomentum([pt("2026-06-01", 3.0), pt("2026-06-20", null), pt("2026-07-01", 3.4)]);
    expect(m).toMatchObject({ fromDate: "2026-06-01", toDate: "2026-07-01" });
  });
});

describe("applyMomentum — headline interaction", () => {
  it("a material DROP outranks a routine caution in the headline", () => {
    const b = buildVendorCard(base({ scorecard: scorecard([scored("model_reliability", 2.5)]) })); // → caution
    expect(b.headline?.text).toContain("reliability"); // sanity: caution is the headline pre-momentum
    const withDrop = applyMomentum(b, { delta: -0.4, fromDate: "2026-06-01", toDate: "2026-07-01", material: true });
    expect(withDrop.headline?.text).toContain("down 0.40");
  });

  it("a material RISE surfaces as the headline when nothing else does", () => {
    const b = buildVendorCard(base({})); // no axes evidenced → no headline pre-momentum
    expect(b.headline).toBeNull();
    const withRise = applyMomentum(b, { delta: 0.5, fromDate: "2026-06-01", toDate: "2026-07-01", material: true });
    expect(withRise.headline?.text).toContain("up 0.50");
  });

  it("cross-shortlist encroachment still wins over momentum (the flagship stays first)", () => {
    const rival = { vendorSlug: "cursor", rationale: "…", sourceUrls: ["https://src"], strength: 55, confidence: 40 };
    const b = buildVendorCard(base({
      encroachment: { encroachesOn: [rival], encroachedBy: [], mapped: true },
      shortlistSlugs: new Set(["acme", "cursor"]),
      nameBySlug: new Map([["acme", "Acme"], ["cursor", "Cursor"]]),
    }));
    const withDrop = applyMomentum(b, { delta: -0.8, fromDate: "2026-06-01", toDate: "2026-07-01", material: true });
    expect(withDrop.headline?.text).toContain("Cursor");
  });

  it("a non-material delta never becomes the headline", () => {
    const b = buildVendorCard(base({}));
    const withTiny = applyMomentum(b, { delta: 0.05, fromDate: "2026-06-01", toDate: "2026-07-01", material: false });
    expect(withTiny.headline).toBeNull();
  });

  it("does not mutate the base card", () => {
    const b = buildVendorCard(base({}));
    applyMomentum(b, { delta: 0.5, fromDate: "2026-06-01", toDate: "2026-07-01", material: true });
    expect(b.momentum).toBeNull();
  });
});
