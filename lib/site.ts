// Canonical site origin + URL helpers for the public SEO surface.
// ───────────────────────────────────────────────────────────────
// One source of truth for the public origin so metadata canonicals, OpenGraph
// URLs, the sitemap and robots all agree. Override with NEXT_PUBLIC_SITE_URL in
// production; falls back to the existing app URL convention.

const RAW_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://ranking-engine-red.vercel.app";

/** Canonical origin, no trailing slash. */
export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");

export const SITE_NAME = "AI Enterprise";

/** Absolute URL for a path (path may start with or without a leading slash). */
export function absoluteUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p === "/" ? "" : p}`;
}

/**
 * A TRUSTED origin for building security-bearing URLs (e.g. magic links) and
 * auth redirects — NEVER derived from the client-controllable Host header.
 * Production uses the canonical SITE_URL; preview uses the Vercel-set VERCEL_URL
 * (trusted, per-deployment) so links still self-host on preview deployments.
 */
export function trustedOrigin(): string {
  if (process.env.VERCEL_ENV === "production") return SITE_URL;
  const v = process.env.VERCEL_URL; // set by Vercel, not from the request Host
  if (v) return `https://${v.replace(/\/+$/, "")}`;
  return SITE_URL;
}
