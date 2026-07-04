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
import { scoreVendorComposite, evidenceCompletenessBand, MANDATORY_PILLARS } from "./composite-engine";
import type { CategoryComposite, CategoryRankedVendor } from "./composite-types";
import { getVendorScorecardsBatch, type VendorScorecard } from "../assessment/domain-scores";
import type { DomainScore } from "../assessment/domain-rubric";
import {
  computeWeightedComposite,
  rankVendorsByComposite,
  rollUpToPillars,
  activeDomains,
  ASSESSMENT_COVERAGE_FLOOR,
  type DomainWeights,
} from "../assessment/composite";
import {
  resolveDomainWeights,
  categoryActivatesModelQuality,
  categoryActivatesDevSentiment,
  buildMethodologyNote,
} from "../assessment/category-weights";
import {
  assessDiscrimination,
  assignTiers,
  detectRankingAnomalies,
  ASSESSMENT_NOISE_BAND,
  type RankRow,
} from "./credibility";
import { readSectorCache, materializeSectorCache, type CachedComposites } from "./sector-cache";

/** LIVE compute of all categories' within-category composite rankings. Guarded:
 *  returns [] on read failure rather than throwing. INTERNAL — page reads go
 *  through the cache-first getCategoryComposites() below; the daily-refresh batch
 *  calls this (via materializeCategoryCache) to fill the per-sector cache once
 *  per cycle, so it is never recomputed on every page load. */
async function computeCategoryComposites(): Promise<CategoryComposite[]> {
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
  // `eff` is the vendor's domain set for THIS category (the 12 framework domains,
  // plus a synthesized model_quality score when the category activates it). All
  // coverage/eligibility figures are read off the composite over the category's
  // ACTIVE domain set — so the denominator is /12 for default categories and /13
  // for one that adds model_quality, and the label never contradicts the ranking.
  function enrich(
    v: CategoryRankedVendor,
    eff: DomainScore[] | null,
    catWeights: DomainWeights,
  ): CategoryRankedVendor {
    const wc = eff ? computeWeightedComposite(eff, catWeights) : null;
    const domainScored = wc?.scoredCount ?? 0;
    const domainTotal = wc?.domainTotal ?? activeDomains(catWeights).length;
    // RAW coverage (evidenced ÷ active domains, weight-independent) gates
    // eligibility and is what we display — so you can't re-weight your way out of
    // thin coverage, and a vendor never appears ranked here but held in the re-rank.
    const domainCoverage = wc?.rawCoverage ?? 0;
    // MANDATORY pillar: at least one domain under each MANDATORY_PILLARS pillar
    // (enterprise_control) must be evidenced for a vendor to hold a public rank —
    // coverage alone can be met while the pillar enterprises care most about is
    // dark. Framework rule, silently lost in the rank-fix unification; restored
    // per the 2026-07 audit.
    const mandatoryPillarsScored = MANDATORY_PILLARS.every(
      (p) => eff?.some((d) => d.pillar === p && d.state === "scored") ?? false,
    );
    const ranked =
      !!wc && domainScored > 0 && domainCoverage >= ASSESSMENT_COVERAGE_FLOOR && mandatoryPillarsScored;
    const excludedReason = ranked
      ? undefined
      : domainScored === 0
        ? `No reviewed evidence across the ${domainTotal} assessment domains yet`
        : !mandatoryPillarsScored
          ? `Enterprise Control has no reviewed evidence — mandatory pillar for a public rank`
          : `Only ${domainScored}/${domainTotal} domains evidenced (need ≥${Math.round(ASSESSMENT_COVERAGE_FLOOR * domainTotal)})`;
    return {
      ...v,
      state: ranked ? "ranked" : "incomplete",
      assessmentComposite: wc ? wc.composite : null,
      // "Why this rank" breakdown — the 6 pillars rolled up from the SAME domain
      // contributions that produce assessmentComposite, so summing them matches
      // the composite + the rank (fixes the pillar/domain divergence).
      rankPillars: wc ? rollUpToPillars(wc.contributions, eff ?? []) : [],
      compositeConfidence: wc ? wc.confidence : v.compositeConfidence,
      domainScored,
      domainTotal,
      domainCoverage,
      evidenceCompleteness: evidenceCompletenessBand(domainCoverage),
      excludedReason,
    };
  }

  return categories.map((category) => {
    // CATEGORY-AWARE default weighting: this category's bespoke profile, or the
    // framework default. The SAME resolved weights drive the static order AND the
    // interactive re-rank (exposed on the result), so they stay identical by
    // construction at the category default.
    const catWeights = resolveDomainWeights(category.id);
    const activatesMQ = categoryActivatesModelQuality(category.id);
    const activatesDevSentiment = categoryActivatesDevSentiment(category.id);
    // A vendor's domain set for THIS category: the 12 framework domains, plus the
    // synthesized model_quality score when the category activates it and the
    // vendor has a real Arena Elo (else model_quality is simply absent → counted
    // as insufficient in the /13 coverage; never fabricated).
    const effFor = (id: string): DomainScore[] | null => {
      const sc = scorecards.get(id);
      if (!sc) return null;
      const extra: DomainScore[] = [];
      if (activatesMQ && sc.modelQuality) extra.push(sc.modelQuality);
      // dev_sentiment: coding categories only, flag-gated, coverage-discounted
      // (absent → counted as an unscored domain), same pattern as model_quality.
      if (activatesDevSentiment && sc.devSentiment) extra.push(sc.devSentiment);
      return extra.length > 0 ? [...sc.domains, ...extra] : sc.domains;
    };

    // Membership: a vendor is in this category iff it has an estimate row here.
    const memberIds = [
      ...new Set(estimates.filter((e) => e.categoryId === category.id).map((e) => e.vendorId)),
    ];

    const scored = memberIds.flatMap((id) => {
      const vendor = vendorById.get(id);
      if (!vendor) return [] as CategoryRankedVendor[];
      const share = shareByVendorCat.get(`${id}__${category.id}`);
      return [enrich(scoreVendorComposite(vendor, scoresByVendor.get(id) ?? [], share), effFor(id), catWeights)];
    });

    // Order via THE shared ranker (the SAME function CategoryRerank calls) with
    // the SAME category weights, so the static ranking and the default-weight
    // re-rank are identical by construction — not two implementations that happen
    // to agree. Map the canonical order back onto the full CategoryRankedVendor objects.
    const canonical = rankVendorsByComposite(
      memberIds.flatMap((id) => {
        const eff = effFor(id);
        return eff ? [{ vendorId: id, domains: eff }] : [];
      }),
      catWeights,
    );
    const orderIdx = new Map(canonical.map((r, i) => [r.vendorId, i] as const));
    const rankedSorted = scored
      .filter((x) => x.state === "ranked")
      .sort((a, b) => (orderIdx.get(a.vendorId) ?? Number.MAX_SAFE_INTEGER) - (orderIdx.get(b.vendorId) ?? Number.MAX_SAFE_INTEGER));

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
      methodologyNote: buildMethodologyNote(category.id),
      resolvedDomainWeights: catWeights,
      lowDiscrimination: low,
      anomalies,
    };
  });
}

