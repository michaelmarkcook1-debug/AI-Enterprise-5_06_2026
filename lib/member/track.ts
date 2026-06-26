// Single-item watchlist tracking — the in-context "Track" CTA backend.
// ────────────────────────────────────────────────────────────────────
// Reads/writes ONLY the member_watchlists table (firewalled from scores). A track
// item is "vendor:<slug>" or "category:<id>"; we validate against the real
// taxonomies and never persist an id we can't resolve.

import { getPrisma, hasDatabase } from "../prisma";
import { ENTITIES } from "../intelligence/entities";
import { MARKET_CATEGORIES } from "../intelligence/seed";
import { getMemberWatchlist } from "./watchlist";

const VENDOR_SLUGS = new Set(ENTITIES.map((e) => e.slug));
const CATEGORY_IDS = new Set(MARKET_CATEGORIES.map((c) => c.id as string));

export interface TrackItem {
  field: "vendors" | "categories";
  id: string;
}

const VENDOR_NAME = new Map(ENTITIES.map((e) => [e.slug, e.name]));
const CATEGORY_NAME = new Map(MARKET_CATEGORIES.map((c) => [c.id as string, c.name]));

/** Human display name for a validated track token, or null if unknown. */
export function trackItemLabel(raw: unknown): string | null {
  const item = parseTrackItem(raw);
  if (!item) return null;
  return (item.field === "vendors" ? VENDOR_NAME.get(item.id) : CATEGORY_NAME.get(item.id)) ?? null;
}

/** Parse + validate a "vendor:<slug>" / "category:<id>" token. null if unknown. */
export function parseTrackItem(raw: unknown): TrackItem | null {
  if (typeof raw !== "string") return null;
  const idx = raw.indexOf(":");
  if (idx < 0) return null;
  const prefix = raw.slice(0, idx);
  const id = raw.slice(idx + 1).trim();
  if (!id) return null;
  if (prefix === "vendor" && VENDOR_SLUGS.has(id)) return { field: "vendors", id };
  if (prefix === "category" && CATEGORY_IDS.has(id)) return { field: "categories", id };
  return null;
}

/** Add or remove one tracked item for a member. Returns the new tracked state for
 *  that item, or null if the item is invalid. Targeted single-field write. */
export async function toggleTrack(
  subscriberId: string,
  raw: unknown,
  action: "add" | "remove",
): Promise<{ tracked: boolean } | null> {
  const item = parseTrackItem(raw);
  if (!item) return null;
  if (!hasDatabase()) return { tracked: action === "add" };

  const current = await getMemberWatchlist(subscriberId);
  const set = new Set(current[item.field]);
  if (action === "add") set.add(item.id);
  else set.delete(item.id);
  const next = { ...current, [item.field]: [...set] };

  await getPrisma().memberWatchlist.upsert({
    where: { subscriberId },
    create: { subscriberId, ...next },
    update: {
      vendors: next.vendors,
      categories: next.categories,
      useCases: next.useCases,
      currentStack: next.currentStack,
    },
  });
  return { tracked: action === "add" };
}

/** Validate a return-to path: must be a SAME-SITE relative path (no open redirect).
 *  Falls back to /watchlist. */
export function safeReturnTo(raw: unknown): string {
  if (
    typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/\\")
  ) {
    return raw;
  }
  return "/monitor";
}
