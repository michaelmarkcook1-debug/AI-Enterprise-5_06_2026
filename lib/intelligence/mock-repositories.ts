import {
  CAPABILITIES,
  EVIDENCE_SOURCES,
  INTELLIGENCE_VENDORS,
  MARKET_CATEGORIES,
  MARKET_SHARE_ESTIMATES,
  NEWS_ITEMS,
  VENDOR_CAPABILITIES,
  VENDOR_MOMENTUM,
  WATCHLISTS,
} from "./seed";
import type {
  Capability,
  EvidenceSource,
  MarketCategory,
  MarketShareEstimate,
  NewsCategory,
  NewsItem,
  Vendor,
  VendorCapability,
  VendorMomentum,
  Watchlist,
} from "./types";
import { DataUnavailableError, seedFallbackAllowed } from "../availability";

// Seed values are a LOCAL-DEV / unit-test convenience only. In any deployed
// build `seedFallbackAllowed()` is false, so every reader below returns an empty
// result instead of dressing seed as live data. This is the single chokepoint
// that makes seed structurally unreachable in production/preview.
const SEED_OFF = () => !seedFallbackAllowed();

export interface ListRepository<T> {
  list(): Promise<T[]>;
}

export interface EntityRepository<T> extends ListRepository<T> {
  get(id: string): Promise<T | null>;
}

export interface NewsRepository extends ListRepository<NewsItem> {
  byVendor(vendorId: string): Promise<NewsItem[]>;
  byCategory(category: NewsCategory): Promise<NewsItem[]>;
}

export interface CapabilityRepository extends ListRepository<Capability> {
  listVendorCapabilities(): Promise<VendorCapability[]>;
}

export interface WatchlistRepository extends ListRepository<Watchlist> {
  create(input: Omit<Watchlist, "id" | "createdAt">): Promise<Watchlist>;
}

const runtimeWatchlists: Watchlist[] = [...WATCHLISTS];

function byVendorName(a: Vendor, b: Vendor): number {
  return a.name.localeCompare(b.name);
}

function byPublishedAtDesc(a: NewsItem, b: NewsItem): number {
  return b.publishedAt.localeCompare(a.publishedAt);
}

export const vendorsMockRepository: EntityRepository<Vendor> = {
  async list(): Promise<Vendor[]> {
    if (SEED_OFF()) return [];
    return [...INTELLIGENCE_VENDORS].sort(byVendorName);
  },
  async get(idOrSlug: string): Promise<Vendor | null> {
    if (SEED_OFF()) return null;
    return INTELLIGENCE_VENDORS.find((vendor) => vendor.id === idOrSlug || vendor.slug === idOrSlug) ?? null;
  },
};

export const newsMockRepository: NewsRepository = {
  async list(): Promise<NewsItem[]> {
    if (SEED_OFF()) return [];
    return [...NEWS_ITEMS].sort(byPublishedAtDesc);
  },
  async byVendor(vendorId: string): Promise<NewsItem[]> {
    if (SEED_OFF()) return [];
    return NEWS_ITEMS.filter((item) => item.vendors.includes(vendorId)).sort(byPublishedAtDesc);
  },
  async byCategory(category: NewsCategory): Promise<NewsItem[]> {
    if (SEED_OFF()) return [];
    return NEWS_ITEMS.filter((item) => item.categories.includes(category)).sort(byPublishedAtDesc);
  },
};

export const marketCategoriesMockRepository: ListRepository<MarketCategory> = {
  async list(): Promise<MarketCategory[]> {
    if (SEED_OFF()) return [];
    return [...MARKET_CATEGORIES];
  },
};

export const marketShareEstimatesMockRepository: ListRepository<MarketShareEstimate> = {
  async list(): Promise<MarketShareEstimate[]> {
    if (SEED_OFF()) return [];
    return [...MARKET_SHARE_ESTIMATES];
  },
};

export const vendorMomentumMockRepository: ListRepository<VendorMomentum> = {
  async list(): Promise<VendorMomentum[]> {
    if (SEED_OFF()) return [];
    return [...VENDOR_MOMENTUM];
  },
};

export const capabilitiesMockRepository: CapabilityRepository = {
  async list(): Promise<Capability[]> {
    if (SEED_OFF()) return [];
    return [...CAPABILITIES];
  },
  async listVendorCapabilities(): Promise<VendorCapability[]> {
    if (SEED_OFF()) return [];
    return [...VENDOR_CAPABILITIES];
  },
};

export const evidenceSourcesMockRepository: ListRepository<EvidenceSource> = {
  async list(): Promise<EvidenceSource[]> {
    if (SEED_OFF()) return [];
    return [...EVIDENCE_SOURCES];
  },
};

export const watchlistsMockRepository: WatchlistRepository = {
  async list(): Promise<Watchlist[]> {
    if (SEED_OFF()) return [];
    return runtimeWatchlists;
  },
  async create(input: Omit<Watchlist, "id" | "createdAt">): Promise<Watchlist> {
    if (SEED_OFF()) {
      throw new DataUnavailableError("watchlist database is unavailable; cannot persist watchlist");
    }
    const watchlist: Watchlist = {
      id: `watchlist_${Date.now().toString(36)}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    runtimeWatchlists.unshift(watchlist);
    return watchlist;
  },
};
