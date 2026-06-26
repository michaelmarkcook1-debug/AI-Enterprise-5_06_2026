import type { Metadata } from "next";
import Link from "next/link";
import ExposureMapHero from "@/components/dashboard/ExposureMapHero";
import CategoryLeadersRail from "@/components/home/CategoryLeadersRail";
import MarketByCategory from "@/components/home/MarketByCategory";
import MarketTodayBand from "@/components/home/MarketTodayBand";
import { getCategoryRankings } from "@/lib/home/category-rankings";
import SubscribeForm from "@/components/SubscribeForm";
import { EXPOSURE_NODES } from "@/lib/investing/exposure-map-data";
import { projectExposureToDependencyEdges, summariseByKind } from "@/lib/graph/dependency-projection";
import { deriveEncroachmentEdges, buildRolesByNodeId } from "@/lib/graph/encroachment";
import { deriveGraphTakeaway } from "@/lib/graph/takeaway";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import { getLastRefreshedAt } from "@/lib/system/daily-refresh";
import { listPublishedArticles } from "@/lib/articles/repository";
import { absoluteUrl } from "@/lib/site";

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
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

function fmtDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = typeof d === "string" ? Date.parse(d) : d.getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export default async function HomePage() {
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

  // Honest freshness + provenance (guarded — never fabricate a timestamp).
  const [provenance, lastRefreshed, articles, categoryRankings] = await Promise.all([
    getDataProvenance().catch(() => null),
    getLastRefreshedAt().catch(() => null),
    listPublishedArticles().catch(() => []),
    getCategoryRankings(),
  ]);
  const isLive = provenance?.source === "live";
  const updated = fmtDate(lastRefreshed) ?? fmtDate(provenance?.lastIngestedAt);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {/* ── Hero: the dependency/encroachment graph IS the headline ── */}
      <header className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
          Independent · evidence-based · source-cited
        </p>
        <h1 className="font-display mt-2 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Who the enterprise-AI market runs on — and who&apos;s coming for them.
        </h1>
        <p className={`mt-3 max-w-2xl text-sm ${MUTED}`}>
          Source-backed vendor rankings and the dependency/encroachment graph of who relies on whom for
          compute, models, cloud, and capital. Every score is confidence-labelled; every edge carries
          its own public source.
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
            {isLive ? "Live source" : "Not live — figures illustrative until ingestion lands"}
          </span>
          <span className={MUTED}>{updated ? `Updated ${updated}` : "Not yet refreshed"}</span>
        </div>
      </header>

      {/* Derived "so what" — recomputed from the live edge data, labelled derived. */}
      {graphTakeaway && (
        <p className="mb-4 max-w-3xl text-sm leading-6 text-[#15263c] dark:text-[#eef3f8]">
          <span className="mr-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide align-middle">
            Derived signal
          </span>
          {graphTakeaway}
        </p>
      )}

      {/* Fold: graph (~70%) + live rankings rail (~30%) */}
      <section className="mb-3 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {/* Gold "vitrine" bracket mounts the instrument without recolouring it. */}
          <div className="relative rounded-xl border border-black/10 p-1.5 dark:border-white/10">
            {/* Gold vitrine — L-brackets at opposite corners frame the instrument. */}
            <span className="pointer-events-none absolute left-0 top-0 h-8 w-px bg-[#d4af37]" aria-hidden />
            <span className="pointer-events-none absolute left-0 top-0 h-px w-8 bg-[#d4af37]" aria-hidden />
            <span className="pointer-events-none absolute bottom-0 right-0 h-8 w-px bg-[#d4af37]" aria-hidden />
            <span className="pointer-events-none absolute bottom-0 right-0 h-px w-8 bg-[#d4af37]" aria-hidden />
            <ExposureMapHero />
          </div>
          <p className="mt-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium">
            Encroachment edges are a derived analytical signal — not a stated fact
          </p>
        </div>
        <div className="lg:col-span-4">
          <CategoryLeadersRail rankings={categoryRankings} />
        </div>
      </section>

      {/* Signature: the gold "dependency spine" seam between owned-signal and evidence */}
      <div className="my-8 flex items-center gap-3" aria-hidden>
        <span className="h-px w-14 bg-[#d4af37]" />
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      {/* ── Market today ── */}
      <MarketTodayBand coverage={{ edgesTotal: total, high, medium, seed }} />

      {/* ── The market, by category (segmented rankings + the explained taxonomy) ── */}
      <MarketByCategory rankings={categoryRankings} />

      {/* ── Most depended-upon, by layer (indexable summary of the hero) ── */}
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
    </main>
  );
}
