// Intelligence-layer repository — backs the executive market portal.
//
// Reads from Prisma/Postgres. Typed seed data is served ONLY in local dev /
// tests (gated by `seedFallbackAllowed()` in lib/data/availability.ts). In any
// deployed build (production OR preview) an unavailable DB throws
// `DataUnavailableError` — surfaces render an honest "live data unavailable"
// state and NEVER substitute seed dressed as real.

import { Prisma } from "../../generated/prisma/client";
import type {
  Capability as PrismaCapability,
  EvidenceSource as PrismaEvidenceSource,
  IntelligenceNewsItem as PrismaNewsItem,
  IntelligencePillarScore as PrismaPillarScore,
  IntelligenceVendor as PrismaVendor,
  MarketCategory as PrismaMarketCategory,
  MarketShareEstimate as PrismaMarketShareEstimate,
  PrismaClient,
  VendorCapability as PrismaVendorCapability,
  VendorMomentum as PrismaVendorMomentum,
  Watchlist as PrismaWatchlist,
} from "../../generated/prisma/client";
import { getPrisma, hasDatabase } from "../prisma";
import type { EvidenceGrade, PillarId } from "../types";
import type {
  Capability,
  EvidenceSource,
  MarketCategory,
  MarketCategoryId,
  MarketDashboard,
  MarketShareEstimate,
  NewsCategory,
  NewsItem,
  RankInput,
  SuggestedScoreImpact,
  Vendor,
  VendorCapability,
  VendorMomentum,
  VendorPillarScore,
  Watchlist,
} from "./types";
import {
  MARKET_CATEGORIES,
  VENDOR_PILLAR_SCORES,
} from "./seed";
import {
  capabilitiesMockRepository,
  evidenceSourcesMockRepository,
  marketCategoriesMockRepository,
  marketShareEstimatesMockRepository,
  newsMockRepository,
  vendorMomentumMockRepository,
  vendorsMockRepository,
  watchlistsMockRepository,
} from "./mock-repositories";
import { calculateRiskPenalty, riskStatusForVendor } from "./metrics";
import { isDataVendorSource } from "./source-quality";
import { isSeedSignedSource } from "./provenance";
import { DataUnavailableError, seedFallbackAllowed } from "../availability";
import { evidenceDepthBand } from "./entities";

let dbFallbackWarningShown = false;

function byScoreDesc(a: Vendor, b: Vendor): number {
  return b.overallScore - a.overallScore;
}

// Read live data from Postgres. Seed is served ONLY when `seedFallbackAllowed()`
// (local dev / tests) — in any deployed build an unavailable DB throws
// `DataUnavailableError` so the surface can render an honest "live data
// unavailable" state instead of silently dressing seed as real.
async function databaseOrSeed<T>(
  read: (client: PrismaClient) => Promise<T>,
  seed: () => T | Promise<T>,
): Promise<T> {
  if (!hasDatabase()) {
    if (seedFallbackAllowed()) return seed();
    throw new DataUnavailableError("intelligence database is not configured (DATABASE_URL unset)");
  }

  try {
    return await read(getPrisma());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (seedFallbackAllowed()) {
      if (!dbFallbackWarningShown && process.env.NODE_ENV !== "test") {
        dbFallbackWarningShown = true;
        console.warn(`AI Enterprise intelligence DB unavailable; using LOCAL-DEV seed data. ${message}`);
      }
      return seed();
    }
    // Deployed build: never mask a real outage with seed. Surface it honestly.
    console.error(`AI Enterprise intelligence DB read failed (no seed fallback in deployed builds): ${message}`);
    throw new DataUnavailableError(`intelligence data is temporarily unavailable: ${message}`);
  }
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function optionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function optionalNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asIndustryStrength(value: unknown): Vendor["industryStrength"] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.industry !== "string" || typeof item.score !== "number") return [];
    return [{
      industry: item.industry,
      score: item.score,
      note: typeof item.note === "string" ? item.note : "Evidence note pending analyst review.",
    }];
  });
}

function asSuggestedScoreImpact(value: unknown): SuggestedScoreImpact[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      !isRecord(item)
      || typeof item.pillar !== "string"
      || typeof item.direction !== "string"
      || typeof item.magnitude !== "number"
      || typeof item.rationale !== "string"
    ) {
      return [];
    }
    const direction = ["up", "down", "watch"].includes(item.direction)
      ? item.direction as SuggestedScoreImpact["direction"]
      : "watch";

    return [{
      pillar: item.pillar as PillarId,
      direction,
      magnitude: item.magnitude,
      rationale: item.rationale,
    }];
  });
}

function asAlertRules(value: unknown): Watchlist["alertRules"] {
  if (!isRecord(value)) return {};
  return {
    riskThreshold: typeof value.riskThreshold === "number" ? value.riskThreshold : undefined,
    momentumChangePct: typeof value.momentumChangePct === "number" ? value.momentumChangePct : undefined,
    categories: Array.isArray(value.categories)
      ? value.categories.filter((item): item is string => typeof item === "string") as NewsCategory[]
      : undefined,
  };
}

