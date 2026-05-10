import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel, ScoreBar, SeedDataBadge } from "@/components/intelligence-ui";
import { VendorNameWithOwnership } from "@/components/ownership-indicator";
import { getInvestmentDashboard } from "@/lib/investing/intelligence";
import type { InvestmentProviderProfile } from "@/lib/investing/types";
import { listNewsItems } from "@/lib/intelligence/repository";
import { InvestingCard, ProviderScoreTable, WarningStrip, label, ownershipFor } from "./investing-ui";

export const dynamic = "force-dynamic";

export default async function InvestingDashboardPage() {
  const dashboard = getInvestmentDashboard();
  const investmentNews = (await listNewsItems())
    .filter((item) => item.categories.some((category) => ["Market movement", "Infrastructure", "Partnership", "Pricing", "Risk event", "Strategy signal", "Product launch"].includes(category)))
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 6);

  return (
    <PageFrame
      title="Investment Intelligence"
      kicker="AI-provider investment cockpit"
      description="A specialist AI-provider investment intelligence layer separating provider quality from investment attractiveness, valuation discipline, retail access, IPO risk, and indirect exposure."
    >
      <div className="space-y-5">
        <WarningStrip />

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
              {dashboard.alerts.length === 0 && <p className="text-sm text-[#596151] dark:text-zinc-400">No current seed alerts.</p>}
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
                <div key={row.provider.id} className="flex items-center justify-between gap-3 rounded-md border border-[#e7ebe2] px-3 py-2 text-sm dark:border-zinc-800">
                  <span>{row.provider.name}</span>
                  <span className="text-xs text-[#697362] dark:text-zinc-500">{row.profile.rumourStage} | readiness {row.profile.readinessScore}/100</span>
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
              <p className="text-xs text-[#6a725f] dark:text-zinc-500">Indirect exposure is not the same as direct ownership of the private AI provider.</p>
            </div>
          </Panel>
        </div>

        <Panel title="Recent investment-relevant AI news">
          <div className="divide-y divide-[#e7ebe2] dark:divide-zinc-800">
            {investmentNews.map((item) => (
              <div key={item.id} className="grid gap-3 py-3 md:grid-cols-[1fr_110px_130px] md:items-center">
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-[#596151] dark:text-zinc-400">{item.whyItMatters}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.categories.slice(0, 3).map((category) => (
                      <span key={category} className="rounded border border-[#d8ded0] px-1.5 py-0.5 text-[11px] text-[#697362] dark:border-zinc-700 dark:text-zinc-400">
                        {category}
                      </span>
                    ))}
                    <SeedDataBadge label={item.sourceKind === "real" ? "Documented" : "Seed source"} />
                  </div>
                </div>
                <div className="font-mono text-sm">Impact {item.impactScore}</div>
                <Confidence value={item.confidenceScore} />
              </div>
            ))}
            {investmentNews.length === 0 && <div className="py-3 text-sm text-[#596151] dark:text-zinc-400">No seeded investment-relevant news items.</div>}
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
            <Link key={href} href={href} className="rounded-md border border-[#cfd7c8] px-3 py-2 text-xs font-semibold hover:bg-[#eef2e8] dark:border-zinc-700 dark:hover:bg-zinc-900">
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
      {rows.length === 0 && <div className="text-sm text-[#596151] dark:text-zinc-400">No seed providers in this category.</div>}
      <div className="pt-1 text-xs uppercase tracking-wide text-[#697362] dark:text-zinc-500">{label(scoreKey)}</div>
    </div>
  );
}
