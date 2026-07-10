// News→Assessment bridge (C12) — server-side assembly. Resolves the canonical
// vendor index ONCE (cached DB read, no LLM) and computes a State-B bridge for
// each news item via the pure JOIN. Server-only (imports the intelligence
// repository); keep this out of client bundles — the pure `bridge.ts` is the
// client-safe half.

import { listIntelligenceVendors } from "../intelligence/repository";
import { newsBridge, buildVendorIndex, type NewsBridge } from "./bridge";

export interface BridgeableItem {
  id: string;
  /** All vendor tokens the item mentions (may be `vendor_`-prefixed). */
  vendors: string[];
  /** Optional resolved primary id (ensures the lead vendor is always included). */
  primaryVendorId?: string | null;
}

/** Compute a State-B bridge for each item, keyed by news-item id. One vendor
 *  read for the whole set. Never returns a score. */
export async function buildNewsBridges(items: readonly BridgeableItem[]): Promise<Map<string, NewsBridge>> {
  const out = new Map<string, NewsBridge>();
  if (items.length === 0) return out;
  const vendors = await listIntelligenceVendors().catch(() => []);
  const index = buildVendorIndex(vendors);
  for (const it of items) {
    // Lead vendor first (dedup handled inside newsBridge), then the rest.
    const tokens = it.primaryVendorId ? [it.primaryVendorId, ...it.vendors] : it.vendors;
    out.set(it.id, newsBridge(it.id, tokens, index));
  }
  return out;
}
