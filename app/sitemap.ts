import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { listIntelligenceVendors, listMarketCategories } from "@/lib/intelligence/repository";

// Dynamic sitemap built from the live vendor + category roster (DB, with the
// repository's seed fallback so the sitemap is never empty). Compare pages are
// combinatorial and intentionally omitted here — they stay crawlable via
// in-page links rather than exploding the sitemap.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [vendors, categories] = await Promise.all([
    listIntelligenceVendors().catch(() => []),
    listMarketCategories().catch(() => []),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/vendors"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/models"), changeFrequency: "weekly", priority: 0.7 },
  ];

  const vendorEntries: MetadataRoute.Sitemap = vendors.map((v) => ({
    url: absoluteUrl(`/vendors/${v.slug}`),
    lastModified: v.lastUpdated ? new Date(v.lastUpdated) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: absoluteUrl(`/category/${c.id}`),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...vendorEntries, ...categoryEntries];
}
