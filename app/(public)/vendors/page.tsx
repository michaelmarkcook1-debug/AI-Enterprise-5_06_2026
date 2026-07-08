import type { Metadata } from "next";
import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { getCategoryComposites } from "@/lib/ranking/category-composite";
import { isLiveData } from "@/lib/intelligence/provenance";
import PillarContributionTable from "@/components/ranking/PillarContributionTable";
import TrackButton from "@/components/member/TrackButton";

// Rankings are SEGMENTED BY CATEGORY (never across) and computed from the FULL
// pillar framework — a transparent, weighted, deterministic composite of all
// evidence-graded pillars — NOT the single market-share proxy. Each position is
// explainable (per-pillar breakdown) and gated on verified evidence.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vendor Rankings",
  description:
    "Enterprise-AI vendor rankings — a weighted composite of all evidence-graded pillars, ranked WITHIN each market category, explainable and source-cited. Never a single market-share proxy.",
  alternates: { canonical: "/vendors" },
};

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

export default async function VendorsPage() {
  // Rank ONLY on verified, source-backed evidence. Without it we show the honest
  // "insufficient evidence" state below rather than seed/estimate figures.
  const isLive = await isLiveData();
  const composites = isLive ? await getCategoryComposites().catch(() => []) : [];
  const withVendors = composites.filter((c) => c.ranked.length > 0 || c.incomplete.length > 0);
  const anyRanked = composites.some((c) => c.ranked.length > 0);

  // So-what takeaway (Prompt 4) — real derived counts from the SAME composites
  // this page already renders, not a separate computation. Never a fabricated
  // insight: just an honest summary of how much of this page is solid vs. thin.
  const rankedCategories = withVendors.filter((c) => c.ranked.length > 0);
  const totalVendorsRanked = rankedCategories.reduce((n, c) => n + c.ranked.length, 0);
  const thinCategories = rankedCategories.filter((c) => c.lowDiscrimination).length;

  return (
    <PageFrame
      title="Vendor rankings"
      kicker="Provider intelligence"
      description="Ranked within each market category — never across them — by a weighted composite of all evidence-graded pillars. Not a single market-share proxy. Every position is explainable and tied to its evidence."
    >
      {/* So-what takeaway (Prompt 4) — real counts from the composites this
          page already renders, same "Derived signal" pattern as the homepage
          graph. Points back into the guided path for anyone who landed on
          this dense list cold and wants a steered fit instead. */}
      {anyRanked && (
        <div className="mb-4 max-w-3xl text-sm leading-6">
          <p className="text-[#15263c] dark:text-[#eef3f8]">
            <span className="mr-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide align-middle">
              Derived signal
            </span>
            {totalVendorsRanked} vendor{totalVendorsRanked === 1 ? "" : "s"} ranked with verified evidence across{" "}
            {rankedCategories.length} categor{rankedCategories.length === 1 ? "y" : "ies"}
            {thinCategories > 0 && (
              <>
                {" "}— {thinCategories} of them {thinCategories === 1 ? "is" : "are"} still thin (treat the order as
                tiers, not a precise rank)
              </>
            )}
            .
          </p>
          <p className="mt-1.5 text-[#15263c]/70 dark:text-[#eef3f8]/70">
            Not sure where to look first?{" "}
            <Link href="/use-cases" className="underline underline-offset-2 hover:no-underline">
              Start here
            </Link>{" "}
            for a guided fit instead of the full list.
          </p>
        </div>
      )}
      {!anyRanked ? (
        <div className={CARD}>
          <p className="text-sm">
            Insufficient verified pillar evidence to rank vendors yet. We rank only on real,
            source-backed evidence across the full framework — never on a default or a single proxy —
            so until ingestion lands, we report the absence of data. Explore the{" "}
            <Link href="/dependencies" className="underline underline-offset-2">dependency graph</Link>{" "}
            in the meantime.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {withVendors.map((c) => (
            <section key={c.category.id} className={CARD}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2 className="font-[var(--font-display)] text-lg font-extrabold tracking-tight">
                  {c.category.name}
                </h2>
                <Link
                  href={`/category/${c.category.id}`}
                  className={`shrink-0 text-xs underline-offset-2 hover:underline ${MUTED}`}
                >
                  Full table &amp; sources →
                </Link>
              </div>
              <p className={`mb-3 max-w-2xl text-xs leading-5 ${MUTED}`}>{c.category.description}</p>

              {/* Per-category methodology — weights are bespoke per category, so the
                  note must never be presented as one global formula. */}
              {c.methodologyNote && (
                <details className="mb-3 text-sm">
                  <summary className="cursor-pointer text-[11px] font-medium underline-offset-2 hover:underline">
                    How this category&apos;s ranking is computed
                  </summary>
                  <p className={`mt-2 max-w-3xl text-xs leading-5 ${MUTED}`}>{c.methodologyNote}</p>
                </details>
              )}

              {/* RANK-FIX — inside the noise band the 1-N order is not statistically
                  separable; say so rather than implying false precision. */}
              {c.lowDiscrimination && c.ranked.length > 1 && (
                <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                  <strong>Early / thin evidence — limited discrimination.</strong> These composites sit within the
                  noise band; treat the order as tiers, not a precise 1–N ranking.
                </p>
              )}

              {c.ranked.length === 0 ? (
                <p className={`text-sm ${MUTED}`}>No vendor has enough verified pillar evidence to rank here yet.</p>
              ) : (
                <ol className="divide-y divide-black/5 dark:divide-white/10">
                  {c.ranked.map((v) => (
                    <li key={v.vendorId} className="py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="font-display tabular-nums text-[#b08d2f] dark:text-[#d4af37]">#{v.rank}</span>
                          <Link href={`/vendors/${v.vendorSlug}`} className="truncate font-medium underline-offset-2 hover:underline">
                            {v.vendorName}
                          </Link>
                        </span>
                        <span className="flex shrink-0 items-baseline gap-3">
                          <span className="font-mono text-sm tabular-nums">
                            {v.assessmentComposite == null ? "—" : v.assessmentComposite.toFixed(2)}
                            <span className={`ml-1 text-[10px] ${MUTED}`}>/5 composite</span>
                          </span>
                          <span className={`font-mono text-[11px] tabular-nums ${MUTED}`}>{Math.round(v.coverage * 100)}% covered</span>
                          <span className={`font-mono text-[11px] tabular-nums ${MUTED}`}>{v.compositeConfidence}% conf</span>
                          <TrackButton item={`vendor:${v.vendorSlug}`} label={v.vendorName} />
                        </span>
                      </div>
                      <PillarContributionTable vendor={v} />
                    </li>
                  ))}
                </ol>
              )}

              {c.incomplete.length > 0 && (
                <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
                  <p className={`text-[11px] font-medium ${MUTED}`}>
                    Held — insufficient evidence to rank ({c.incomplete.length})
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {c.incomplete.map((v) => (
                      <li key={v.vendorId} className="text-xs">
                        <Link href={`/vendors/${v.vendorSlug}`} className="underline-offset-2 hover:underline">
                          {v.vendorName}
                        </Link>
                        <span className={MUTED}> — {v.excludedReason} ({Math.round(v.coverage * 100)}% covered)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
