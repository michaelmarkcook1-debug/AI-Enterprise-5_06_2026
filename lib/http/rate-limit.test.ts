import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, rateLimitHeaders, __resetRateLimits } from "./rate-limit";

describe("rateLimit (fixed window)", () => {
  beforeEach(() => __resetRateLimits());

  it("allows up to the limit, then blocks within the window", () => {
    const opts = { limit: 3, windowMs: 1000 };
    const t = 1_000_000;
    expect(rateLimit("k", opts, t).allowed).toBe(true);
    expect(rateLimit("k", opts, t).allowed).toBe(true);
    expect(rateLimit("k", opts, t).allowed).toBe(true);
    const fourth = rateLimit("k", opts, t);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("k", opts, 1_000_000).allowed).toBe(true);
    expect(rateLimit("k", opts, 1_000_500).allowed).toBe(false);
    expect(rateLimit("k", opts, 1_001_001).allowed).toBe(true); // new window
  });

  it("tracks keys independently", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("a", opts, 1).allowed).toBe(true);
    expect(rateLimit("b", opts, 1).allowed).toBe(true);
    expect(rateLimit("a", opts, 1).allowed).toBe(false);
  });

  it("emits standard headers", () => {
    const r = rateLimit("h", { limit: 5, windowMs: 2000 }, 0);
    const headers = rateLimitHeaders(r);
    expect(headers["x-ratelimit-limit"]).toBe("5");
    expect(headers["x-ratelimit-remaining"]).toBe("4");
    expect(headers["x-ratelimit-reset"]).toBe("2");
  });
});
