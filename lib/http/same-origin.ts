// CSRF defence-in-depth for state-changing member routes.
// ────────────────────────────────────────────────────────
// The session cookie is sameSite="lax", which already blocks most cross-site
// POSTs. This adds an explicit Origin/Referer check on top. We compare against
// the REQUEST'S OWN host (not a fixed SITE_URL) so it holds on every deployment
// — preview URLs, prod domain, localhost — without allow-listing each one.

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * True when the request looks same-origin. A cross-site request carries a foreign
 * Origin/Referer and is rejected; a same-origin request matches the host it was
 * sent to. FAIL-CLOSED: if neither Origin nor Referer is present we reject —
 * browsers always attach Origin on unsafe (POST/PUT/DELETE) same-origin requests,
 * so this only blocks header-stripped/forged traffic, not legitimate callers.
 */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  const originHost = hostOf(request.headers.get("origin"));
  if (originHost) return originHost === host;

  const refererHost = hostOf(request.headers.get("referer"));
  if (refererHost) return refererHost === host;

  return false;
}
