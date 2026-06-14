import type { InvestorToolNav } from "@/lib/investing/types";

export const INVESTOR_TOOLS_NAV: InvestorToolNav = {
  id: "investor_tools",
  label: "Investor Tools",
  route: "/investor-tools",
  children: [
    { id: "investment_intelligence", label: "Investment Intelligence", route: "/investor-tools/intelligence" },
    { id: "investment_simulator", label: "Investment Simulator", route: "/investor-tools/simulator" },
    { id: "market_signals", label: "Market Signals", route: "/investor-tools/signals" },
    { id: "public_ai_stocks", label: "Public AI Stocks", route: "/investor-tools/public" },
    { id: "ipo_watch", label: "IPO Watch", route: "/investor-tools/ipo-watch" },
    { id: "exposure_map", label: "AI Ecosystem Navigator", route: "/investor-tools/exposure-map" },
    { id: "investor_briefing", label: "Investment Briefings", route: "/investor-tools/briefings" },
    { id: "investor_watchlist", label: "Investor Watchlist", route: "/investor-tools/watchlist" },
  ],
};
