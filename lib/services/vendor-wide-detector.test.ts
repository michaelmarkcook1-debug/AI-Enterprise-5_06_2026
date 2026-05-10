import { describe, expect, it } from "vitest";
import { isVendorWideUrl } from "./vendor-wide-detector";

describe("isVendorWideUrl — vendor-wide page detection", () => {
  it.each([
    "https://writer.com/security/",
    "https://writer.com/plans/",
    "https://www.glean.com/security",
    "https://harvey.ai/security",
    "https://www.ibm.com/trust",
    "https://www.sap.com/about/trust-center.html",
    "https://www.anthropic.com/pricing",
    "https://cohere.com/pricing",
    "https://cohere.com/security",
  ])("matches %s as vendor-wide", (url) => {
    expect(isVendorWideUrl(url).match).toBe(true);
  });

  it("does NOT match product-specific sub-pages even if path contains 'pricing'", () => {
    // /bedrock/pricing is the Bedrock pricing page — bind to Bedrock,
    // not to AWS as a whole. Vendor-wide detection looks at the FIRST
    // path segment only.
    expect(isVendorWideUrl("https://aws.amazon.com/bedrock/pricing/").match).toBe(false);
  });

  it("matches status. and trust. subdomains", () => {
    expect(isVendorWideUrl("https://status.snowflake.com/").match).toBe(true);
    expect(isVendorWideUrl("https://status.cloud.google.com/").match).toBe(true);
    expect(isVendorWideUrl("https://trust.openai.com/").match).toBe(true);
    expect(isVendorWideUrl("https://trust.servicenow.com/foo").match).toBe(true);
  });

  it.each([
    "https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-overview",
    "https://www.snowflake.com/en/product/features/cortex/",
    "https://platform.openai.com/docs/api-reference",
    "https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html",
  ])("does NOT match product page %s", (url) => {
    expect(isVendorWideUrl(url).match).toBe(false);
  });

  it("returns false for null/undefined/empty/bad URLs", () => {
    expect(isVendorWideUrl(null).match).toBe(false);
    expect(isVendorWideUrl(undefined).match).toBe(false);
    expect(isVendorWideUrl("").match).toBe(false);
    expect(isVendorWideUrl("not a url").match).toBe(false);
  });

  it("returns the matched signal in the result", () => {
    expect(isVendorWideUrl("https://example.com/security/encryption").signal).toBe("security");
    expect(isVendorWideUrl("https://example.com/pricing").signal).toBe("pricing");
    expect(isVendorWideUrl("https://status.openai.com/").signal).toBe("status");
    expect(isVendorWideUrl("https://trust.openai.com/").signal).toBe("trust");
  });
});
