// Live-data enrichment for Investor Tools.
// ─────────────────────────────────────────
// Layered overlay that fetches the live signals already wired elsewhere in
// the app and merges them onto the seed `InvestmentProviderProfile`
// baseline. Nothing in here mutates the seed — callers receive a NEW
// EnrichedInvestmentProvider record per provider, so this module can be
// dropped into any route without breaking existing seed-only consumers.
//
// Live sources combined:
//   1. Yahoo Finance quote — live price / 52w range for any public ticker.
//      Free, no-key. See lib/connectors/yahooFinance.ts.
//   2. IntelligenceNewsItem table — classified news (filled by the
//      competitive-intel monitor on the daily refresh cron).
//   3. vendor-uptake-seed — share-of-named-vendor-usage aggregated from
//      the 4-spreadsheet 2026-05 research (used in Demonstrate explorer).
//   4. buildQuadrantData — AI Atlas position (Enhance × Innovate).
//   5. listVendorMomentum + listVendorPillarScores + repository — the same
//      pillar / momentum / confidence inputs the QUAD scoring engine uses.
//   6. REPUTATION_VENDOR_IDS + seed — three-pillar reputation summary.
//
// All fetches are wrapped in try/catch so a single source failing (network,
// API limit, missing key) degrades that field to null rather than killing
// the whole enrichment. The caller can spot a field === null and fall back
// to the seed value transparently.

import { yahooFinanceConnector } from "../connectors/yahooFinance";
import {
  listIntelligenceVendors,
  listNewsItems,
  listVendorMomentum,
  listVendorPillarScores,
} from "../intelligence/repository";
import { buildQuadrantData } from "../intelligence/quadrant";
import { aggregateUptake } from "../intelligence/vendor-uptake-seed";
import {
  CUSTOMER_REPUTATION,
  DEVELOPER_REPUTATION,
  EMPLOYEE_REPUTATION,
} from "../reputation/seed";
import type { InvestmentProviderProfile } from "./types";
import type { NewsCategory, NewsItem, Vendor, VendorMomentum, VendorPillarScore } from "../intelligence/types";

/* ─── Live data field shapes ────────────────────────────────────── */

export interface LiveQuote {
  symbol: string;
  currency: string | null;
  exchange: string | null;
  price: number;
  /** Most recent close before the live price; used to compute pctChange. */
  previousClose: number | null;
  pctChange: number | null;
  fetchedAt: string;
}

export interface LiveNewsItem {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  url: string | null;
  publishedAt: string;
  impactScore: number;
  confidence: number;
  categories: NewsCategory[];
  /** "real" = source-backed via connectors; "seed" = curated until promoted. */
  isLive: boolean;
}

export interface AtlasPosition {
  execute: number;
  vision: number;
  quadrant: "leaders" | "challengers" | "visionaries" | "niche";
  score: number;
  momentum: number;
  /** Movement since prior snapshot, in axis-units. Null if no prior. */
  deltaExecute: number | null;
  deltaVision: number | null;
}

export interface ReputationSummary {
  developerOverall: number | null;
  employeeOverall: number | null;
  customerOverall: number | null;
  /** Mean of the three when at least one is non-null. */
  combined: number | null;
}

export interface EnrichedInvestmentProvider {
  provider: InvestmentProviderProfile;
  /** Live stock quote — null when ticker missing, fetch errors, or rate-limited. */
  quote: LiveQuote | null;
  /** Up to N most-recent classified news items mentioning this provider. */
  news: LiveNewsItem[];
  /** Share-of-named-vendor-usage from the 2026-05 spreadsheet research (0..1). */
  uptakeShare: number | null;
  /** AI Atlas (Enhance × Innovate) position — null if vendor not in the spine. */
  atlas: AtlasPosition | null;
  /** Cross-pillar momentum score 0..100 — null if vendor not in the spine. */
  momentumScore: number | null;
  /** Mean pillar score across all six pillars — null if not in the spine. */
  pillarMean: number | null;
  /** Three-pillar reputation summary — null if not in the reputation seed set. */
  reputation: ReputationSummary | null;
}

/* ─── Vendor-id resolution ──────────────────────────────────────── */

/**
 * Match an InvestmentProviderProfile against an IntelligenceVendor record
 * by name (case + punctuation tolerant). Investment provider IDs follow
 * the "openai" / "msft" pattern, intelligence vendor IDs follow
 * "vendor_openai" / "vendor_microsoft" — they don't line up directly, so
 * we resolve by name.
 */
