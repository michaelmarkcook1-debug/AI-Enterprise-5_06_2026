import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSharedDecisionView } from "@/lib/member/decision-shares";
import { rateLimit } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { getCategoryCompositeWithMeta } from "@/lib/ranking/category-composite";
import { getVendorScorecardsBatch, type VendorScorecard } from "@/lib/assessment/domain-scores";
import { ENTITIES } from "@/lib/intelligence/entities";
import { MARKET_CATEGORIES } from "@/lib/intelligence/seed";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";
import {
  rankVendorsByComposite,
  normalizeWeights,
  activeDomains,
  type DomainWeights,
} from "@/lib/assessment/composite";
import type { DomainId } from "@/lib/types";
import DataUnavailable from "@/components/DataUnavailable";

// PUBLIC, unauthenticated, read-only — no session, no cookie, no member/admin
// chrome (this route lives under app/(public), which applies neither the
// (member) login-redirect nor the (internal) admin gate). The share TOKEN is
// the only credential; see lib/member/decision-shares.ts for the security
// model. Deliberately NOT sharing JSX with the owner's decision page — a
// separate, narrower implementation is the safer way to guarantee no
// rename/delete/export owner control can ever leak into this view.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared decision",
  robots: { index: false, follow: false },
};

type Params = { token: string };

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function SharedDecisionPage({ params }: { params: Promise<Params> }) {
  // Public route, no login required — rate-limited so it can't be hammered
  // into DB/compute cost, or used to mass-confirm candidate tokens leaked via
  // another channel. A limit hit renders the identical notFound() as any
  // other failure — never a distinguishing 429, preserving "no error reveals
  // existence" even under load.
  const session = anonSessionHash({ headers: await headers() } as unknown as Request);
  const rl = rateLimit(`shared-decision:${session}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) notFound();

  const { token } = await params;
  const shared = await getSharedDecisionView(token);
  if (!shared) notFound();
  const { decision, displayName } = shared;

  const categoryName = MARKET_CATEGORIES.find((c) => c.id === decision.category)?.name ?? decision.category;
  const { composite, asOf } = await getCategoryCompositeWithMeta(decision.category);
  const asOfIso = asOf ? asOf.toISOString().slice(0, 10) : null;

  const entityById = new Map(ENTITIES.map((e) => [e.id, e]));
  const shortlistIds = decision.shortlist.map((s) => s.vendorId).filter((vid) => entityById.has(vid));
  const scorecards: Map<string, VendorScorecard> =
    composite && shortlistIds.length > 0
      ? await getVendorScorecardsBatch(shortlistIds).catch(() => new Map<string, VendorScorecard>())
      : new Map<string, VendorScorecard>();

  const activatesModelQuality = composite ? (composite.resolvedDomainWeights.model_quality ?? 0) > 0 : false;
  const activatesDevSentiment = composite ? (composite.resolvedDomainWeights.dev_sentiment ?? 0) > 0 : false;
  const effectiveDomains = (sc: VendorScorecard | undefined) => {
    if (!sc) return [];
    const extra = [];
    if (activatesModelQuality && sc.modelQuality) extra.push(sc.modelQuality);
    if (activatesDevSentiment && sc.devSentiment) extra.push(sc.devSentiment);
    return extra.length > 0 ? [...sc.domains, ...extra] : sc.domains;
  };

  const noteByVendor = new Map(decision.shortlist.map((s) => [s.vendorId, s.note]));
  const ranked = composite
    ? rankVendorsByComposite(
        shortlistIds.map((vid) => ({ vendorId: vid, domains: effectiveDomains(scorecards.get(vid)) })),
        decision.weights,
      )
    : [];

  const weightDomains = activeDomains(decision.weights as Partial<DomainWeights>);
  const normWeights = normalizeWeights(decision.weights as Partial<DomainWeights>);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
        Shared decision — read only
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">{decision.name}</h1>
      <p className={`mt-2 text-sm ${MUTED}`}>
        {categoryName} · {decision.shortlist.length} vendor{decision.shortlist.length === 1 ? "" : "s"}
        {displayName ? ` · shared by ${displayName}` : ""}
      </p>
      <p className={`mt-1 text-xs ${MUTED}`}>
        You&apos;re viewing a private weighting someone shared with you — no account needed, and you can&apos;t edit it.{" "}
        <Link href="/" className="underline underline-offset-2">Explore AI Enterprise</Link> to build your own.
      </p>

      {!composite ? (
        <div className="mt-6">
          <DataUnavailable
            title="Live rankings unavailable for this category"
            detail="This shared decision is valid, but we can't currently recompute it against live data — this category has no eligible ranking right now."
          />
        </div>
      ) : (
        <>
          {asOfIso && <p className={`mt-4 mb-4 text-xs ${MUTED}`}>Showing current data as of {fmtDate(asOfIso)}.</p>}

          <section className={CARD}>
            <h2 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Weighting used</h2>
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
            <h2 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Shortlist</h2>
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
