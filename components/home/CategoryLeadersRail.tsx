import Link from "next/link";
import type { CategoryRanking } from "@/lib/home/category-rankings";

// Hero rail — a category NAVIGATOR, not a flat leaderboard. Each row is one
// market category with its current leader. The point the old flat rail missed:
// vendors are ranked within a category, never across them. Links into the full
// per-category ranking at /category/[id].
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default function CategoryLeadersRail({ rankings }: { rankings: CategoryRanking[] }) {
  const withLeaders = rankings.filter((r) => r.leaders.length > 0);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Leaders by category</h2>
        <Link href="#market-by-category" className={`text-xs underline-offset-2 hover:underline ${MUTED}`}>
          All categories →
        </Link>
      </div>
      <p className={`mt-1 text-[11px] ${MUTED}`}>
        Ranked within each category — never across them. Figures are <strong>Market Share Est.</strong> —
        directional, derived from cited signals, not measured.
      </p>

      {withLeaders.length === 0 ? (
        <p className={`mt-4 text-sm ${MUTED}`}>Category rankings are not available right now.</p>
      ) : (
        <ol className="mt-3 divide-y divide-black/5 dark:divide-white/10">
          {withLeaders.map((r) => {
            const top = r.leaders[0];
            return (
              <li key={r.category.id} className="py-2">
                <Link href={`/category/${r.category.id}`} className="group flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#13294b] group-hover:underline dark:text-[#eef3f8]">
                      {r.category.name}
                    </span>
                    <span className={`block truncate text-[11px] ${MUTED}`}>
                      {top.vendor.name} leads · {r.leaders.length} tracked
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-[#b08d2f] dark:text-[#d4af37]" title="Market Share Est. — derived from cited signals, not measured. Directional.">
                    Est. {Math.round(top.estimatedShare)}%
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
