"use client";

// Compact, persistent status strip rendered above every Investor Tools route.
// Surfaces the shared state so users always know:
//   - how many providers they're tracking
//   - whether the simulator has unsaved configuration
//   - the last viewed provider (one-click jump)
// Keeps the cross-tab story visible without forcing every page to opt in.

import Link from "next/link";
import { useInvestorSnapshot, useInvestorState } from "./InvestorStateProvider";
import { getVendorIntel } from "@/lib/intelligence/seed-vendors-intel";

export function InvestorStatusBar() {
  const state = useInvestorSnapshot();
  const { setSimulatorInput } = useInvestorState();
  const watchlistCount = state.watchlist.length;
  const hasSimulatorConfig = Object.keys(state.simulatorInput).length > 0;
  const focusId = state.focusProviderId;
  const focusName = focusId ? findVendorName(focusId) : null;
  const savedCount = state.savedPortfolios.length;

  return (
    <div className="border-b border-[#dfe4da] bg-white/60 px-5 py-1.5 text-[11px] text-[#5f685a] dark:border-zinc-800 dark:bg-[#071827]/60 dark:text-zinc-400">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold uppercase tracking-wide">Investor session</span>

        <Link href="/investor-tools/watchlist" className="hover:text-[#18201b] dark:hover:text-zinc-100">
          Watchlist <span className="font-mono">{watchlistCount}</span>
        </Link>

        <span className="opacity-50">·</span>

        <Link href="/investor-tools/simulator" className="hover:text-[#18201b] dark:hover:text-zinc-100">
          Simulator {hasSimulatorConfig ? <span className="text-emerald-700 dark:text-emerald-400">configured</span> : <span className="opacity-70">default</span>}
        </Link>

        <span className="opacity-50">·</span>

        <span>
          Saved portfolios <span className="font-mono">{savedCount}</span>
        </span>

        {focusName && focusId && (
          <>
            <span className="opacity-50">·</span>
            <Link href={`/investor-tools/provider/${focusId}`} className="hover:text-[#18201b] dark:hover:text-zinc-100">
              Last viewed: <strong>{focusName}</strong>
            </Link>
          </>
        )}

        {hasSimulatorConfig && (
          <button
            type="button"
            onClick={() => setSimulatorInput({})}
            className="ml-auto text-[10px] uppercase tracking-wide opacity-70 hover:opacity-100"
            title="Reset simulator inputs to defaults (does not affect watchlist or saved portfolios)"
          >
            Reset simulator
          </button>
        )}
      </div>
    </div>
  );
}

function findVendorName(id: string): string | null {
  return getVendorIntel(id)?.name ?? null;
}
