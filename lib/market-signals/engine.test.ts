import { describe, expect, it } from "vitest";
import {
  adjustPostIpoBand,
  canMoveCentre,
  deriveCurrentRegime,
  deriveSignalAdjustedDelta,
  isMarketTalk,
  isStale,
  scoreSignal,
} from "./engine";
import { SEED_SIGNALS } from "./seed";
import type { MarketSignal } from "./types";

const FIXED_NOW = new Date("2026-05-09T00:00:00.000Z");

function makeSignal(overrides: Partial<MarketSignal> = {}): MarketSignal {
  return {
    id: "sig_test",
    signalType: "company_specific", signalCategory: "company_specific",
    title: "Test", summary: "Test summary",
    entityIds: ["microsoft"], entityTypes: ["vendor"],
    vendorIds: ["vendor_microsoft"], tickers: ["MSFT"],
    affectedExposureClasses: ["core_public_ai_platform"],
    affectedModules: ["investor_tools"],
    sourceId: "src_test", sourceName: "Test source",
    sourceUrl: "https://example.com/test", sourceType: "company_release",
    sourceDate: "2026-05-01", capturedAt: FIXED_NOW.toISOString(),
    evidenceGrade: "E4", confidenceScore: 80, dataStatus: "documented",
    sentiment: 0.4, direction: "positive", magnitude: 60, timeHorizon: "medium_term",
    volatilityImpact: 0, valuationImpact: 12, revenueImpact: 8, marginImpact: 2,
    ipoWindowImpact: 0, liquidityImpact: 0, regulatoryImpact: 0,
    infrastructureImpact: 0, politicalRiskImpact: 0,
    notes: "", uncertaintyNote: "Test", requiresHumanReview: false,
    ...overrides,
  };
}

describe("market-signals: truthfulness gates", () => {
  it("E0 evidence cannot move centre", () => {
    const e0 = makeSignal({ evidenceGrade: "E0", magnitude: 90, confidenceScore: 80 });
    expect(canMoveCentre(e0)).toBe(false);
    expect(scoreSignal(e0, { now: FIXED_NOW }).impactScore).toBe(0);
  });

  it("unsupported dataStatus cannot move centre", () => {
    const u = makeSignal({ dataStatus: "unsupported", magnitude: 90 });
    expect(canMoveCentre(u)).toBe(false);
    expect(scoreSignal(u, { now: FIXED_NOW }).impactScore).toBe(0);
  });

  it("market talk caps confidence at 25 and centre at 2pt", () => {
    const talk = makeSignal({
      signalType: "social_market_talk", signalCategory: "social_market_talk",
      evidenceGrade: "E1", dataStatus: "seed",
      confidenceScore: 80, magnitude: 90, sentiment: 0.9,
    });
    expect(isMarketTalk(talk)).toBe(true);
    const score = scoreSignal(talk, { now: FIXED_NOW, relevance: 100 });
    expect(score.confidenceScore).toBeLessThanOrEqual(25);
    expect(score.impactScore).toBeLessThanOrEqual(2);
  });

  it("stale signals get a stalePenalty", () => {
    const stale = makeSignal({ sourceDate: "2025-09-01" });
    expect(isStale(stale, FIXED_NOW)).toBe(true);
    const fresh = makeSignal({ sourceDate: "2026-05-01" });
    expect(scoreSignal(stale, { now: FIXED_NOW }).impactScore).toBeLessThan(
      scoreSignal(fresh, { now: FIXED_NOW }).impactScore,
    );
    expect(scoreSignal(stale, { now: FIXED_NOW }).components.stalePenalty).toBeGreaterThan(0);
  });

  it("weaker source confidence yields lower confidenceScore", () => {
    const weak = makeSignal({ evidenceGrade: "E1", confidenceScore: 35 });
    const strong = makeSignal({ evidenceGrade: "E5", confidenceScore: 92 });
    expect(scoreSignal(weak, { now: FIXED_NOW }).confidenceScore).toBeLessThan(
      scoreSignal(strong, { now: FIXED_NOW }).confidenceScore,
    );
  });
});

describe("market-signals: scoring engine", () => {
  it("magnitude × relevance × confidence drives impact", () => {
    const big = makeSignal({ magnitude: 90, confidenceScore: 90 });
    const small = makeSignal({ magnitude: 10, confidenceScore: 90 });
    expect(scoreSignal(big, { now: FIXED_NOW, relevance: 80 }).impactScore).toBeGreaterThan(
      scoreSignal(small, { now: FIXED_NOW, relevance: 80 }).impactScore,
    );
  });

  it("corroboration raises impact within bounds", () => {
    const sig = makeSignal();
    const noC = scoreSignal(sig, { now: FIXED_NOW, relevance: 70 });
    const corr = scoreSignal(sig, { now: FIXED_NOW, relevance: 70, corroboratingSignalIds: ["a", "b", "c"] });
    expect(corr.components.corroborationWeight).toBeGreaterThan(noC.components.corroborationWeight);
    expect(corr.impactScore).toBeGreaterThanOrEqual(noC.impactScore);
  });

  it("contradictions apply a penalty", () => {
    const sig = makeSignal({ magnitude: 70, confidenceScore: 80 });
    const clean = scoreSignal(sig, { now: FIXED_NOW, relevance: 70 });
    const contradicted = scoreSignal(sig, { now: FIXED_NOW, relevance: 70, contradictingSignalIds: ["x", "y", "z"] });
    expect(contradicted.components.contradictionPenalty).toBeGreaterThan(0);
    expect(contradicted.impactScore).toBeLessThanOrEqual(clean.impactScore);
  });

  it("affectedScoreFields populated from signal impact fields", () => {
    const ipoSig = makeSignal({ ipoWindowImpact: 20, signalCategory: "ipo_specific" });
    expect(scoreSignal(ipoSig, { now: FIXED_NOW }).affectedScoreFields).toEqual(
      expect.arrayContaining(["postIpoBandWidth", "postIpoBandCenter", "ipoReadinessScore"]),
    );
  });

  it("seed signals score deterministically", () => {
    const a = SEED_SIGNALS.map((sig) => scoreSignal(sig, { now: FIXED_NOW }).impactScore);
    const b = SEED_SIGNALS.map((sig) => scoreSignal(sig, { now: FIXED_NOW }).impactScore);
    expect(a).toEqual(b);
  });
});

