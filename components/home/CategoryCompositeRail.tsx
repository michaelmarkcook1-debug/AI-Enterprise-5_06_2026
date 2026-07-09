import Link from "next/link";
import type { CategoryComposite } from "@/lib/ranking/composite-types";
import CalibrationBadge from "@/components/ranking/CalibrationBadge";
import { calibrationBand } from "@/lib/ranking/calibration";

// Hero rail — a category NAVIGATOR. Each row is one market category with its
// best-EVIDENCED vendor (top of the within-category multi-pillar composite),
// not the biggest by market share. Links into the full per-category ranking.
const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

export default function CategoryCompositeRail({ composites }: { composites: CategoryComposite[] }) {
  const withRanked = composites.filter((c) => c.ranked.length > 0);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Leaders by category</h2>
        <Link href="#market-by-category" className={`text-xs underline-offset-2 hover:underline ${MUTED}`}>
          All categories →
        </Link>
      </div>
      <p className={`mt-1 text-[11px] ${MUTED}`}>
        Best-evidenced vendor per category — a weighted composite of all pillars, ranked within
        category. Not market share.
      </p>

      {withRanked.length === 0 ? (
        <p className={`mt-4 text-sm ${MUTED}`}>
          No vendor has enough verified pillar evidence to rank yet. We report that honestly rather
          than rank on partial evidence.
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-black/5 dark:divide-white/10">
          {withRanked.map((c) => {
            const top = c.ranked[0];
            return (
              <li key={c.category.id} className="py-2">
                <Link href={`/category/${c.category.id}`} className="group flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#13294b] group-hover:underline dark:text-[#eef3f8]">
                      {c.category.name}
                    </span>
                    {/* Band caveats a thin-evidence leader here — e.g. the ai_silicon
                        #1 reads "Emerging leader · limited evidence", not a bare "leads". */}
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <CalibrationBadge
                        calibration={calibrationBand(1, c.ranked.length, top.domainCoverage ?? 0, top.compositeConfidence ?? 0)}
                        showStanding={false}
                      />
                      <span className={`truncate text-[11px] ${MUTED}`}>
                        {top.vendorName} · {c.ranked.length} ranked
                        {c.incomplete.length > 0 ? ` · ${c.incomplete.length} held` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm tabular-nums text-[#b08d2f] dark:text-[#d4af37]">
                      {top.assessmentComposite == null ? "—" : `${top.assessmentComposite.toFixed(2)}/5`}
                    </span>
                    <span className={`block text-[10px] tabular-nums ${MUTED}`}>{top.compositeConfidence}% conf</span>
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
