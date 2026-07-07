import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/lib/site";
import { listMarketCategories } from "@/lib/intelligence/repository";
import { getCategoryCompositeWithMeta } from "@/lib/ranking/category-composite";
import DataUnavailable from "@/components/DataUnavailable";
import PillarContributionTable from "@/components/ranking/PillarContributionTable";
import TrackButton from "@/components/member/TrackButton";
import { getVendorScorecardsBatch, type VendorScorecard } from "@/lib/assessment/domain-scores";
import type { DomainScore } from "@/lib/assessment/domain-rubric";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";
import { activeDomains, effectiveDomains, type DomainWeights } from "@/lib/assessment/composite";
import type { DomainId } from "@/lib/types";
import { INTERACTIVE_ASSESSMENT_ENABLED, INTERROGATE_ENABLED } from "@/lib/availability";
import { getMemberOrTest } from "@/lib/member/auth";
import CategoryRerank, { type RerankVendor } from "@/components/assessment/CategoryRerank";
import { getRankMovements, type RankMovement } from "@/lib/intelligence/rank-movement";
import RankMovementIndicator from "@/components/ranking/RankMovementIndicator";
import TabChat from "@/components/chat/TabChat";
import CompetitiveIntelHeatmap from "@/components/assessment/CompetitiveIntelHeatmap";
import ExportPackLinks from "@/components/export/ExportPackLinks";

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
  const { composite, asOf } = await getCategoryCompositeWithMeta(slug);
  if (!composite) notFound();
  const { category, ranked, incomplete, isLive, methodologyNote, lowDiscrimination, resolvedDomainWeights } =
    composite;
  // The category's ACTIVE domain set (canonical order) — the 12 framework domains
  // plus model_quality where the category activates it. Drives the domain strip
  // and the re-rank so both match the static ranking's coverage denominator.
  const activeOrder: DomainId[] = activeDomains(resolvedDomainWeights);
  // A vendor's domain set for THIS category: framework domains + the synthesized
  // model_quality / dev_sentiment scores when active (else absent → insufficient).
  // Must match category-composite's effFor so the static order and the re-rank agree.
  const effectiveDomainsFor = (sc: VendorScorecard | undefined): DomainScore[] =>
    sc ? effectiveDomains(sc.domains, sc, resolvedDomainWeights) : [];

  // Phase 3 — per-vendor 12-domain evidence scorecards (deterministic, no LLM,
  // batched into one query). Used for the compact domain strip under each vendor.
  const scorecards: Map<string, VendorScorecard> = isLive
    ? await getVendorScorecardsBatch([...ranked, ...incomplete].map((v) => v.vendorId)).catch(
        () => new Map<string, VendorScorecard>(),
      )
    : new Map<string, VendorScorecard>();

  // Rankings movement — real per-vendor overall-rank delta from snapshot history.
  const movements: Map<string, RankMovement> = isLive
    ? await getRankMovements().catch(() => new Map<string, RankMovement>())
    : new Map<string, RankMovement>();

  // Interactive re-rank uses the SAME 12-domain composite as the static ranking
  // (default weights → identical order). Feed it every member with a scorecard.
  const rerankVendors: RerankVendor[] = INTERACTIVE_ASSESSMENT_ENABLED
    ? [...ranked, ...incomplete].flatMap((v) => {
        const sc = scorecards.get(v.vendorId);
        return sc
          ? [{ vendorId: v.vendorId, vendorName: v.vendorName, vendorSlug: v.vendorSlug, domains: effectiveDomainsFor(sc) }]
          : [];
      })
    : [];

  // Wave-3 Interrogate — member-gated premium action; resolve identity only when
  // the flag is on so anonymous visitors keep the free Wave-2 re-rank.
  const interrogateMember = INTERROGATE_ENABLED ? await getMemberOrTest().catch(() => null) : null;

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
        {/* C15 — honest as-of: the sector ranking is materialised once per nightly
            batch and served cached; never presented as "live" when it isn't. */}
        {isLive && (
          <p className={`mt-2 text-[11px] ${MUTED}`}>
            {asOf
              ? `Sector rankings as of ${asOf.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — refreshed nightly, computed once per sector`
              : "Sector rankings computed live"}
          </p>
        )}
        {isLive && (
          <div className="mt-3">
            <ExportPackLinks href={`/api/export/procurement-pack?category=${slug}`} />
          </div>
        )}
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
              <strong>Early / thin evidence — limited discrimination.</strong> These vendors&apos; weighted assessment
              composites sit within the noise band, so treat the order as <strong>tiers</strong> (shown per vendor), not a
              precise 1-N ranking. More reviewed evidence will separate them.
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
                      <RankMovementIndicator movement={movements.get(v.vendorId)} />
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
                      <span className="font-mono text-sm tabular-nums" title={`${v.domainTotal}-domain weighted assessment composite (0–5), coverage-discounted`}>
                        {(v.assessmentComposite ?? 0).toFixed(2)}
                        <span className={`ml-1 text-[10px] ${MUTED}`}>/5 composite</span>
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
                      Market Share Est.: ~{Math.round(v.marketContext.estimatedShare)}% category share ·{" "}
                      {v.rankPillars.find((p) => p.pillar === "market_strength")?.state === "scored"
                        ? "one input to the cited Market Position domain below"
                        : "context only, not the rank"}{" "}
                      · <Link href="/insights#market-share-est" className="underline underline-offset-2">how this is estimated</Link>
                    </p>
                  )}
                  <PillarContributionTable vendor={v} />
                  <DomainStrip domains={effectiveDomainsFor(scorecards.get(v.vendorId))} order={activeOrder} />
                </li>
              ))}
            </ol>
          )}

          {incomplete.length > 0 && (
            <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/10">
              <h2 className="text-sm font-semibold">Held — insufficient evidence to rank ({incomplete.length})</h2>
              <p className={`mt-1 text-xs ${MUTED}`}>
                These vendors compete in the category but lack enough reviewed evidence across the {activeOrder.length} assessment
                domains to be ranked. We hold them rather than float them on partial data.
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
                    <DomainStrip domains={effectiveDomainsFor(scorecards.get(v.vendorId))} order={activeOrder} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Interactive re-rank — weight the 12 domains to your priorities. Uses
              the SAME composite as the static list above, so at default weights it
              reproduces this exact order (no surprise reshuffle); adjust to see
              YOUR ranking. Pure client-side maths, no network call. */}
          {INTERACTIVE_ASSESSMENT_ENABLED && rerankVendors.length > 1 && (
            <div className="mt-6 border-t border-black/5 pt-5 dark:border-white/10">
              <CategoryRerank
                vendors={rerankVendors}
                defaultWeights={resolvedDomainWeights}
                interrogate={{
                  enabled: INTERROGATE_ENABLED,
                  signedIn: !!interrogateMember,
                  scope: { kind: "category", categoryId: slug },
                }}
                asOfDate={asOf ? asOf.toISOString().slice(0, 10) : null}
              />
            </div>
          )}
        </section>
      )}

      {/* Vendor-tabs · Competitive Intel — a cross-vendor capability heatmap,
          a VIEW of the live composites (rows = domains, cols = vendors). Reuses
          the scorecards already fetched above; insufficient stays insufficient. */}
      {isLive && (
        <CompetitiveIntelHeatmap
          domainOrder={activeOrder}
          vendors={ranked
            .map((v) => {
              const sc = scorecards.get(v.vendorId);
              return sc
                ? { vendorId: v.vendorId, vendorName: v.vendorName, vendorSlug: v.vendorSlug, domains: effectiveDomainsFor(sc) }
                : null;
            })
            .filter((v): v is NonNullable<typeof v> => v !== null)}
        />
      )}

      {/* Piece 3 — Ask AI, grounded in THIS category's live composite only. */}
      {isLive && (
        <TabChat
          tab={{ kind: "category", id: slug }}
          label={category.name}
          chips={[
            "Why is the top vendor ranked first?",
            "Which vendors are held for insufficient evidence?",
            "How is this ranking computed?",
          ]}
        />
      )}
    </main>
  );
}

