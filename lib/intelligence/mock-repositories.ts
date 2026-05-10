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
    return [...INTELLIGENCE_VENDORS].sort(byVendorName);
  },
  async get(idOrSlug: string): Promise<Vendor | null> {
    return INTELLIGENCE_VENDORS.find((vendor) => vendor.id === idOrSlug || vendor.slug === idOrSlug) ?? null;
  },
};

export const newsMockRepository: NewsRepository = {
  async list(): Promise<NewsItem[]> {
    return [...NEWS_ITEMS].sort(byPublishedAtDesc);
  },
  async byVendor(vendorId: string): Promise<NewsItem[]> {
    return NEWS_ITEMS.filter((item) => item.vendors.includes(vendorId)).sort(byPublishedAtDesc);
  },
  async byCategory(category: NewsCategory): Promise<NewsItem[]> {
    return NEWS_ITEMS.filter((item) => item.categories.includes(category)).sort(byPublishedAtDesc);
  },
};

export const marketCategoriesMockRepository: ListRepository<MarketCategory> = {
  async list(): Promise<MarketCategory[]> {
    return [...MARKET_CATEGORIES];
  },
};

export const marketShareEstimatesMockRepository: ListRepository<MarketShareEstimate> = {
  async list(): Promise<MarketShareEstimate[]> {
    return [...MARKET_SHARE_ESTIMATES];
  },
};

export const vendorMomentumMockRepository: ListRepository<VendorMomentum> = {
  async list(): Promise<VendorMomentum[]> {
    return [...VENDOR_MOMENTUM];
  },
};

export const capabilitiesMockRepository: CapabilityRepository = {
  async list(): Promise<Capability[]> {
    return [...CAPABILITIES];
  },
  async listVendorCapabilities(): Promise<VendorCapability[]> {
    return [...VENDOR_CAPABILITIES];
  },
};

export const evidenceSourcesMockRepository: ListRepository<EvidenceSource> = {
  async list(): Promise<EvidenceSource[]> {
    return [...EVIDENCE_SOURCES];
  },
};

export const watchlistsMockRepository: WatchlistRepository = {
  async list(): Promise<Watchlist[]> {
    return runtimeWatchlists;
  },
  async create(input: Omit<Watchlist, "id" | "createdAt">): Promise<Watchlist> {
    const watchlist: Watchlist = {
      id: `watchlist_${Date.now().toString(36)}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    runtimeWatchlists.unshift(watchlist);
    return watchlist;
  },
};
