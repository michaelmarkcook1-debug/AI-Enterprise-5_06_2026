// lib/shield/vendor-map.ts — crosswalk between the Shield ledger and our vendors.
// ─────────────────────────────────────────────────────────────────────────────
// The Shield (lib/shield/data.ts) is its own curated dataset, slugged its own
// way ("anthropic-api", "google-gemini"). Our rankings key on bare vendor ids
// ("anthropic", "google"). This is the only place the two vocabularies meet.
//
// THE HONESTY RULE THIS FILE EXISTS TO ENFORCE: the Shield grades model
// providers — the labs whose own terms govern your IP. It has nothing to say
// about a chip designer, a neocloud, or an application vendor. "No Shield row"
// therefore means NOT APPLICABLE, and must never render as a zero, a low score,
// a gap, or an absence of protection. A vendor the Shield doesn't cover has not
// failed the Shield; it was never in scope. Callers get `null` and are expected
// to render nothing rather than something bad.
//
// Reka is the one Shield vendor we don't track: it stays in the standalone
// ledger (it's the Shield's own data) but resolves to null here, so it never
// links to a profile and can never appear in a shortlist.

import { SHIELD, type VendorShield } from "./data";

/** Shield slug → our bare vendor id. `null` = the Shield covers it, we don't. */
const SHIELD_SLUG_TO_VENDOR_ID: Record<string, string | null> = {
  "openai-api": "openai",
  "anthropic-api": "anthropic",
  "google-gemini": "google",
  "mistral-la-plateforme": "mistral",
  "meta-llama": "meta",
  deepseek: "deepseek",
  cohere: "cohere",
  "xai-grok": "xai",
  "ai21-jamba": "ai21",
  "ibm-granite": "ibm",
  "alibaba-qwen": "alibaba",
  "zai-glm": "zai",
  "moonshot-kimi": "moonshot",
  reka: null, // model provider, not in our vendor set — ledger-only
};

/** Reverse index, built once. Vendors we track → their Shield row. */
const VENDOR_ID_TO_SHIELD: Map<string, VendorShield> = new Map(
  SHIELD.flatMap((s) => {
    const id = SHIELD_SLUG_TO_VENDOR_ID[s.slug];
    return id ? ([[id, s]] as [string, VendorShield][]) : [];
  }),
);

/**
 * The Shield row for one of our vendors, or null when the Shield doesn't cover
 * it. Null is the common case (37 of our 50 vendors) and is NOT a finding —
 * see the not-applicable rule above.
 */
export function shieldForVendorId(vendorId: string): VendorShield | null {
  return VENDOR_ID_TO_SHIELD.get(vendorId) ?? null;
}

/**
 * True when the Shield is in scope for this vendor at all. Use this to decide
 * whether to render a Shield section, so an out-of-scope vendor shows nothing
 * rather than an empty or zeroed one.
 */
export function shieldAppliesTo(vendorId: string): boolean {
  return VENDOR_ID_TO_SHIELD.has(vendorId);
}

/** Our vendor id for a Shield row, or null for ledger-only rows (Reka). */
export function vendorIdForShieldSlug(shieldSlug: string): string | null {
  return SHIELD_SLUG_TO_VENDOR_ID[shieldSlug] ?? null;
}

/** Every vendor id the Shield can speak to — the shortlist intersection set. */
export function shieldCoveredVendorIds(): string[] {
  return [...VENDOR_ID_TO_SHIELD.keys()];
}
