// Breaking-news card for the Query market overview.
// ──────────────────────────────────────────────────
// Shows the last 14 days of genuinely impactful AI-market news, deduped and
// capped at the top 10 (lib/intelligence/repository.getBreakingNews), grouped
// into importance tiers and spread across vendors so the feed isn't dominated
// by one name. When the daily ingest is behind, it says so rather than showing
// nothing.

import type { BreakingNews, BreakingNewsItem, ImportanceLevel } from "@/lib/intelligence/repository";
import { impactClasses } from "@/lib/ui/semantic-colors";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// Importance tiers, in display order. Colours are deliberately tier-coded so the
// eye can triage critical → notable without reading every score.
const TIERS: Array<{ level: ImportanceLevel; label: string; dot: string; text: string }> = [
  { level: "critical", label: "Critical", dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400" },
  { level: "high", label: "High impact", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  { level: "notable", label: "Notable", dot: "bg-sky-500", text: "text-sky-700 dark:text-sky-400" },
];

function NewsRow({ item }: { item: BreakingNewsItem }) {
  return (
    <li className="py-2.5 first:pt-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold leading-5 text-[#13294b] dark:text-[#eef3f8]">{item.title}</p>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${impactClasses(item.impactScore)}`} title="Market-impact score">
          {item.impactScore}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#54647a] dark:text-[#a7bacd]">
        <span className="font-semibold text-[#3f5068] dark:text-[#c2d1e0]">Why it matters: </span>{item.whyItMatters}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {item.primaryVendorName && (
          <span className="rounded bg-[#e7eef6] px-1.5 py-0.5 text-[9px] font-semibold text-[#33506f] dark:bg-[#16314c] dark:text-[#9fc2e0]">
            {item.primaryVendorName}
          </span>
        )}
        {item.categories.slice(0, 1).map((c) => (
          <span key={c} className="rounded bg-[#f3ead2] px-1.5 py-0.5 text-[9px] font-medium text-[#5a4f33] dark:bg-[#1a2c3f] dark:text-[#a7bacd]">{c}</span>
        ))}
        <span className="ml-auto text-[10px] tabular-nums text-[#8a98a8]">{fmtDate(item.publishedAt)}</span>
      </div>
    </li>
  );
}

export default function BreakingNewsCard({ news }: { news: BreakingNews }) {
  const { items, windowDays, latestPublishedAt, latestAgeDays, usedFallback, vendorsCovered } = news;
  // News is meant to ingest daily, so flag "behind" once the newest tracked
  // story is more than 2 days old (not just older than the whole window).
  const stale = latestAgeDays != null && latestAgeDays > 2;

  // Group the top items into importance tiers; sort newest-first within a tier.
  const groups = TIERS.map((tier) => ({
    ...tier,
    rows: items
      .filter((i) => i.importance === tier.level)
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)),
  })).filter((g) => g.rows.length > 0);

  return (
    <section className="flex flex-col rounded-xl border border-[#e3d9c0] bg-white p-4 dark:border-[#1d3a57] dark:bg-[#0c2238]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full ${stale ? "bg-amber-400" : "bg-rose-500"} opacity-75 ${stale ? "" : "animate-ping"}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${stale ? "bg-amber-500" : "bg-rose-600"}`} />
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#15263c] dark:text-[#eef3f8]">Breaking news</h3>
        </div>
        <span className="text-[10px] font-medium text-[#6b7d93] dark:text-[#7a9bb8]">
          Last {windowDays} days · top {items.length}{vendorsCovered > 0 ? ` · ${vendorsCovered} vendors` : ""}
        </span>
      </div>

      {/* Freshness / staleness line — honest about the daily ingest cadence. */}
      {latestPublishedAt && (
        <div className={`mt-1 text-[11px] ${stale ? "text-amber-700 dark:text-amber-400" : "text-[#6b7d93] dark:text-[#7a9bb8]"}`}>
          {usedFallback
            ? `No new signals in the last ${windowDays} days — showing the most recent (${fmtDate(latestPublishedAt)}, ${latestAgeDays}d ago).`
            : stale
            ? `Feed last updated ${fmtDate(latestPublishedAt)} (${latestAgeDays}d ago) — daily ingest may be behind.`
            : `Updated ${fmtDate(latestPublishedAt)}.`}
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[#e3d9c0] p-6 text-center dark:border-[#1d3a57]">
          <p className="text-xs leading-5 text-[#6b7d93] dark:text-[#7a9bb8]">
            No high-impact AI-market news in the last {windowDays} days.
            {latestPublishedAt ? ` Latest tracked story: ${fmtDate(latestPublishedAt)}.` : ""}
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.level}>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex h-1.5 w-1.5 rounded-full ${g.dot}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${g.text}`}>{g.label}</span>
                <span className="text-[10px] tabular-nums text-[#8a98a8]">({g.rows.length})</span>
              </div>
              <ul className="mt-1 divide-y divide-[#efe9d9] dark:divide-[#16314c]">
                {g.rows.map((item) => (
                  <NewsRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
