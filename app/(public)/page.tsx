import type { Metadata } from "next";
import Link from "next/link";
import BreakingNewsHero from "@/components/home/BreakingNewsHero";
import MarketTodayBand from "@/components/home/MarketTodayBand";
import ReputationCard from "@/components/home/ReputationCard";
import SubscribeForm from "@/components/SubscribeForm";
import { EXPOSURE_NODES } from "@/lib/investing/exposure-map-data";
import { projectExposureToDependencyEdges } from "@/lib/graph/dependency-projection";
import { deriveEncroachmentEdges, buildRolesByNodeId } from "@/lib/graph/encroachment";
import { deriveGraphTakeaway } from "@/lib/graph/takeaway";
import { getBreakingNews } from "@/lib/intelligence/repository";
import { getCachedProvenance } from "@/lib/intelligence/provenance";
import { getLastRefreshedAt } from "@/lib/system/daily-refresh";
import { listPublishedArticles } from "@/lib/articles/repository";
import TabChat from "@/components/chat/TabChat";
import { absoluteUrl } from "@/lib/site";
import { resolveHomeViewMode } from "@/lib/member/view-mode";
import { getMember, getMemberOrTest } from "@/lib/member/auth";
import { ensureTestBuyerSeeded } from "@/lib/member/seed-test-buyer";
import { getMemberWatchlist } from "@/lib/member/watchlist";
import { listMemberDecisions } from "@/lib/member/decisions";
import { buildMonitor } from "@/lib/member/monitor";
import BuyerHome from "@/components/home/BuyerHome";
import { buildNewsBridges } from "@/lib/news-bridge/server";

// Public front door — the daily WATCH (IA reorg 2026-07-10, "a watch, not a
// checkout"). Rebuilt as a scannable daily briefing: what moved (news) → what to
// watch (movers + encroachment) → then LINKS out to the depth. The heavy
// exploration instruments (the full dependency graph, dependency-by-layer, the
// delivery channel) live on their own pages (/dependencies, /vendors) — the home
// no longer dumps everything; it's a glance. DB-backed → force-dynamic; all reads
// parallel + guarded; zero live LLM at request time.
export const dynamic = "force-dynamic";

const TITLE = "AI Enterprise — your daily enterprise-AI watch";
const DESCRIPTION =
  "A daily, source-cited read on what's moving in enterprise AI — who's rising, who's being encroached on, who relies on whom. Every score is confidence-labelled; every edge carries its source.";

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

// The "explore the market" links — the depth, one click from the daily glance.
const EXPLORE: { href: string; title: string; blurb: string }[] = [
  { href: "/dependencies", title: "Dependency & encroachment map", blurb: "Who relies on whom for compute, models, cloud & capital — and who's about to eat whose lunch." },
  { href: "/vendors", title: "Vendor rankings & assessment", blurb: "Source-cited, confidence-labelled standings within each category — assess a specific provider." },
  { href: "/peers", title: "Peer benchmark", blurb: "What companies like yours are adopting, by vertical, size and region." },
  { href: "/legislation", title: "Regulatory tracker", blurb: "The AI rules landing in your jurisdiction and the assessment domains they touch." },
];

