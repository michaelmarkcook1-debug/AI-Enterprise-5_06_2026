import {
  listMarketCategories,
  listMarketShareEstimates,
  listIntelligenceVendors,
} from "@/lib/intelligence/repository";
import type { Vendor, MarketCategory } from "@/lib/intelligence/types";

// Rankings are SEGMENTED BY CATEGORY — vendors are only ever compared WITHIN a
// category, never across them (a chip foundry, a VC, and a model lab are not one
// leaderboard). This mirrors the canonical /category/[slug] model: group the
// source-backed market-share estimates by their original category and rank by
// estimatedShare. Shares are directional analyst estimates (labelled in the UI).

export interface CategoryLeader {
  vendor: Vendor;
  estimatedShare: number;
  confidence: number;
}

export interface CategoryRanking {
  category: MarketCategory;
  leaders: CategoryLeader[];
}

/** Group estimates by their original category; rank vendors within each.
 *  Guarded: returns [] on any read failure rather than throwing. */
export async function getCategoryRankings(): Promise<CategoryRanking[]> {
  const [categories, estimates, vendors] = await Promise.all([
    listMarketCategories().catch(() => []),
    listMarketShareEstimates().catch(() => []),
    listIntelligenceVendors().catch(() => []),
  ]);
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  return categories.map((category) => {
    const leaders = estimates
      .filter((e) => e.categoryId === category.id)
      .map((e) => {
        const vendor = vendorById.get(e.vendorId);
        return vendor ? { vendor, estimatedShare: e.estimatedShare, confidence: e.confidence } : null;
      })
      .filter((x): x is CategoryLeader => x !== null)
      .sort((a, b) => b.estimatedShare - a.estimatedShare);
    return { category, leaders };
  });
}