function mapVendor(row: PrismaVendor): Vendor {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    description: row.description,
    headquarters: optionalString(row.headquarters),
    ownershipType: row.ownershipType,
    supportedIndustries: row.supportedIndustries,
    supportedUseCases: row.supportedUseCases,
    supportedEcosystems: row.supportedEcosystems,
    deploymentOptions: row.deploymentOptions,
    autonomyLevelMax: row.autonomyLevelMax,
    overallScore: row.overallScore,
    confidenceScore: row.confidenceScore,
    marketPosition: row.marketPosition,
    strategy: row.strategy,
    productCapabilities: row.productCapabilities,
    enterpriseControls: row.enterpriseControls,
    agenticCapability: row.agenticCapability,
    industryStrength: asIndustryStrength(row.industryStrength),
    riskProfile: row.riskProfile,
    analystInterpretation: row.analystInterpretation,
    lastUpdated: toIso(row.lastUpdated),
    // Cross-tab role/infra metadata (folded from the entity model). Optional
    // columns may be absent on rows predating the migration → coalesce.
    roleTags: row.roleTags ?? [],
    infraBand: optionalString(row.infraBand) ?? undefined,
    infraBandSecondary: optionalString(row.infraBandSecondary) ?? undefined,
  };
}

function mapPillarScore(row: PrismaPillarScore): VendorPillarScore {
  return {
    vendorId: row.vendorId,
    pillar: row.pillar as PillarId,
    capabilityScore: row.capabilityScore,
    evidenceGrade: row.evidenceGrade as EvidenceGrade,
    confidence: row.confidence,
    strengths: row.strengths,
    risks: row.risks,
    missingEvidence: row.missingEvidence,
  };
}

function mapMarketCategory(row: PrismaMarketCategory): MarketCategory {
  return {
    id: row.id as MarketCategoryId,
    name: row.name,
    description: row.description,
  };
}

function mapMarketShare(row: PrismaMarketShareEstimate): MarketShareEstimate {
  return {
    vendorId: row.vendorId,
    categoryId: row.categoryId as MarketCategoryId,
    reportedShare: optionalNumber(row.reportedShare),
    estimatedShare: row.estimatedShare,
    confidence: row.confidence,
    source: row.source,
    sourceDate: toIso(row.sourceDate),
    methodology: row.methodology,
    previousEstimate: optionalNumber(row.previousEstimate),
    changePct: row.changePct,
  };
}

function mapMomentum(row: PrismaVendorMomentum): VendorMomentum {
  return {
    vendorId: row.vendorId,
    period: row.period,
    momentumScore: row.momentumScore,
    newsVelocity: row.newsVelocity,
    productVelocity: row.productVelocity,
    adoptionSignal: row.adoptionSignal,
    hiringSignal: row.hiringSignal,
    customerSignal: row.customerSignal,
    partnerSignal: row.partnerSignal,
    marketShareMovement: row.marketShareMovement,
    riskSignal: row.riskSignal,
    confidence: row.confidence,
  };
}

function mapNews(row: PrismaNewsItem): NewsItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    sourceName: row.sourceName,
    sourceUrl: optionalString(row.sourceUrl),
    // Seed detection: any of (a) explicit "seed" in the source name,
    // (b) the [MOCK] prefix used by `lib/intelligence/seed-news.ts`,
    // (c) the "stub" / "placeholder" markers used by other seed fixtures,
    // or (d) a missing source URL. The previous implementation matched
    // only "seed" as a substring, which let every [MOCK]-prefixed seed
    // item through as "real" and rendered a dishonest green badge on
    // the dashboard's recent-news cards.
    sourceKind:
      /\[mock\]|\bseed\b|\bstub\b|\bplaceholder\b/i.test(row.sourceName) ||
      !optionalString(row.sourceUrl)
        ? "seed"
        : "real",
    publishedAt: toIso(row.publishedAt),
    vendors: row.vendors,
    categories: row.categories as NewsCategory[],
    impactScore: row.impactScore,
    confidenceScore: row.confidenceScore,
    affectedPillars: row.affectedPillars as PillarId[],
    whyItMatters: row.whyItMatters,
    suggestedScoreImpact: asSuggestedScoreImpact(row.suggestedScoreImpact),
    relatedVendors: row.relatedVendors,
    sentiment: row.sentiment as NewsItem["sentiment"],
  };
}

function mapCapability(row: PrismaCapability): Capability {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
  };
}

function mapVendorCapability(row: PrismaVendorCapability): VendorCapability {
  return {
    vendorId: row.vendorId,
    capabilityId: row.capabilityId,
    status: row.status as VendorCapability["status"],
    maturityScore: row.maturityScore,
    evidenceGrade: row.evidenceGrade as EvidenceGrade,
    lastVerified: toIso(row.lastVerified),
    notes: row.notes,
  };
}

function mapWatchlist(row: PrismaWatchlist): Watchlist {
  return {
    id: row.id,
    name: row.name,
    vendors: row.vendors,
    categories: row.categories,
    industries: row.industries,
    alertRules: asAlertRules(row.alertRules),
    createdAt: toIso(row.createdAt),
  };
}

