import type { Metadata } from "next";
import { getMember } from "@/lib/member/auth";
import { getMemberWatchlist } from "@/lib/member/watchlist";
import { ENTITIES } from "@/lib/intelligence/entities";
import { MARKET_CATEGORIES } from "@/lib/intelligence/seed";
import { USE_CASES } from "@/lib/use-cases";
import WatchlistEditor from "@/components/member/WatchlistEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your watchlist",
  robots: { index: false, follow: false },
};

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default async function WatchlistPage() {
  const member = await getMember();
  if (!member) return null; // the (member) layout guards this; belt-and-suspenders.

  const watchlist = await getMemberWatchlist(member.subscriberId);

  // Static taxonomy reads — no LLM, no polling. Dedupe vendors by slug.
  const vendorMap = new Map(ENTITIES.map((e) => [e.slug, e.name]));
  const vendors = [...vendorMap.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const categories = MARKET_CATEGORIES.map((c) => ({ id: c.id as string, label: c.name }));
  const useCases = USE_CASES.map((u) => ({ id: u.id, label: u.label }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
          Your watchlist
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Watched: your shortlist</h1>
        <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>
          Save the vendors, categories, use-cases and current stack you care about. Your personalised
          Monitor (coming next) will track changes for exactly these — confidence-labelled, composed
          from the same cached market data. Private to you.
        </p>
      </header>

      <WatchlistEditor initial={watchlist} vendors={vendors} categories={categories} useCases={useCases} />
    </main>
  );
}
