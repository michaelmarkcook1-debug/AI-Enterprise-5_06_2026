import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// Public crawl policy. The rankings/insight surface is fully indexable; admin
// and admin-API paths are kept out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/admin"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
