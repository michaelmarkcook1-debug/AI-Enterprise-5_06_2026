import { describe, it, expect } from "vitest";
import { isSameOrigin } from "./same-origin";

// Mock a Request with arbitrary headers (Headers() strips the forbidden "host").
function req(h: Record<string, string | undefined>): Request {
  return { headers: { get: (k: string) => h[k.toLowerCase()] ?? null } } as unknown as Request;
}

describe("isSameOrigin", () => {
  it("allows a same-origin POST (Origin host matches request host)", () => {
    expect(isSameOrigin(req({ host: "ex.com", origin: "https://ex.com" }))).toBe(true);
  });

  it("rejects a cross-origin POST (foreign Origin)", () => {
    expect(isSameOrigin(req({ host: "ex.com", origin: "https://evil.com" }))).toBe(false);
  });

  it("falls back to Referer when Origin is absent", () => {
    expect(isSameOrigin(req({ host: "ex.com", referer: "https://ex.com/x" }))).toBe(true);
    expect(isSameOrigin(req({ host: "ex.com", referer: "https://evil.com/x" }))).toBe(false);
  });

  it("allows when neither Origin nor Referer is present (rely on sameSite cookie)", () => {
    expect(isSameOrigin(req({ host: "ex.com" }))).toBe(true);
  });

  it("rejects when there is no host header at all", () => {
    expect(isSameOrigin(req({ origin: "https://ex.com" }))).toBe(false);
  });

  it("works on preview/prod hosts equally (compares to the request's own host)", () => {
    expect(isSameOrigin(req({ host: "preview-abc.vercel.app", origin: "https://preview-abc.vercel.app" }))).toBe(true);
    expect(isSameOrigin(req({ host: "preview-abc.vercel.app", origin: "https://other.vercel.app" }))).toBe(false);
  });
});