// Compact per-domain evidence strip: one cell per ACTIVE category domain showing
// the 0–5 score (or "—" for insufficient evidence). `order` is the category's
// active domain set (12, or 13 incl model_quality), so every vendor in a category
// shows the same cells in the same order — a vendor missing an active domain reads
// "—" rather than dropping the cell. Deterministic, evidence-only; the fuller
// scorecard with citations lives on the vendor profile.
function DomainStrip({ domains, order }: { domains: DomainScore[]; order: DomainId[] }) {
  const byDomain = new Map<DomainId, DomainScore>(domains.map((d) => [d.domain, d]));
  const anyScored = order.some((id) => byDomain.get(id)?.state === "scored");
  if (!anyScored) return null;
  const tone = (band: number) =>
    band >= 4
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : band >= 3
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  return (
    <div className="mt-2 flex flex-wrap gap-1" aria-label="Per-domain evidence scores (0–5)">
      {order.map((id) => {
        const d = byDomain.get(id);
        const scored = d?.state === "scored";
        return (
          <span
            key={id}
            title={`${DOMAIN_LABEL[id]}: ${scored ? `${d!.score.toFixed(1)}/5` : "insufficient evidence"}`}
            className={`inline-flex h-6 min-w-[2.1rem] items-center justify-center rounded px-1 font-mono text-[10px] tabular-nums ${
              scored
                ? tone(d!.band)
                : "bg-black/5 text-[#15263c]/40 dark:bg-white/5 dark:text-[#eef3f8]/40"
            }`}
          >
            {scored ? d!.score.toFixed(1) : "—"}
          </span>
        );
      })}
    </div>
  );
}
