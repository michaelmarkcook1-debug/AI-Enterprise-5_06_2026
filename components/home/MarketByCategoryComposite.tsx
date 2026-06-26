import Link from "next/link";
import type { CategoryComposite } from "@/lib/ranking/composite-types";

// "The market, by category" — the explained taxonomy. Each card states what the
// category IS and shows the top vendors WITHIN it, ranked by the weighted
// multi-pillar composite (not market share). Honest "insufficient evidence"
// where no vendor has enough verified pillar coverage to rank.
const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default function MarketByCategoryComposite({ composites }: { composites: CategoryComposite[] }) {
  if (composites.length === 0) return null;

  return (
    <section id="market-by-category" className="mb-10 scroll-mt-20">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">
          The market, by category
        </h2>
        <span className={`text-xs ${MUTED}`}>{composites.length} categories</span>
      </div>
      <p className={`mb-2 max-w-3xl text-sm ${MUTED}`}>
        We rank vendors <strong>within</strong> comparable categories — never across them — by a
        weighted composite of all evidence-graded pillars (Business Fit, Enterprise Control,
        Reliability &amp; Safety, Integration &amp; Operations, Vendor Resilience, Market Strength).
        Market share is one input via Market Strength, never the rank.
      </p>
      <p className="mb-4 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium">
        Only pillars with verified evidence (E2+) count — dark pillars show as insufficient, never defaulted
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {composites.map((c) => (
          <div key={c.category.id} className={CARD}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{c.category.name}</h3>
              <Link href={`/category/${c.category.id}`} className={`shrink-0 text-xs underline-offset-2 hover:underline ${MUTED}`}>
                View →
              </Link>
            </div>
            <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{c.category.description}</p>

            {c.ranked.length === 0 ? (
              <p className={`mt-3 text-xs ${MUTED}`}>
                No vendor has enough verified pillar evidence to rank yet
                {c.incomplete.length > 0 ? ` (${c.incomplete.length} held as insufficient).` : "."}
              </p>
            ) : (
              <ol className="mt-3 space-y-1.5">
                {c.ranked.slice(0, 3).map((v) => (
                  <li key={v.vendorId} className="grid grid-cols-[1rem_1fr_auto] items-baseline gap-2 text-sm">
                    <span className="font-display text-[#b08d2f] tabular-nums dark:text-[#d4af37]">{v.rank}</span>
                    <Link href={`/vendors/${v.vendorSlug}`} className="min-w-0 truncate underline-offset-2 hover:underline">
                      {v.vendorName}
                    </Link>
                    <span className={`font-mono text-xs tabular-nums ${MUTED}`}>{v.composite!.toFixed(0)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
