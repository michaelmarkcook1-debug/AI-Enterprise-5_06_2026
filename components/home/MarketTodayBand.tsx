import Link from "next/link";
import { getMarketDashboard, listIntelligenceVendors } from "@/lib/intelligence/repository";
import { HARDCODED_SURFACES_WIRED } from "@/lib/availability";
import DataUnavailable from "@/components/DataUnavailable";

// "Market Today" — composed ONLY from real / explicitly-labelled readers. There
// is no measured "market index" field, so we never invent one. Two tiles:
//   1. Movers — getMarketDashboard().weeklyMovers (MarketShareEstimate.changePct),
//      wearing an "estimate, not measured" pill. NOT getRankingHistories deltas
//      (those are PRNG-reconstructed when no snapshots exist).
//   2. Coverage — counts only: vendors tracked + the source-backed graph partition.
// Breaking news moved out to BreakingNewsHero at the top of the front page
// (2026-07-04) — it's the hero now, not a tile here.

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const TILE = "rounded-lg border border-black/5 dark:border-white/10 p-4";
const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

export default async function MarketTodayBand({
  coverage,
  isLive,
}: {
  coverage: { edgesTotal: number; high: number; medium: number; seed: number };
  /** Movers are quantitative estimates — only shown when backed by verified evidence. */
  isLive: boolean;
}) {
  const [dashboard, vendors] = await Promise.all([
    isLive ? getMarketDashboard().catch(() => null) : Promise.resolve(null),
    listIntelligenceVendors().catch(() => []),
  ]);

  const movers = isLive ? (dashboard?.weeklyMovers ?? []).slice(0, 5) : [];

  return (
    <section className="mb-10">
      <div className="mb-3">
        <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">Market today</h2>
      </div>

      {!isLive ? (
        <DataUnavailable
          title="Market movement unavailable"
          detail="Movers are directional estimates shown only once backed by verified evidence — we don't display them as if measured."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={CARD}>
            <h3 className="text-sm font-semibold">Movers</h3>
            <p className={`mt-1 text-xs ${MUTED}`}>Directional estimates — never shown as measured.</p>
            {movers.length === 0 ? (
              <div className="mt-3 space-y-2">
                <p className={`text-sm ${MUTED}`}>
                  No evidence-backed market-share movement in the current window — movers surface only when
                  the shift is cited, never invented.
                </p>
                <p className="text-[13px]">
                  <span className={`mr-1 ${MUTED}`}>Fresh right now:</span>
                  <Link href="/models" className="underline underline-offset-2 hover:no-underline">model benchmarks</Link>
                  <span className={MUTED}> · </span>
                  <Link href="/legislation" className="underline underline-offset-2 hover:no-underline">
                    legislation &amp; regulation
                  </Link>
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {movers.map((m) => {
                  const up = m.changePct >= 0;
                  return (
                    <li key={m.vendor.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{m.vendor.name}</span>
                      <span className={`tabular-nums font-mono text-xs ${up ? "text-sky-700 dark:text-sky-400" : "text-orange-600 dark:text-orange-400"}`}>
                        {up ? "▲" : "▼"} {Math.abs(m.changePct).toFixed(1)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={CARD}>
            <h3 className="text-sm font-semibold">Coverage</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className={TILE}>
                <dd className="font-display text-2xl tabular-nums">{vendors.length || "—"}</dd>
                <dt className={`mt-0.5 text-xs ${MUTED}`}>Vendors tracked</dt>
              </div>
              {/* Edge counts are graph-derived (hardcoded) — gate so they don't ride
                  the provenance flip and show hardcoded numbers as live. */}
              {HARDCODED_SURFACES_WIRED && (
                <>
                  <div className={TILE}>
                    <dd className="font-display text-2xl tabular-nums">{coverage.edgesTotal}</dd>
                    <dt className={`mt-0.5 text-xs ${MUTED}`}>Source-cited edges</dt>
                  </div>
                  <div className={TILE}>
                    <dd className="font-display text-2xl tabular-nums">{coverage.high}</dd>
                    <dt className={`mt-0.5 text-xs ${MUTED}`}>High-confidence</dt>
                  </div>
                  <div className={TILE}>
                    <dd className="font-display text-2xl tabular-nums">{coverage.medium} · {coverage.seed}</dd>
                    <dt className={`mt-0.5 text-xs ${MUTED}`}>Medium · seed</dt>
                  </div>
                </>
              )}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
