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