function normName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolveVendor(
  provider: InvestmentProviderProfile,
  vendors: Vendor[],
): Vendor | null {
  const n = normName(provider.name);
  const direct = vendors.find((v) => normName(v.name) === n);
  if (direct) return direct;
  // Common alias collapses — "Microsoft" / "MSFT", "Alphabet (Google)" /
  // "Google DeepMind", etc.
  const aliasMap: Record<string, string> = {
    microsoft: "microsoft",
    msft: "microsoft",
    alphabet: "googledeepmind",
    google: "googledeepmind",
    amazon: "aws",
    awsbedrock: "aws",
    metaplatforms: "meta",
  };
  const aliased = aliasMap[n];
  if (aliased) {
    const hit = vendors.find((v) => normName(v.name) === aliased);
    if (hit) return hit;
  }
  return null;
}

/* ─── Live fetchers ─────────────────────────────────────────────── */

async function fetchQuote(ticker: string | null): Promise<LiveQuote | null> {
  if (!ticker) return null;
  try {
    const result = await yahooFinanceConnector.fetch({
      resource: "chart",
      symbol: ticker,
      range: "5d",
      interval: "1d",
    });
    if (!result.ok || result.records.length === 0) return null;
    const record = result.records[0];
    // The chart record carries the meta block: regularMarketPrice +
    // points[]. Previous close is the close of the second-to-last point.
    const chart = record as Extract<typeof record, { resource: "chart" }>;
    const price = chart.regularMarketPrice ?? null;
    if (price === null || price === undefined) return null;
    const points = chart.points ?? [];
    const previousClose = points.length >= 2 ? points[points.length - 2]?.close ?? null : null;
    const pctChange = previousClose && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : null;
    return {
      symbol: chart.symbol,
      currency: chart.currency ?? null,
      exchange: chart.exchange ?? null,
      price,
      previousClose,
      pctChange,
      fetchedAt: result.fetchedAt,
    };
  } catch {
    return null;
  }
}

function newsForVendor(
  vendor: Vendor | null,
  provider: InvestmentProviderProfile,
  allNews: NewsItem[],
  limit = 5,
): LiveNewsItem[] {
  // Match by intelligence vendorId when we have it; fall back to a
  // case-insensitive provider-name appearance in the title or summary.
  const providerNameLc = provider.name.toLowerCase();
  const matches = allNews.filter((item) => {
    if (vendor && item.vendors.includes(vendor.id)) return true;
    const hay = `${item.title} ${item.summary}`.toLowerCase();
    return hay.includes(providerNameLc);
  });
  return matches
    .slice()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit)
    .map((n) => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      whyItMatters: n.whyItMatters,
      url: n.sourceUrl ?? null,
      publishedAt: n.publishedAt,
      impactScore: n.impactScore,
      confidence: n.confidenceScore,
      categories: n.categories,
      isLive: n.sourceKind === "real",
    }));
}

function uptakeForVendor(provider: InvestmentProviderProfile): number | null {
  // aggregateUptake() with no filters returns each vendor's overall
  // share-of-named-vendor-usage normalised to sum to 1. We match by name.
  const rows = aggregateUptake({});
  const n = normName(provider.name);
  // Common spreadsheet name → provider name mappings.
  const aliasMap: Record<string, string> = {
    googledeepmind: "googledeepmindgemini",
    google: "googledeepmindgemini",
    alphabet: "googledeepmindgemini",
    meta: "metallama",
    metaplatforms: "metallama",
    amazon: "aws", // not in uptake spine, but keep for completeness
    msft: "microsoft",
  };
  const target = aliasMap[n] ?? n;
  const hit = rows.find((r) => normName(r.vendor) === target);
  return hit ? hit.share : null;
}

function atlasForVendor(
  vendor: Vendor | null,
  quadrant: Awaited<ReturnType<typeof buildQuadrantData>>,
): AtlasPosition | null {
  if (!vendor) return null;
  const point = quadrant.points.find((p) => p.vendor.id === vendor.id);
  if (!point) return null;
  const which = (e: number, v: number): AtlasPosition["quadrant"] => {
    const eHi = e >= quadrant.executeCut;
    const vHi = v >= quadrant.visionCut;
    if (eHi && vHi) return "leaders";
    if (eHi && !vHi) return "challengers";
    if (!eHi && vHi) return "visionaries";
    return "niche";
  };
  return {
    execute: point.now.execute,
    vision: point.now.vision,
    quadrant: which(point.now.execute, point.now.vision),
    score: point.now.score,
    momentum: point.now.momentum,
    deltaExecute: point.delta?.execute ?? null,
    deltaVision: point.delta?.vision ?? null,
  };
}

