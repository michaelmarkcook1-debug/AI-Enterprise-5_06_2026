import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/lib/site";
import { listMarketCategories } from "@/lib/intelligence/repository";
import { getCategoryComposite } from "@/lib/ranking/category-composite";
import DataUnavailable from "@/components/DataUnavailable";
import PillarContributionTable from "@/components/ranking/PillarContributionTable";
import TrackButton from "@/components/member/TrackButton";
import { getVendorScorecardsBatch, type VendorScorecard } from "@/lib/assessment/domain-scores";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";

// force-dynamic (not ISR): rankings are DB-backed + recalculated each pipeline
// run, so the page must reflect the live data immediately — never serve a stale
// pre-recompute render. DB reads only; no LLM at request time.
export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const categories = await listMarketCategories().catch(() => []);
  const category = categories.find((c) => c.id === slug);
  if (!category) return { title: "Category not found" };
  const title = `${category.name} — vendor rankings`;
  return {
    title,
    description: category.description,
    alternates: { canonical: `/category/${slug}` },
    openGraph: { title, description: category.description, url: absoluteUrl(`/category/${slug}`), type: "website" },
  };
}

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  // Within-category multi-pillar composite. Computed only on verified evidence;
  // otherwise the honest "insufficient evidence" state shows — never seed.
  const composite = await getCategoryComposite(slug);
  if (!composite) notFound();
  const { category, ranked, incomplete, isLive, methodologyNote, lowDiscrimination } = composite;

  // Phase 3 — per-vendor 12-domain evidence scorecards (deterministic, no LLM,
  // batched into one query). Used for the compact domain strip under each vendor.
  const scorecards: Map<string, VendorScorecard> = isLive
    ? await getVendorScorecardsBatch([...ranked, ...incomplete].map((v) => v.vendorId)).catch(
        () => new Map<string, VendorScorecard>(),
      )
    : new Map<string, VendorScorecard>();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <nav className={`mb-3 text-xs ${MUTED}`}>
        <Link href="/vendors" className="underline underline-offset-2">Vendors</Link> · Category
      </nav>
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{category.name}</h1>
          <TrackButton item={`category:${category.id}`} label={category.name} />
        </div>
        <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>{category.description}</p>
      </header>

      {!isLive ? (
        <DataUnavailable
          title="Live rankings unavailable"
          detail="We rank vendors in this category only on verified, source-backed evidence across the full pillar framework — never on a default or a single market-share proxy. Until ingestion lands and evidence is approved, we hold the ranking."
        />
      ) : ranked.length === 0 && incomplete.length === 0 ? (
        <div className={CARD}>
          <p className="text-sm">
            No vendors are tracked in this category yet. Browse the{" "}
            <Link href="/vendors" className="underline underline-offset-2">full vendor leaderboard</Link>.
          </p>
        </div>
      ) : (
        <section className={CARD}>
          <details className="mb-4 text-sm">
            <summary className="cursor-pointer text-[11px] font-medium underline-offset-2 hover:underline">
              How this ranking is computed
            </summary>
            <p className={`mt-2 text-xs leading-5 ${MUTED}`}>{methodologyNote}</p>
          </details>

          {/* RANK-FIX — when composites sit inside the noise band the order is not
              statistically separable; lead with tiers + an honest note, not a
              false-precision 1-N list. */}
          {lowDiscrimination && ranked.length > 1 && (
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              <strong>Early / thin evidence — limited discrimination.</strong> These vendors&apos; coverage-adjusted
              composites sit within the noise band, so treat the order as <strong>tiers</strong> (shown per vendor), not a
              precise 1-N ranking. More verified evidence will separate them.
            </p>
          )}

          {ranked.length === 0 ? (
            <p className={`text-sm ${MUTED}`}>No vendor has enough verified pillar evidence to rank here yet.</p>
          ) : (
            <ol className="divide-y divide-black/5 dark:divide-white/10">
              {ranked.map((v) => (
                <li key={v.vendorId} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="font-display tabular-nums text-[#b08d2f] dark:text-[#d4af37]">#{v.rank}</span>
                      <Link href={`/vendors/${v.vendorSlug}`} className="truncate font-medium underline-offset-2 hover:underline">
                        {v.vendorName}
                      </Link>
                      {v.tier && (
                        <span className="rounded-full border border-black/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#15263c]/70 dark:border-white/15 dark:text-[#eef3f8]/70">
                          {v.tier}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="font-mono text-sm tabular-nums" title={`Raw pillar composite ${v.composite?.toFixed(0)} × ${v.domainScored}/${v.domainTotal} domain coverage`}>
                        {(v.adjustedComposite ?? 0).toFixed(0)}
                        <span className={`ml-1 text-[10px] ${MUTED}`}>composite</span>
                      </span>
                      <span className={`font-mono text-[11px] tabular-nums ${MUTED}`}>{v.domainScored}/{v.domainTotal} domains</span>
                      <span className={`font-mono text-[11px] tabular-nums ${MUTED}`}>{v.compositeConfidence}% conf</span>
                      <TrackButton item={`vendor:${v.vendorSlug}`} label={v.vendorName} />
                    </span>
                  </div>
                  {v.marketContext.estimatedShare === null ? (
                    <p className={`mt-1 text-[10px] ${MUTED}`}>Market Share Est.: mapping insufficient</p>
                  ) : v.marketContext.isSeedSource ? (
                    <p className={`mt-1 text-[10px] ${MUTED}`}>Market Share Est.: insufficient real-sourced estimate</p>
                  ) : (
                    <p className={`mt-1 text-[10px] ${MUTED}`}>
                      Market Share Est.: ~{Math.round(v.marketContext.estimatedShare)}% category share · context only, not the rank ·{" "}
                      <Link href="/insights#market-share-est" className="underline underline-offset-2">how this is estimated</Link>
                    </p>
                  )}
                  <PillarContributionTable vendor={v} />
                  <DomainStrip scorecard={scorecards.get(v.vendorId)} />
                </li>
              ))}
            </ol>
          )}

          {incomplete.length > 0 && (
            <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/10">
              <h2 className="text-sm font-semibold">Held — insufficient evidence to rank ({incomplete.length})</h2>
              <p className={`mt-1 text-xs ${MUTED}`}>
                These vendors compete in the category but lack enough verified pillar evidence to be ranked.
                We hold them rather than float them on partial data.
              </p>
              <ul className="mt-2 space-y-3">
                {incomplete.map((v) => (
                  <li key={v.vendorId}>
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/vendors/${v.vendorSlug}`} className="text-sm font-medium underline-offset-2 hover:underline">
                        {v.vendorName}
                      </Link>
                      <span className={`text-[11px] ${MUTED}`}>{v.excludedReason}</span>
                    </div>
                    <PillarContributionTable vendor={v} />
                    <DomainStrip scorecard={scorecards.get(v.vendorId)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

// Compact 12-domain evidence strip: one cell per framework domain showing the
// 0–5 score (or "—" for insufficient evidence). Deterministic, evidence-only —
// the fuller scorecard with citations lives on the vendor profile.
function DomainStrip({ scorecard }: { scorecard?: VendorScorecard }) {
  if (!scorecard || scorecard.scoredCount === 0) return null;
  const tone = (band: number) =>
    band >= 4
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : band >= 3
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  return (
    <div className="mt-2 flex flex-wrap gap-1" aria-label="Per-domain evidence scores (0–5)">
      {scorecard.domains.map((d) => (
        <span
          key={d.domain}
          title={`${DOMAIN_LABEL[d.domain]}: ${d.state === "scored" ? `${d.score.toFixed(1)}/5` : "insufficient evidence"}`}
          className={`inline-flex h-6 min-w-[2.1rem] items-center justify-center rounded px-1 font-mono text-[10px] tabular-nums ${
            d.state === "scored"
              ? tone(d.band)
              : "bg-black/5 text-[#15263c]/40 dark:bg-white/5 dark:text-[#eef3f8]/40"
          }`}
        >
          {d.state === "scored" ? d.score.toFixed(1) : "—"}
        </span>
      ))}
    </div>
  );
}
