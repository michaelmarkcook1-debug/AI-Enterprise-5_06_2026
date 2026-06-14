import { describe, expect, it } from "vitest";
import { DEFAULT_RISK_SHOCK } from "./seed";
import {
  calculateIndirectExposureScore,
  calculateScatterDomain,
  calculateWorstDrawdown,
  classifyIpoForecast,
  compatiblePrivateExposureOptions,
  createSimulationState,
  defaultPrivateExposureForUniverse,
  eligibleUniverseFor,
  generateRandomShock,
  getSeedPortfolio,
  portfolioAiExposureScore,
  portfolioConfidenceScore,
  portfolioQualityScore,
  portfolioSpeculationScore,
  simulatePortfolio,
  validateSimulationAllocation,
  validatePortfolio,
} from "./simulator";

describe("investment simulator portfolio construction", () => {
  it("allocates to 100% including cash reserve", () => {
    const portfolio = getSeedPortfolio({ cashReservePct: 12, investmentUniverse: "public_and_indirect" });
    const total = portfolio.holdings.reduce((sum, holding) => sum + holding.weightPct, 0);

    expect(total).toBeCloseTo(100, 1);
    expect(portfolio.holdings.find((holding) => holding.providerId === "cash")?.weightPct).toBeCloseTo(12, 1);
  });

  it("does not treat private inaccessible providers as direct holdings", () => {
    const portfolio = getSeedPortfolio({ investmentUniverse: "speculative_all" });

    expect(portfolio.holdings.some((holding) => holding.providerId === "harvey" && holding.isDirectlyInvestable)).toBe(false);
    expect(() => validatePortfolio({
      ...portfolio,
      holdings: [{ providerId: "harvey", weightPct: 100, amount: 10000, exposureType: "private_inaccessible", isDirectlyInvestable: true, confidence: 50 }],
    })).toThrow("private inaccessible");
  });

  it("separates public-only and IPO-watch universes", () => {
    const publicOnly = eligibleUniverseFor({ investmentUniverse: "public_only" });
    const ipoWatch = eligibleUniverseFor({ investmentUniverse: "ipo_watch" });

    expect(publicOnly.every((provider) => provider.publicStatus === "public")).toBe(true);
    expect(publicOnly.some((provider) => provider.id === "openai")).toBe(false);
    expect(ipoWatch.every((provider) => provider.publicStatus === "private")).toBe(true);
    expect(ipoWatch.some((provider) => provider.id === "msft")).toBe(false);
  });

  it("validates manual allocation totals including cash reserve", () => {
    const valid = validateSimulationAllocation({
      allocationStyle: "manual",
      investmentUniverse: "public_only",
      cashReservePct: 8,
      selectedVendorIds: ["msft", "nvda"],
      manualAllocations: { msft: 52, nvda: 40 },
    });
    const invalid = validateSimulationAllocation({
      allocationStyle: "manual",
      investmentUniverse: "public_only",
      cashReservePct: 8,
      selectedVendorIds: ["msft"],
      manualAllocations: { msft: 50 },
    });

    expect(valid.isValid).toBe(true);
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.join(" ")).toContain("short");
  });

  it("blocks IPO-watch universe from public direct holdings", () => {
    const validation = validateSimulationAllocation({
      allocationStyle: "manual",
      investmentUniverse: "ipo_watch",
      cashReservePct: 0,
      selectedVendorIds: ["msft"],
      manualAllocations: { msft: 100 },
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors.join(" ")).toContain("IPO Watch cannot include public direct holdings");
  });

  it("allows valid IPO-watch manual allocations to private watchlist providers", () => {
    const state = createSimulationState({
      allocationStyle: "manual",
      investmentUniverse: "ipo_watch",
      includePrivateExposure: "ipo_watchlist",
      cashReservePct: 0,
      selectedVendorIds: ["openai"],
      manualAllocations: { openai: 100 },
    });

    expect(state.errors).toEqual([]);
    expect(state.result).not.toBeNull();
  });

  it("normalises incompatible private exposure choices by investment universe", () => {
    const publicOnly = createSimulationState({
      investmentUniverse: "public_only",
      includePrivateExposure: "ipo_watchlist",
    });
    const ipoWatch = createSimulationState({
      investmentUniverse: "ipo_watch",
      includePrivateExposure: "indirect_only",
    });

    expect(compatiblePrivateExposureOptions("public_only")).toEqual(["no"]);
    expect(defaultPrivateExposureForUniverse("ipo_watch")).toBe("ipo_watchlist");
    expect(publicOnly.input.includePrivateExposure).toBe("no");
    expect(ipoWatch.input.includePrivateExposure).toBe("ipo_watchlist");
  });
});

