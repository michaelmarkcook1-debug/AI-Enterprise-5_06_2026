// Within-category composite ranking — data assembly + gating.
// ───────────────────────────────────────────────────────────────────────────
// Composes the deterministic engine over real, source-backed inputs, grouped
// WITHIN each market category. Gates the whole block on isLiveData() so nothing
// renders unless backed by verified evidence — never seed/default.

import {
  listMarketCategories,
  listMarketShareEstimates,
  listIntelligenceVendors,
  listVendorPillarScores,
} from "../intelligence/repository";
import { isLiveData } from "../intelligence/provenance";
import type { MarketShareEstimate, VendorPillarScore } from "../intelligence/types";
import { scoreVendorComposite, compareRanked, METHODOLOGY_NOTE } from "./composite-engine";
import type { CategoryComposite, CategoryRankedVendor } from "./composite-types";

/** All categories with their within-category composite rankings. Guarded:
 *  returns [] on read failure rather than throwing (mirrors category-rankings). */
export async function getCategoryComposites(): Promise<CategoryComposite[]> {
  const [live, categories, estimates, vendors, pillarScores] = await Promise.all([
    isLiveData(),
    listMarketCategories().catch(() => []),
    listMarketShareEstimates().catch(() => []),
    listIntelligenceVendors().catch(() => []),
    listVendorPillarScores().catch(() => []),
  ]);

  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  const scoresByVendor = new Map<string, VendorPillarScore[]>();
  for (const s of pillarScores) {
    const arr = scoresByVendor.get(s.vendorId);
    if (arr) arr.push(s);
    else scoresByVendor.set(s.vendorId, [s]);
  }

  // Market-share rows are CONTEXT + the category-membership signal only.
  const shareByVendorCat = new Map<string, MarketShareEstimate>();
  for (const e of estimates) shareByVendorCat.set(`${e.vendorId}__${e.categoryId}`, e);

  return categories.map((category) => {
    // Membership: a vendor is in this category iff it has an estimate row here.
    const memberIds = [
      ...new Set(estimates.filter((e) => e.categoryId === category.id).map((e) => e.vendorId)),
    ];

    const scored = memberIds.flatMap((id) => {
      const vendor = vendorById.get(id);
      if (!vendor) return [] as CategoryRankedVendor[];
      const share = shareByVendorCat.get(`${id}__${category.id}`);
      return [scoreVendorComposite(vendor, scoresByVendor.get(id) ?? [], share)];
    });

    const ranked = scored
      .filter((x) => x.state === "ranked")
      .sort(compareRanked)
      .map((x, i) => ({ ...x, rank: i + 1 }));
    const incomplete = scored
      .filter((x) => x.state === "incomplete")
      // Deterministic order (mirrors compareRanked's terminal tie-break): coverage
      // desc, then vendorId — so display order never depends on DB row order.
      .sort((a, b) => {
        const byCov = b.coverage - a.coverage;
        return Math.abs(byCov) > 1e-9 ? byCov : a.vendorId.localeCompare(b.vendorId);
      });

    return { category, ranked, incomplete, isLive: live, methodologyNote: METHODOLOGY_NOTE };
  });
}

/** One category's composite (for /category/[slug]). */
export async function getCategoryComposite(slug: string): Promise<CategoryComposite | null> {
  const all = await getCategoryComposites();
  return all.find((c) => c.category.id === slug) ?? null;
}

/** A vendor's standing across every category it competes in — for the profile.
 *  Each entry includes the vendor's own CategoryRankedVendor + the size of the
 *  ranked field, so the profile can show "#2 of 7 ranked" honestly. */
export interface VendorCategoryStanding {
  categoryId: string;
  categoryName: string;
  standing: CategoryRankedVendor;
  rankedCount: number;
  isLive: boolean;
}

export async function getVendorCategoryStandings(
  vendorId: string,
): Promise<VendorCategoryStanding[]> {
  const all = await getCategoryComposites();
  const out: VendorCategoryStanding[] = [];
  for (const c of all) {
    const standing =
      c.ranked.find((v) => v.vendorId === vendorId) ??
      c.incomplete.find((v) => v.vendorId === vendorId);
    if (standing) {
      out.push({
        categoryId: c.category.id,
        categoryName: c.category.name,
        standing,
        rankedCount: c.ranked.length,
        isLive: c.isLive,
      });
    }
  }
  return out;
}
