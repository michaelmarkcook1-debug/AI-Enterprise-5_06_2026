// News→Assessment bridge (C12) — the honest JOIN from a market-news item to the
// vendor assessment(s) it bears on.
// ─────────────────────────────────────────────────────────────────────────────
// THE HARD RULE (the strictest no-fabrication surface — the most public):
//  • This is a DETERMINISTIC JOIN over existing data (news → the vendors it
//    mentions), NOT a scoring path. It NEVER mints a score, delta, or direction.
//  • Two states in the C12 spec: State A = a REAL before→after delta, shown ONLY
//    when the evidence pipeline genuinely re-scored the vendor and recorded that
//    delta with a citation; State B = "pending re-assessment", no number.
//  • As built today there is NO mechanism that records a real, news-linked
//    re-score delta (news never becomes analyst_verified evidence; the daily
//    recompute is not linked back to a news item). So EVERY bridge is State B.
//  • This type is deliberately shaped so State A is UNREPRESENTABLE here: there is
//    no numeric/delta field to populate. A future real re-score linkage adds the
//    State-A variant explicitly; until then nothing can render a fabricated
//    movement even by accident.
//
// Pure + client-safe: no DB/LLM imports. The server resolves the vendor index
// (lib/intelligence) and calls this; the panel renders the returned data.

/** State B is the only state reachable today (see the file header). Modelled as
 *  a string union so adding a real State-A variant later is an explicit, typed
 *  change — never a silent number. */
export type BridgeState = "pending_reassessment";

export interface BridgeVendor {
  /** Canonical vendor id (bare, e.g. "anthropic"). */
  id: string;
  name: string;
  /** Route slug for /vendors/[slug] — may differ from id (alibaba/moonshot/zai). */
  slug: string;
}

export interface NewsBridge {
  newsItemId: string;
  /** Vendors this item touches, resolved + routable. Empty = no tracked vendor
   *  matched (the panel then shows nothing rather than inventing a target). */
  vendors: BridgeVendor[];
  /** ALWAYS "pending_reassessment" today. There is intentionally NO delta/number
   *  field on this type — State A is unrepresentable until a real re-score
   *  linkage exists. */
  state: BridgeState;
}

/** The single honest label for the current (State B) bridge. Rendered verbatim so
 *  copy can't drift into implying a movement. */
export const PENDING_LABEL =
  "Flagged — may affect this vendor's assessment. Pending re-assessment; no score change is claimed." as const;

/**
 * Pure JOIN. Given a news item's vendor tokens (which may be `vendor_`-prefixed
 * or bare ids/slugs) and a resolution index, return the routable vendors it
 * touches. Deterministic, order-preserving, de-duplicated. Never returns a score.
 */
export function newsBridge(
  newsItemId: string,
  vendorTokens: readonly string[],
  index: ReadonlyMap<string, BridgeVendor>,
): NewsBridge {
  const seen = new Set<string>();
  const vendors: BridgeVendor[] = [];
  for (const tok of vendorTokens) {
    if (!tok) continue;
    const key = tok.replace(/^vendor_/, "");
    const v = index.get(key);
    if (v && !seen.has(v.id)) {
      seen.add(v.id);
      vendors.push(v);
    }
  }
  return { newsItemId, vendors, state: "pending_reassessment" };
}

/** Build the resolution index from the canonical vendor list, keyed by BOTH id
 *  and slug so a news token in either form resolves. Pure over its input. */
export function buildVendorIndex(
  vendors: readonly { id: string; slug: string; name: string }[],
): Map<string, BridgeVendor> {
  const idx = new Map<string, BridgeVendor>();
  for (const v of vendors) {
    const bv: BridgeVendor = { id: v.id, name: v.name, slug: v.slug };
    idx.set(v.id, bv);
    if (v.slug && v.slug !== v.id) idx.set(v.slug, bv);
  }
  return idx;
}
