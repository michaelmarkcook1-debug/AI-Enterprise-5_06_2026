// Investment Simulator — seed-deterministic engine + live news overlay.
//
// The interactive engine remains in InvestmentSimulatorClient (untouched
// for now to avoid a behavioural regression). What's new on this page:
//   1. Server-side enrichment of the seed default portfolio's holdings
//      via lib/investing/live-data.ts.
//   2. A "Live news context" panel rendered above the client simulator,
//      showing for each seed holding: AI Atlas position, the latest
//      classified news headline, and the computed news-tilt that would
//      apply if the user toggles `applyNewsOverlay` on inside the
//      simulator inputs.
//   3. A "Portfolio news climate" summary strip — the portfolio-weighted
//      tilt + a plain-English rationale (lib/investing/news-tilt.ts).
//
// Force-dynamic so every render reflects the latest classified news
// from IntelligenceNewsItem (filled by the daily competitive-intel
// monitor).

import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Panel, SeedDataBadge } from "@/components/intelligence-ui";
import {
  getDefaultSimulationInput,
  getSeedPortfolio,
  listIndirectExposures,
  listInvestmentProviders,
  listIpoWatch,
  simulatePortfolio,
} from "@/lib/investing/simulator";
import { simulatePortfolioLive } from "@/lib/investing/simulator-live";
import InvestmentSimulatorClient from "./InvestmentSimulatorClient";

export const dynamic = "force-dynamic";

const QUADRANT_LABEL: Record<string, string> = {
  leaders: "Leaders",
  challengers: "Challengers",
  visionaries: "Visionaries",
  niche: "Niche",
};

export default async function InvestmentSimulatorPage() {
  const input = { ...getDefaultSimulationInput(), applyNewsOverlay: true };
  const portfolio = { ...getSeedPortfolio(input), applyNewsOverlay: true };
  const baseResult = simulatePortfolio(portfolio);
  const { live } = await simulatePortfolioLive(portfolio);

  return (
    <PageFrame
      title="Investment Simulator"
      kicker="Scenario modelling + live news overlay"
      description="Hypothetical AI-provider portfolio modelling for public, indirect, and IPO-watch exposure. The deterministic scenario math (bull / base / bear / stress) is shown below; the live news-overlay strip and per-holding news context above are sourced from the classified-news monitor and the AI Atlas spine. Not financial advice."
    >
      {/* News climate strip — portfolio-weighted tilt over the horizon. */}
      {live && (
        <div className="mb-5 rounded-xl border border-[#e6dcc3] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-zinc-500">
                  Portfolio news climate
                </span>
                <SeedDataBadge
                  label={live.holdings.some((h) => h.enriched.news.some((n) => n.isLive)) ? "live" : "seed"}
                  provenance={live.holdings.some((h) => h.enriched.news.some((n) => n.isLive)) ? "live" : "seed"}
                />
              </div>
              <p className="mt-1 text-sm text-[#13294b] dark:text-zinc-100">{live.summary}</p>
              <p className="mt-1 text-[11px] text-[#5b6b7f] dark:text-zinc-500">
                Multipliers applied to scenario terminal values (over {portfolio.horizonYears}y):
                Bull ×{live.scenarios.bull.multiplier.toFixed(3)} ·
                Base ×{live.scenarios.base.multiplier.toFixed(3)} ·
                Bear ×{live.scenarios.bear.multiplier.toFixed(3)} ·
                Stress ×{live.scenarios.stress.multiplier.toFixed(3)}.
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-[#5b6b7f] dark:text-zinc-500">Annualised tilt</div>
              <div className={`font-mono text-2xl font-semibold ${
                live.portfolioAnnualTilt > 0.0005
                  ? "text-emerald-700 dark:text-emerald-300"
                  : live.portfolioAnnualTilt < -0.0005
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-[#13294b] dark:text-zinc-100"
              }`}>
                {live.portfolioAnnualTilt >= 0 ? "+" : ""}{(live.portfolioAnnualTilt * 100).toFixed(2)}pp
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-holding live news context */}
      {live && live.holdings.length > 0 && (
        <div className="mb-6">
          <Panel title="Live news + AI Atlas context for the seed portfolio holdings">
            <p className="mb-3 text-xs leading-5 text-[#56657b] dark:text-zinc-400">
              Each holding shows its AI Atlas quadrant, vendor-uptake share from the May 2026
              research, and the most recent classified news that contributed to its tilt. Toggle
              the news overlay off inside the simulator inputs below to see the deterministic
              scenario math without this adjustment.
            </p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {live.holdings.map((h) => {
                const tiltPp = (h.tilt.tilt * 100).toFixed(2);
                const tone =
                  h.tilt.tilt > 0.0005 ? "ok" : h.tilt.tilt < -0.0005 ? "bad" : "neutral";
                const atlas = h.enriched.atlas;
                const uptake = h.enriched.uptakeShare;
                const news = h.enriched.news;
                return (
                  <div key={h.providerId} className="rounded-md border border-[#e6dcc3] bg-[#fafbf8] p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/investor-tools/provider/${h.providerId}`}
                        className="font-semibold text-[#13294b] hover:underline dark:text-zinc-100"
                      >
                        {h.providerName}
                      </Link>
                      <span className={`font-mono text-xs font-semibold ${
                        tone === "ok" ? "text-emerald-700 dark:text-emerald-300"
                        : tone === "bad" ? "text-rose-700 dark:text-rose-300"
                        : "text-[#5b6b7f] dark:text-zinc-500"
                      }`}>
                        {h.tilt.tilt >= 0 ? "+" : ""}{tiltPp}pp
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#5b6b7f]">
                      {atlas ? (
                        <span className={`rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wider ${
                          atlas.quadrant === "leaders"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : atlas.quadrant === "challengers"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                            : atlas.quadrant === "visionaries"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                        }`}>
                          Atlas: {QUADRANT_LABEL[atlas.quadrant]}
                        </span>
                      ) : <span className="italic">No Atlas</span>}
                      {uptake !== null && (
                        <span className="rounded-full bg-[#f3ead2] px-1.5 py-0.5 font-semibold text-[#455044] dark:bg-zinc-800 dark:text-zinc-300">
                          Uptake {(uptake * 100).toFixed(1)}%
                        </span>
                      )}
                      <span className="italic">{news.length} stor{news.length === 1 ? "y" : "ies"}</span>
                    </div>
                    {news.length === 0 ? (
                      <p className="mt-2 text-[11px] italic text-[#5d6b80]">No recent classified news.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {news.slice(0, 2).map((n) => (
                          <li key={n.id} className="text-[11px] leading-4">
                            <div className="font-medium text-[#13294b] dark:text-zinc-200">{n.title}</div>
                            <div className="text-[10px] text-[#5d6b80]">{new Date(n.publishedAt).toLocaleDateString()} · impact {n.impactScore}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* Existing client simulator — unchanged behaviour. */}
      <InvestmentSimulatorClient
        initialInput={input}
        initialPortfolio={portfolio}
        initialResult={baseResult}
        providers={listInvestmentProviders()}
        ipoWatch={listIpoWatch()}
        indirectExposures={listIndirectExposures()}
      />
    </PageFrame>
  );
}
