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
  computeWeightedComposite,
  compareWeighted,
  DEFAULT_DOMAIN_WEIGHTS,
  ASSESSMENT_COVERAGE_FLOOR,
} from "../assessment/composite";
import {
  assessDiscrimination,
  assignTiers,
  detectRankingAnomalies,
  ASSESSMENT_NOISE_BAND,
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

  // UNIFIED — rank by the 12-domain assessment composite (the SAME
  // computeWeightedComposite the interactive re-rank uses), so the static order
  // and the default-weight re-rank are identical by construction. The pillar
  // composite + pillars[] from scoreVendorComposite are kept as the "why this
  // rank" detail; eligibility + the headline score now come from DOMAIN evidence.
  function enrich(v: CategoryRankedVendor, domains: VendorScorecard | undefined): CategoryRankedVendor {
    const domainTotal = domains?.domains.length ?? 12;
    const domainScored = domains?.scoredCount ?? 0;
    const wc = domains ? computeWeightedComposite(domains.domains, DEFAULT_DOMAIN_WEIGHTS) : null;
    // RAW coverage (evidenced domains / 12, weight-independent) gates eligibility
    // and is what we display — so you can't re-weight your way out of thin coverage,
    // and a vendor never appears ranked here but held in the re-rank (same rule).
    const domainCoverage = wc?.rawCoverage ?? 0;
    const ranked = !!wc && domainScored > 0 && domainCoverage >= ASSESSMENT_COVERAGE_FLOOR;
    const excludedReason = ranked
      ? undefined
      : domainScored === 0
        ? "No reviewed evidence across the 12 assessment domains yet"
        : `Only ${domainScored}/${domainTotal} domains evidenced (need ≥${Math.round(ASSESSMENT_COVERAGE_FLOOR * domainTotal)})`;
    return {
      ...v,
      state: ranked ? "ranked" : "incomplete",
      assessmentComposite: wc ? wc.composite : null,
      compositeConfidence: wc ? wc.confidence : v.compositeConfidence,
      domainScored,
      domainTotal,
      domainCoverage,
      evidenceCompleteness: evidenceCompletenessBand(domainCoverage),
      excludedReason,
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
      return [enrich(scoreVendorComposite(vendor, scoresByVendor.get(id) ?? [], share), scorecards.get(id))];
    });

    // Sort by the assessment composite via the SAME comparator the re-rank uses
    // (compareWeighted) → default-weight CategoryRerank produces this exact order.
    const rankedSorted = scored
      .filter((x) => x.state === "ranked")
      .sort((a, b) =>
        compareWeighted(
          { composite: a.assessmentComposite ?? 0, coverage: a.domainCoverage, confidence: a.compositeConfidence ?? 0, vendorId: a.vendorId },
          { composite: b.assessmentComposite ?? 0, coverage: b.domainCoverage, confidence: b.compositeConfidence ?? 0, vendorId: b.vendorId },
        ),
      );

    const adjustedDesc = rankedSorted.map((v) => v.assessmentComposite ?? 0);
    const tiers = assignTiers(adjustedDesc, ASSESSMENT_NOISE_BAND);
    const ranked = rankedSorted.map((x, i) => ({ ...x, rank: i + 1, tier: tiers[i] ?? null }));

    const incomplete = scored
      .filter((x) => x.state === "incomplete")
      .sort((a, b) => {
        const byCov = b.domainCoverage - a.domainCoverage;
        return Math.abs(byCov) > 1e-9 ? byCov : a.vendorId.localeCompare(b.vendorId);
      });

    // Sanity-check + discrimination on the 0–5 assessment scale.
    const rankRows: RankRow[] = rankedSorted.map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      rawComposite: v.composite ?? 0,
      adjustedComposite: v.assessmentComposite ?? 0,
      domainCoverage: v.domainCoverage,
      confidence: v.compositeConfidence ?? 0,
    }));
    const { low } = assessDiscrimination(adjustedDesc, ASSESSMENT_NOISE_BAND);
    const anomalies = detectRankingAnomalies(rankRows, ASSESSMENT_NOISE_BAND);
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