/** Cache-first: serve the per-sector materialised cache when fresh, else compute
 *  live. ALL page reads go through here, so each sector is computed once per
 *  refresh cycle (not per page load) and served to every subscriber. */
export async function getCategoryComposites(): Promise<CategoryComposite[]> {
  return (await readSectorCache(computeCategoryComposites)).composites;
}

/** Same, but exposes the honest as-of + whether it came from cache — for
 *  surfaces that show a "sector rankings as of X" freshness label. */
export async function getCategoryCompositesWithMeta(): Promise<CachedComposites> {
  return readSectorCache(computeCategoryComposites);
}

/** Materialise the per-sector cache from a fresh live compute. Called ONCE per
 *  refresh cycle by the daily-refresh batch — never on a page request. */
export async function materializeCategoryCache(): Promise<{ written: number }> {
  return materializeSectorCache(computeCategoryComposites);
}

/** One category's composite (for /category/[slug]). Cache-first via getCategoryComposites. */
export async function getCategoryComposite(slug: string): Promise<CategoryComposite | null> {
  const all = await getCategoryComposites();
  return all.find((c) => c.category.id === slug) ?? null;
}

/** One category's composite + the honest as-of (drives the /category/[slug]
 *  "sector rankings as of X" freshness label). */
export async function getCategoryCompositeWithMeta(
  slug: string,
): Promise<{ composite: CategoryComposite | null; asOf: Date | null; source: "cache" | "live" }> {
  const { composites, asOf, source } = await readSectorCache(computeCategoryComposites);
  return { composite: composites.find((c) => c.category.id === slug) ?? null, asOf, source };
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
