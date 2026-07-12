import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mapAaModels, fetchArtificialAnalysisModels, type AaModelRaw } from "./artificial-analysis-fetch";

// Fixture mirrors the LIVE response shape (verified 2026-07-08): evaluations /
// pricing / performance are NESTED objects, and the list endpoint paginates.
function row(overrides: Partial<AaModelRaw> = {}): AaModelRaw {
  return {
    id: "id-1",
    name: "claude-opus-4-8",
    slug: "claude-opus-4-8",
    release_date: "2026-05-28",
    model_creator: { id: "c-anthropic", name: "Anthropic" },
    evaluations: {
      artificial_analysis_intelligence_index: 55.7,
      artificial_analysis_coding_index: 74.3,
      artificial_analysis_agentic_index: 47.2,
    },
    pricing: { price_1m_input_tokens: 5, price_1m_output_tokens: 25 },
    performance: { median_output_tokens_per_second: 66.03, median_time_to_first_token_seconds: 1.2 },
    ...overrides,
  };
}

function pageResponse(rows: AaModelRaw[], page: number, totalPages: number) {
  return {
    ok: true,
    json: async () => ({
      pagination: { page, total_pages: totalPages, has_more: page < totalPages },
      data: rows,
    }),
  };
}

describe("mapAaModels — pure, no fabrication", () => {
  it("maps a real nested row to a roster vendor via model_creator.name", () => {
    const { models, unmappedCreators } = mapAaModels([row()]);
    expect(models).toHaveLength(1);
    expect(models[0].vendorId).toBe("anthropic");
    expect(models[0].modelName).toBe("claude-opus-4-8");
    expect(models[0].releaseDate).toBe("2026-05-28");
    expect(models[0].intelligenceIndex).toBe(55.7);
    expect(models[0].codingIndex).toBe(74.3);
    expect(models[0].agenticIndex).toBe(47.2);
    expect(models[0].priceInputPer1m).toBe(5);
    expect(models[0].outputTokensPerSecond).toBe(66.03);
    expect(unmappedCreators).toEqual([]);
  });

  it("maps the creators Artificial Analysis names differently from Arena (verified live)", () => {
    const { models } = mapAaModels([
      row({ model_creator: { id: "k", name: "Kimi" }, name: "Kimi K2" }),
      row({ model_creator: { id: "t", name: "TII UAE" }, name: "Falcon" }),
      row({ model_creator: { id: "s", name: "ServiceNow" }, name: "Apriel" }),
      row({ model_creator: { id: "z", name: "Z AI" }, name: "GLM-5.2" }),
      row({ model_creator: { id: "sx", name: "SpaceXAI" }, name: "Grok 4.20 0309 (Reasoning)" }),
    ]);
    expect(models.map((m) => m.vendorId)).toEqual(["moonshot", "g42", "servicenow", "zai", "xai"]);
  });

  it("drops a row whose creator maps to no roster vendor, reporting it as unmapped (never invents a vendor)", () => {
    const { models, unmappedCreators } = mapAaModels([
      row(),
      row({ model_creator: { id: "x", name: "SomeUntrackedLab" }, name: "untracked-model" }),
    ]);
    expect(models).toHaveLength(1);
    expect(unmappedCreators).toEqual(["SomeUntrackedLab"]);
  });

  it("drops a row with no model_creator at all", () => {
    expect(mapAaModels([row({ model_creator: null })]).models).toHaveLength(0);
  });

  it("normalises release_date to YYYY-MM-DD and passes through null honestly", () => {
    expect(mapAaModels([row({ release_date: "2026-05-28T00:00:00Z" })]).models[0].releaseDate).toBe("2026-05-28");
    expect(mapAaModels([row({ release_date: null })]).models[0].releaseDate).toBeNull();
    expect(mapAaModels([row({ release_date: "not-a-date" })]).models[0].releaseDate).toBeNull();
  });

  it("passes through null/missing nested objects honestly rather than defaulting to 0", () => {
    const m = mapAaModels([row({ evaluations: null, pricing: null, performance: null })]).models[0];
    expect(m.intelligenceIndex).toBeNull();
    expect(m.codingIndex).toBeNull();
    expect(m.agenticIndex).toBeNull();
    expect(m.priceInputPer1m).toBeNull();
    expect(m.outputTokensPerSecond).toBeNull();
  });

  it("is deterministic for the same input", () => {
    const rows = [row(), row({ name: "gpt-5.5", model_creator: { id: "o", name: "OpenAI" } })];
    expect(mapAaModels(rows)).toEqual(mapAaModels(rows));
  });
});

describe("fetchArtificialAnalysisModels — honest absence, paginated, never throws", () => {
  const ORIGINAL_KEY = process.env.ARTIFICIAL_ANALYSIS_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ARTIFICIAL_ANALYSIS_API_KEY;
    else process.env.ARTIFICIAL_ANALYSIS_API_KEY = ORIGINAL_KEY;
  });

  it("reports not_configured without any network call when no API key is set", async () => {
    delete process.env.ARTIFICIAL_ANALYSIS_API_KEY;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const outcome = await fetchArtificialAnalysisModels();
    expect(outcome.status).toBe("not_configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the api key as x-api-key and walks ALL pages (a page-1-only read could miss a flagship)", async () => {
    process.env.ARTIFICIAL_ANALYSIS_API_KEY = "test-key";
    const page1 = Array.from({ length: 6 }, (_, i) => row({ id: `p1-${i}`, name: `model-a${i}` }));
    const page2 = Array.from({ length: 4 }, (_, i) => row({ id: `p2-${i}`, name: `model-b${i}` }));
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(pageResponse(page1, 1, 2))
      .mockResolvedValueOnce(pageResponse(page2, 2, 2));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const outcome = await fetchArtificialAnalysisModels();
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") expect(outcome.result.models).toHaveLength(10);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("page=1");
    expect(String(fetchSpy.mock.calls[1][0])).toContain("page=2");
    expect((fetchSpy.mock.calls[0][1].headers as Record<string, string>)["x-api-key"]).toBe("test-key");
  });

  it("reports error if a later page fails — a truncated roster could silently drop a vendor's flagship", async () => {
    process.env.ARTIFICIAL_ANALYSIS_API_KEY = "test-key";
    const page1 = Array.from({ length: 6 }, (_, i) => row({ id: `p1-${i}`, name: `model-a${i}` }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(pageResponse(page1, 1, 2))
      .mockResolvedValueOnce({ ok: false, status: 429 }) as unknown as typeof fetch;
    expect((await fetchArtificialAnalysisModels()).status).toBe("error");
  });

  it("reports error on a non-ok HTTP response, never a fabricated result", async () => {
    process.env.ARTIFICIAL_ANALYSIS_API_KEY = "test-key";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    expect((await fetchArtificialAnalysisModels()).status).toBe("error");
  });

  it("reports error on network failure, never throws", async () => {
    process.env.ARTIFICIAL_ANALYSIS_API_KEY = "test-key";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    await expect(fetchArtificialAnalysisModels()).resolves.toEqual({ status: "error" });
  });

  it("reports error on a suspiciously small response (parse likely broke), not a thin misleading result", async () => {
    process.env.ARTIFICIAL_ANALYSIS_API_KEY = "test-key";
    globalThis.fetch = vi.fn().mockResolvedValue(pageResponse([row()], 1, 1)) as unknown as typeof fetch;
    expect((await fetchArtificialAnalysisModels()).status).toBe("error");
  });
});
