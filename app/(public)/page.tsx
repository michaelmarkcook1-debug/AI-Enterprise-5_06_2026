import type { Metadata } from "next";
import Link from "next/link";
import ExposureMapHero from "@/components/dashboard/ExposureMapHero";
import BreakingNewsHero from "@/components/home/BreakingNewsHero";
import CategoryCompositeRail from "@/components/home/CategoryCompositeRail";
import MarketByCategoryComposite from "@/components/home/MarketByCategoryComposite";
import MarketTodayBand from "@/components/home/MarketTodayBand";
import { getCategoryComposites } from "@/lib/ranking/category-composite";
import SubscribeForm from "@/components/SubscribeForm";
import { EXPOSURE_NODES } from "@/lib/investing/exposure-map-data";
import { projectExposureToDependencyEdges, summariseByKind } from "@/lib/graph/dependency-projection";
import { deriveEncroachmentEdges, buildRolesByNodeId } from "@/lib/graph/encroachment";
import { deriveGraphTakeaway } from "@/lib/graph/takeaway";
import { getBreakingNews } from "@/lib/intelligence/repository";
import { getCachedProvenance } from "@/lib/intelligence/provenance";
import { getLastRefreshedAt } from "@/lib/system/daily-refresh";
import { listPublishedArticles } from "@/lib/articles/repository";
import TabChat from "@/components/chat/TabChat";
import { absoluteUrl } from "@/lib/site";
import DataUnavailable from "@/components/DataUnavailable";
import { buildDeliveryGraph } from "@/lib/graph/delivery-projection";
import { TRACKED_VENDOR_NAMES } from "@/lib/sourcing/ai-news-manifest";
import { resolveHomeViewMode } from "@/lib/member/view-mode";
import { getMember, getMemberOrTest } from "@/lib/member/auth";
import { ensureTestBuyerSeeded } from "@/lib/member/seed-test-buyer";
import { getMemberWatchlist } from "@/lib/member/watchlist";
import { listMemberDecisions } from "@/lib/member/decisions";
import { buildMonitor } from "@/lib/member/monitor";
import BuyerHome from "@/components/home/BuyerHome";
import { buildNewsBridges } from "@/lib/news-bridge/server";
import { cookies } from "next/headers";
import { getMarketBrief } from "@/lib/brief/market-brief";
import TheBrief from "@/components/home/TheBrief";
import MarkBriefSeen from "@/components/home/MarkBriefSeen";

// Public front door. DB-backed (live rankings, breaking news, provenance) →
// force-dynamic, matching /vendors. All reads are parallel + guarded so the page
// stays fast and never 500s on a slow/absent DB. ZERO live LLM at request time;
// the dependency graph is pure/static. No client poller (lean public shell).
export const dynamic = "force-dynamic";

const TITLE = "AI Enterprise — who the enterprise-AI market runs on";
const DESCRIPTION =
  "Independent, source-cited rankings of enterprise AI vendors and the dependency/encroachment graph of who relies on whom — and who's about to eat whose lunch. Every score is confidence-labelled; every edge carries its source.";

