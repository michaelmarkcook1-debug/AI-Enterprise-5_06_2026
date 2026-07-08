import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberOrTest } from "@/lib/member/auth";
import { getMemberDecision } from "@/lib/member/decisions";
import { getCategoryCompositeWithMeta } from "@/lib/ranking/category-composite";
import { getVendorScorecardsBatch, type VendorScorecard } from "@/lib/assessment/domain-scores";
import { ENTITIES } from "@/lib/intelligence/entities";
import { MARKET_CATEGORIES } from "@/lib/intelligence/seed";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";
import { categoryModelQualityDriver } from "@/lib/assessment/category-weights";
import type { DomainScore } from "@/lib/assessment/domain-rubric";
import {
  rankVendorsByComposite,
  normalizeWeights,
  activeDomains,
  effectiveDomains,
  type DomainWeights,
} from "@/lib/assessment/composite";
import type { DomainId } from "@/lib/types";
import DataUnavailable from "@/components/DataUnavailable";
import DecisionNameEditor from "@/components/member/DecisionNameEditor";
import DeleteDecisionButton from "@/components/member/DeleteDecisionButton";
import ExportPackLinks from "@/components/export/ExportPackLinks";
import ShareManager from "@/components/member/ShareManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Decision",
  robots: { index: false, follow: false },
};

