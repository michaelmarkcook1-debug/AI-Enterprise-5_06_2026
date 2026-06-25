// Public-route rate limiter (scaffold).
// ──────────────────────────────────────
// A small fixed-window limiter for the public API routes that land in Wave 2/4
// (email capture, intent logging, search). The brief requires every public
// route to be rate-limited so the free surface can't be hammered into cost or
// abuse.
//
// SCOPE NOTE — this is an in-memory limiter. On Vercel Fluid Compute instances
// are reused, so it throttles effectively per warm instance, which is the right
// first line of defence. When the public routes go live in Wave 2 and we want a
// global limit across instances, back this with a durable store (Vercel KV /
// Upstash) behind the SAME signature — callers won't change.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Opportunistic sweep so the Map can't grow unbounded on a long-lived instance.
const MAX_KEYS = 10_000;

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** ms until the current window resets. */
  resetMs: number;
}

/**
 * Fixed-window rate limit for a key (e.g. an anon session hash or IP).
 * Pure-ish: mutates the in-process bucket map and returns the verdict.
 */
export function rateLimit(key: string, opts: RateLimitOptions, now: number = Date.now()): RateLimitResult {
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: opts.limit - 1, limit: opts.limit, resetMs: opts.windowMs };
  }

  existing.count += 1;
  const allowed = existing.count <= opts.limit;
  return {
    allowed,
    remaining: Math.max(0, opts.limit - existing.count),
    limit: opts.limit,
    resetMs: Math.max(0, existing.resetAt - now),
  };
}

/** Standard headers to attach to a rate-limited response. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "x-ratelimit-limit": String(r.limit),
    "x-ratelimit-remaining": String(r.remaining),
    "x-ratelimit-reset": String(Math.ceil(r.resetMs / 1000)),
  };
}

/** Test seam — clear all buckets. */
export function __resetRateLimits(): void {
  buckets.clear();
}
