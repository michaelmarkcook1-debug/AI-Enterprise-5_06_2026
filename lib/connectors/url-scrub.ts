// URL secret-scrubber.
// ────────────────────
// Strips known secret-bearing query parameters from a URL before it gets
// stored in audit logs, returned in API responses, or written to
// NormalisedEvidenceSource records. Connectors that pass keys in the URL
// (EIA, FRED, BEA, Alpha Vantage, Congress, etc.) MUST scrub before
// returning the URL to anything downstream.
//
// Defence-in-depth: even if a future caller forgets to scrub, downstream
// consumers (status route, demo dashboard, normalise.ts) re-scrub on read.

/** Param names treated as secrets. Compared case-insensitively. */
const SECRET_PARAM_NAMES = [
  "api_key",
  "apikey",
  "api-key",
  "key",
  "token",
  "access_token",
  "auth_token",
  "secret",
  "client_secret",
  "x-api-key",
];

const SCRUBBED_PLACEHOLDER = "***";

/** Returns the URL with every known secret param replaced by `***`.
 * Preserves the rest of the URL exactly. Safe to call on URLs without
 * secrets — returns the input verbatim. Safe to call on malformed URLs
 * — returns the input verbatim. */
export function scrubSecretsFromUrl(url: string | undefined | null): string | undefined {
  if (!url) return url ?? undefined;
  try {
    const u = new URL(url);
    let mutated = false;
    for (const [k] of [...u.searchParams.entries()]) {
      if (SECRET_PARAM_NAMES.some((s) => s.toLowerCase() === k.toLowerCase())) {
        u.searchParams.set(k, SCRUBBED_PLACEHOLDER);
        mutated = true;
      }
    }
    return mutated ? u.toString() : url;
  } catch {
    return url;
  }
}

/** Returns true iff the URL still contains any of the known secret
 * params at a non-placeholder value. Used by tests to assert no leak. */
export function urlContainsSecret(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    for (const [k, v] of u.searchParams.entries()) {
      if (
        SECRET_PARAM_NAMES.some((s) => s.toLowerCase() === k.toLowerCase()) &&
        v !== SCRUBBED_PLACEHOLDER &&
        v !== ""
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export const SCRUB_SECRET_PLACEHOLDER = SCRUBBED_PLACEHOLDER;