function mapEvidenceSource(row: PrismaEvidenceSource): EvidenceSource {
  return {
    id: row.id,
    entityType: row.entityType as EvidenceSource["entityType"],
    entityId: row.entityId,
    sourceType: row.sourceType as EvidenceSource["sourceType"],
    sourceName: row.sourceName,
    sourceUrl: optionalString(row.sourceUrl),
    capturedAt: toIso(row.capturedAt),
    evidenceGrade: row.evidenceGrade as EvidenceGrade,
    confidence: row.confidence,
    notes: row.notes,
  };
}

export async function listIntelligenceVendors(): Promise<Vendor[]> {
  return databaseOrSeed(
    async (client) => {
      const rows = await client.intelligenceVendor.findMany({ orderBy: { name: "asc" } });
      return rows.length ? rows.map(mapVendor) : vendorsMockRepository.list();
    },
    () => vendorsMockRepository.list(),
  );
}

export async function getIntelligenceVendor(idOrSlug: string): Promise<Vendor | null> {
  return databaseOrSeed(
    async (client) => {
      const row = await client.intelligenceVendor.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      });
      return row ? mapVendor(row) : vendorsMockRepository.get(idOrSlug);
    },
    () => vendorsMockRepository.get(idOrSlug),
  );
}

export async function listMarketCategories(): Promise<MarketCategory[]> {
  return databaseOrSeed(
    async (client) => {
      const rows = await client.marketCategory.findMany();
      const order = new Map(MARKET_CATEGORIES.map((category, index) => [category.id, index]));
      return rows.length
        ? rows.map(mapMarketCategory).sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
        : marketCategoriesMockRepository.list();
    },
    () => marketCategoriesMockRepository.list(),
  );
}

export async function listMarketShareEstimates(): Promise<MarketShareEstimate[]> {
  return databaseOrSeed(
    async (client) => {
      const rows = await client.marketShareEstimate.findMany({ orderBy: [{ categoryId: "asc" }, { estimatedShare: "desc" }] });
      // Drop any seed-signed rows: the live DB was seed-loaded, so seed estimates
      // can sit in the table. They must NEVER render as real, even when the
      // portal is otherwise live. Real, evidence-derived estimates remain.
      const real = rows.map(mapMarketShare).filter((e) => !isSeedSignedSource(e.source));
      return real.length ? real : marketShareEstimatesMockRepository.list();
    },
    () => marketShareEstimatesMockRepository.list(),
  );
}

// Keep only the newest period per vendor. The live derive-scores writer emits
// `rolling_30d` rows while older seed rows use `2026-Wnn`; without this, both
// leak through and stale seed momentum can pollute winning/losing-vendor
// filters. Rows arrive period-desc, so the first seen per vendor is newest.
function newestMomentumPerVendor(rows: VendorMomentum[]): VendorMomentum[] {
  const seen = new Set<string>();
  const out: VendorMomentum[] = [];
  for (const r of rows) {
    if (seen.has(r.vendorId)) continue;
    seen.add(r.vendorId);
    out.push(r);
  }
  return out;
}

export async function listVendorMomentum(): Promise<VendorMomentum[]> {
  return databaseOrSeed(
    async (client) => {
      const rows = await client.vendorMomentum.findMany({ orderBy: [{ period: "desc" }, { momentumScore: "desc" }] });
      return newestMomentumPerVendor(rows.length ? rows.map(mapMomentum) : await vendorMomentumMockRepository.list());
    },
    async () => newestMomentumPerVendor(await vendorMomentumMockRepository.list()),
  );
}

export async function listNewsItems(): Promise<NewsItem[]> {
  // Merge strategy: DB rows (from the projector / approved evidence)
  // take precedence, but curated seed items fill in vendor coverage
  // the projector hasn't produced. Without this merge, seeded news for
  // newly-added vendors (Meta, DeepSeek, Alibaba, etc.) is invisible
  // any time the projector has written even one IntelligenceNewsItem.
  // Sorted newest-first overall after the merge.
  return databaseOrSeed(
    async (client) => {
      const dbRows = (await client.intelligenceNewsItem.findMany({ orderBy: { publishedAt: "desc" } })).map(mapNews);
      const seed = await newsMockRepository.list();
      const dbIds = new Set(dbRows.map((r) => r.id));
      const seedFallback = seed.filter((s) => !dbIds.has(s.id));
      const merged = [...dbRows, ...seedFallback];
      merged.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
      return merged;
    },
    () => newsMockRepository.list(),
  );
}

/** Importance tier for a news item, derived from its market-impact score. */
export type ImportanceLevel = "critical" | "high" | "notable";

export interface BreakingNewsItem extends NewsItem {
  /** Importance tier (critical ≥80, high ≥65, notable otherwise). */
  importance: ImportanceLevel;
  /** Primary (first-listed) vendor, normalised id + display name — used to
   *  spread coverage across vendors and to label each story. */
  primaryVendorId: string | null;
  primaryVendorName: string | null;
}

