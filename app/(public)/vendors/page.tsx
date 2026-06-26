import type { Metadata } from "next";
import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import { getCategoryRankings } from "@/lib/home/category-rankings";

// Rankings are SEGMENTED BY CATEGORY — vendors are only compared WITHIN a market
// category, never across them. The old flat "Overall" leaderboard mixed
// incomparable entity types (a foundry, a VC, a model lab) on one score. This
// reuses the canonical /category logic (market-share estimates), which also means
// investors / pure-capital entities (Sequoia, SoftBank) simply aren't ranked here
// — they have no market-share category and live in the dependency graph.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vendor Rankings",
  description:
    "Evidence-based enterprise-AI vendor rankings — ranked WITHIN each market category, never across them. Directional, confidence-labelled, source-cited.",
  alternates: { canonical: "/vendors" },
};

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default async function VendorsPage() {
  const rankings = await getCategoryRankings();
  const withLeaders = rankings.filter((r) => r.leaders.length > 0);

  return (
    <PageFrame
      title="Vendor rankings"
      kicker="Provider intelligence"
      description="Ranked within each market category — never across them. A model lab, a chip foundry, and a cloud platform don't belong on one leaderboard, so each has its own. Share figures are directional analyst estimates, each carrying its source."
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium">
          Directional estimates, not measured market data
        </span>
        <OwnershipLegend />
      </div>

      {withLeaders.length === 0 ? (
        <div className={CARD}>
          <p className="text-sm">
            Insufficient verified market-share evidence to rank vendors yet. We report the absence of
            data rather than estimate upward — explore the{" "}
            <Link href="/dependencies" className="underline underline-offset-2">dependency graph</Link>{" "}
            in the meantime.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {withLeaders.map((r) => (
            <section key={r.category.id} className={CARD}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2 className="font-[var(--font-display)] text-lg font-extrabold tracking-tight">
                  {r.category.name}
                </h2>
                <Link
                  href={`/category/${r.category.id}`}
                  className={`shrink-0 text-xs underline-offset-2 hover:underline ${MUTED}`}
                >
                  Sources &amp; full table →
                </Link>
              </div>
              <p className={`mb-3 max-w-2xl text-xs leading-5 ${MUTED}`}>{r.category.description}</p>

              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-left ${MUTED}`}>
                    <th className="w-8 py-1.5 pr-3 font-medium">#</th>
                    <th className="py-1.5 pr-3 font-medium">Vendor</th>
                    <th className="py-1.5 pr-3 text-right font-medium tabular-nums">Est. share</th>
                    <th className="py-1.5 text-right font-medium tabular-nums">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {r.leaders.map((l, i) => (
                    <tr key={l.vendor.id} className="border-t border-black/5 dark:border-white/10">
                      <td className="py-1.5 pr-3 font-mono tabular-nums text-[#b08d2f] dark:text-[#d4af37]">{i + 1}</td>
                      <td className="py-1.5 pr-3">
                        <Link href={`/vendors/${l.vendor.slug}`} className="underline-offset-2 hover:underline">
                          <VendorNameWithOwnership name={l.vendor.name} ownershipType={l.vendor.ownershipType} compactBadge />
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{l.estimatedShare.toFixed(1)}%</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{Math.round(l.confidence)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      <p className={`mt-6 text-sm ${MUTED}`}>
        Investors and pure-capital entities (e.g. Sequoia, SoftBank) aren&apos;t ranked here — they
        aren&apos;t product vendors, so a quality rank against them would mislead. See how capital and
        compute flow in the{" "}
        <Link href="/dependencies" className="underline underline-offset-2">dependency &amp; encroachment graph</Link>.
      </p>
    </PageFrame>
  );
}
