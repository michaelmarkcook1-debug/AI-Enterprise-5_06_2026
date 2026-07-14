"use client";

// Reusable client widget that records a provider view + offers a one-click
// watchlist toggle. Drop into any /investor-tools/provider/[slug] view.

import { useEffect } from "react";
import { useInvestorState, useWatchlistMembership } from "./InvestorStateProvider";

export function WatchlistToggle({ providerId, providerName }: { providerId: string; providerName: string }) {
  const { recordProviderView } = useInvestorState();
  const { isOn, toggle } = useWatchlistMembership(providerId);

  // Record the view exactly once per mount so analytics-ish "recently viewed"
  // stays accurate. The mutator is idempotent on duplicate ids.
  useEffect(() => {
    recordProviderView(providerId);
  }, [providerId, recordProviderView]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isOn}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        isOn
          ? "border-emerald-700 bg-emerald-900 text-white dark:border-emerald-300 dark:bg-emerald-300 dark:text-emerald-950"
          : "border-[#d6c9a8] bg-white/70 text-[#24364f] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8] dark:hover:bg-[#143049]"
      }`}
      title={isOn ? `Remove ${providerName} from watchlist` : `Add ${providerName} to watchlist`}
    >
      <span aria-hidden>{isOn ? "★" : "☆"}</span>
      {isOn ? "On watchlist" : "Add to watchlist"}
    </button>
  );
}