export interface BreakingNews {
  /** Top items: deduped, importance-ranked, vendor-spread, capped at `limit`. */
  items: BreakingNewsItem[];
  /** The window applied (days). */
  windowDays: number;
  /** Newest publishedAt across the ENTIRE feed — used to surface staleness. */
  latestPublishedAt: string | null;
  /** How many days old the newest tracked story is (null if feed empty). */
  latestAgeDays: number | null;
  /** Of the shown items, how many are source-backed (sourceKind === "real"). */
  liveCount: number;
  /** True when nothing fell inside the window so we fell back to the most
   *  recent items — the card shows them but flags the feed as stale rather
   *  than rendering an empty "0 signals" state when we DO have intelligence. */
  usedFallback: boolean;
  /** Distinct vendors represented across the shown items. */
  vendorsCovered: number;
}

function importanceOf(score: number): ImportanceLevel {
  if (score >= 80) return "critical";
  if (score >= 65) return "high";
  return "notable";
}

/** Normalised title key for dedup. Strips the projector's
 *  "<subfactor> update — <vendor>" boilerplate before normalising so two
 *  machine-titled variants of the same event collapse. */
function newsTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+update\s+[—-]\s+[a-z0-9 ._-]+$/i, "") // drop trailing "… update — vendor"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Content-aware dedup key: same primary vendor + same core content (the
 *  why-it-matters / summary prefix). Catches near-duplicate machine titles that
 *  describe the SAME event — e.g. "token_based_pricing update — cohere" and
 *  "model_pricing_clarity update — cohere", which share the same pricing text. */
