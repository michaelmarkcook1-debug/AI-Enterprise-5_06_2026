// Regression tests for the 2026-06-18 P0 audit fixes.
// Guards against the exact defects the audit found: a frozen freshness clock,
// the inverted OpenAI>Anthropic ranking, and stale frontier/coding shares.
import { describe, it, expect } from "vitest";
import { freshnessFactor } from "./engine";
import { INTELLIGENCE_VENDORS, MARKET_SHARE_ESTIMATES } from "./intelligence/seed";

describe("P0 audit — freshness clock is live, not frozen", () => {
  it("decays evidence relative to the current date", () => {
    // 200 days before NOW must lose full credit. Under the old frozen asOf
    // (2026-05-07) an item 200 days before today resolved to ~0 days old → 1.0;
    // a live clock returns < 1.0. This fails if the hardcoded date returns.
    const twoHundredDaysAgo = new Date(Date.now() - 200 * 86_400_000).toISOString();
    expect(freshnessFactor(twoHundredDaysAgo)).toBeLessThan(1);
  });
  it("gives fresh evidence full credit", () => {
    expect(freshnessFactor(new Date().toISOString())).toBe(1);
  });
});

describe("P0 audit — headline ranking & shares reflect mid-2026 reality", () => {
  const vendor = (id: string) => INTELLIGENCE_VENDORS.find((v) => v.id === id);
  const share = (vendorId: string, categoryId: string) =>
    MARKET_SHARE_ESTIMATES.find((s) => s.vendorId === vendorId && s.categoryId === categoryId)?.estimatedShare ?? 0;

  it("ranks Anthropic at or above OpenAI on overall score", () => {
    const a = vendor("anthropic");
    const o = vendor("openai");
    expect(a).toBeDefined();
    expect(o).toBeDefined();
    expect(a!.overallScore).toBeGreaterThanOrEqual(o!.overallScore);
  });

  it("gives Anthropic the leading enterprise frontier-API share", () => {
    expect(share("anthropic", "frontier_model_api")).toBeGreaterThan(share("openai", "frontier_model_api"));
  });

  it("gives Anthropic the leading coding-agent share (over OpenAI and Microsoft)", () => {
    expect(share("anthropic", "developer_coding_agent")).toBeGreaterThan(share("openai", "developer_coding_agent"));
    expect(share("anthropic", "developer_coding_agent")).toBeGreaterThan(share("microsoft", "developer_coding_agent"));
  });
});
