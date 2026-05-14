// Intelligence-layer repository — backs the executive market portal.
//
// Reads from Prisma/Postgres when configured and falls back to typed seed data
// for local demos, static builds, and first-run development.

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

let dbFallbackWarningShown = false;

function byScoreDesc(a: Vendor, b: Vendor): number {
  return b.overallScore - a.overallScore;
}

async function databaseOrSeed<T>(
  read: (client: PrismaClient) => Promise<T>,
  seed: () => T | Promise<T>,
): Promise<T> {
  if (!hasDatabase()) return seed();

  try {
    return await read(getPrisma());
  } catch (error) {
    if (!dbFallbackWarningShown && process.env.NODE_ENV !== "test") {
      dbFallbackWarningShown = true;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`AI Enterpise intelligence DB unavailable; using seed data. ${message}`);
    }
    return seed();
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
      return rows.length ? rows.map(mapMarketShare) : marketShareEstimatesMockRepository.list();
    },
    () => marketShareEstimatesMockRepository.list(),
  );
}

export async function listVendorMomentum(): Promise<VendorMomentum[]> {
  return databaseOrSeed(
    async (client) => {
      const rows = await client.vendorMomentum.findMany({ orderBy: [{ period: "desc" }, { momentumScore: "desc" }] });
      return rows.length ? rows.map(mapMomentum) : vendorMomentumMockRepository.list();
    },
    () => vendorMomentumMockRepository.list(),
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

export async function listVendorPillarScores(): Promise<VendorPillarScore[]> {
  // Same merge strategy as listVendorCapabilities above.
  return databaseOrSeed(
    async (client) => {
      const dbRows = (await client.intelligencePillarScore.findMany({
        orderBy: [{ vendorId: "asc" }, { pillar: "asc" }],
      })).map(mapPillarScore);
      const dbKeys = new Set(dbRows.map((r) => `${r.vendorId}_${r.pillar}`));
      const seedFallback = VENDOR_PILLAR_SCORES.filter((s) => !dbKeys.has(`${s.vendorId}_${s.pillar}`));
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
  return databaseOrSeed(
    async (client) => {
      const rows = await client.watchlist.findMany({ orderBy: { createdAt: "desc" } });
      return rows.length ? rows.map(mapWatchlist) : watchlistsMockRepository.list();
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

export async function getMarketDashboard(): Promise<MarketDashboard> {
  const [vendors, shares, categories, momentum, news] = await Promise.all([
    listIntelligenceVendors(),
    listMarketShareEstimates(),
    listMarketCategories(),
    listVendorMomentum(),
    listNewsItems(),
  ]);
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
