import Link from "next/link";
import { ScoreBar } from "@/components/intelligence-ui";
import { VendorNameWithOwnership } from "@/components/ownership-indicator";
import { listIntelligenceVendors, listVendorMomentum } from "@/lib/intelligence/repository";

// Compact Top-N leaderboard rail beside the hero graph. Data path mirrors
// /vendors EXACTLY (listIntelligenceVendors + listVendorMomentum, sorted by
// overallScore). DB-backed → the home is force-dynamic. Scores are governed by
// getDataProvenance(): the freshness chip on the page carries the seed-vs-live
// truth, so this rail never asserts the figures are measured. Missing → "—".
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default async function RankingsRail({ limit = 8 }: { limit?: number }) {
  const [vendors, momentum] = await Promise.all([
    listIntelligenceVendors().catch(() => []),
    listVendorMomentum().catch(() => []),
  ]);
  const momentumByVendor = new Map(momentum.map((m) => [m.vendorId, m]));
  const top = vendors.slice().sort((a, b) => b.overallScore - a.overallScore).slice(0, limit);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Live rankings</h2>
        <Link href="/vendors" className={`text-xs underline-offset-2 hover:underline ${MUTED}`}>
          See all →
        </Link>
      </div>
      <p className={`mt-1 text-[11px] ${MUTED}`}>Scores are directional and confidence-labelled.</p>

      {top.length === 0 ? (
        <p className={`mt-4 text-sm ${MUTED}`}>Rankings are not available right now.</p>
      ) : (
        <ol className="mt-3 divide-y divide-black/5 dark:divide-white/10">
          {top.map((v, i) => {
            const mo = momentumByVendor.get(v.id);
            return (
              <li key={v.id} className="py-2.5">
                <Link href={`/vendors/${v.slug}`} className="group grid grid-cols-[1.4rem_1fr_auto] items-center gap-3">
                  <span className="font-display text-lg leading-none text-[#b08d2f] dark:text-[#d4af37] tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#13294b] group-hover:underline dark:text-[#eef3f8]">
                      <VendorNameWithOwnership name={v.name} ownershipType={v.ownershipType} compactBadge />
                    </span>
                    <span className={`block truncate text-[11px] ${MUTED}`}>{v.category}</span>
                  </span>
                  <span className="w-20">
                    <ScoreBar value={v.overallScore} />
                    <span className={`mt-1 block text-right text-[10px] tabular-nums ${MUTED}`}>
                      {mo ? `mom ${mo.momentumScore}/100` : "—"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
