// Perplexity scope-boundary tests.
// ────────────────────────────────
// Locks the platform-only contract for Perplexity per the Stage-2 Rev2
// and Post-Zip-Suggestions packs:
//   INCLUDED in ProductScope / Capabilities / Commercial Models /
//             Vendor Intelligence / News Intelligence
//   EXCLUDED from Investor Tools / Investment Intelligence / IPO
//             Watch / Investment Simulator / Public AI Stocks /
//             Indirect Exposure Map / Investor Briefings / Watchlist
//
// These tests fail loudly if a future change accidentally lets
// Perplexity into an investor surface.

import { describe, expect, it } from "vitest";
import {
  PRODUCT_SCOPES,
  productScopesForVendor,
} from "./product-scope";
import {
  INVESTMENT_PROVIDERS,
  IPO_PROFILES,
  IPO_EVIDENCE_QUALITY,
  IPO_FORECASTS,
  POST_IPO_FLUCTUATION_BANDS,
  INVESTOR_EXCLUDED_VENDOR_IDS,
  isInvestorTracked,
} from "../investing/seed";

describe("Perplexity — platform inclusion", () => {
  it("is present in PRODUCT_SCOPES", () => {
    const perp = productScopesForVendor("perplexity");
    expect(perp.length).toBeGreaterThan(0);
  });

  it("has at least one source-backed enterprise product", () => {
    const perp = productScopesForVendor("perplexity");
    expect(
      perp.some((s) => s.productName.includes("Enterprise Pro") || s.productName.includes("Enterprise Max")),
    ).toBe(true);
  });

  it("registers core Sonar / Search / Agent API products from the pack list", () => {
    const names = productScopesForVendor("perplexity").map((s) => s.productName);
    expect(names).toContain("Search API");
    expect(names).toContain("Sonar API");
    expect(names).toContain("Agent API");
    expect(names).toContain("Sonar");
    expect(names).toContain("Sonar Pro");
    expect(names).toContain("Sonar Reasoning Pro");
    expect(names).toContain("Sonar Deep Research");
  });

  it("Agent API entry carries the hosted-third-party caveat", () => {
    const agentApi = PRODUCT_SCOPES.find(
      (s) => s.vendorId === "perplexity" && s.productName === "Agent API",
    );
    expect(agentApi).toBeDefined();
    expect(agentApi!.uncertaintyNote).toMatch(/hosted_third_party|hosted third|third-party/i);
  });

  it("is opted-out of Investor Tools via includeInInvestorTools=false", () => {
    const perp = productScopesForVendor("perplexity");
    for (const s of perp) {
      expect(s.includeInInvestorTools).toBe(false);
    }
  });

  it("is opted-out of Investment Simulator", () => {
    const perp = productScopesForVendor("perplexity");
    for (const s of perp) {
      expect(s.includeInSimulator).toBe(false);
    }
  });

  it("remains in Commercial Models inventory (INVESTMENT_PROVIDERS)", () => {
    // The model-inventory repository pulls vendors from INVESTMENT_PROVIDERS;
    // Perplexity must stay here so Commercial Models surfaces it.
    expect(INVESTMENT_PROVIDERS.find((p) => p.id === "perplexity")).toBeDefined();
  });
});

describe("Perplexity — investor exclusion", () => {
  it("INVESTOR_EXCLUDED_VENDOR_IDS contains 'perplexity'", () => {
    expect(INVESTOR_EXCLUDED_VENDOR_IDS.has("perplexity")).toBe(true);
  });

  it("isInvestorTracked('perplexity') returns false", () => {
    expect(isInvestorTracked("perplexity")).toBe(false);
  });

  it("isInvestorTracked returns true for other vendors", () => {
    expect(isInvestorTracked("anthropic")).toBe(true);
    expect(isInvestorTracked("msft")).toBe(true);
    expect(isInvestorTracked("googl")).toBe(true);
  });

  it("is absent from IPO_PROFILES (process states)", () => {
    expect(IPO_PROFILES.find((r) => r.providerId === "perplexity")).toBeUndefined();
  });

  it("is absent from IPO_EVIDENCE_QUALITY (evidence signals)", () => {
    expect(IPO_EVIDENCE_QUALITY.find((r) => r.providerId === "perplexity")).toBeUndefined();
  });

  it("is absent from IPO_FORECASTS", () => {
    expect(IPO_FORECASTS.find((r) => r.providerId === "perplexity")).toBeUndefined();
  });

  it("is absent from POST_IPO_FLUCTUATION_BANDS", () => {
    expect(POST_IPO_FLUCTUATION_BANDS.find((r) => r.providerId === "perplexity")).toBeUndefined();
  });
});
