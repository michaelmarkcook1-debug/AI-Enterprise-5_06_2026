import type { BreakingNews } from "@/lib/intelligence/repository";
import type { NewsBridge } from "@/lib/news-bridge/bridge";
import type { NewsExposure } from "@/lib/news/exposure";
import NewsBridgePanel from "@/components/news/NewsBridgePanel";

// Front-page hero. Breaking news is the first substantial thing a visitor
// sees — promoted here from its old mid-page "Market today" tile. Same
// real-gated data (getBreakingNews already hard-filters to sourceKind==="real"
// + an https source + recency-weighted importance — see repository.ts), just
// given the visual weight a hero deserves: a lead story, then the rest.

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

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

/** Other outlets that covered the same event. Story clustering collapses those
 *  rows into one headline; the citations are surfaced here so nothing a reader
 *  could previously click disappears. */
function AlsoReportedBy({ sources }: { sources: { name: string; url?: string }[] }) {
  if (sources.length === 0) return null;
  return (
    <span className={`text-xs ${MUTED}`}>
      {" · also reported by "}
      {sources.map((s, i) => (
        <span key={`${s.name}-${i}`}>
          {i > 0 && ", "}
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {s.name}
            </a>
          ) : (
            s.name
          )}
        </span>
      ))}
    </span>
  );
}

/** "Does this land on me?" — shown ONLY when the viewer supplied a watchlist or
 *  stack. No stored context means no badge; we never infer an ecosystem. */
function ExposureBadge({ exposure, demo }: { exposure: NewsExposure | undefined; demo?: boolean }) {
  if (!exposure) return null;
  const direct = exposure.tier === "direct";
  // The label must name WHOSE context this is. When it comes from the shared
  // demo watchlist (no real session), "your" would be a false first-person claim.
  const label = demo
    ? direct
      ? "On the demo shortlist"
      : "Demo: touches a dependency"
    : exposure.label;
  return (
    <span
      title={
        (demo ? "Matched against the shared demo watchlist, not your own account. " : "") +
        (direct
          ? exposure.detail
          : `${exposure.detail} — derived from a cited dependency edge (confidence ${exposure.confidence ?? "n/a"}), not a stated claim.`)
      }
      className={`ml-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-semibold ${
        direct
          ? "border-[#b08d2f]/50 bg-[#b08d2f]/15 text-[#8a6d1f] dark:text-[#e8c95c]"
          : "border-[#123d2c]/25 bg-[#123d2c]/[0.06] text-[#123d2c]/75 dark:border-white/20 dark:bg-white/[0.06] dark:text-[#c8d7e9]"
      }`}
    >
      {label}
      {!direct && <span className="font-normal opacity-70">· derived</span>}
    </span>
  );
}

export default function BreakingNewsHero({
  news,
  bridges,
  exposures,
  exposuresAreDemo,
  triage,
}: {
  news: BreakingNews | null;
  /** C12 — per-item news→assessment bridge (State B), keyed by news-item id. */
  bridges?: Map<string, NewsBridge>;
  /** Per-item "affects your ecosystem" verdict, keyed by news-item id. Absent
   *  for visitors with no saved context — which renders no badge at all. */
  exposures?: Map<string, NewsExposure>;
  /** True when exposures came from the SHARED demo watchlist rather than the
   *  viewer's own session — changes the wording so "your" is never claimed. */
  exposuresAreDemo?: boolean;
  /** Queue-depth suffix for the pending badge (e.g. "· 12 in queue, oldest 6d"),
   *  so "pending re-assessment" ages visibly instead of reading as permanent. */
  triage?: string;
}) {
  const items = news?.items ?? [];

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.14em] text-rose-700 dark:text-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
          Breaking
        </span>
        <span className={`text-xs ${MUTED}`}>
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
            <p className={`mb-3 text-xs ${MUTED}`}>
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
          </a>
          {/* Meta sits outside the story anchor so the other outlets' links are
              real links, not nested inside one. */}
          <p className={`mt-2 text-xs ${MUTED}`}>
            {itemMeta(items[0])}
            {itemMeta(items[0]) ? " · " : ""}
            {ageLabel(Math.floor((Date.now() - Date.parse(items[0].publishedAt)) / 86_400_000))}
            <AlsoReportedBy sources={items[0].alsoReportedBy} />
            <ExposureBadge exposure={exposures?.get(items[0].id)} demo={exposuresAreDemo} />
          </p>
          {/* C12 bridge — outside the story anchor (no nested links). */}
          {bridges?.get(items[0].id) && <NewsBridgePanel bridge={bridges.get(items[0].id)!} triage={triage} />}

          {/* Rest of the field — compact, secondary to the lead story. */}
          {items.length > 1 && (
            <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-black/5 pt-4 dark:border-white/10 sm:grid-cols-2">
              {items.slice(1).map((n) => (
                <li key={n.id} className="text-sm">
                  <a
                    href={n.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {n.title}
                  </a>
                  <span className={`mt-0.5 block text-xs ${MUTED}`}>
                    {itemMeta(n)}
                    <AlsoReportedBy sources={n.alsoReportedBy} />
                    <ExposureBadge exposure={exposures?.get(n.id)} demo={exposuresAreDemo} />
                  </span>
                  {bridges?.get(n.id) && <NewsBridgePanel bridge={bridges.get(n.id)!} compact triage={triage} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
