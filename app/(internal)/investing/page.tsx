import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel, ScoreBar, SeedDataBadge } from "@/components/intelligence-ui";
import { VendorNameWithOwnership } from "@/components/ownership-indicator";
import { getInvestmentDashboard } from "@/lib/investing/intelligence";
import type { InvestmentProviderProfile } from "@/lib/investing/types";
import { listNewsItems } from "@/lib/intelligence/repository";
import { enrichInvestmentProviders } from "@/lib/investing/live-data";
import { aggregateUptake } from "@/lib/intelligence/vendor-uptake-seed";
import { InvestingCard, ProviderScoreTable, WarningStrip, label, ownershipFor } from "./investing-ui";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function InvestingDashboardPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  const dashboard = getInvestmentDashboard();
  const investmentNews = (await listNewsItems())
    .filter((item) => item.categories.some((category) => ["Market movement", "Infrastructure", "Partnership", "Pricing", "Risk event", "Strategy signal", "Product launch"].includes(category)))
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 6);

  // Live overlay — enrich the top 8 ranked public providers with the
  // app-wide spine (AI Atlas, uptake, news) so the hub surfaces the
  // freshly classified data alongside the seed scoring model.
  const topPublicProviders = dashboard.corePublicPlatforms.slice(0, 8).map((row) => row.provider);
  const enrichedTop = await enrichInvestmentProviders(topPublicProviders, { skipQuotes: true, newsLimit: 1 });
  const uptakeTop = aggregateUptake({}).slice(0, 5);
  const newsTickerTop = (await listNewsItems()).slice(0, 5);

  return (
    <PageFrame
      title="Investor Tools"
      kicker="Where should capital be allocated?"
      description="Separated from the CIO decision workflow. Serves VC, PE, public market investors, corporate development, strategy teams, and M&A. Tracks vendor momentum, category growth, valuation signals, exposure risk, and scenario modelling."
    >
      <div className="space-y-5">
        {/* Live overlay strip — pulls from the same data the QUAD tabs use. */}
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.95fr_1fr]">
          <Panel title="AI Atlas position — top public providers">
            <p className="mb-2 text-[11px] text-[#56657b] dark:text-[#a7bacd]">
              Live Enhance × Innovate quadrant for each tracked public provider, sourced from the
              <Link href="/query" className="ml-1 underline">Query tab</Link>.
            </p>
            <ul className="space-y-1.5 text-xs">
              {enrichedTop.map((e) => (
                <li key={e.provider.id} className="flex items-center justify-between gap-2">
                  <Link href={`/investor-tools/provider/${e.provider.slug}`} className="truncate font-medium hover:underline">
                    {e.provider.name}
                  </Link>
                  {e.atlas ? (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      e.atlas.quadrant === "leaders"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : e.atlas.quadrant === "challengers"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                        : e.atlas.quadrant === "visionaries"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                    }`}>{e.atlas.quadrant}</span>
                  ) : <span className="text-[#5d6b80]">—</span>}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Vendor uptake share — top 5 (May 2026 research)">
            <p className="mb-2 text-[11px] text-[#56657b] dark:text-[#a7bacd]">
              Share-of-named-vendor-usage from the
              <Link href="/demonstrate#uptake" className="ml-1 underline">Demonstrate explorer</Link>.
            </p>
            <ul className="space-y-1.5 text-xs">
              {uptakeTop.map((row, i) => (
                <li key={row.vendor} className="flex items-center justify-between gap-2">
                  <span className="truncate"><span className="mr-1.5 inline-block w-3 text-right font-mono text-[10px] text-[#5b6b7f]">{i + 1}</span>{row.vendor}</span>
                  <span className="font-mono font-semibold">{(row.share * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Classified news ticker">
            <p className="mb-2 text-[11px] text-[#56657b] dark:text-[#a7bacd]">
              Latest items from the competitive-intel monitor.
            </p>
            <ul className="space-y-1.5 text-xs">
              {newsTickerTop.map((item) => (
                <li key={item.id} className="border-l-2 border-[#e6dcc3] pl-2">
                  <div className="truncate text-[#13294b] dark:text-[#eef3f8]" title={item.title}>{item.title}</div>
                  <div className="flex items-center gap-2 text-[10px] text-[#5d6b80]">
                    <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                    <span>impact {item.impactScore}</span>
                    <SeedDataBadge label={item.sourceKind === "real" ? "live" : "seed"} provenance={item.sourceKind === "real" ? "live" : "seed"} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InvestingCard title="Top long-term AI exposure" provider={dashboard.cards.topLongTerm?.provider ?? null} score={dashboard.cards.topLongTerm?.provider.longTermHoldScore} href={`/investor-tools/provider/${dashboard.cards.topLongTerm?.provider.slug ?? ""}`} />
          <InvestingCard title="Highest short-term catalyst" provider={dashboard.cards.highestCatalyst?.provider ?? null} score={dashboard.cards.highestCatalyst?.provider.shortTermCatalystScore} href={`/investor-tools/provider/${dashboard.cards.highestCatalyst?.provider.slug ?? ""}`} />
          <InvestingCard title="Highest speculative upside" provider={dashboard.cards.highestSpeculative?.provider ?? null} score={dashboard.cards.highestSpeculative?.provider.speculativeUpsideScore} href={`/investor-tools/provider/${dashboard.cards.highestSpeculative?.provider.slug ?? ""}`} />
          <InvestingCard title="Highest valuation risk" provider={dashboard.cards.highestValuationRisk?.provider ?? null} score={dashboard.cards.highestValuationRisk?.provider.valuationRiskScore} href={`/investor-tools/provider/${dashboard.cards.highestValuationRisk?.provider.slug ?? ""}`} />
          <InvestingCard title="Highest infrastructure dependency" provider={dashboard.cards.highestInfrastructureDependency?.provider ?? null} score={dashboard.cards.highestInfrastructureDependency?.provider.infrastructureDependencyScore} href={`/investor-tools/provider/${dashboard.cards.highestInfrastructureDependency?.provider.slug ?? ""}`} />
          <InvestingCard title="Strongest IPO watch candidate" provider={dashboard.cards.strongestIpoWatch?.provider ?? null} score={dashboard.cards.strongestIpoWatch?.profile.readinessScore} risk={dashboard.cards.strongestIpoWatch?.provider.mainRisk} href={`/investor-tools/provider/${dashboard.cards.strongestIpoWatch?.provider.slug ?? ""}`} />
          <InvestingCard title="Best AI workflow candidate" provider={dashboard.cards.bestWorkflowSoftware?.provider ?? null} score={dashboard.cards.bestWorkflowSoftware?.consumerInvestmentPotential} href={`/investor-tools/provider/${dashboard.cards.bestWorkflowSoftware?.provider.slug ?? ""}`} />
          <InvestingCard title="Most overhyped / confidence gap" provider={dashboard.cards.mostOverhyped?.provider ?? null} score={dashboard.cards.mostOverhyped?.hypePenalty} reason="Watchlist candidate: requires valuation validation before investment interpretation." href={`/investor-tools/provider/${dashboard.cards.mostOverhyped?.provider.slug ?? ""}`} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Short-term catalyst watch">
            <div className="space-y-4">
              {dashboard.shortTermCatalysts.slice(0, 6).map((row) => (
                <div key={row.provider.id} className="grid gap-3 md:grid-cols-[180px_1fr_110px] md:items-center">
                  <Link className="text-sm font-medium" href={`/investor-tools/provider/${row.provider.slug}`}>
                    <VendorNameWithOwnership name={row.provider.name} ownershipType={ownershipFor(row.provider)} />
                  </Link>
                  <ScoreBar value={row.provider.shortTermCatalystScore} label="Catalyst score" />
                  <Confidence value={row.provider.evidenceConfidence} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Risk radar and watchlist alerts">
            <div className="space-y-3">
              {dashboard.alerts.length === 0 && <p className="text-sm text-[#54647a] dark:text-[#a7bacd]">No current seed alerts.</p>}
              {dashboard.alerts.map((alert) => (
                <div key={alert} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
                  {alert}
                </div>
              ))}
              <div className="pt-2">
                <SeedDataBadge label="Seed / estimated" reason="Investment data is placeholder seed intelligence until live financial ingestion is connected." />
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Panel title="Core public AI platform exposures">
            <MiniList rows={dashboard.corePublicPlatforms.map((row) => row.provider)} scoreKey="investmentAttractivenessScore" />
          </Panel>
          <Panel title="AI infrastructure exposure">
            <MiniList rows={dashboard.infrastructureExposure.map((row) => row.provider)} scoreKey="aiRevenueExposureScore" />
          </Panel>
          <Panel title="Speculative/private IPO watchlist">
            <MiniList rows={dashboard.speculativeWatchlist.map((row) => row.provider)} scoreKey="speculativeUpsideScore" />
          </Panel>
        </div>

        <Panel title="Public and watchlist ranking model">
          <ProviderScoreTable providers={[...dashboard.longTermHolds.map((row) => row.provider), ...dashboard.speculativeWatchlist.map((row) => row.provider)].filter((provider, index, all) => all.findIndex((item) => item.id === provider.id) === index).slice(0, 14)} />
        </Panel>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="IPO rumour monitor">
            <div className="space-y-3">
              {dashboard.ipoRumourMonitor.slice(0, 6).map((row) => (
                <div key={row.provider.id} className="flex items-center justify-between gap-3 rounded-md border border-[#ece4d0] px-3 py-2 text-sm dark:border-[#1d3a57]">
                  <span>{row.provider.name}</span>
                  <span className="text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">{row.profile.rumourStage} | readiness {row.profile.readinessScore}/100</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Indirect exposure preview">
            <div className="space-y-3">
              {dashboard.indirectExposurePreview.map((edge) => (
                <div key={`${edge.publicTicker}-${edge.privateProviderId}`} className="grid grid-cols-[90px_1fr_70px] gap-3 text-sm">
                  <span className="font-semibold">{edge.publicTicker}</span>
                  <span>{edge.privateProviderId} | {edge.exposureType}</span>
                  <span className="font-mono">{Math.round((edge.indirectExposureScore ?? 0))}</span>
                </div>
              ))}
              <p className="text-xs text-[#5e6b7e] dark:text-[#8fa5bb]">Indirect exposure is not the same as direct ownership of the private AI provider.</p>
            </div>
          </Panel>
        </div>

        <Panel title="Recent investment-relevant AI news">
          <div className="divide-y divide-[#ece4d0] dark:divide-[#1d3a57]">
            {investmentNews.map((item) => (
              <div key={item.id} className="grid gap-3 py-3 md:grid-cols-[1fr_110px_130px] md:items-center">
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">{item.whyItMatters}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.categories.slice(0, 3).map((category) => (
                      <span key={category} className="rounded border border-[#e0d6ba] px-1.5 py-0.5 text-[11px] text-[#5b6b7f] dark:border-[#2a4a6b] dark:text-[#a7bacd]">
                        {category}
                      </span>
                    ))}
                    <SeedDataBadge label={item.sourceKind === "real" ? "Documented" : "Seed source"} provenance={item.sourceKind === "real" ? "live" : "seed"} />
                  </div>
                </div>
                <div className="font-mono text-sm">Impact {item.impactScore}</div>
                <Confidence value={item.confidenceScore} />
              </div>
            ))}
            {investmentNews.length === 0 && <div className="py-3 text-sm text-[#54647a] dark:text-[#a7bacd]">No seeded investment-relevant news items.</div>}
          </div>
        </Panel>

        <div className="flex flex-wrap gap-2">
          {[
            ["/investor-tools/public", "Public AI stocks"],
            ["/investor-tools/ipo-watch", "IPO watch"],
            ["/investor-tools/exposure-map", "Exposure map"],
            ["/investor-tools/briefing", "Investment briefing"],
            ["/investor-tools/simulator", "Simulator"],
            ["/investor-tools/watchlist", "Watchlist"],
          ].map(([href, text]) => (
            <Link key={href} href={href} className="rounded-md border border-[#d6c9a8] px-3 py-2 text-xs font-semibold hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:hover:bg-[#0c2238]">
              {text}
            </Link>
          ))}
        </div>
      </div>
    </PageFrame>
  );
}

function MiniList({ rows, scoreKey }: { rows: InvestmentProviderProfile[]; scoreKey: keyof InvestmentProviderProfile }) {
  return (
    <div className="space-y-3">
      {rows.slice(0, 6).map((provider) => {
        const value = provider[scoreKey];
        return (
          <Link key={provider.id} href={`/investor-tools/provider/${provider.slug}`} className="flex items-center justify-between gap-3 text-sm">
            <span>{provider.name}</span>
            <span className="font-mono">{typeof value === "number" || typeof value === "string" ? String(value) : "n/a"}</span>
          </Link>
        );
      })}
      {rows.length === 0 && <div className="text-sm text-[#54647a] dark:text-[#a7bacd]">No seed providers in this category.</div>}
      <div className="pt-1 text-xs uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">{label(scoreKey)}</div>
    </div>
  );
}
