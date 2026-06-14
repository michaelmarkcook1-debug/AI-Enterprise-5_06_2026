import { describe, expect, it } from "vitest";
import { CONNECTORS, dashboardSummary, listConnectorHealth } from "./registry";

describe("connectors: registry", () => {
  it("registers exactly the expected free/official set", () => {
    const ids = Object.keys(CONNECTORS).sort();
    expect(ids).toEqual([
      "alphaVantage", "bea", "bls", "congress", "eia",
      "federalRegister", "fiscalData", "fred", "gdelt", "github", "sec",
      "vendorDocs", "yahooFinance",
    ].sort());
  });

  it("every connector exposes a health() snapshot with required fields", () => {
    for (const c of listConnectorHealth()) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.homepageUrl).toMatch(/^https?:\/\//);
      expect(c.apiDocsUrl).toMatch(/^https?:\/\//);
      expect(c.defaultEvidenceGrade).toMatch(/^E[0-5]$/);
      expect(c.defaultConfidenceFloor).toBeGreaterThanOrEqual(0);
      expect(c.defaultConfidenceFloor).toBeLessThanOrEqual(100);
    }
  });

  it("requires-key connectors report not_configured when the env var is unset", () => {
    // Strip env so we get a clean truth-state without leaking real values.
    const saved: Record<string, string | undefined> = {};
    for (const v of ["FRED_API_KEY", "BEA_API_KEY", "EIA_API_KEY", "ALPHA_VANTAGE_API_KEY", "CONGRESS_API_KEY", "SEC_USER_AGENT"]) {
      saved[v] = process.env[v];
      delete process.env[v];
    }
    try {
      const required = ["fred", "bea", "eia", "alphaVantage", "congress", "sec"];
      for (const id of required) {
        const h = CONNECTORS[id].health();
        expect(h.configured).toBe(false);
        expect(h.status).toBe("not_configured");
      }
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v !== undefined) process.env[k] = v;
      }
    }
  });

  it("no-key connectors are always configured", () => {
    for (const id of ["fiscalData", "gdelt", "federalRegister", "bls", "github"]) {
      const h = CONNECTORS[id].health();
      expect(h.configured).toBe(true);
    }
  });

  it("dashboardSummary counts roll up correctly", () => {
    const s = dashboardSummary();
    expect(s.total).toBe(13);
    expect(s.configured + s.notConfigured).toBeLessThanOrEqual(s.total);
  });

  it("connectors do not fake a successful fetch when env is missing (sec example)", async () => {
    const saved = process.env.SEC_USER_AGENT;
    delete process.env.SEC_USER_AGENT;
    try {
      const r = await CONNECTORS.sec.fetch({ cik: "0000320193" } as never);
      expect(r.ok).toBe(false);
      expect(r.status).toBe("not_configured");
    } finally {
      if (saved) process.env.SEC_USER_AGENT = saved;
    }
  });
});