export const metadata: Metadata = {
  title: { absolute: "AI Enterprise — Enterprise AI Market Intelligence" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/"), type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

function fmtDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = typeof d === "string" ? Date.parse(d) : d.getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export default async function HomePage() {
  // Auth-dependent home (Prompt 3, locked IA decision §0): same URL, buyer
  // view when a real session exists or the visitor has toggled into the
  // test-buyer demo. Resolved FIRST so a buyer-mode visit does none of the
  // visitor market-feed work below.
  const viewMode = await resolveHomeViewMode();
  if (viewMode === "buyer") {
    const [realMember, member] = await Promise.all([getMember(), getMemberOrTest()]);
    if (member) {
      // Sample data belongs ONLY on the shared test-buyer account — never
      // seeded into a real member's own watchlist/decisions.
      if (!realMember) await ensureTestBuyerSeeded(member.subscriberId).catch(() => {});
      const watchlist = await getMemberWatchlist(member.subscriberId);
      const [decisions, monitor, brief] = await Promise.all([
        listMemberDecisions(member.subscriberId),
        buildMonitor(watchlist),
        getMarketBrief({ since: null }).catch(() => null),
      ]);
      return <BuyerHome watchlist={watchlist} decisions={decisions} monitor={monitor} isDemo={!realMember} brief={brief} />;
    }
  }

  // Pure, static, zero-cost graph derivation (no DB, no LLM).
  const edges = projectExposureToDependencyEdges();
  const byKind = summariseByKind(edges);
  const encroachments = deriveEncroachmentEdges(edges, buildRolesByNodeId());
  const labelById = new Map(EXPOSURE_NODES.map((n) => [n.id, n.label]));
  const label = (id: string) => labelById.get(id) ?? id;
  const graphTakeaway = deriveGraphTakeaway(edges, label);

  // Confidence partition DERIVED from the data so the credibility line can never
  // drift from the edges themselves (high ≥80, medium 45–79, seed <45).
  const high = edges.filter((e) => e.confidence >= 80).length;
  const medium = edges.filter((e) => e.confidence >= 45 && e.confidence < 80).length;
  const seed = edges.filter((e) => e.confidence < 45).length;
  const total = edges.length;

  // Delivery-partnership graph — pure/static curated analyst data, always available.
  const deliveryGraph = buildDeliveryGraph();
  // Count distinct SIs per AI vendor (for "most covered" ranking).
  const sisByVendor = new Map<string, number>();
  for (const e of deliveryGraph.edges) {
    sisByVendor.set(e.vendorId, (sisByVendor.get(e.vendorId) ?? 0) + 1);
  }
  const topVendorsBySI = [...sisByVendor.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Honest freshness + provenance (guarded — never fabricate a timestamp).
  // Rankings are loaded only when the portal is backed by verified evidence;
  // otherwise we hold the section rather than render directional/seed figures.
  // Visitor's last look at The Brief (first-party cookie) → "new since" highlight.
  const briefSince = await (async (): Promise<Date | null> => {
    try {
      const v = (await cookies()).get("ae_brief_seen")?.value;
      return v ? new Date(decodeURIComponent(v)) : null;
    } catch {
      return null;
    }
  })();
  const [provenance, lastRefreshed, articles, news, brief] = await Promise.all([
    getCachedProvenance().catch(() => null),
    getLastRefreshedAt().catch(() => null),
    listPublishedArticles().catch(() => []),
    getBreakingNews({ days: 14, limit: 5 }).catch(() => null),
    getMarketBrief({ since: briefSince }).catch(() => null),
  ]);
  const isLive = provenance?.source === "live";
  // C12 — news→assessment bridge (State B): resolve which vendor(s) each breaking
  // item touches → route into their assessment. Deterministic JOIN, no score.
  const newsBridges = news ? await buildNewsBridges(news.items).catch(() => undefined) : undefined;
  // Rankings are a weighted multi-pillar composite, within category, computed only
  // when backed by verified evidence (else honest "insufficient evidence").
  const categoryComposites = isLive ? await getCategoryComposites().catch(() => []) : [];
  const updated = isLive ? (fmtDate(lastRefreshed) ?? fmtDate(provenance?.lastIngestedAt)) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {/* ── Masthead: brand line + tagline. Kept short — breaking news, not
            this, is the hero (below). ── */}
      <header className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
          Independent · evidence-based · source-cited
        </p>
        <h1 className="font-display mt-2 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Who the enterprise-AI market runs on — and who&apos;s coming for them.
        </h1>
        <p className={`mt-3 max-w-2xl text-base ${MUTED}`}>
          Source-backed vendor rankings and the dependency graph of who relies on whom for compute,
          models, cloud, and capital — every score traceable to a public source.
        </p>
        {/* Orientation pointer — the designed-it-and-still-lost fix: one obvious
            link to the plain-English "what is this / how do I assess" page. */}
        <p className="mt-2 text-sm">
          <Link
            href="/how-it-works"
            className="font-semibold text-[#a07f1f] underline-offset-4 hover:underline dark:text-[#d4af37]"
          >
            New here? How it works — the data, the scoring, and how to run an assessment →
          </Link>
        </p>
        {/* Freshness / provenance strip — honest seed-vs-live, never a fake date. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium ${
              isLive
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
            {isLive
              ? "Live source"
              : "Live rankings unavailable — shown only when backed by verified evidence"}
          </span>
          <span className={MUTED}>{isLive && updated ? `Updated ${updated}` : ""}</span>
        </div>
      </header>

      {/* ── Hero: breaking news is the first substantial thing a visitor sees —
            promoted here from the old mid-page "Market today" tile. ── */}
      <BreakingNewsHero news={news} bridges={newsBridges} />

      {/* The Brief — market-wide "since you last looked" digest of real, dated
          moves (news + new models) + the regulatory horizon. MarkBriefSeen stamps
          the visit (after paint) so the next visit can highlight what's new. */}
      {brief && <TheBrief brief={brief} />}
      <MarkBriefSeen />

      {/* Derived "so what" — from the dependency graph. UN-GATED 2026-07-02
          (Mic ruling): the graph is CURATED ANALYST REFERENCE data — every edge
          carries a source + confidence, seed-confidence edges render dashed —
          the same class as the taxonomy and the GSI delivery layer, NOT a
          fabricated score. It shows with its labels, never presented as live-DB. */}
      {graphTakeaway && (
        <div className="mb-4 max-w-3xl text-sm leading-6">
          <p className="text-[#15263c] dark:text-[#eef3f8]">
            <span className="mr-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide align-middle">
              Derived signal
            </span>
            {graphTakeaway.chokepoints}
          </p>
          {graphTakeaway.ubiquity && (
            <p className="mt-1.5 text-[#15263c]/70 dark:text-[#eef3f8]/70">{graphTakeaway.ubiquity}</p>
          )}
        </div>
      )}

      {/* Fold: graph (~70%) + rankings rail (~30%), gated INDEPENDENTLY. The
          rankings are the real evidence-derived composite → gate on isLive. The
          dependency graph is CURATED ANALYST REFERENCE data (un-gated 2026-07-02,
          Mic ruling — see note above): per-edge source + confidence labels do the
          honesty work; it is never presented as live-DB fact. */}
      <section className="mb-3 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {(
            <>
              {/* Gold "vitrine" bracket mounts the instrument without recolouring it. */}
              <div className="relative rounded-xl border border-black/10 p-1.5 dark:border-white/10">
                <span className="pointer-events-none absolute left-0 top-0 h-8 w-px bg-[#d4af37]" aria-hidden />
                <span className="pointer-events-none absolute left-0 top-0 h-px w-8 bg-[#d4af37]" aria-hidden />
                <span className="pointer-events-none absolute bottom-0 right-0 h-8 w-px bg-[#d4af37]" aria-hidden />
                <span className="pointer-events-none absolute bottom-0 right-0 h-px w-8 bg-[#d4af37]" aria-hidden />
                <ExposureMapHero />
              </div>
              {/* De-clutter (owner, 2026-07-13): caveat kept, pill retired — one quiet
                  muted line instead of another amber badge competing for attention. */}
              <p className={`mt-2 text-xs ${MUTED}`}>
                Encroachment edges are a derived signal — not a stated fact.
              </p>
            </>
          )}
        </div>
        <div className="lg:col-span-4">
          {isLive ? (
            <CategoryCompositeRail composites={categoryComposites} />
          ) : (
            <DataUnavailable
              title="Live rankings unavailable"
              detail="Rankings appear once the market data is backed by reviewed, source-backed evidence."
              reason={provenance?.reason}
            />
          )}
        </div>
      </section>

      {/* Signature: the gold "dependency spine" seam between owned-signal and evidence */}
      <div className="my-8 flex items-center gap-3" aria-hidden>
        <span className="h-px w-14 bg-[#d4af37]" />
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      {/* ── Market today (breaking news is real-gated; movers gated on live evidence) ── */}
      <MarketTodayBand coverage={{ edgesTotal: total, high, medium, seed }} isLive={isLive} />

      {/* ── The market, by category (composite rankings + the explained taxonomy) ── */}
      {isLive ? (
        <MarketByCategoryComposite composites={categoryComposites} />
      ) : (
        <section className="mb-10">
          <DataUnavailable
            title="Live rankings by category unavailable"
            detail="We rank vendors only on verified, source-backed evidence. Until ingestion lands and evidence is approved, we hold these rankings rather than show directional estimates as if measured."
            reason={provenance?.reason}
          />
        </section>
      )}

      {/* ── Most depended-upon, by layer (indexable summary of the hero).
            Graph-derived — curated analyst reference data, un-gated 2026-07-02
            (Mic ruling); the per-edge confidence partition line below does the
            honesty work. ── */}
      <section className={`${CARD} mb-10`}>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">
            Most depended-upon, by layer
          </h2>
          <Link href="/dependencies" className={`text-xs underline-offset-2 hover:underline ${MUTED}`}>
            Explore the full graph →
          </Link>
        </div>
        <p className={`mb-4 text-xs ${MUTED}`}>
          {total} source-backed relationships — {high} high-confidence, {medium} medium, {seed} seed
          (plausible, not yet verified). Concentration here is where pricing power and systemic risk live.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {byKind.map((k) => (
            <div key={k.kind} className="rounded-lg border border-black/5 p-4 dark:border-white/10">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{k.label}</h3>
                <span className={`text-xs ${MUTED}`}>{k.edgeCount} links</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {k.topProviders.map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between">
                    <span>{label(p.id)}</span>
                    <span className={`tabular-nums text-xs ${MUTED}`}>{p.dependents} rely on</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Encroachment teaser — derived, clearly badged */}
        {encroachments.length > 0 && (
          <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/10">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold">Encroachment watch</h3>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium">
                Derived — not a stated fact
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {encroachments.slice(0, 4).map((e) => (
                <li key={`${e.fromVendorId}->${e.toVendorId}`} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm">
                  <span className="font-medium">{label(e.fromVendorId)}</span>
                  <span className={MUTED}> could encroach on </span>
                  <span className="font-medium">{label(e.toVendorId)}</span>
                </li>
              ))}
            </ul>
            <p className={`mt-2 text-[10px] ${MUTED}`}>
              Derived only for vendors with mapped market roles — absence here is
              under-coverage, not an all-clear.
            </p>
          </div>
        )}
      </section>

      {/* ── IT-services delivery channel (GSI layer) — curated analyst data.
            Relocated from the hero's flag-off fallback slot when the graph was
            un-gated (2026-07-02): both now render, graph in the hero, this here. ── */}
      <section className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5 h-full flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-[var(--font-display)] text-lg font-bold tracking-tight">
                IT-services delivery channel
              </h2>
              <p className={`mt-0.5 text-xs ${MUTED}`}>
                {deliveryGraph.edges.length} relationships — which global SIs are delivering AI vendors into enterprise
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Analyst-curated
            </span>
          </div>

          {/* Most covered AI vendors by SI count */}
          <div>
            <p className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}>
              Most covered AI vendors
            </p>
            <ul className="space-y-1.5">
              {topVendorsBySI.map(([vendorId, count]) => (
                <li key={vendorId} className="flex items-center justify-between">
                  <Link
                    href={`/vendors/${vendorId}`}
                    className="text-sm font-medium hover:underline underline-offset-2"
                  >
                    {TRACKED_VENDOR_NAMES[vendorId] ?? vendorId}
                  </Link>
                  <span className={`text-xs tabular-nums ${MUTED}`}>
                    {count} SI{count !== 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className={`mt-auto text-[11px] ${MUTED}`}>
            Analyst-curated · pending external confirmation ·{" "}
            <Link href="/vendors" className="underline underline-offset-2">
              see vendor profiles
            </Link>{" "}
            for implementation partner details
          </p>
        </div>

        {/* Encroachment watch (delivery-derived) */}
        {deliveryGraph.encroachers.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Derived encroachment signal
            </p>
            {deliveryGraph.encroachers.map((enc) => (
              <p key={enc.partnerId} className="text-sm">
                <span className="font-medium">{enc.partnerName}</span>
                <span className={MUTED}> delivers rival models: {enc.vendorIds.join(", ")}</span>
              </p>
            ))}
          </div>
        )}
      </section>

      {/* ── Latest insight (honestly empty when none) ── */}
      {articles.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">Latest insight</h2>
            <Link href="/insights" className={`text-xs underline-offset-2 hover:underline ${MUTED}`}>
              All insights →
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {articles.slice(0, 3).map((a) => (
              <li key={a.slug} className={CARD}>
                <Link href={`/insights/${a.slug}`} className="text-sm font-semibold underline-offset-2 hover:underline">
                  {a.title}
                </Link>
                {a.summary && <p className={`mt-1 line-clamp-3 text-xs ${MUTED}`}>{a.summary}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Email capture ── */}
      <section className={`${CARD} mb-4`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-md">
            <h2 className="font-[var(--font-display)] text-lg font-extrabold tracking-tight">
              Get the market read
            </h2>
            <p className={`mt-1 text-sm ${MUTED}`}>
              The evidence-based moves in enterprise AI — who&apos;s rising, who&apos;s exposed, who
              relies on whom. Double opt-in, no spam.
            </p>
          </div>
          <SubscribeForm source="home" className="w-full max-w-sm" />
        </div>
      </section>

      {/* Piece 3 — Ask AI, grounded in the verified breaking-news feed only. */}
      <TabChat
        tab={{ kind: "news" }}
        label="Market today"
        chips={[
          "What's the biggest verified story this week?",
          "Which vendors are in the news right now?",
          "Is the impact score a measured fact?",
        ]}
      />
    </main>
  );
}
