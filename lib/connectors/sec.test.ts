import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { secConnector, isSecUserAgentValid, SEC_NOT_CONFIGURED_MESSAGE } from "./sec";

describe("isSecUserAgentValid", () => {
  it("accepts SEC-compliant strings with a contact email", () => {
    expect(isSecUserAgentValid("AI Enterprise contact@example.com")).toBe(true);
    expect(isSecUserAgentValid("MyCo team@myco.io")).toBe(true);
  });

  it("rejects missing / empty / placeholder strings", () => {
    expect(isSecUserAgentValid(undefined)).toBe(false);
    expect(isSecUserAgentValid("")).toBe(false);
    expect(isSecUserAgentValid("MyApp")).toBe(false);
    // Has @ but no domain dot — too short to be a real email.
    expect(isSecUserAgentValid("x@y")).toBe(false);
  });
});

describe("secConnector.health()", () => {
  const originalUa = process.env.SEC_USER_AGENT;
  afterEach(() => {
    if (originalUa === undefined) delete process.env.SEC_USER_AGENT;
    else process.env.SEC_USER_AGENT = originalUa;
  });

  it("missing UA → configured=false, status=not_configured, exact message", () => {
    delete process.env.SEC_USER_AGENT;
    const h = secConnector.health();
    expect(h.configured).toBe(false);
    expect(h.status).toBe("not_configured");
    expect(h.message).toBe(SEC_NOT_CONFIGURED_MESSAGE);
    expect(h.envVars).toContain("SEC_USER_AGENT");
  });

  it("placeholder UA (no email) → not_configured", () => {
    process.env.SEC_USER_AGENT = "AI Enterprise";
    expect(secConnector.health().status).toBe("not_configured");
  });

  it("valid UA → configured=true, ok, message cleared", () => {
    process.env.SEC_USER_AGENT = "AI Enterprise contact@example.com";
    const h = secConnector.health();
    expect(h.configured).toBe(true);
    expect(h.status).toBe("ok");
    expect(h.message).toBeUndefined();
    expect(h.tier).toBe("official_government");
    expect(h.defaultEvidenceGrade).toBe("E5");
  });
});

describe("secConnector.fetch()", () => {
  const originalUa = process.env.SEC_USER_AGENT;
  const originalFetch = globalThis.fetch;

  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => {
    if (originalUa === undefined) delete process.env.SEC_USER_AGENT;
    else process.env.SEC_USER_AGENT = originalUa;
    globalThis.fetch = originalFetch;
  });

  it("missing UA → not_configured, no network call", async () => {
    delete process.env.SEC_USER_AGENT;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const result = await secConnector.fetch({ cik: "0000789019" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("not_configured");
    expect(result.error).toBe(SEC_NOT_CONFIGURED_MESSAGE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("missing cik → error", async () => {
    process.env.SEC_USER_AGENT = "AI Enterprise contact@example.com";
    const result = await secConnector.fetch({ cik: "" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.error).toMatch(/cik required/);
  });

  it("calls submissions URL by default with User-Agent header", async () => {
    process.env.SEC_USER_AGENT = "AI Enterprise contact@example.com";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({ name: "Microsoft Corp", tickers: ["MSFT"] }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const result = await secConnector.fetch({ cik: "789019" });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toBe("https://data.sec.gov/submissions/CIK0000789019.json");
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("AI Enterprise contact@example.com");
    expect(result.records[0].resource).toBe("submissions");
  });

  it("resource=facts routes to the XBRL endpoint", async () => {
    process.env.SEC_USER_AGENT = "AI Enterprise contact@example.com";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({ entityName: "Microsoft Corp", facts: { "us-gaap": {} } }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const result = await secConnector.fetch({ cik: "789019", resource: "facts" });
    expect(result.ok).toBe(true);
    expect((fetchSpy.mock.calls[0][0] as string)).toMatch(/companyfacts\/CIK0000789019\.json$/);
    expect(result.records[0].resource).toBe("facts");
  });

  it("HTTP 429 → status=rate_limited (separate from generic error)", async () => {
    process.env.SEC_USER_AGENT = "AI Enterprise contact@example.com";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 429, statusText: "Too Many Requests",
    }) as unknown as typeof fetch;
    const result = await secConnector.fetch({ cik: "789019" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("rate_limited");
    expect(result.error).toContain("HTTP 429");
  });

  it("does NOT fake success on network error", async () => {
    process.env.SEC_USER_AGENT = "AI Enterprise contact@example.com";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND data.sec.gov")) as unknown as typeof fetch;
    const result = await secConnector.fetch({ cik: "789019" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.error).toContain("ENOTFOUND");
  });

  it("normaliseFetchResult produces a NormalisedEvidenceSource", async () => {
    process.env.SEC_USER_AGENT = "AI Enterprise contact@example.com";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({ name: "Microsoft Corp" }),
    }) as unknown as typeof fetch;
    const result = await secConnector.fetch({ cik: "789019" });
    const { normaliseFetchResult } = await import("../evidence/normalise");
    const evidence = normaliseFetchResult(secConnector.health(), result);
    expect(evidence.connectorId).toBe("sec");
    expect(evidence.evidenceGrade).toBe("E5");
    expect(evidence.sourceType).toBe("official_government");
    expect(evidence.recordCount).toBe(1);
  });
});