function newsDedupKey(n: NewsItem): string {
  const vendor = normalizeVendorId(n.vendors[0]) ?? "";
  const content = (n.whyItMatters || n.summary || n.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
  return `${vendor}|${content}`;
}

/** Normalise a vendor id so prefixed/bare variants (vendor_openai / openai)
 *  count as one vendor for the spread cap and the name lookup. */
function normalizeVendorId(id: string | undefined): string | null {
  if (!id) return null;
  return id.replace(/^vendor_/, "") || null;
}

/**
 * v1.3 — "Breaking news" feed for the Query market-overview card. Filters the
 * merged news feed to genuinely impactful items in the last `days` days
 * (impactScore ≥ minImpact), newest first. Also returns the newest publish
 * date across the whole feed so the UI can honestly flag a stale feed when the
 * daily ingest hasn't run.
 */
export async function getBreakingNews(
  opts: { days?: number; minImpact?: number; limit?: number; maxPerVendor?: number } = {},
): Promise<BreakingNews> {
  const days = opts.days ?? 14;
  const minImpact = opts.minImpact ?? 50;
  const limit = opts.limit ?? 10;
  const maxPerVendor = opts.maxPerVendor ?? 2;

  // Pull the feed plus an id→name map so we can label + spread by vendor.
  const [merged, vendors] = await Promise.all([
    listNewsItems(), // already sorted newest-first
    listIntelligenceVendors().catch(() => [] as Vendor[]),
  ]);
  const nameById = new Map(vendors.map((v) => [v.id, v.name]));
  const resolveVendorName = (id: string | null) =>
    id ? nameById.get(id) ?? nameById.get(`vendor_${id}`) ?? id : null;

  // Buyer-facing "breaking news" must only show REAL, linkable items — never
  // seed/[MOCK] scaffolding. Gate on sourceKind "real" + a usable https URL, so
  // an empty live feed shows an honest empty state instead of mock headlines.
  // AND reject items whose source is a data/firmographic VENDOR (Zoominfo,
  // Flexera, …) rather than a credible publication — we suppress, never
  // substitute a source. See lib/intelligence/source-quality.ts.
  const hasRealSource = (n: NewsItem) =>
    n.sourceKind === "real" &&
    typeof n.sourceUrl === "string" &&
    n.sourceUrl.startsWith("http") &&
    !isDataVendorSource(n.sourceName);
  const all = merged.filter(hasRealSource);
  const latestPublishedAt = all[0]?.publishedAt ?? null;
  const latestAgeDays = latestPublishedAt
    ? Math.floor((Date.now() - Date.parse(latestPublishedAt)) / 86_400_000)
    : null;

  // Rank by importance (impact) first, then recency — so "top N" means the
  // most consequential stories, and dedup keeps the strongest instance.
  const ranked = [...all].sort(
    (a, b) => b.impactScore - a.impactScore || (a.publishedAt < b.publishedAt ? 1 : -1),
  );

  // Dedup the same story (re-ingested, multi-sourced, or machine-titled twins).
  // `ranked` is impact-desc then recency, so the strongest instance is kept.
  const dedupe = (list: NewsItem[]): NewsItem[] => {
    const seen = new Set<string>();
    const out: NewsItem[] = [];
    for (const n of list) {
      const tKey = newsTitleKey(n.title);
      const cKey = newsDedupKey(n);
      if ((tKey && seen.has(tKey)) || seen.has(cKey)) continue;
      if (tKey) seen.add(tKey);
      seen.add(cKey);
      out.push(n);
    }
    return out;
  };

  // Spread coverage: cap any single primary vendor at `maxPerVendor` while
  // filling up to `limit`; only relax the cap if we'd otherwise fall short
  // (so a genuinely single-vendor week still fills, per "where applicable").
  const selectSpread = (list: NewsItem[]): NewsItem[] => {
    const counts = new Map<string, number>();
    const picked: NewsItem[] = [];
    const deferred: NewsItem[] = [];
    for (const n of list) {
      if (picked.length >= limit) break;
      const key = normalizeVendorId(n.vendors[0]) ?? "__none__";
      const c = counts.get(key) ?? 0;
      if (c < maxPerVendor) {
        counts.set(key, c + 1);
        picked.push(n);
      } else {
        deferred.push(n);
      }
    }
    for (const n of deferred) {
      if (picked.length >= limit) break;
      picked.push(n);
    }
    return picked;
  };

  const cutoff = Date.now() - days * 86_400_000;
  const windowed = ranked.filter((n) => Date.parse(n.publishedAt) >= cutoff && n.impactScore >= minImpact);

  // Graceful degradation: when nothing falls inside the window (e.g. the daily
  // ingest is a few days behind), fall back to the most recent meaningful real
  // items (relaxed impact floor) and flag the feed as stale rather than showing
  // an empty "0 signals" card while we actually hold real intel.
  let chosen = selectSpread(dedupe(windowed));
  let usedFallback = false;
  if (chosen.length === 0 && all.length > 0) {
    const relaxed = Math.max(40, minImpact - 15);
    chosen = selectSpread(dedupe(ranked.filter((n) => n.impactScore >= relaxed)));
    usedFallback = chosen.length > 0;
  }

  const items: BreakingNewsItem[] = chosen.map((n) => {
    const primaryVendorId = normalizeVendorId(n.vendors[0]);
    return {
      ...n,
      importance: importanceOf(n.impactScore),
      primaryVendorId,
      primaryVendorName: resolveVendorName(primaryVendorId),
    };
  });

  return {
    items,
    windowDays: days,
    latestPublishedAt,
    latestAgeDays,
    liveCount: items.filter((n) => n.sourceKind === "real").length,
    usedFallback,
    vendorsCovered: new Set(items.map((i) => i.primaryVendorId).filter(Boolean)).size,
  };
}

export async function listCapabilities(): Promise<Capability[]> {
  return databaseOrSeed(
    async (client) => {
      const rows = await client.capability.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
      return rows.length ? rows.map(mapCapability) : capabilitiesMockRepository.list();
    },
    () => capabilitiesMockRepository.list(),
  );
}

export async function listVendorCapabilities(): Promise<VendorCapability[]> {
  // Merge strategy (not all-or-nothing): the intelligence projector only
  // writes cells it has verified evidence for. If we returned just the DB
  // rows, every (vendor, capability) pair not yet touched by the projector
  // would render as "validation_required" — even though we have curated
  // seed estimates for them. So we layer DB rows over seed rows: any
  // (vendor, capability) pair present in the DB wins; everything else
  // falls back to the seed baseline.
  return databaseOrSeed(
    async (client) => {
      const dbRows = (await client.vendorCapability.findMany({
        orderBy: [{ vendorId: "asc" }, { capabilityId: "asc" }],
      })).map(mapVendorCapability);
      const seed = await capabilitiesMockRepository.listVendorCapabilities();
      const dbKeys = new Set(dbRows.map((r) => `${r.vendorId}_${r.capabilityId}`));
      const seedFallback = seed.filter((s) => !dbKeys.has(`${s.vendorId}_${s.capabilityId}`));
      return [...dbRows, ...seedFallback];
    },
    () => capabilitiesMockRepository.listVendorCapabilities(),
  );
}

/** A capability a vendor has NEWLY gained from ingested evidence. */
export interface NewVendorCapability {
  vendorId: string;
  vendorName: string;
  vendorCategory: string;
  capabilityId: string;
  capabilityName: string;
  /** Capability family (the dimension the vendor now overlaps competitors on). */
  capabilityFamily: string;
  maturityScore: number;
  evidenceGrade: VendorCapability["evidenceGrade"];
  lastVerified: string;
  notes: string;
  sourceUrls: string[];
}

/**
 * Capabilities a vendor has NEWLY gained from ingested evidence within the
 * recency window — i.e. a (vendor, capability) cell that the live DB holds
 * (evidence-projected) but which is ABSENT from the curated seed baseline. That
 * absence is the signal: the analyst roster never credited the vendor with this
 * capability, so its appearance from real evidence means the vendor just gained
 * it (e.g. "Anthropic shipped a legal app it never had"). Derived at read-time —
 * no schema change — by diffing live DB cells against the seed set. Returns []
 * when there's no database (pure-seed mode has no "new" capabilities by
 * definition — everything is the baseline).
 */
export async function listNewVendorCapabilities(
  opts: { days?: number; limit?: number } = {},
): Promise<NewVendorCapability[]> {
  const days = opts.days ?? 60;
  const limit = opts.limit ?? 12;
  return databaseOrSeed<NewVendorCapability[]>(
    async (client) => {
      const cutoff = new Date(Date.now() - days * 86_400_000);
      const dbRows = (await client.vendorCapability.findMany({
        where: { lastVerified: { gte: cutoff } },
        orderBy: { lastVerified: "desc" },
      })).map(mapVendorCapability);
      if (dbRows.length === 0) return [];
      // Curated baseline: a (vendor, capability) pair present in the seed is an
      // analyst-known capability (it may have been re-verified by evidence, but
      // it is NOT newly gained). Only DB cells absent from the seed are "new".
      const seed = await capabilitiesMockRepository.listVendorCapabilities();
      const seedKeys = new Set(seed.map((s) => `${s.vendorId}_${s.capabilityId}`));
      const fresh = dbRows.filter((r) => !seedKeys.has(`${r.vendorId}_${r.capabilityId}`));
      if (fresh.length === 0) return [];
      const [caps, vendors] = await Promise.all([listCapabilities(), listIntelligenceVendors()]);
      const capById = new Map(caps.map((c) => [c.id, c]));
      const venById = new Map(vendors.map((v) => [v.id, v]));
      const out: NewVendorCapability[] = [];
      for (const r of fresh) {
        const cap = capById.get(r.capabilityId);
        // Vendor ids appear bare ("openai") or prefixed ("vendor_openai") across
        // tables — resolve either form so rows aren't silently dropped.
        const ven =
          venById.get(r.vendorId) ??
          venById.get(r.vendorId.replace(/^vendor_/, "")) ??
          venById.get(`vendor_${r.vendorId}`);
        if (!cap || !ven) continue; // skip orphans (no matching capability/vendor)
        out.push({
          vendorId: r.vendorId,
          vendorName: ven.name,
          vendorCategory: ven.category,
          capabilityId: r.capabilityId,
          capabilityName: cap.name,
          capabilityFamily: cap.category,
          maturityScore: r.maturityScore,
          evidenceGrade: r.evidenceGrade,
          lastVerified: r.lastVerified,
          notes: r.notes,
          sourceUrls: r.sourceUrls ?? [],
        });
        if (out.length >= limit) break;
      }
      return out;
    },
    (): NewVendorCapability[] => [],
  );
}

export async function listVendorPillarScores(): Promise<VendorPillarScore[]> {
  // Same merge strategy as listVendorCapabilities above.
  return databaseOrSeed(
    async (client) => {
      const dbRows = (await client.intelligencePillarScore.findMany({
        orderBy: [{ vendorId: "asc" }, { pillar: "asc" }],
      })).map(mapPillarScore);
      const dbKeys = new Set(dbRows.map((r) => `${r.vendorId}_${r.pillar}`));
      // Seed pillar scores layer in ONLY in local dev/tests — never in a
      // deployed build (else fabricated scores merge alongside real DB rows).
      const seedFallback = seedFallbackAllowed()
        ? VENDOR_PILLAR_SCORES.filter((s) => !dbKeys.has(`${s.vendorId}_${s.pillar}`))
        : [];
      return [...dbRows, ...seedFallback];
    },
    () => VENDOR_PILLAR_SCORES,
  );
}

export async function listEvidenceSources(): Promise<EvidenceSource[]> {
  return databaseOrSeed(
    async (client) => {
      const rows = await client.evidenceSource.findMany({ orderBy: [{ entityType: "asc" }, { entityId: "asc" }] });
      return rows.length ? rows.map(mapEvidenceSource) : evidenceSourcesMockRepository.list();
    },
    () => evidenceSourcesMockRepository.list(),
  );
}

export async function listWatchlists(): Promise<Watchlist[]> {
  // Same merge strategy used for capabilities + pillar scores + news:
  // DB rows win per id; seed entries with ids not present in DB are
  // appended. Without this merge, any new curated watchlist (e.g.
  // "Vertical AI specialists", "Regulated enterprise stack") is
  // shadowed by the DB-seeded initial two rows.
  return databaseOrSeed(
    async (client) => {
      const dbRows = (await client.watchlist.findMany({ orderBy: { createdAt: "desc" } })).map(mapWatchlist);
      const seed = await watchlistsMockRepository.list();
      const dbIds = new Set(dbRows.map((r) => r.id));
      const seedFallback = seed.filter((s) => !dbIds.has(s.id));
      return [...dbRows, ...seedFallback];
    },
    () => watchlistsMockRepository.list(),
  );
}

export async function createWatchlist(input: Omit<Watchlist, "id" | "createdAt">): Promise<Watchlist> {
  return databaseOrSeed(
    async (client) => mapWatchlist(await client.watchlist.create({
      data: {
        name: input.name,
        vendors: input.vendors,
        categories: input.categories,
        industries: input.industries,
        alertRules: toInputJson(input.alertRules),
      },
    })),
    () => watchlistsMockRepository.create(input),
  );
}

/**
 * Per-vendor count of analyst_verified EvidenceRecord rows — the honest
 * evidence-depth signal. Shared by the dashboard, understand, vendor-detail and
 * export surfaces so they all use ONE query + threshold. Returns an empty Map
 * with no database (the seed/no-DB path is honestly all-seed). Read-only.
 */
export async function getEvidenceDepthByVendor(): Promise<Map<string, number>> {
  if (!hasDatabase()) return new Map();
  try {
    const rows = await getPrisma().evidenceRecord.groupBy({
      by: ["vendorId"],
      where: { reviewStatus: "analyst_verified" },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.vendorId, r._count._all]));
  } catch {
    return new Map();
  }
}

