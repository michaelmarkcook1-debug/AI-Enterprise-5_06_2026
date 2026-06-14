import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  eiaConnector,
  normaliseEiaRows,
  safeNumber,
  EIA_API_BASE,
  EIA_NOT_CONFIGURED_MESSAGE,
} from "./eia";

describe("safeNumber — string→number coercion (EIA returns strings)", () => {
  it.each([
    ["13245.6", 13245.6],
    ["0", 0],
    ["-5", -5],
    [42, 42],
    [-3.14, -3.14],
  ] as const)("parses %s → %s", (input, expected) => {
    expect(safeNumber(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["   "],
    ["."],   // EIA's missing-value sentinel
    ["NA"],
    ["not a number"],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY],
    [{}],
    [[]],
    [true],
  ] as const)("rejects %p → null", (input) => {
    expect(safeNumber(input)).toBeNull();
  });
});

describe("normaliseEiaRows", () => {
  it("returns [] for non-array input (defensive)", () => {
    expect(normaliseEiaRows(null)).toEqual([]);
    expect(normaliseEiaRows(undefined)).toEqual([]);
    expect(normaliseEiaRows({})).toEqual([]);
    expect(normaliseEiaRows("oops")).toEqual([]);
  });

  it("preserves the raw value AND attaches valueNumber", () => {
    const rows = normaliseEiaRows([
      { period: "2024-12", value: "13245.6", stateid: "CA" },
      { period: "2024-11", value: null },
      { period: "2024-10", value: "." },
      { period: "2024-09", value: 100 },
    ]);
    expect(rows[0]).toMatchObject({ period: "2024-12", value: "13245.6", valueNumber: 13245.6, stateid: "CA" });
    expect(rows[1]).toMatchObject({ period: "2024-11", value: null, valueNumber: null });
    expect(rows[2]).toMatchObject({ period: "2024-10", value: ".", valueNumber: null });
    expect(rows[3]).toMatchObject({ period: "2024-09", value: 100, valueNumber: 100 });
  });
});

describe("eiaConnector.health()", () => {
  const originalKey = process.env.EIA_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.EIA_API_KEY;
    else process.env.EIA_API_KEY = originalKey;
  });

  it("returns configured=false, status=not_configured with the documented message when key is missing", () => {
    delete process.env.EIA_API_KEY;
    const h = eiaConnector.health();
    expect(h.configured).toBe(false);
    expect(h.status).toBe("not_configured");
    expect(h.message).toBe(EIA_NOT_CONFIGURED_MESSAGE);
    expect(h.envVars).toContain("EIA_API_KEY");
  });

  it("returns configured=true, status=ok, no message when key is present", () => {
    process.env.EIA_API_KEY = "test-key";
    const h = eiaConnector.health();
    expect(h.configured).toBe(true);
    expect(h.status).toBe("ok");
    expect(h.message).toBeUndefined();
  });

  it("declares the v2 base, government tier, and E5 default grade", () => {
    process.env.EIA_API_KEY = "test-key";
    const h = eiaConnector.health();
    expect(EIA_API_BASE).toBe("https://api.eia.gov/v2");
    expect(h.tier).toBe("official_government");
    expect(h.defaultEvidenceGrade).toBe("E5");
  });
});

describe("eiaConnector.fetch()", () => {
  const originalKey = process.env.EIA_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.EIA_API_KEY;
    else process.env.EIA_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  });

  it("returns not_configured WITHOUT touching the network when key is missing", async () => {
    delete process.env.EIA_API_KEY;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const result = await eiaConnector.fetch({ route: "electricity/retail-sales/data" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("not_configured");
    expect(result.error).toBe(EIA_NOT_CONFIGURED_MESSAGE);
    expect(result.records).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns error when route is missing", async () => {
    process.env.EIA_API_KEY = "test-key";
    const result = await eiaConnector.fetch({ route: "" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.error).toMatch(/route required/);
  });

  it("calls EIA v2 with api_key in the URL and normalises rows", async () => {
    process.env.EIA_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        response: {
          total: "12345",
          data: [
            { period: "2024-12", stateid: "CA", sectorid: "ALL", price: "16.8", sales: "21500.7", revenue: "3612.1", customers: "13900000" },
            { period: "2024-11", stateid: "CA", sectorid: "ALL", price: ".", sales: "20100.0", revenue: "3320.5", customers: "13895000" },
          ],
        },
      }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const result = await eiaConnector.fetch({
      route: "electricity/retail-sales/data",
      params: { frequency: "monthly" },
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.recordCount).toBe(2);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/api\.eia\.gov\/v2\/electricity\/retail-sales\/data\?/);
    expect(url).toMatch(/api_key=test-key/);
    expect(url).toMatch(/frequency=monthly/);
    expect(result.records[0].total).toBe(12345);
    expect(result.records[0].rows[0]).toMatchObject({
      period: "2024-12",
      stateid: "CA",
      valueNumber: null, // no `value` column on this route
    });
  });

  it("does NOT fake success on HTTP error — bubbles status + error verbatim", async () => {
    process.env.EIA_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const result = await eiaConnector.fetch({ route: "electricity/retail-sales/data" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.error).toContain("HTTP 403");
    expect(result.records).toEqual([]);
  });

  it("does NOT fake success on network error", async () => {
    process.env.EIA_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const result = await eiaConnector.fetch({ route: "electricity/retail-sales/data" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.error).toContain("ECONNRESET");
  });
});

describe("eia retail-sales service (smoke)", () => {
  const originalKey = process.env.EIA_API_KEY;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.EIA_API_KEY;
    else process.env.EIA_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  });

  it("normalises rows into RetailSalesPoint with parsed numbers", async () => {
    process.env.EIA_API_KEY = "test-key";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({
        response: {
          total: "1",
          data: [
            { period: "2024-12", stateid: "CA", sectorid: "RES", price: "30.5", sales: "9500.2", revenue: "2898.5", customers: "13500000" },
          ],
        },
      }),
    }) as unknown as typeof fetch;
    const { getRetailSalesData } = await import("../services/eia-retail-sales");
    const result = await getRetailSalesData({ frequency: "monthly", stateId: "CA", sectorId: "RES" });
    expect(result.fetch.ok).toBe(true);
    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toMatchObject({
      period: "2024-12",
      stateId: "CA",
      sectorId: "RES",
      priceCentsPerKwh: 30.5,
      salesMillionKwh: 9500.2,
      revenueMillionDollars: 2898.5,
      customers: 13500000,
    });
    // Evidence shape conforms to NormalisedEvidenceSource
    expect(result.evidence?.connectorId).toBe("eia");
    expect(result.evidence?.evidenceGrade).toBe("E5");
  });

  it("smoke: not_configured propagates from connector to service", async () => {
    delete process.env.EIA_API_KEY;
    const { getRetailSalesData } = await import("../services/eia-retail-sales");
    const result = await getRetailSalesData();
    expect(result.fetch.ok).toBe(false);
    expect(result.fetch.status).toBe("not_configured");
    expect(result.evidence).toBeNull();
    expect(result.points).toEqual([]);
  });
});
