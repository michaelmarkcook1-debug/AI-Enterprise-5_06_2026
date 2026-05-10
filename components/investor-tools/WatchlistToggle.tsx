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
          : "border-[#cfd7c8] bg-white/70 text-[#273227] hover:bg-[#eef2e8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      }`}
      title={isOn ? `Remove ${providerName} from watchlist` : `Add ${providerName} to watchlist`}
    >
      <span aria-hidden>{isOn ? "★" : "☆"}</span>
      {isOn ? "On watchlist" : "Add to watchlist"}
    </button>
  );
}