export async function getMarketDashboard(): Promise<MarketDashboard> {
  const [vendorsRaw, shares, categories, momentum, news, evidenceDepthByVendor] = await Promise.all([
    listIntelligenceVendors(),
    listMarketShareEstimates(),
    listMarketCategories(),
    listVendorMomentum(),
    listNewsItems(),
    getEvidenceDepthByVendor(),
  ]);
  // Attach the evidence-depth honesty signal to every vendor so all dashboard
  // panels can mark un-evidenced scores (a 0-depth vendor is a seed estimate).
  const vendors = vendorsRaw.map((vendor) => {
    const evidenceDepth = evidenceDepthByVendor.get(vendor.id) ?? 0;
    return { ...vendor, evidenceDepth, dataConfidence: evidenceDepthBand(evidenceDepth) };
  });
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const topVendors = [...vendors].sort(byScoreDesc).slice(0, 8);
  const momentumByVendor = new Map(momentum.map((row) => [row.vendorId, row]));

  const winningVendors = [...vendors]
    .filter((vendor) => (momentumByVendor.get(vendor.id)?.momentumScore ?? 0) >= 60)
    .sort((a, b) => (momentumByVendor.get(b.id)?.momentumScore ?? 0) - (momentumByVendor.get(a.id)?.momentumScore ?? 0))
    .slice(0, 5)
    .map((vendor) => ({
      vendor,
      reason: `Momentum ${momentumByVendor.get(vendor.id)?.momentumScore ?? 0}/100 with visible category movement.`,
      confidence: momentumByVendor.get(vendor.id)?.confidence ?? vendor.confidenceScore,
    }));

  // ─────────────────────────────────────────────────────────────
  // "Who's losing" — sharpened per the May-2026 dashboard review.
  // The previous implementation rendered the same generic hedge
  // ("Confidence, evidence depth, or category concentration is
  // limiting the current view.") for every entry. That's not a
  // thesis. Replaced with a composite "losing score" + a per-vendor
  // reason that names the actual issue.
  //
  // Composite losing score = (low momentum) + (negative share trend)
  //   + (depth of risk profile). Higher = bigger problem.
  //
  // Per-vendor reason names whichever signal is most damning, falling
  // back to the vendor's own riskProfile entries so the copy is
  // grounded in seed-curated content, not invented.
  // ─────────────────────────────────────────────────────────────
  const shareTrendByVendor = new Map<string, number>();
  for (const s of shares) {
    const prev = shareTrendByVendor.get(s.vendorId) ?? 0;
    shareTrendByVendor.set(s.vendorId, prev + Math.min(0, s.changePct));
  }

  function losingScore(v: Vendor): number {
    const mom = momentumByVendor.get(v.id)?.momentumScore ?? 50;
    const momentumDrag = Math.max(0, 60 - mom);
    const shareDrag = Math.abs(Math.min(0, shareTrendByVendor.get(v.id) ?? 0));
    const riskDepth = (v.riskProfile?.length ?? 0) * 8;
    const confidenceGap = Math.max(0, 70 - (v.confidenceScore ?? 50));
    return momentumDrag * 1.4 + shareDrag * 1.1 + riskDepth + confidenceGap * 0.6;
  }

  function losingReason(v: Vendor): string {
    const mom = momentumByVendor.get(v.id)?.momentumScore ?? 50;
    const shareDelta = shareTrendByVendor.get(v.id) ?? 0;
    const primaryRisk = v.riskProfile?.[0];
    // Most damning signal first.
    if (shareDelta <= -6) {
      return `Category share down ${Math.abs(shareDelta).toFixed(1)}pp${primaryRisk ? ` — ${primaryRisk.toLowerCase()}` : ""}.`;
    }
    if (mom < 50) {
      return `Momentum ${Math.round(mom)}/100 — ${primaryRisk ? primaryRisk.toLowerCase() : "lagging product cadence"}.`;
    }
    if ((v.riskProfile?.length ?? 0) >= 2) {
      return `Two open risks: ${v.riskProfile!.slice(0, 2).join("; ").toLowerCase()}.`;
    }
    if (v.confidenceScore < 65) {
      return `Evidence depth ${v.confidenceScore}/100 — ${primaryRisk ? primaryRisk.toLowerCase() : "limited verified-source coverage"}.`;
    }
    return primaryRisk ?? "Position narrowing on combined momentum + evidence signals.";
  }

  const losingVendors = [...vendors]
    .filter((vendor) => {
      const mom = momentumByVendor.get(vendor.id)?.momentumScore ?? 50;
      const shareDelta = shareTrendByVendor.get(vendor.id) ?? 0;
      // Real signals only: momentum below 60, OR meaningful share
      // erosion, OR ≥2 open risks. Skip vendors that don't actually
      // signal "losing" — even if confidenceScore is low, that alone
      // isn't a losing signal, it's an evidence-depth signal.
      return mom < 60 || shareDelta <= -3 || (vendor.riskProfile?.length ?? 0) >= 2;
    })
    .sort((a, b) => losingScore(b) - losingScore(a))
    .slice(0, 5)
    .map((vendor) => ({
      vendor,
      reason: losingReason(vendor),
      confidence: vendor.confidenceScore,
    }));

  const weeklyMovers = shares
    .filter((estimate) => Math.abs(estimate.changePct) >= 10)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 6)
    .flatMap((estimate) => {
      const vendor = vendorById.get(estimate.vendorId);
      if (!vendor) return [];
      return [{
        vendor,
        changePct: estimate.changePct,
        reason: `${estimate.categoryId.replace(/_/g, " ")} estimate moved from ${estimate.previousEstimate ?? "n/a"} to ${estimate.estimatedShare}%.`,
        confidence: estimate.confidence,
      }];
    });

  const categoryShare = categories.map((category) => ({
    category,
    leaders: shares
      .filter((estimate) => estimate.categoryId === category.id)
      .sort((a, b) => b.estimatedShare - a.estimatedShare)
      .slice(0, 3)
      .flatMap((estimate) => {
        const vendor = vendorById.get(estimate.vendorId);
        return vendor ? [{ vendor, estimate }] : [];
      }),
  }));

  const agenticMomentum = momentum
    .filter((row) => {
      const vendor = vendorById.get(row.vendorId);
      return vendor?.supportedUseCases.some((useCase) => useCase.toLowerCase().includes("agent"))
        || vendor?.category.includes("Agent")
        || (row.momentumScore >= 70);
    })
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, 6)
    .flatMap((row) => {
      const vendor = vendorById.get(row.vendorId);
      return vendor ? [{ vendor, momentum: row }] : [];
    });

  const riskAlerts = vendors
    .filter((vendor) => vendor.riskProfile.length > 0)
    .sort((a, b) => {
      const severityRank = { high: 3, medium: 2, watch: 1 };
      return severityRank[riskStatusForVendor(b, momentumByVendor.get(b.id))] - severityRank[riskStatusForVendor(a, momentumByVendor.get(a.id))];
    })
    .slice(0, 8)
    .map((vendor) => ({
      vendor,
      alert: vendor.riskProfile[0],
      severity: riskStatusForVendor(vendor, momentumByVendor.get(vendor.id)),
      confidence: vendor.confidenceScore,
    }));

  const sectorNames = Array.from(new Set(vendors.flatMap((vendor) => vendor.industryStrength.map((strength) => strength.industry)))).slice(0, 6);
  const sectorLeaders = sectorNames.map((industry) => ({
    industry,
    vendors: vendors
      .flatMap((vendor) => vendor.industryStrength.filter((strength) => strength.industry === industry).map((strength) => ({ vendor, score: strength.score })))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
  }));

  return {
    generatedAt: new Date().toISOString(),
    topVendors,
    winningVendors,
    losingVendors,
    weeklyMovers,
    majorNews: news.slice(0, 6),
    categoryShare,
    agenticMomentum,
    riskAlerts,
    sectorLeaders,
  };
}

