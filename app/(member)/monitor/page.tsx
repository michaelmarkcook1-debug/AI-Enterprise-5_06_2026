import type { Metadata } from "next";
import Link from "next/link";
import { getMemberOrTest } from "@/lib/member/auth";
import { getMemberWatchlist } from "@/lib/member/watchlist";
import { buildMonitor } from "@/lib/member/monitor";
import { ENTITIES } from "@/lib/intelligence/entities";
import { MARKET_CATEGORIES } from "@/lib/intelligence/seed";
import MonitorControls, { type MonitorItem } from "@/components/member/MonitorControls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Monitor", robots: { index: false, follow: false } };

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

const TIER_CLS: Record<string, string> = {
  high: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  seed: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
};
const TIER_LABEL: Record<string, string> = { high: "high confidence", medium: "medium", seed: "seed" };

export default async function MonitorPage() {
  const member = await getMemberOrTest();
  if (!member) return null; // the (member) layout guards this; belt-and-suspenders.

  const watchlist = await getMemberWatchlist(member.subscriberId);
  const monitor = await buildMonitor(watchlist);

  // Options for the add control (static taxonomies, deduped vendors).
  const vendorOpts = [...new Map(ENTITIES.map((e) => [e.slug, e.name])).entries()]
    .map(([slug, name]): MonitorItem => ({ item: `vendor:${slug}`, label: name, type: "vendor" }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const categoryOpts = MARKET_CATEGORIES.map((c): MonitorItem => ({ item: `category:${c.id}`, label: c.name, type: "category" }));
  const options = [...vendorOpts, ...categoryOpts];
  const saved: MonitorItem[] = [
    ...monitor.savedVendors.map((v): MonitorItem => ({ item: `vendor:${v.slug}`, label: v.name, type: "vendor" })),
    ...monitor.savedCategories.map((c): MonitorItem => ({ item: `category:${c.id}`, label: c.name, type: "category" })),
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
          Your Monitor
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Your shortlist, watched</h1>
        <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>
          What changed for the vendors and categories you track — composed from the same cached market
          data as the public surface, confidence-labelled. Private to you; no figure here is generated
          per-request.
        </p>
      </header>

      <div className="mb-6">
        <MonitorControls saved={saved} options={options} />
      </div>

      {!monitor.hasItems ? (
        <div className={CARD}>
          <p className="text-sm">
            Your Monitor is empty. Add a few vendors and categories above and we&apos;ll surface their
            ranking moves, dependency &amp; encroachment alerts, and news here — all from cached data.
          </p>
        </div>
      ) : !monitor.hasSignal ? (
        <div className={CARD}>
          {monitor.isLive ? (
            <>
              <p className="text-sm font-medium">No material change for your shortlist this week.</p>
              <p className={`mt-1 text-xs ${MUTED}`}>
                We only report movement that&apos;s in the data — no change is an honest answer, not an empty one.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Market signals appear once backed by verified evidence.</p>
              <p className={`mt-1 text-xs ${MUTED}`}>
                Ranking moves and dependency/encroachment alerts are held until our live data store carries
                reviewed, source-backed evidence — we don&apos;t surface seed or estimated figures as if measured.
                Source-backed news on your shortlist still appears here when there is any.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Ranking moves */}
          {monitor.rankingMoves.length > 0 && (
            <section className={CARD}>
              <h2 className="text-sm font-semibold">Ranking moves</h2>
              <p className="mt-1 mb-3 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium">
                Directional estimates, not measured market data
              </p>
              <ul className="space-y-2">
                {monitor.rankingMoves.map((m) => {
                  const up = m.changePct >= 0;
                  return (
                    <li key={`${m.vendorSlug}-${m.categoryId}`} className="flex items-baseline justify-between gap-3 border-t border-black/5 pt-2 text-sm dark:border-white/10 first:border-0 first:pt-0">
                      <span className="min-w-0">
                        <Link href={`/vendors/${m.vendorSlug}`} className="font-medium underline-offset-2 hover:underline">{m.vendorName}</Link>
                        <span className={MUTED}> in </span>
                        <Link href={`/category/${m.categoryId}`} className="underline-offset-2 hover:underline">{m.categoryName}</Link>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`font-mono tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {up ? "▲" : "▼"} {Math.abs(m.changePct).toFixed(1)}%
                        </span>
                        <span className={`ml-2 text-[10px] ${MUTED}`}>{Math.round(m.confidence)}% conf</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Dependency / encroachment alerts */}
          {monitor.graphAlerts.length > 0 && (
            <section className={CARD}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">Dependency &amp; encroachment alerts</h2>
                <Link href="/dependencies" className={`text-xs underline-offset-2 hover:underline ${MUTED}`}>The graph →</Link>
              </div>
              <ul className="space-y-2">
                {monitor.graphAlerts.map((a, i) => (
                  <li key={i} className="border-t border-black/5 pt-2 text-sm dark:border-white/10 first:border-0 first:pt-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TIER_CLS[a.tier]}`}>{TIER_LABEL[a.tier]}</span>
                      {a.kind === "encroachment" && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium">derived — not a stated fact</span>
                      )}
                    </div>
                    <p>{a.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* News */}
          {monitor.news.length > 0 && (
            <section className={CARD}>
              <h2 className="mb-3 text-sm font-semibold">News on your shortlist</h2>
              <ul className="space-y-3">
                {monitor.news.map((n, i) => (
                  <li key={i} className="text-sm">
                    {n.sourceUrl ? (
                      <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:underline">{n.title}</a>
                    ) : (
                      <span className="font-medium">{n.title}</span>
                    )}
                    <span className={`mt-0.5 block text-[11px] ${MUTED}`}>
                      {n.vendorName ? `${n.vendorName} · ` : ""}{n.sourceName}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
