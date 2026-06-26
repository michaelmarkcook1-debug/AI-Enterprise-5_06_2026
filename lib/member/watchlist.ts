// Member watchlist persistence (Phase 2 Wave 1).
// ───────────────────────────────────────────────
// FIREWALLED: this stores a member's saved selections as plain strings (vendor
// slugs, category ids, use-case ids) and NEVER reads or writes any score table.
// All writes are validated against the real taxonomies, deduped, and size-capped.

import { getPrisma, hasDatabase } from "../prisma";
import { ENTITIES } from "../intelligence/entities";
import { MARKET_CATEGORIES } from "../intelligence/seed";
import { USE_CASES } from "../use-cases";

const VALID_VENDOR_SLUGS = new Set(ENTITIES.map((e) => e.slug));
const VALID_CATEGORY_IDS = new Set(MARKET_CATEGORIES.map((c) => c.id as string));
const VALID_USE_CASE_IDS = new Set(USE_CASES.map((u) => u.id));

const MAX_PER_LIST = 50;

export interface MemberWatchlistView {
  vendors: string[];
  categories: string[];
  useCases: string[];
  currentStack: string[];
}

const EMPTY: MemberWatchlistView = { vendors: [], categories: [], useCases: [], currentStack: [] };

/** Keep only known, non-empty, deduped values; cap the length. Unknown ids are
 *  dropped silently (we never persist a value we can't resolve to a real entity). */
function cleanList(input: unknown, valid: Set<string>): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    const v = x.trim();
    if (!v || !valid.has(v) || out.includes(v)) continue;
    out.push(v);
    if (out.length >= MAX_PER_LIST) break;
  }
  return out;
}

export async function getMemberWatchlist(subscriberId: string): Promise<MemberWatchlistView> {
  if (!hasDatabase()) return EMPTY;
  const row = await getPrisma().memberWatchlist.findUnique({ where: { subscriberId } });
  if (!row) return EMPTY;
  return {
    vendors: row.vendors,
    categories: row.categories,
    useCases: row.useCases,
    currentStack: row.currentStack,
  };
}

/** Pure validation: keep only known/deduped/capped ids across all four lists.
 *  Exported for testing — the persistence path below reuses it. */
export function sanitizeWatchlist(input: unknown): MemberWatchlistView {
  const i = (input ?? {}) as Partial<MemberWatchlistView>;
  return {
    vendors: cleanList(i.vendors, VALID_VENDOR_SLUGS),
    categories: cleanList(i.categories, VALID_CATEGORY_IDS),
    useCases: cleanList(i.useCases, VALID_USE_CASE_IDS),
    currentStack: cleanList(i.currentStack, VALID_VENDOR_SLUGS),
  };
}

export async function saveMemberWatchlist(subscriberId: string, input: unknown): Promise<MemberWatchlistView> {
  const data = sanitizeWatchlist(input);
  if (!hasDatabase()) return data;
  await getPrisma().memberWatchlist.upsert({
    where: { subscriberId },
    create: { subscriberId, ...data },
    update: data,
  });
  return data;
}
