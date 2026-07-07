import { describe, it, expect } from "vitest";
import { redactTokens } from "./redact-tokens";

describe("redactTokens — SEC-001 defense-in-depth regression", () => {
  it("redacts a 64-hex-char token embedded anywhere in the string", () => {
    const token = "a".repeat(64);
    expect(redactTokens(`/shared/${token}`)).toBe("/shared/[redacted]");
    expect(redactTokens(`https://example.com/shared/${token}?x=1`)).toBe("https://example.com/shared/[redacted]?x=1");
  });

  it("leaves ordinary paths untouched", () => {
    expect(redactTokens("/vendors/openai")).toBe("/vendors/openai");
    expect(redactTokens(undefined)).toBeNull();
  });

  it("does not falsely redact strings shorter than 64 hex chars", () => {
    expect(redactTokens(`/vendors/${"a".repeat(40)}`)).toBe(`/vendors/${"a".repeat(40)}`);
  });
});
