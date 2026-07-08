import Link from "next/link";
import type { MemberWatchlistView } from "@/lib/member/watchlist";
import type { MemberDecisionView } from "@/lib/member/decisions";
import type { MonitorView } from "@/lib/member/monitor";

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

// The personalised dashboard half of the auth-dependent home (Prompt 3). Pure
// composition over three ALREADY-LIVE reads (watchlist, decisions, monitor) —
// no new data path, no score computation of its own. `isDemo` renders the
// explicit "demo" labelling the toggle guardrail requires whenever this is
// the shared test-buyer rather than a real signed-in member.
export default function BuyerHome({
  watchlist,
  decisions,
  monitor,
  isDemo,
}: {
  watchlist: MemberWatchlistView;
  decisions: MemberDecisionView[];
  monitor: MonitorView;
  isDemo: boolean;
}) {
  const hasShortlist = watchlist.vendors.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-extrabold tracking-tight text-[#13294b] dark:text-[#eef3f8]">
            Your workspace
          </h1>
          <p className={`mt-1 text-sm ${MUTED}`}>Your shortlist, your saved decisions, what changed this week.</p>
        </div>
        {isDemo && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400 bg-rose-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-900 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            Demo — shared test account
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <section className={CARD}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Your shortlist</h2>
            <Link href="/watchlist" className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">
              Edit →
            </Link>
          </div>
          {hasShortlist ? (
            <ul className="space-y-2">
              {monitor.savedVendors.map((v) => (
                <li key={v.slug} className="flex items-center justify-between text-sm">
                  <Link href={`/vendors/${v.slug}`} className="font-medium text-[#13294b] hover:underline dark:text-[#eef3f8]">
                    {v.name}
                  </Link>
                  <span className={`text-xs ${MUTED}`}>tracked</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`text-sm ${MUTED}`}>No vendors tracked yet — add one from any vendor page.</p>
          )}
        </section>

        <section className={CARD}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Your saved decisions</h2>
            <Link href="/decisions" className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">
              View all →
            </Link>
          </div>
          {decisions.length > 0 ? (
            <ul className="space-y-2">
              {decisions.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <Link href={`/decisions/${d.id}`} className="font-medium text-[#13294b] hover:underline dark:text-[#eef3f8]">
                    {d.name}
                  </Link>
                  <span className={`text-xs ${MUTED}`}>{d.shortlist.length} vendor{d.shortlist.length === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`text-sm ${MUTED}`}>No saved decisions yet — save a weighting from any category page.</p>
          )}
        </section>

        <section className={`${CARD} md:col-span-2`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">What changed for you this week</h2>
            <Link href="/monitor" className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">
              Full monitor →
            </Link>
          </div>
          {!monitor.hasItems ? (
            <p className={`text-sm ${MUTED}`}>Track a vendor or category to start seeing what moves.</p>
          ) : !monitor.hasSignal ? (
            <p className={`text-sm ${MUTED}`}>Nothing material moved for your tracked items this week.</p>
          ) : (
            <ul className="space-y-2">
              {monitor.rankingMoves.slice(0, 4).map((m, i) => (
                <li key={`rank-${i}`} className="text-sm">
                  <span className="font-medium text-[#13294b] dark:text-[#eef3f8]">{m.vendorName}</span>{" "}
                  <span className={MUTED}>
                    in {m.categoryName}: {m.changePct > 0 ? "+" : ""}
                    {m.changePct.toFixed(1)}% share estimate
                  </span>
                </li>
              ))}
              {monitor.news.slice(0, 4).map((n, i) => (
                <li key={`news-${i}`} className="text-sm">
                  <span className="font-medium text-[#13294b] dark:text-[#eef3f8]">{n.vendorName ?? "Market"}:</span>{" "}
                  <span className={MUTED}>{n.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className={`mt-6 text-xs ${MUTED}`}>
        <Link href="/use-cases" className="underline underline-offset-2 hover:no-underline">
          Start here
        </Link>{" "}
        to find your next opportunity, or{" "}
        <Link href="/vendors" className="underline underline-offset-2 hover:no-underline">
          assess a vendor
        </Link>
        .
      </p>
    </main>
  );
}
