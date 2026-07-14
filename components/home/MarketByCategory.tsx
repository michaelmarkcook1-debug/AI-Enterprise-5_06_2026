import Link from "next/link";
import { VendorNameWithOwnership } from "@/components/ownership-indicator";
import type { CategoryRanking } from "@/lib/home/category-rankings";

// "The market, by category" — the explained taxonomy. Each card states what the
// category IS (its source-defined description) and shows the top vendors WITHIN
// it. This is the home-page explanation of the categories the platform is built
// around; full per-category tables live at /category/[id].
const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

export default function MarketByCategory({ rankings }: { rankings: CategoryRanking[] }) {
  if (rankings.length === 0) return null;

  return (
    <section id="market-by-category" className="mb-10 scroll-mt-20">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">
          The market, by category
        </h2>
        <span className={`text-xs ${MUTED}`}>{rankings.length} categories</span>
      </div>
      <p className={`mb-2 max-w-3xl text-sm ${MUTED}`}>
        We rank vendors <strong>within</strong> comparable categories — never across them. A model lab,
        a chip foundry, and a cloud platform don&apos;t belong on one leaderboard, so each has its own.
      </p>
      <p className={`mb-4 max-w-3xl text-xs leading-5 ${MUTED}`}>
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-medium">Market Share Est.</span>{" "}
        — figures are estimates derived from real cited signals (reviewed evidence, dependencies, adoption, momentum),
        not measured market data. Directional, recalculated each refresh.{" "}
        <Link href="/insights#market-share-est" className="underline underline-offset-2">How this is estimated</Link>.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rankings.map((r) => (
          <div key={r.category.id} className={CARD}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{r.category.name}</h3>
              <Link href={`/category/${r.category.id}`} className={`shrink-0 text-xs underline-offset-2 hover:underline ${MUTED}`}>
                View →
              </Link>
            </div>
            <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{r.category.description}</p>

            {r.leaders.length === 0 ? (
              <p className={`mt-3 text-xs ${MUTED}`}>Insufficient verified evidence yet.</p>
            ) : (
              <ol className="mt-3 space-y-1.5">
                {r.leaders.slice(0, 3).map((l, i) => (
                  <li key={l.vendor.id} className="grid grid-cols-[1rem_1fr_auto] items-baseline gap-2 text-sm">
                    <span className="font-display text-[#b08d2f] tabular-nums dark:text-[#d4af37]">{i + 1}</span>
                    <Link href={`/vendors/${l.vendor.slug}`} className="min-w-0 truncate underline-offset-2 hover:underline">
                      <VendorNameWithOwnership name={l.vendor.name} ownershipType={l.vendor.ownershipType} compactBadge />
                    </Link>
                    <span className={`font-mono text-xs tabular-nums ${MUTED}`} title="Market Share Est. — derived from cited signals, not measured. Directional.">Est. {Math.round(l.estimatedShare)}%</span>
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
