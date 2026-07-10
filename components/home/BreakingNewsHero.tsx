import type { BreakingNews } from "@/lib/intelligence/repository";
import type { NewsBridge } from "@/lib/news-bridge/bridge";
import NewsBridgePanel from "@/components/news/NewsBridgePanel";

// Front-page hero. Breaking news is the first substantial thing a visitor
// sees — promoted here from its old mid-page "Market today" tile. Same
// real-gated data (getBreakingNews already hard-filters to sourceKind==="real"
// + an https source + recency-weighted importance — see repository.ts), just
// given the visual weight a hero deserves: a lead story, then the rest.

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

function ageLabel(days: number | null): string {
  if (days === null) return "no dated items";
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function itemMeta(n: BreakingNews["items"][number]): string {
  const parts = [n.primaryVendorName, n.sourceName].filter(Boolean) as string[];
  return parts.join(" · ");
}

// How many stories show above the fold before the "show more" expander.
const VISIBLE_LIST = 4; // + the lead story = 5 shown by default

function NewsListItem({ n, bridge }: { n: BreakingNews["items"][number]; bridge?: NewsBridge }) {
  return (
    <li className="text-sm">
      <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:underline">
        {n.title}
      </a>
      <span className={`mt-0.5 block text-[11px] ${MUTED}`}>{itemMeta(n)}</span>
      {bridge && <NewsBridgePanel bridge={bridge} compact />}
    </li>
  );
}

const NEWS_UL = "grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2";

export default function BreakingNewsHero({
  news,
  bridges,
}: {
  news: BreakingNews | null;
  /** C12 — per-item news→assessment bridge (State B), keyed by news-item id. */
  bridges?: Map<string, NewsBridge>;
}) {
  const items = news?.items ?? [];

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-rose-700 dark:text-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
          Breaking
        </span>
        <span className={`text-[11px] ${MUTED}`}>
          {news ? `Latest verified item ${ageLabel(news.latestAgeDays)}` : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-white/60 p-5 text-sm dark:border-white/10 dark:bg-white/5">
          <p className={MUTED}>
            No verified items in the last two weeks. We show source-backed news only — never seed
            headlines.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
          {news?.usedFallback && (
            <p className={`mb-3 text-[11px] ${MUTED}`}>
              Nothing inside the two-week window — showing the most recent verified items.
            </p>
          )}

          {/* Lead story — the top recency-weighted item, given full hero weight. */}
          <a
            href={items[0].sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <h2 className="font-[var(--font-display)] text-2xl font-bold leading-tight tracking-tight group-hover:underline sm:text-3xl">
              {items[0].title}
            </h2>
            {items[0].whyItMatters && (
              <p className={`mt-2 max-w-3xl text-sm leading-6 ${MUTED}`}>{items[0].whyItMatters}</p>
            )}
            <p className={`mt-2 text-xs ${MUTED}`}>
              {itemMeta(items[0])}
              {itemMeta(items[0]) ? " · " : ""}
              {ageLabel(Math.floor((Date.now() - Date.parse(items[0].publishedAt)) / 86_400_000))}
            </p>
          </a>
          {/* C12 bridge — outside the story anchor (no nested links). */}
          {bridges?.get(items[0].id) && <NewsBridgePanel bridge={bridges.get(items[0].id)!} />}

          {/* Rest of the field — compact, secondary to the lead story. The first
              few show inline (5 total incl. the lead); the rest are behind a native
              <details> "show more" so the daily glance stays tight but the full,
              deeper feed is one click away. No client JS — keeps this server-rendered. */}
          {items.length > 1 && (
            <>
              <ul className={`mt-5 border-t border-black/5 pt-4 dark:border-white/10 ${NEWS_UL}`}>
                {items.slice(1, 1 + VISIBLE_LIST).map((n) => (
                  <NewsListItem key={n.id} n={n} bridge={bridges?.get(n.id)} />
                ))}
              </ul>
              {items.length > 1 + VISIBLE_LIST && (
                <details className="mt-3">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">
                    Show {items.length - 1 - VISIBLE_LIST} more verified{" "}
                    {items.length - 1 - VISIBLE_LIST === 1 ? "story" : "stories"}
                    <span aria-hidden>▾</span>
                  </summary>
                  <ul className={`mt-3 ${NEWS_UL}`}>
                    {items.slice(1 + VISIBLE_LIST).map((n) => (
                      <NewsListItem key={n.id} n={n} bridge={bridges?.get(n.id)} />
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
