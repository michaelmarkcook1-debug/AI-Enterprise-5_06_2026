import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mapAaModels, fetchArtificialAnalysisModels, type AaModelRaw } from "./artificial-analysis-fetch";

function row(overrides: Partial<AaModelRaw> = {}): AaModelRaw {
  return {
    id: "id-1",
    name: "claude-opus-4-8",
    slug: "claude-opus-4-8",
    release_date: "2026-06-15",
    model_creator: { id: "anthropic", name: "Anthropic" },
    artificial_analysis_intelligence_index: 56,
    artificial_analysis_coding_index: 58,
    artificial_analysis_agentic_index: 60,
    median_output_tokens_per_second: 85.4,
    median_time_to_first_token_seconds: 1.2,
    price_1m_input_tokens: 5,
    price_1m_output_tokens: 25,
    ...overrides,
  };
}

describe("mapAaModels — pure, no fabrication", () => {
  it("maps a real row to a roster vendor via model_creator.name", () => {
    const { models, unmappedCreators } = mapAaModels([row()]);
    expect(models).toHaveLength(1);
    expect(models[0].vendorId).toBe("anthropic");
    expect(models[0].modelName).toBe("claude-opus-4-8");
    expect(models[0].releaseDate).toBe("2026-06-15");
    expect(models[0].intelligenceIndex).toBe(56);
    expect(unmappedCreators).toEqual([]);
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
    const { models } = mapAaModels([row({ model_creator: null })]);
    expect(models).toHaveLength(0);
  });

  it("normalises release_date to YYYY-MM-DD and passes through null honestly", () => {
    expect(mapAaModels([row({ release_date: "2026-06-15T00:00:00Z" })]).models[0].releaseDate).toBe("2026-06-15");
    expect(mapAaModels([row({ release_date: null })]).models[0].releaseDate).toBeNull();
    expect(mapAaModels([row({ release_date: "not-a-date" })]).models[0].releaseDate).toBeNull();
  });

  it("passes through null indices honestly rather than defaulting to 0", () => {
    const m = mapAaModels([
      row({ artificial_analysis_intelligence_index: null, artificial_analysis_coding_index: null, artificial_analysis_agentic_index: null }),
    ]).models[0];
    expect(m.intelligenceIndex).toBeNull();
    expect(m.codingIndex).toBeNull();
    expect(m.agenticIndex).toBeNull();
  });

  it("is deterministic for the same input", () => {
    const rows = [row(), row({ name: "gpt-5.5", model_creator: { id: "openai", name: "OpenAI" } })];
    expect(mapAaModels(rows)).toEqual(mapAaModels(rows));
  });
});

describe("fetchArtificialAnalysisModels — honest absence, never throws", () => {
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

  it("sends the api key as x-api-key and returns ok with mapped models on success", async () => {
    process.env.ARTIFICIAL_ANALYSIS_API_KEY = "test-key";
    const rows = Array.from({ length: 6 }, (_, i) => row({ id: `id-${i}`, name: `model-${i}` }));
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: rows }) });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const outcome = await fetchArtificialAnalysisModels();
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") expect(outcome.result.models).toHaveLength(6);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain("/language/models/free");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
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
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [row()] }) }) as unknown as typeof fetch;
    expect((await fetchArtificialAnalysisModels()).status).toBe("error");
  });
});
