// Vendor-wide URL detector — pure helper.
// ────────────────────────────────────────
// True when the URL points to a page whose claims apply to every product
// the vendor sells: trust centres, security pages, pricing pages, status
// pages, "/about" pages, legal/DPA pages.

const VENDOR_WIDE_PATH_PATTERNS = [
  /^trust(?:[-_/]|$)/i,
  /^security(?:[-_/]|$)/i,
  /^pricing(?:[-_/]|$)/i,
  /^plans(?:[-_/]|$)/i,
  /^status(?:[-_/]|$)/i,
  /^about(?:[-_/]|$)/i,
  /^legal(?:[-_/]|$)/i,
  /^compliance(?:[-_/]|$)/i,
  /^dpa(?:[-_/]|$)/i,
];

const VENDOR_WIDE_HOST_PREFIXES = ["status.", "trust."];

export interface VendorWideMatch {
  match: boolean;
  /** The path token or host prefix that triggered the match. */
  signal?: string;
}

export function isVendorWideUrl(rawUrl: string | null | undefined): VendorWideMatch {
  if (!rawUrl) return { match: false };
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { match: false };
  }
  // 1. Subdomain check — status.openai.com, trust.servicenow.com, etc.
  const host = parsed.hostname.toLowerCase();
  for (const prefix of VENDOR_WIDE_HOST_PREFIXES) {
    if (host.startsWith(prefix)) {
      return { match: true, signal: prefix.replace(".", "") };
    }
  }
  // 2. Path check — first path segment maps to a vendor-wide pattern.
  const pathname = parsed.pathname.toLowerCase();
  const stripped = pathname.replace(/^\//, "");
  for (const rx of VENDOR_WIDE_PATH_PATTERNS) {
    if (rx.test(stripped)) {
      const m = stripped.match(/^([a-z][-_a-z]*)/i);
      return { match: true, signal: m?.[1] };
    }
  }
  return { match: false };
}
