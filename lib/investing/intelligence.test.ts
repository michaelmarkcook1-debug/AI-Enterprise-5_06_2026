import { describe, expect, it } from "vitest";
import {
  calculateConsumerInvestmentPotential,
  calculateHypePenalty,
  calculateIndirectExposureScore,
  calculateInvestmentAttractivenessScore,
  calculateRetailAccessPenalty,
  doNotRankReason,
  getInvestmentDashboard,
  getInvestmentProvider,
  isWatchlistOnly,
  listInvestmentProviderScores,
} from "./intelligence";

describe("investment intelligence scoring", () => {
  it("keeps provider quality separate from investment attractiveness", () => {
    const microsoft = getInvestmentProvider("msft");
    expect(microsoft).toBeTruthy();
    expect(calculateInvestmentAttractivenessScore(microsoft!)).not.toBe(microsoft!.aiProviderQualityScore);
  });

  it("penalises inaccessible private providers before consumer ranking", () => {
    const harvey = getInvestmentProvider("harvey");
    const microsoft = getInvestmentProvider("msft");

    expect(harvey).toBeTruthy();
    expect(microsoft).toBeTruthy();
    expect(doNotRankReason(harvey!)).toContain("Private company");
    expect(calculateConsumerInvestmentPotential(harvey!)).toBe(0);
    expect(calculateConsumerInvestmentPotential(microsoft!)).toBeGreaterThan(50);
  });

  it("applies lower retail access penalty to public direct providers than IPO watch providers", () => {
    const microsoft = getInvestmentProvider("msft");
    const openai = getInvestmentProvider("openai");

    expect(calculateRetailAccessPenalty(microsoft!)).toBeLessThan(calculateRetailAccessPenalty(openai!));
    expect(isWatchlistOnly(openai!)).toBe(true);
    expect(isWatchlistOnly(microsoft!)).toBe(false);
  });

  it("flags hype and valuation gaps without turning them into buy or sell advice", () => {
    const openai = getInvestmentProvider("openai");
    const microsoft = getInvestmentProvider("msft");

    expect(calculateHypePenalty(openai!)).toBeGreaterThan(calculateHypePenalty(microsoft!));
    expect(calculateHypePenalty(openai!)).toBeLessThanOrEqual(50);
  });
});

describe("investment intelligence dashboard", () => {
  it("builds the required dashboard sections from seed data", () => {
    const dashboard = getInvestmentDashboard();

    expect(dashboard.corePublicPlatforms.length).toBeGreaterThan(0);
    expect(dashboard.ipoRumourMonitor.length).toBeGreaterThan(5);
    expect(dashboard.indirectExposurePreview.length).toBeGreaterThan(0);
    expect(dashboard.warning).toContain("not financial advice");
  });

  it("returns ranked provider score rows", () => {
    const rows = listInvestmentProviderScores();

    expect(rows.length).toBeGreaterThan(10);
    expect(rows[0].consumerInvestmentPotential).toBeGreaterThanOrEqual(rows[1].consumerInvestmentPotential);
    expect(rows.some((row) => row.watchlistOnly)).toBe(true);
  });

  it("scores indirect exposure with confidence and dilution", () => {
    const strong = calculateIndirectExposureScore({
      privateProviderId: "openai",
      publicTicker: "NVDA",
      exposureType: "compute infrastructure",
      exposureStrength: 0.8,
      revenueLinkage: 0.75,
      confidence: 0.8,
      dilutionPenalty: 0.2,
    });
    const diluted = calculateIndirectExposureScore({
      privateProviderId: "openai",
      publicTicker: "MSFT",
      exposureType: "strategic",
      exposureStrength: 0.8,
      revenueLinkage: 0.75,
      confidence: 0.8,
      dilutionPenalty: 0.7,
    });

    expect(strong).toBeGreaterThan(diluted);
    expect(strong).toBeGreaterThan(25);
  });
});
