import { getBreakingNews, getMarketDashboard, listIntelligenceVendors } from "@/lib/intelligence/repository";

// "Market Today" — composed ONLY from real / explicitly-labelled readers. There
// is no measured "market index" field, so we never invent one. Three tiles:
//   1. Breaking — getBreakingNews() already hard-gates on sourceKind==="real" +
//      an https source, so seed/[MOCK] news cannot leak; honest empty/stale state.
//   2. Movers — getMarketDashboard().weeklyMovers (MarketShareEstimate.changePct),
//      wearing an "estimate, not measured" pill. NOT getRankingHistories deltas
//      (those are PRNG-reconstructed when no snapshots exist).
//   3. Coverage — counts only: vendors tracked + the source-backed graph partition.

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const TILE = "rounded-lg border border-black/5 dark:border-white/10 p-4";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

function ageLabel(days: number | null): string {
  if (days === null) return "no dated items";
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default async function MarketTodayBand({
  coverage,
  isLive,
}: {
  coverage: { edgesTotal: number; high: number; medium: number; seed: number };
  /** Movers are quantitative estimates — only shown when backed by verified
   *  evidence. Breaking news + coverage counts are independently real-gated. */
  isLive: boolean;
}) {
  const [news, dashboard, vendors] = await Promise.all([
    getBreakingNews({ days: 14, limit: 5 }).catch(() => null),
    isLive ? getMarketDashboard().catch(() => null) : Promise.resolve(null),
    listIntelligenceVendors().catch(() => []),
  ]);

  const movers = isLive ? (dashboard?.weeklyMovers ?? []).slice(0, 5) : [];

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">Market today</h2>
        <span className={`text-[11px] ${MUTED}`}>
          {news ? `Latest verified item ${ageLabel(news.latestAgeDays)}` : ""}
        </span>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${isLive ? "lg:grid-cols-3" : ""}`}>
        {/* Tile 1 — Breaking (real-gated by construction; shown regardless) */}
        <div className={CARD}>
          <h3 className="text-sm font-semibold">Breaking</h3>
          {!news || news.items.length === 0 ? (
            <p className={`mt-3 text-sm ${MUTED}`}>
              No verified items in the last 14 days. We show source-backed news only — never seed
              headlines.
            </p>
          ) : (
            <>
              {news.usedFallback && (
                <p className={`mt-1 text-[11px] ${MUTED}`}>
                  Nothing inside the window — showing the most recent verified items.
                </p>
              )}
              <ul className="mt-3 space-y-3">
                {news.items.map((n) => (
                  <li key={n.id} className="text-sm">
                    {n.sourceUrl ? (
                      <a
                        href={n.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {n.title}
                      </a>
                    ) : (
                      <span className="font-medium">{n.title}</span>
                    )}
                    <span className={`mt-0.5 block text-[11px] ${MUTED}`}>
                      {n.primaryVendorName ? `${n.primaryVendorName} · ` : ""}
                      {n.sourceName}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Tiles 2 + 3 (Movers, Coverage) are estimate/graph-derived — STRICT mode
            holds them until the portal is backed by verified evidence. */}
        {isLive && (
        <>
        <div className={CARD}>
          <h3 className="text-sm font-semibold">Movers</h3>
          <p className="mt-1 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium">
            Directional estimates, not measured market data
          </p>
          {movers.length === 0 ? (
            <p className={`mt-3 text-sm ${MUTED}`}>
              {isLive
                ? "No estimated movement to report."
                : "Held until backed by verified evidence — we don't show directional estimates as if measured."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {movers.map((m) => {
                const up = m.changePct >= 0;
                return (
                  <li key={m.vendor.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{m.vendor.name}</span>
                    <span className={`tabular-nums font-mono text-xs ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {up ? "▲" : "▼"} {Math.abs(m.changePct).toFixed(1)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Tile 3 — Coverage (counts only; nothing inferred) */}
        <div className={CARD}>
          <h3 className="text-sm font-semibold">Coverage</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className={TILE}>
              <dd className="font-display text-2xl tabular-nums">{vendors.length || "—"}</dd>
              <dt className={`mt-0.5 text-[11px] ${MUTED}`}>Vendors tracked</dt>
            </div>
            <div className={TILE}>
              <dd className="font-display text-2xl tabular-nums">{coverage.edgesTotal}</dd>
              <dt className={`mt-0.5 text-[11px] ${MUTED}`}>Source-cited edges</dt>
            </div>
            <div className={TILE}>
              <dd className="font-display text-2xl tabular-nums">{coverage.high}</dd>
              <dt className={`mt-0.5 text-[11px] ${MUTED}`}>High-confidence</dt>
            </div>
            <div className={TILE}>
              <dd className="font-display text-2xl tabular-nums">{coverage.medium} · {coverage.seed}</dd>
              <dt className={`mt-0.5 text-[11px] ${MUTED}`}>Medium · seed</dt>
            </div>
          </dl>
        </div>
        </>
        )}
      </div>
    </section>
  );
}
