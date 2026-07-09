import { describe, it, expect, vi, afterEach } from "vitest";
import {
  seedFallbackAllowed,
  DataUnavailableError,
  isDataUnavailable,
  isRealProductionEnv,
  memberTestOpenEffective,
  MEMBER_TEST_OPEN,
  demoHeroOpen,
  heroDemoActive,
} from "./availability";
import {
  vendorsMockRepository,
  newsMockRepository,
  marketShareEstimatesMockRepository,
  marketCategoriesMockRepository,
  vendorMomentumMockRepository,
} from "./intelligence/mock-repositories";
import { listIntelligenceVendors, listMarketShareEstimates } from "./intelligence/repository";

afterEach(() => vi.unstubAllEnvs());

describe("seedFallbackAllowed — the seed firewall", () => {
  it("is FALSE on any Vercel deploy, even under NODE_ENV=test", () => {
    vi.stubEnv("VERCEL", "1");
    expect(seedFallbackAllowed()).toBe(false);
  });

  it("is FALSE in production (no VERCEL)", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(seedFallbackAllowed()).toBe(false);
  });

  it("is TRUE under NODE_ENV=test (the unit suite runs on fixtures)", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(seedFallbackAllowed()).toBe(true);
  });

  it("local dev requires an explicit ALLOW_SEED_FALLBACK=1 opt-in", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_SEED_FALLBACK", "");
    expect(seedFallbackAllowed()).toBe(false);
    vi.stubEnv("ALLOW_SEED_FALLBACK", "1");
    expect(seedFallbackAllowed()).toBe(true);
  });
});

describe("no seed-data path is reachable in a deployed build", () => {
  it("every mock repository returns empty when seed is disallowed (VERCEL set)", async () => {
    vi.stubEnv("VERCEL", "1");
    expect(await vendorsMockRepository.list()).toEqual([]);
    expect(await vendorsMockRepository.get("openai")).toBeNull();
    expect(await newsMockRepository.list()).toEqual([]);
    expect(await newsMockRepository.byVendor("openai")).toEqual([]);
    expect(await marketShareEstimatesMockRepository.list()).toEqual([]);
    expect(await marketCategoriesMockRepository.list()).toEqual([]);
    expect(await vendorMomentumMockRepository.list()).toEqual([]);
  });

  it("repository readers throw DataUnavailableError instead of seeding (VERCEL set, no DB)", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "");
    await expect(listIntelligenceVendors()).rejects.toThrow(DataUnavailableError);
    await expect(listMarketShareEstimates()).rejects.toThrow(DataUnavailableError);
  });

  it("isDataUnavailable identifies the error type", () => {
    expect(isDataUnavailable(new DataUnavailableError("x"))).toBe(true);
    expect(isDataUnavailable(new Error("x"))).toBe(false);
    expect(isDataUnavailable(null)).toBe(false);
  });
});

// Prompt 3 prerequisite: the shared MEMBER_TEST_OPEN bypass must be
// unreachable on real production, regardless of the owner-intent flag.
describe("isRealProductionEnv", () => {
  it("is true only when VERCEL_ENV is exactly \"production\"", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isRealProductionEnv()).toBe(true);
  });

  it("is false for preview deploys, even though Next.js sets NODE_ENV=production there too", () => {
    // the exact trap this exists to avoid: preview builds are still NODE_ENV=production
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    expect(isRealProductionEnv()).toBe(false);
  });

  it("is false for local dev (VERCEL_ENV unset)", () => {
    vi.stubEnv("VERCEL_ENV", "");
    expect(isRealProductionEnv()).toBe(false);
  });
});

describe("memberTestOpenEffective", () => {
  it("is false in real production even though MEMBER_TEST_OPEN (owner intent) is true", () => {
    expect(MEMBER_TEST_OPEN).toBe(true); // the owner-intent flag itself is unconditional
    vi.stubEnv("VERCEL_ENV", "production");
    expect(memberTestOpenEffective()).toBe(false); // but the EFFECTIVE value must not be
  });

  it("is true in preview/local dev, matching MEMBER_TEST_OPEN", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(memberTestOpenEffective()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "");
    expect(memberTestOpenEffective()).toBe(true);
  });
});

describe("demoHeroOpen / heroDemoActive — the prod demo opening for the two hero features ONLY", () => {
  it("demoHeroOpen is env-gated and OFF by default (merging changes nothing until DEMO_HERO_OPEN=1)", () => {
    vi.stubEnv("DEMO_HERO_OPEN", "");
    expect(demoHeroOpen()).toBe(false);
    vi.stubEnv("DEMO_HERO_OPEN", "1");
    expect(demoHeroOpen()).toBe(true);
    vi.stubEnv("DEMO_HERO_OPEN", "true"); // only the exact "1" opens it
    expect(demoHeroOpen()).toBe(false);
  });

  it("CRITICAL scoping: on REAL production, DEMO_HERO_OPEN=1 opens the hero gate but does NOT reopen the rest of the member surface", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("DEMO_HERO_OPEN", "1");
    expect(heroDemoActive()).toBe(true); // the two hero features get the demo member…
    expect(memberTestOpenEffective()).toBe(false); // …but watchlist/decisions/monitor/chat stay closed on prod
  });

  it("real production stays fully closed by default (flag unset) — nothing opens on merge", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("DEMO_HERO_OPEN", "");
    expect(heroDemoActive()).toBe(false);
    expect(memberTestOpenEffective()).toBe(false);
  });

  it("on preview/local the hero gate is already open via test-open, with or without the flag", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DEMO_HERO_OPEN", "");
    expect(heroDemoActive()).toBe(true); // test-open path, flag not needed off-prod
    expect(memberTestOpenEffective()).toBe(true);
  });
});
