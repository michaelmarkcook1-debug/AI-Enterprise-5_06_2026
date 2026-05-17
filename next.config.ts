import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    // Section 5 of the prompt pack made /investor-tools the canonical surface.
    // The real page implementations live under /app/investing/* and are
    // re-exported by /app/investor-tools/*; these redirects 308 the public
    // /investing/* URLs to the canonical /investor-tools/* paths. Module
    // imports between the two are unaffected (they're file imports, not URLs).
    return [
      { source: "/investment", destination: "/investor-tools/simulator", permanent: true },
      { source: "/investment-pack", destination: "/investor-tools/simulator", permanent: true },
      { source: "/investing", destination: "/investor-tools", permanent: true },
      { source: "/investing/simulator", destination: "/investor-tools/simulator", permanent: true },
      { source: "/investing/public", destination: "/investor-tools/public", permanent: true },
      { source: "/investing/ipo-watch", destination: "/investor-tools/ipo-watch", permanent: true },
      { source: "/investing/exposure-map", destination: "/investor-tools/exposure-map", permanent: true },
      { source: "/investing/briefing", destination: "/investor-tools/briefing", permanent: true },
      { source: "/investing/watchlist", destination: "/investor-tools/watchlist", permanent: true },
      { source: "/investing/provider/:slug", destination: "/investor-tools/provider/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