function pillarMeanForVendor(
  vendor: Vendor | null,
  pillarScores: VendorPillarScore[],
): number | null {
  if (!vendor) return null;
  const rows = pillarScores.filter((p) => p.vendorId === vendor.id);
  if (rows.length === 0) return null;
  const mean = rows.reduce((sum, p) => sum + p.capabilityScore, 0) / rows.length;
  return Math.round(mean * 10) / 10;
}

function momentumForVendor(
  vendor: Vendor | null,
  momentum: VendorMomentum[],
): number | null {
  if (!vendor) return null;
  const hit = momentum.find((m) => m.vendorId === vendor.id);
  return hit ? hit.momentumScore : null;
}

function reputationForVendor(vendor: Vendor | null): ReputationSummary | null {
  if (!vendor) return null;
  const dev = DEVELOPER_REPUTATION.find((r) => r.vendorId === vendor.id);
  const emp = EMPLOYEE_REPUTATION.find((r) => r.vendorId === vendor.id);
  const cus = CUSTOMER_REPUTATION.find((r) => r.vendorId === vendor.id);
  if (!dev && !emp && !cus) return null;
  const developerOverall = dev?.overall ?? null;
  const employeeOverall = emp?.overall ?? null;
  const customerOverall = cus?.overall ?? null;
  const scores = [developerOverall, employeeOverall, customerOverall].filter(
    (s): s is number => typeof s === "number",
  );
  const combined = scores.length > 0
    ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10
    : null;
  return { developerOverall, employeeOverall, customerOverall, combined };
}

/* ─── Public enrichment API ─────────────────────────────────────── */

export interface EnrichmentOptions {
  /** Max news items per provider. Default 5. */
  newsLimit?: number;
  /** Skip the Yahoo Finance call (useful when the page only needs news + atlas). */
  skipQuotes?: boolean;
}

/**
 * Enrich a batch of investment providers in parallel. Shared lookups
 * (vendors, news, quadrant, pillar scores) are fetched ONCE up-front
 * and reused across all providers; per-provider work is the Yahoo quote
 * fetch only.
 *
 * Returns providers in the same order the caller passed them in.
 */
export async function enrichInvestmentProviders(
  providers: InvestmentProviderProfile[],
  options: EnrichmentOptions = {},
): Promise<EnrichedInvestmentProvider[]> {
  const newsLimit = options.newsLimit ?? 5;
  const skipQuotes = options.skipQuotes ?? false;

  // Shared lookups — fetched once.
  let vendors: Vendor[] = [];
  let news: NewsItem[] = [];
  let pillarScores: VendorPillarScore[] = [];
  let momentum: VendorMomentum[] = [];
  let quadrant: Awaited<ReturnType<typeof buildQuadrantData>> | null = null;
  try {
    [vendors, news, pillarScores, momentum, quadrant] = await Promise.all([
      listIntelligenceVendors().catch(() => []),
      listNewsItems().catch(() => []),
      listVendorPillarScores().catch(() => []),
      listVendorMomentum().catch(() => []),
      buildQuadrantData({}).catch(() => null),
    ]);
  } catch {
    // Already swallowed per-promise; this only catches the overall
    // Promise.all itself rejecting, which shouldn't happen given the
    // per-promise .catch handlers above.
  }

  // Per-provider work: in parallel.
  return await Promise.all(
    providers.map(async (provider) => {
      const vendor = resolveVendor(provider, vendors);
      const [quote] = await Promise.all([
        skipQuotes ? Promise.resolve(null) : fetchQuote(provider.ticker),
      ]);
      return {
        provider,
        quote,
        news: newsForVendor(vendor, provider, news, newsLimit),
        uptakeShare: uptakeForVendor(provider),
        atlas: quadrant ? atlasForVendor(vendor, quadrant) : null,
        momentumScore: momentumForVendor(vendor, momentum),
        pillarMean: pillarMeanForVendor(vendor, pillarScores),
        reputation: reputationForVendor(vendor),
      };
    }),
  );
}

/**
 * Enrich a single provider. Convenience wrapper around
 * `enrichInvestmentProviders([provider])`.
 */
export async function enrichInvestmentProvider(
  provider: InvestmentProviderProfile,
  options: EnrichmentOptions = {},
): Promise<EnrichedInvestmentProvider> {
  const [enriched] = await enrichInvestmentProviders([provider], options);
  return enriched;
}
