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
  // OWNER INSTRUCTION (2026-07-10): member surfaces stay UNGATED for testing on
  // ALL environments incl. real production — the prior prod-scoping was reverted.
  it("tracks MEMBER_TEST_OPEN unconditionally — open on real production too", () => {
    expect(MEMBER_TEST_OPEN).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(memberTestOpenEffective()).toBe(true);
  });

  it("is true in preview/local dev as well", () => {
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

  // These two previously asserted that real production stayed CLOSED — encoding
  // the `&& !isRealProductionEnv()` scoping that was REVERTED on owner instruction
  // (2026-07-10: member surfaces stay ungated, including on the production URL the
  // owner actually tests on). The scoping went; the tests didn't, so they failed
  // against intended behaviour. Rewritten to assert the current ruling, and still
  // to fail loudly if anyone re-scopes prod without that being a decision.
  it("on REAL production the member surface is OPEN by owner instruction — not because of DEMO_HERO_OPEN", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("DEMO_HERO_OPEN", "1");
    expect(heroDemoActive()).toBe(true);
    // Open via MEMBER_TEST_OPEN itself. If this flips to false, someone re-added
    // prod scoping — revisit deliberately rather than "fixing" the test.
    expect(memberTestOpenEffective()).toBe(true);
  });

  it("with the prod demo flag UNSET the hero gate is still open — MEMBER_TEST_OPEN carries it", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("DEMO_HERO_OPEN", "");
    expect(demoHeroOpen()).toBe(false); // the flag itself stays strictly env-gated
    expect(heroDemoActive()).toBe(true); // …but test-open already opens the gate
    expect(memberTestOpenEffective()).toBe(true);
  });

  // The pre-launch invariant this pair protects: before a genuine public launch,
  // MEMBER_TEST_OPEN goes false and MEMBER_AUTH_ENABLED comes on — at which point
  // heroDemoActive() must depend on DEMO_HERO_OPEN alone. These expectations are
  // meant to be revisited at that point, not quietly deleted.

  it("on preview/local the hero gate is already open via test-open, with or without the flag", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DEMO_HERO_OPEN", "");
    expect(heroDemoActive()).toBe(true); // test-open path, flag not needed off-prod
    expect(memberTestOpenEffective()).toBe(true);
  });
});