const DEFAULT_WEIGHTS: Record<PillarId, number> = {
  business_fit: 0.17,
  enterprise_control: 0.24,
  reliability_safety: 0.16,
  integration_ops: 0.16,
  vendor_resilience: 0.13,
  market_strength: 0.14,
};

export async function rankIntelligenceVendors(input: RankInput) {
  const [vendors, pillarScores, shares] = await Promise.all([
    listIntelligenceVendors(),
    listVendorPillarScores(),
    listMarketShareEstimates(),
  ]);
  const selected = input.vendorIds?.length
    ? vendors.filter((vendor) => input.vendorIds?.includes(vendor.id))
    : vendors;
  const riskTolerance = input.riskTolerance ?? 3;

  return selected
    .map((vendor) => {
      const scores = pillarScores.filter((score) => score.vendorId === vendor.id);
      const weighted = scores.reduce((sum, score) => {
        const weight = DEFAULT_WEIGHTS[score.pillar] ?? 0;
        return sum + score.capabilityScore * weight * (score.confidence / 100);
      }, 0);
      const categoryShare = input.categoryId
        ? shares.find((share) => share.vendorId === vendor.id && share.categoryId === input.categoryId)
        : undefined;
      const categoryBonus = categoryShare ? Math.min(6, categoryShare.estimatedShare / 5) : 0;
      const useCaseBonus = input.useCase && vendor.supportedUseCases.some((useCase) => useCase.toLowerCase().includes(input.useCase!.toLowerCase()))
        ? 4
        : 0;
      const industryBonus = input.industry && vendor.supportedIndustries.some((industry) => industry.toLowerCase().includes(input.industry!.replace(/_/g, " ").split(" ")[0]))
        ? 3
        : 0;
      const riskPenalty = vendor.riskProfile.length * calculateRiskPenalty("moderate", riskTolerance);
      const missingEvidencePenalty = Math.max(0, 76 - vendor.confidenceScore) * 0.12;
      const finalScore = Math.max(0, Math.min(100, weighted + categoryBonus + useCaseBonus + industryBonus - riskPenalty - missingEvidencePenalty));
      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        finalScore,
        confidenceScore: vendor.confidenceScore,
        categoryShare,
        rationale: `${vendor.name} scores strongest where ${vendor.category.toLowerCase()} fit, evidence confidence, and market momentum align. Estimated data is confidence-labelled and does not override control risks.`,
        risks: vendor.riskProfile,
        pillarScores: Object.fromEntries(scores.map((score) => [score.pillar, score.capabilityScore])),
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((result, index) => ({ ...result, rank: index + 1 }));
}