export default async function HomePage() {
  // Auth-dependent home (locked IA decision): buyer "My workspace" view when a
  // real session exists or the visitor toggled into the test-buyer demo.
  const viewMode = await resolveHomeViewMode();
  if (viewMode === "buyer") {
    const [realMember, member] = await Promise.all([getMember(), getMemberOrTest()]);
    if (member) {
      if (!realMember) await ensureTestBuyerSeeded(member.subscriberId).catch(() => {});
      const watchlist = await getMemberWatchlist(member.subscriberId);
      const [decisions, monitor] = await Promise.all([
        listMemberDecisions(member.subscriberId),
        buildMonitor(watchlist),
      ]);
      return <BuyerHome watchlist={watchlist} decisions={decisions} monitor={monitor} isDemo={!realMember} />;
    }
  }

  // Pure, static, zero-cost graph derivation (no DB, no LLM) — the encroachment
  // "what to watch" signal + its plain-English takeaway.
  const edges = projectExposureToDependencyEdges();
  const encroachments = deriveEncroachmentEdges(edges, buildRolesByNodeId());
  const labelById = new Map(EXPOSURE_NODES.map((n) => [n.id, n.label]));
  const label = (id: string) => labelById.get(id) ?? id;
  const graphTakeaway = deriveGraphTakeaway(edges, label);

  // Source-backed graph confidence partition (for the coverage line in Movers).
  const high = edges.filter((e) => e.confidence >= 80).length;
  const medium = edges.filter((e) => e.confidence >= 45 && e.confidence < 80).length;
  const seed = edges.filter((e) => e.confidence < 45).length;
  const total = edges.length;

  // Honest freshness + real-gated news (never fabricate a timestamp).
  const [provenance, lastRefreshed, articles, news] = await Promise.all([
    getCachedProvenance().catch(() => null),
    getLastRefreshedAt().catch(() => null),
    listPublishedArticles().catch(() => []),
    getBreakingNews({ days: 14, limit: 20 }).catch(() => null),
  ]);
  const isLive = provenance?.source === "live";
  const newsBridges = news ? await buildNewsBridges(news.items).catch(() => undefined) : undefined;
  const updated = fmtDate(lastRefreshed) ?? fmtDate(provenance?.lastIngestedAt);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* ── Masthead: the daily watch, dated. ── */}
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
          Daily market watch · independent · source-cited
        </p>
        <h1 className="font-display mt-2 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          What&apos;s moving in enterprise AI — and who&apos;s exposed.
        </h1>
        <p className={`mt-3 max-w-2xl text-sm ${MUTED}`}>
          The source-backed changes worth knowing today — who&apos;s rising, who&apos;s being encroached
          on, who relies on whom.{" "}
          <Link
            href="/watchlist"
            className="font-medium text-sky-700 underline underline-offset-2 hover:no-underline dark:text-sky-400"
          >
            Track the vendors you run →
          </Link>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium ${
              isLive
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
            {isLive ? "Live source-backed data" : "Rankings shown only when backed by verified evidence"}
          </span>
          {updated && <span className={MUTED}>Updated {updated}</span>}
        </div>
      </header>

      {/* ── 1 · The day's read: verified breaking news (real-or-empty, never seed). ── */}
      <BreakingNewsHero news={news} bridges={newsBridges} />

      {/* ── 2 · What to watch: the scannable daily signals. ── */}
      <section className="mb-9">
        <h2 className="mb-1 font-[var(--font-display)] text-xl font-extrabold tracking-tight">What to watch</h2>
        {graphTakeaway && (
          <p className="mb-4 max-w-3xl text-sm leading-6 text-[#15263c] dark:text-[#eef3f8]">
            <span className="mr-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide align-middle">
              Derived signal
            </span>
            {graphTakeaway.chokepoints}
          </p>
        )}

        {/* Movers (gated on live evidence) + coverage. */}
        <MarketTodayBand coverage={{ edgesTotal: total, high, medium, seed }} isLive={isLive} />

        {/* Encroachment watch — who's coming for whom (a daily-relevant signal). */}
        {encroachments.length > 0 && (
          <div className={`${CARD}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Encroachment watch</h3>
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium">
                  Derived — not a stated fact
                </span>
              </div>
              <Link href="/dependencies" className={`text-xs underline-offset-2 hover:underline ${MUTED}`}>
                Full map →
              </Link>
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
              Derived only for vendors with mapped market roles — absence here is under-coverage, not an all-clear.
            </p>
          </div>
        )}
      </section>

      {/* ── Reputation tracker — the complete 3-pillar tracker, un-buried onto the
            daily watch (Developer / Employee / Customer + risk/litigation signals). ── */}
      <ReputationCard />

      {/* ── 3 · Explore the market: the depth, one click from the glance. ── */}
      <section className="mb-9">
        <h2 className="mb-3 font-[var(--font-display)] text-xl font-extrabold tracking-tight">Explore the market</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EXPLORE.map((c) => (
            <Link key={c.href} href={c.href} className={`${CARD} group block transition-colors hover:border-[#d4af37]/50`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#13294b] group-hover:underline dark:text-[#eef3f8]">{c.title}</h3>
                <span className="text-[#b08d2f] dark:text-[#d4af37]" aria-hidden>→</span>
              </div>
              <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{c.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Latest insight (honestly empty when none). ── */}
      {articles.length > 0 && (
        <section className="mb-9">
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
            <h2 className="font-[var(--font-display)] text-lg font-extrabold tracking-tight">Get the daily read by email</h2>
            <p className={`mt-1 text-sm ${MUTED}`}>
              The evidence-based moves in enterprise AI — who&apos;s rising, who&apos;s exposed, who relies on
              whom. Double opt-in, no spam.
            </p>
          </div>
          <SubscribeForm source="home" className="w-full max-w-sm" />
        </div>
      </section>

      {/* Ask AI, grounded in the verified breaking-news feed only. */}
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
