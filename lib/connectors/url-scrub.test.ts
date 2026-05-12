import { describe, expect, it } from "vitest";
import { scrubSecretsFromUrl, urlContainsSecret, SCRUB_SECRET_PLACEHOLDER } from "./url-scrub";

describe("scrubSecretsFromUrl", () => {
  it("scrubs api_key from EIA-style URLs", () => {
    const url = "https://api.eia.gov/v2/electricity/retail-sales/data?api_key=SECRETXYZ&frequency=monthly";
    const scrubbed = scrubSecretsFromUrl(url)!;
    expect(scrubbed).not.toContain("SECRETXYZ");
    expect(scrubbed).toContain(`api_key=${SCRUB_SECRET_PLACEHOLDER}`);
    expect(scrubbed).toContain("frequency=monthly");
  });

  it("scrubs api_key from FRED-style URLs", () => {
    const url = "https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=DEADBEEF&file_type=json";
    expect(urlContainsSecret(url)).toBe(true);
    const scrubbed = scrubSecretsFromUrl(url)!;
    expect(urlContainsSecret(scrubbed)).toBe(false);
  });

  it("scrubs the camelCase apikey variant", () => {
    const url = "https://example.com/data?apikey=DEADBEEF";
    expect(urlContainsSecret(url)).toBe(true);
    expect(urlContainsSecret(scrubSecretsFromUrl(url))).toBe(false);
  });

  it("scrubs token / access_token / client_secret / x-api-key", () => {
    for (const param of ["token", "access_token", "client_secret", "x-api-key", "secret", "auth_token"]) {
      const url = `https://example.com/r?${param}=ZZZ&keep=this`;
      expect(urlContainsSecret(url)).toBe(true);
      const scrubbed = scrubSecretsFromUrl(url)!;
      expect(urlContainsSecret(scrubbed)).toBe(false);
      expect(scrubbed).toContain("keep=this");
    }
  });

  it("is case-insensitive on param names", () => {
    const url = "https://example.com/r?API_KEY=SECRET";
    expect(urlContainsSecret(url)).toBe(true);
    expect(urlContainsSecret(scrubSecretsFromUrl(url))).toBe(false);
  });

  it("passes through URLs without secrets unchanged", () => {
    const url = "https://example.com/r?id=42&page=2";
    expect(scrubSecretsFromUrl(url)).toBe(url);
  });

  it("returns input unchanged for null/undefined/empty", () => {
    expect(scrubSecretsFromUrl(null)).toBeUndefined();
    expect(scrubSecretsFromUrl(undefined)).toBeUndefined();
    expect(scrubSecretsFromUrl("")).toBe("");
  });

  it("returns input unchanged for malformed URLs (defensive)", () => {
    expect(scrubSecretsFromUrl("not a url")).toBe("not a url");
    expect(scrubSecretsFromUrl("/relative/path?api_key=X")).toBe("/relative/path?api_key=X");
  });

  it("INVARIANT — connector URL with api_key NEVER leaks through scrub", () => {
    // Real-world fixture from the EIA connector
    const url = "https://api.eia.gov/v2/electricity/retail-sales/data?api_key=0d997de768fee586fc60095b5facea41&frequency=monthly&data%5B0%5D=price";
    const scrubbed = scrubSecretsFromUrl(url)!;
    expect(scrubbed).not.toContain("0d997de768fee586fc60095b5facea41");
    expect(urlContainsSecret(scrubbed)).toBe(false);
  });
});
