import { describe, it, expect } from "vitest";
import { anonSessionHash } from "./anon-session";

function req(headers: Record<string, string>): Request {
  return new Request("https://example.com/vendors", { headers });
}

describe("anonSessionHash", () => {
  const day = new Date("2026-06-25T12:00:00Z");
  const h = { "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0", "accept-language": "en-GB" };

  it("is deterministic for the same request + day", () => {
    expect(anonSessionHash(req(h), day)).toBe(anonSessionHash(req(h), day));
  });

  it("rotates across UTC days", () => {
    const next = new Date("2026-06-26T12:00:00Z");
    expect(anonSessionHash(req(h), day)).not.toBe(anonSessionHash(req(h), next));
  });

  it("differs by client signal", () => {
    const other = anonSessionHash(req({ ...h, "x-forwarded-for": "198.51.100.2" }), day);
    expect(anonSessionHash(req(h), day)).not.toBe(other);
  });

  it("leaks no raw PII — opaque 32-char hex, no ip/ua substring", () => {
    const hash = anonSessionHash(req(h), day);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("203.0.113.7");
    expect(hash.toLowerCase()).not.toContain("mozilla");
  });

  it("handles missing headers without throwing", () => {
    expect(() => anonSessionHash(req({}), day)).not.toThrow();
  });
});