describe("investment simulator scenarios", () => {
  it("calculates deterministic scenario paths", () => {
    const portfolio = getSeedPortfolio({ startingCapital: 10000, horizonYears: 3 });
    const first = simulatePortfolio(portfolio);
    const second = simulatePortfolio(portfolio);

    expect(first.basePath).toEqual(second.basePath);
    // Monthly resolution: 1 starting point + (horizonYears × 12) monthly points.
    expect(first.basePath).toHaveLength(1 + 3 * 12);
    expect(first.bullValue).toBeGreaterThan(first.baseValue);
    expect(first.stressValue).toBeLessThan(first.baseValue);
  });

  it("calculates worst drawdown from path lows versus prior peaks", () => {
    expect(calculateWorstDrawdown([
      { year: 0, value: 100 },
      { year: 1, value: 120 },
      { year: 2, value: 90 },
    ])).toBeCloseTo(-25, 1);
  });

  it("applies risk shocks to reduce stress scenario value", () => {
    const portfolio = getSeedPortfolio({ investmentUniverse: "ipo_watch" });
    const normal = simulatePortfolio(portfolio);
    const shocked = simulatePortfolio(portfolio, undefined, { ...DEFAULT_RISK_SHOCK, valuationCompressionPct: 25, ipoLockupSelloffPct: 35 });

    expect(shocked.stressValue).toBeLessThan(normal.stressValue);
  });

  it("generates random shock metadata with timing and state impact", () => {
    const shock = generateRandomShock(5, "public_and_indirect", "balanced", "test-seed");
    const normal = createSimulationState({ investmentUniverse: "public_and_indirect" });
    const shocked = createSimulationState({ investmentUniverse: "public_and_indirect" }, undefined, shock);

    expect(shock.shockYear).toBeGreaterThanOrEqual(1);
    expect(shock.shockQuarter).toBeGreaterThanOrEqual(1);
    expect(shock.displayMessage).toContain("Shock applied");
    expect(shocked.stateHash).not.toBe(normal.stateHash);
    expect(shocked.shocks[0]?.shockId).toBe(shock.shockId);
  });

  it("updates state hash when key inputs change", () => {
    const balanced = createSimulationState({ riskProfile: "balanced", cashReservePct: 8 });
    const aggressive = createSimulationState({ riskProfile: "aggressive", cashReservePct: 8 });
    const moreCash = createSimulationState({ riskProfile: "balanced", cashReservePct: 15 });

    expect(balanced.stateHash).not.toBe(aggressive.stateHash);
    expect(balanced.stateHash).not.toBe(moreCash.stateHash);
  });
});

describe("investment simulator scoring", () => {
  it("calculates AI exposure, quality, speculation, and confidence scores", () => {
    const portfolio = getSeedPortfolio({ investmentUniverse: "ipo_watch", riskProfile: "aggressive" });

    expect(portfolioAiExposureScore(portfolio)).toBeGreaterThan(40);
    expect(portfolioQualityScore(portfolio)).toBeGreaterThan(60);
    expect(portfolioSpeculationScore(portfolio)).toBeGreaterThan(40);
    expect(portfolioConfidenceScore(portfolio)).toBeGreaterThan(50);
  });

  it("scores indirect exposure with dilution/noise penalty", () => {
    const strong = calculateIndirectExposureScore({
      privateProviderId: "openai",
      publicTicker: "MSFT",
      exposureType: "strategic",
      exposureStrength: 0.8,
      revenueLinkage: 0.7,
      confidence: 0.75,
      dilutionPenalty: 0.2,
    });
    const diluted = calculateIndirectExposureScore({
      privateProviderId: "openai",
      publicTicker: "MSFT",
      exposureType: "strategic",
      exposureStrength: 0.8,
      revenueLinkage: 0.7,
      confidence: 0.75,
      dilutionPenalty: 0.55,
    });

    expect(strong).toBeGreaterThan(diluted);
  });

  it("classifies IPO forecast conservatively when pricing and lock-up risk are high", () => {
    expect(classifyIpoForecast({ readinessScore: 80, pricingRisk: "high", lockupRisk: 88 })).toBe("wait_for_lockup_candidate");
    expect(classifyIpoForecast({ readinessScore: 90, pricingRisk: "medium", lockupRisk: 45 })).toBe("compounder_candidate");
  });

  it("auto-scales tightly clustered scatter domains", () => {
    const domain = calculateScatterDomain([
      { x: 50, y: 70 },
      { x: 51, y: 71 },
      { x: 50.5, y: 70.5 },
    ], "x");

    expect(domain.expanded).toBe(true);
    expect(domain.max - domain.min).toBeGreaterThanOrEqual(20);
  });
});
