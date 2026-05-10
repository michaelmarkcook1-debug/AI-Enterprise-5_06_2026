import { describe, expect, it } from "vitest";
import { categoriseClassifyFailure } from "./runner";

describe("categoriseClassifyFailure", () => {
  it("zod too_big rationale (the May-2026 root cause) → schema_validation", () => {
    const msg = `[\n  {\n    "origin": "string",\n    "code": "too_big",\n    "maximum": 400,\n    "inclusive": true,\n    "path": [\n      "rationale"\n    ],\n    "message": "Too big: expected string to have <=400 characters"\n  }\n]`;
    expect(categoriseClassifyFailure(msg).code).toBe("schema_validation");
  });

  it("zod too_small → schema_validation", () => {
    const msg = `[{"code":"too_small","minimum":10,"path":["rationale"]}]`;
    expect(categoriseClassifyFailure(msg).code).toBe("schema_validation");
  });

  it("zod invalid_enum → schema_validation", () => {
    const msg = `[{"code":"invalid_enum","path":["finalGrade"]}]`;
    expect(categoriseClassifyFailure(msg).code).toBe("schema_validation");
  });

  it("Anthropic credit-balance error → credit_balance", () => {
    expect(
      categoriseClassifyFailure("400 Your credit balance is too low to access the Anthropic API").code,
    ).toBe("credit_balance");
  });

  it("rate limit 429 → rate_limit", () => {
    expect(categoriseClassifyFailure("429 too many requests").code).toBe("rate_limit");
    expect(categoriseClassifyFailure("rate limited by upstream").code).toBe("rate_limit");
  });

  it("auth 401 → auth", () => {
    expect(categoriseClassifyFailure("401 invalid api key").code).toBe("auth");
    expect(categoriseClassifyFailure("Unauthorized: missing API key").code).toBe("auth");
  });

  it("model not found → model_not_found", () => {
    expect(categoriseClassifyFailure("Model 'claude-sonnet-4-6' not found").code).toBe("model_not_found");
  });

  it("timeout → timeout", () => {
    expect(categoriseClassifyFailure("ETIMEDOUT").code).toBe("timeout");
    expect(categoriseClassifyFailure("Request timed out after 60s").code).toBe("timeout");
  });

  it("LLM returned no tool_use → no_tool_use", () => {
    expect(categoriseClassifyFailure("LLM returned no tool_use block").code).toBe("no_tool_use");
  });

  it("network errors → network", () => {
    expect(categoriseClassifyFailure("ECONNRESET").code).toBe("network");
    expect(categoriseClassifyFailure("getaddrinfo ENOTFOUND api.anthropic.com").code).toBe("network");
  });

  it("unknown errors stay 'unknown'", () => {
    expect(categoriseClassifyFailure("some bizarre new failure").code).toBe("unknown");
  });

  it("reason field is truncated to 1500 chars", () => {
    const huge = "x".repeat(5000);
    const r = categoriseClassifyFailure(huge);
    expect(r.reason.length).toBeLessThanOrEqual(1500);
  });
});

describe("rationale schema fix (regression on May-2026 root cause)", () => {
  it("ClassificationSchema accepts a 1500-char rationale (used to fail at 400)", async () => {
    const { ClassificationSchema } = await import("../agents/evidence-classifier");
    const long = "Reasoning: " + "abc ".repeat(400); // ~1611 chars
    const parsed = ClassificationSchema.parse({
      finalGrade: "E2",
      finalRawScore: 50,
      confidence: 0.7,
      rationale: long,
    });
    // Truncated to display max but parse must succeed
    expect(parsed.rationale.length).toBeLessThanOrEqual(1500);
    expect(parsed.confidence).toBe(0.7);
  });

  it("ClassificationSchema still rejects too-short rationale", async () => {
    const { ClassificationSchema } = await import("../agents/evidence-classifier");
    expect(() =>
      ClassificationSchema.parse({
        finalGrade: "E2",
        finalRawScore: 50,
        confidence: 0.7,
        rationale: "tiny",
      }),
    ).toThrow();
  });
});