type Params = { id: string };

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function DecisionDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const member = await getMemberOrTest();
  if (!member) return null; // the (member) layout guards this; belt-and-suspenders.

  const decision = await getMemberDecision(member.subscriberId, id);
  if (!decision) notFound();

  const categoryName = MARKET_CATEGORIES.find((c) => c.id === decision.category)?.name ?? decision.category;

  // Re-apply the SAVED weights to CURRENT live scores — never a frozen snapshot.
  // Same composite function the live category page and re-rank use, so this is
  // an exact reproduction of what the member would see re-running their weights
  // today, not a parallel calculation that could quietly disagree.
  const { composite, asOf } = await getCategoryCompositeWithMeta(decision.category);

  const asOfIso = asOf ? asOf.toISOString().slice(0, 10) : null;
  const refreshedSince = !!(decision.asOfDate && asOfIso && decision.asOfDate !== asOfIso);

  const entityById = new Map(ENTITIES.map((e) => [e.id, e]));
  const shortlistIds = decision.shortlist.map((s) => s.vendorId).filter((vid) => entityById.has(vid));

  const scorecards: Map<string, VendorScorecard> =
    composite && shortlistIds.length > 0
      ? await getVendorScorecardsBatch(shortlistIds).catch(() => new Map<string, VendorScorecard>())
      : new Map<string, VendorScorecard>();

  const effectiveDomainsFor = (sc: VendorScorecard | undefined): DomainScore[] =>
    sc && composite
      ? effectiveDomains(sc.domains, sc, composite.resolvedDomainWeights, categoryModelQualityDriver(decision.category))
      : [];

  const noteByVendor = new Map(decision.shortlist.map((s) => [s.vendorId, s.note]));
  const ranked = composite
    ? rankVendorsByComposite(
        shortlistIds.map((vid) => ({ vendorId: vid, domains: effectiveDomainsFor(scorecards.get(vid)) })),
        decision.weights,
      )
    : [];

  const droppedCount = decision.shortlist.length - shortlistIds.length;
  const weightDomains = activeDomains(decision.weights as Partial<DomainWeights>);
  const normWeights = normalizeWeights(decision.weights as Partial<DomainWeights>);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <nav className={`mb-3 text-xs ${MUTED}`}>
        <Link href="/decisions" className="underline underline-offset-2">My decisions</Link> · {categoryName}
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <DecisionNameEditor
            id={decision.id}
            name={decision.name}
            category={decision.category}
            weights={decision.weights}
            shortlist={decision.shortlist}
            asOfDate={decision.asOfDate}
          />
          <DeleteDecisionButton id={decision.id} name={decision.name} redirectTo="/decisions" />
        </div>
        <p className={`mt-2 text-sm ${MUTED}`}>
          {categoryName} · {decision.shortlist.length} vendor{decision.shortlist.length === 1 ? "" : "s"} · saved{" "}
          {fmtDate(decision.createdAt)}, updated {fmtDate(decision.updatedAt)}
        </p>
      </header>

      <div className="mb-4">
        <ShareManager decisionId={decision.id} />
      </div>

      {!composite ? (
        <DataUnavailable
          title="Live rankings unavailable for this category"
          detail="This decision is saved and safe, but we can't currently recompute it against live data — this category has no eligible ranking right now. Your saved name, weights and shortlist are unaffected."
        />
      ) : (
        <>
          {asOfIso && (
            <p className={`mb-4 text-xs ${MUTED}`}>
              {refreshedSince
                ? `Evidence has been refreshed since you saved this decision — saved against data as of ${fmtDate(decision.asOfDate!)}, now showing data as of ${fmtDate(asOfIso)}.`
                : decision.asOfDate
                  ? `Live data is unchanged since you saved this decision (as of ${fmtDate(asOfIso)}).`
                  : `Showing current data as of ${fmtDate(asOfIso)}.`}
            </p>
          )}

          <div className="mb-4">
            <ExportPackLinks href={`/api/member/decisions/${decision.id}/export`} />
          </div>

          <section className={CARD}>
            <h2 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Your saved weights</h2>
            <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {weightDomains.map((d: DomainId) => (
                <div key={d} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-[#3f5068] dark:text-[#a7bacd]" title={DOMAIN_LABEL[d]}>
                    {DOMAIN_LABEL[d]}
                  </span>
                  <span className="font-mono tabular-nums text-[#7a8aa0]">{Math.round(normWeights[d] * 100)}%</span>
                </div>
              ))}
            </div>
          </section>

          <section className={`${CARD} mt-4`}>
            <h2 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Shortlist — re-ranked on current scores</h2>
            {droppedCount > 0 && (
              <p className={`mt-1 text-[11px] ${MUTED}`}>
                {droppedCount} vendor{droppedCount === 1 ? "" : "s"} from the original shortlist could not be re-resolved and{" "}
                {droppedCount === 1 ? "is" : "are"} omitted below.
              </p>
            )}
            {ranked.length === 0 ? (
              <p className={`mt-2 text-sm ${MUTED}`}>No shortlisted vendors could be re-ranked.</p>
            ) : (
              <ol className="mt-3 divide-y divide-black/5 dark:divide-white/10">
                {ranked.map((v, i) => {
                  const entity = entityById.get(v.vendorId);
                  const note = noteByVendor.get(v.vendorId);
                  return (
                    <li key={v.vendorId} className="py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="font-mono tabular-nums text-[#b08d2f] dark:text-[#d4af37]">
                            {v.ranked ? `#${i + 1}` : "—"}
                          </span>
                          <Link href={`/vendors/${entity?.slug ?? v.vendorId}`} className="truncate font-medium underline-offset-2 hover:underline">
                            {entity?.name ?? v.vendorId}
                          </Link>
                          {!v.ranked && (
                            <span className="rounded-full border border-black/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#15263c]/70 dark:border-white/15 dark:text-[#eef3f8]/70">
                              held
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-3 text-xs">
                          <span className="font-mono tabular-nums text-[#13294b] dark:text-[#eef3f8]">
                            {v.composite.toFixed(2)}<span className="ml-0.5 text-[10px] text-[#7a8aa0]">/5</span>
                          </span>
                          <span className="font-mono tabular-nums text-[#7a8aa0]">{Math.round(v.coverage * 100)}% cov</span>
                        </span>
                      </div>
                      {note && <p className={`mt-1 pl-6 text-[11px] italic ${MUTED}`}>&ldquo;{note}&rdquo;</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  );
}
