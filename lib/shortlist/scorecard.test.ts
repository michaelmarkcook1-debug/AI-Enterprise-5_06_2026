import { describe, it, expect } from "vitest";
import { buildVendorCard, type VendorCardInput } from "./scorecard";
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
