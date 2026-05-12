import { afterEach, describe, expect, it } from "vitest";
import {
  vendorDocsConnector,
  isAnthropicKeyValid,
  VENDOR_DOCS_NOT_CONFIGURED_MESSAGE,
} from "./vendorDocs";

describe("isAnthropicKeyValid", () => {
  it("accepts sk-ant- prefixed long keys", () => {
    expect(isAnthropicKeyValid("sk-ant-0123456789abcdef0123")).toBe(true);
  });
  it("rejects missing / short / wrongly-prefixed keys", () => {
    expect(isAnthropicKeyValid(undefined)).toBe(false);
    expect(isAnthropicKeyValid("")).toBe(false);
    expect(isAnthropicKeyValid("sk-ant-")).toBe(false);
    expect(isAnthropicKeyValid("test-key")).toBe(false);
    expect(isAnthropicKeyValid("sk-something-else")).toBe(false);
  });
});

describe("vendorDocsConnector.health()", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("missing ANTHROPIC_API_KEY → configured=false, status=not_configured, message set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    const h = vendorDocsConnector.health();
    expect(h.configured).toBe(false);
    expect(h.status).toBe("not_configured");
    expect(h.message).toBe(VENDOR_DOCS_NOT_CONFIGURED_MESSAGE);
    expect(h.envVars).toContain("ANTHROPIC_API_KEY");
    expect(h.tier).toBe("official");
    expect(h.defaultEvidenceGrade).toBe("E2");
  });

  it("valid key → configured=true, ok, message cleared", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test1234567890abcdef";
    const h = vendorDocsConnector.health();
    expect(h.configured).toBe(true);
    expect(h.status).toBe("ok");
    expect(h.message).toBeUndefined();
  });
});

describe("vendorDocsConnector.fetch()", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("missing key → not_configured (honest gate even though the fetch itself doesn't need the key)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await vendorDocsConnector.fetch();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("not_configured");
    expect(result.error).toBe(VENDOR_DOCS_NOT_CONFIGURED_MESSAGE);
    expect(result.records).toEqual([]);
  });

  it("with key, returns the full manifest grouped by vendor", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test1234567890abcdef";
    const result = await vendorDocsConnector.fetch();
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.records.length).toBeGreaterThan(0);
    // Every record has a vendor + at least one manifest URL
    for (const r of result.records) {
      expect(r.vendorId).toBeTruthy();
      expect(r.totalSources).toBeGreaterThan(0);
      expect(r.manifestUrls.length).toBe(r.totalSources);
    }
  });

  it("with key + vendorId scope, narrows to that vendor", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test1234567890abcdef";
    // Try a vendor that's definitely in the manifest — vendor_openai
    const result = await vendorDocsConnector.fetch({ vendorId: "vendor_openai" });
    if (result.ok) {
      expect(result.records.length).toBeLessThanOrEqual(1);
      if (result.records.length === 1) {
        expect(result.records[0].vendorId).toBe("vendor_openai");
      }
    } else {
      // Honest about empty manifest sections — error, not fake ok.
      expect(result.status).toBe("error");
    }
  });

  it("unknown vendor → error (not fake ok)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test1234567890abcdef";
    const result = await vendorDocsConnector.fetch({ vendorId: "vendor_does_not_exist" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.error).toMatch(/No manifest entries/);
  });

  it("normaliseFetchResult produces a NormalisedEvidenceSource at E2", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test1234567890abcdef";
    const result = await vendorDocsConnector.fetch();
    const { normaliseFetchResult } = await import("../evidence/normalise");
    const evidence = normaliseFetchResult(vendorDocsConnector.health(), result);
    expect(evidence.connectorId).toBe("vendorDocs");
    expect(evidence.evidenceGrade).toBe("E2");
    expect(evidence.sourceType).toBe("official");
  });
});
