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
import { scoreVendorComposite, evidenceCompletenessBand, METHODOLOGY_NOTE } from "./composite-engine";
import type { CategoryComposite, CategoryRankedVendor } from "./composite-types";
import { getVendorScorecardsBatch, type VendorScorecard } from "../assessment/domain-scores";
import {
  coverageAdjustedComposite,
  compareAdjusted,
  assessDiscrimination,
  assignTiers,
  detectRankingAnomalies,
  type RankRow,
} from "./credibility";

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

  // RANK-FIX — TRUE domain coverage per vendor (the scorecard the user sees).
  // One batched read for every member vendor; drives the coverage-discount + the
  // honest coverage labels. Defensive: an empty map → 0 coverage (no inflation).
  const allMemberIds = [...new Set(estimates.map((e) => e.vendorId))];
  const scorecards: Map<string, VendorScorecard> = await getVendorScorecardsBatch(allMemberIds).catch(
    () => new Map<string, VendorScorecard>(),
  );

  // Enrich a pillar-scored vendor with TRUE domain coverage + the linear
  // coverage-discount, and re-derive the completeness band from DOMAIN coverage
  // so the label can never read "full" while the strip shows gaps.
  function enrich(v: CategoryRankedVendor): CategoryRankedVendor {
    const sc = scorecards.get(v.vendorId);
    const domainTotal = sc?.domains.length ?? 12;
    const domainScored = sc?.scoredCount ?? 0;
    const domainCoverage = domainTotal > 0 ? domainScored / domainTotal : 0;
    const adjustedComposite = v.composite != null ? coverageAdjustedComposite(v.composite, domainCoverage) : null;
    return {
      ...v,
      domainScored,
      domainTotal,
      domainCoverage,
      adjustedComposite,
      evidenceCompleteness: v.state === "ranked" ? evidenceCompletenessBand(domainCoverage) : v.evidenceCompleteness,
    };
  }

  return categories.map((category) => {
    // Membership: a vendor is in this category iff it has an estimate row here.
    const memberIds = [
      ...new Set(estimates.filter((e) => e.categoryId === category.id).map((e) => e.vendorId)),
    ];

    const scored = memberIds.flatMap((id) => {
      const vendor = vendorById.get(id);
      if (!vendor) return [] as CategoryRankedVendor[];
      const share = shareByVendorCat.get(`${id}__${category.id}`);
      return [enrich(scoreVendorComposite(vendor, scoresByVendor.get(id) ?? [], share))];
    });

    // Rank by the COVERAGE-ADJUSTED composite (full evidence is never out-ranked
    // by thin evidence on a near-tied raw composite). Natural-break tiers + a
    // sanity-check make thin/compressed orderings honest rather than false-precise.
    const rankRows: RankRow[] = scored
      .filter((x) => x.state === "ranked")
      .map((v) => ({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        rawComposite: v.composite ?? 0,
        adjustedComposite: v.adjustedComposite ?? 0,
        domainCoverage: v.domainCoverage,
        confidence: v.compositeConfidence ?? 0,
      }))
      .sort(compareAdjusted);

    const tiers = assignTiers(rankRows.map((r) => r.adjustedComposite));
    const tierByVendor = new Map(rankRows.map((r, i) => [r.vendorId, tiers[i]] as const));
    const orderByVendor = new Map(rankRows.map((r, i) => [r.vendorId, i] as const));

    const ranked = scored
      .filter((x) => x.state === "ranked")
      .sort((a, b) => (orderByVendor.get(a.vendorId) ?? 0) - (orderByVendor.get(b.vendorId) ?? 0))
      .map((x, i) => ({ ...x, rank: i + 1, tier: tierByVendor.get(x.vendorId) ?? null }));

    const incomplete = scored
      .filter((x) => x.state === "incomplete")
      // Deterministic order: domain coverage desc, then vendorId.
      .sort((a, b) => {
        const byCov = b.domainCoverage - a.domainCoverage;
        return Math.abs(byCov) > 1e-9 ? byCov : a.vendorId.localeCompare(b.vendorId);
      });

    const { low } = assessDiscrimination(rankRows.map((r) => r.adjustedComposite));
    const anomalies = detectRankingAnomalies(rankRows);
    if (anomalies.length > 0) {
      console.warn(`[rank-fix] ${category.id}: ${anomalies.length} ranking anomaly(ies) for review:\n  ${anomalies.join("\n  ")}`);
    }

    return {
      category,
      ranked,
      incomplete,
      isLive: live,
      methodologyNote: METHODOLOGY_NOTE,
      lowDiscrimination: low,
      anomalies,
    };
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