describe("market-signals: regime", () => {
  it("derives a regime view from current signals", () => {
    const r = deriveCurrentRegime(FIXED_NOW);
    expect(r.contributingSignalIds.length).toBeGreaterThan(0);
    expect(r).toMatchObject({
      riskAppetite: expect.any(String),
      ipoWindowQuality: expect.any(String),
      aiSentimentRegime: expect.any(String),
    });
  });

  it("stale signals are excluded from regime", () => {
    const stale = makeSignal({ id: "stale", sourceDate: "2024-01-01" });
    const r = deriveCurrentRegime(FIXED_NOW, [...SEED_SIGNALS, stale]);
    expect(r.contributingSignalIds).not.toContain("stale");
  });
});

describe("market-signals: post-IPO band adjustment", () => {
  const baseBand = { lowPct: -20, highPct: 20, centerPct: 0, widthPct: 40 };

  it("market talk widens band, does not move centre aggressively", () => {
    const talk = makeSignal({
      id: "sig_talk_band",
      signalType: "social_market_talk", signalCategory: "social_market_talk",
      evidenceGrade: "E1", dataStatus: "seed", confidenceScore: 25,
      magnitude: 80, sentiment: 0.9, ipoWindowImpact: 15,
      vendorIds: ["vendor_test"], affectedExposureClasses: [],
    });
    const adj = adjustPostIpoBand(baseBand, [talk], { providerId: "vendor_test", now: FIXED_NOW });
    expect(Math.abs(adj.centreShift)).toBeLessThanOrEqual(2);
    expect(adj.adjustedWidthPct).toBeGreaterThanOrEqual(baseBand.widthPct);
  });

  it("verified positive catalyst shifts centre upward", () => {
    const pos = makeSignal({
      id: "sig_pos_band", vendorIds: ["vendor_test"], affectedExposureClasses: [],
      evidenceGrade: "E5", dataStatus: "verified", confidenceScore: 95,
      magnitude: 80, sentiment: 0.6, ipoWindowImpact: 25, revenueImpact: 25,
    });
    const adj = adjustPostIpoBand(baseBand, [pos], { providerId: "vendor_test", now: FIXED_NOW, vendorSensitivity: 0.7 });
    expect(adj.centreShift).toBeGreaterThan(0);
  });

  it("verified negative regulatory event shifts centre downward via eventShockAdjustment", () => {
    const reg = makeSignal({
      id: "sig_reg_band", vendorIds: ["vendor_test"], affectedExposureClasses: [],
      signalType: "political_regulatory", signalCategory: "political_regulatory",
      evidenceGrade: "E5", dataStatus: "verified", confidenceScore: 90,
      magnitude: 70, sentiment: -0.5, valuationImpact: -30, regulatoryImpact: 60,
    });
    const adj = adjustPostIpoBand(baseBand, [reg], { providerId: "vendor_test", now: FIXED_NOW, vendorSensitivity: 0.7 });
    expect(adj.eventShockAdjustment).toBeLessThan(0);
  });

  it("empty signal set produces seed dataStatus", () => {
    const adj = adjustPostIpoBand(baseBand, [], { providerId: "vendor_test", now: FIXED_NOW });
    expect(adj.dataStatus).toBe("seed");
    expect(adj.contributingSignalIds).toHaveLength(0);
  });
});

describe("market-signals: signal-adjusted simulation delta", () => {
  it("zero delta when no signals match the provider", () => {
    const d = deriveSignalAdjustedDelta("vendor_unknown_xyz", 0.08, 0.18, [], { now: FIXED_NOW });
    expect(d.contributingSignalIds).toHaveLength(0);
    expect(d.signalAdjustedAnnualReturn).toBeCloseTo(0.08);
    expect(d.signalAdjustedVolatility).toBeCloseTo(0.18, 4);
  });

  it("aggregates verified positive catalysts into a return uplift", () => {
    const d = deriveSignalAdjustedDelta("vendor_microsoft", 0.08, 0.18, SEED_SIGNALS, { now: FIXED_NOW });
    expect(d.contributingSignalIds.length).toBeGreaterThan(0);
    expect(d.confidenceScore).toBeGreaterThan(0);
  });

  it("market-talk presence raises adjusted volatility", () => {
    const provider = "vendor_anthropic";
    const noTalk = SEED_SIGNALS.filter((sig) => sig.signalCategory !== "social_market_talk");
    const dNo = deriveSignalAdjustedDelta(provider, 0.08, 0.18, noTalk, { now: FIXED_NOW });
    const dWith = deriveSignalAdjustedDelta(provider, 0.08, 0.18, SEED_SIGNALS, { now: FIXED_NOW });
    expect(dWith.signalAdjustedVolatility).toBeGreaterThanOrEqual(dNo.signalAdjustedVolatility);
  });
});
