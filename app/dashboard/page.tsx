import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Confidence, EstimatedNote, Metric, Panel, ScoreBar, SeedDataBadge } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import { marketMoverStatus, momentumStatus } from "@/lib/intelligence/metrics";
import { getMarketDashboard } from "@/lib/intelligence/repository";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import CommercialModelsCard from "@/components/dashboard/CommercialModelsCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [dashboard, provenance] = await Promise.all([
    getMarketDashboard(),
    getDataProvenance(),
  ]);

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="border-b border-[#dfe4da] pb-6 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#6a725f] dark:text-zinc-500">
              <span>Executive market dashboard</span>
              <SeedDataBadge provenance={provenance.source} reason={provenance.reason} />
            </div>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-[#121812] dark:text-zinc-50 md:text-5xl">
              AI Enterpise tracks market position, momentum, and enterprise risk across AI platforms.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#596151] dark:text-zinc-400">
              Seeded market intelligence across category share, agentic momentum, capability change, risk posture, and evidence confidence.
            </p>
            <div className="mt-4">
              <OwnershipLegend />
            </div>
          </section>
          <section className="grid grid-cols-2 gap-4 self-end border-b border-[#dfe4da] pb-6 dark:border-zinc-800">
            <Metric label="Tracked vendors" value="20" note="MVP universe" />
            <Metric label="Major signals" value={dashboard.majorNews.length} note="Seed news" />
            <Metric label="Risk radar" value={dashboard.riskAlerts.length} note="Estimated status" />
            <Metric label="Categories" value={dashboard.categoryShare.length} note="Category-specific share" />
          </section>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <Panel title="Top enterprise AI platform vendors" action={<Link className="text-xs text-[#2f5d50] hover:underline dark:text-emerald-300" href="/vendors">View all</Link>}>
            <div className="divide-y divide-[#edf0ea] dark:divide-zinc-800">
              {dashboard.topVendors.slice(0, 7).map((vendor, index) => (
                <Link key={vendor.id} href={`/vendors/${vendor.slug}`} className="grid grid-cols-[32px_1fr_120px] items-center gap-3 py-3">
                  <div className="font-mono text-sm text-[#697362]">{index + 1}</div>
                  <div>
                    <div className="font-medium text-[#18201b] dark:text-zinc-100">
                      <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} />
                    </div>
                    <div className="text-xs text-[#66705f] dark:text-zinc-500">{vendor.category} - {vendor.marketPosition}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg font-semibold dark:text-zinc-100">{vendor.overallScore}</div>
                    <Confidence value={vendor.confidenceScore} />
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <div className="grid gap-5">
            <Panel title="Who's winning" action={<SeedDataBadge label="Estimated" />}>
              <div className="space-y-3">
                {dashboard.winningVendors.slice(0, 5).map((item) => (
                  <div key={item.vendor.id} className="border-l-2 border-emerald-600 pl-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                      </div>
                      <Confidence value={item.confidence} />
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[#596151] dark:text-zinc-400">{item.reason}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Who's losing" action={<SeedDataBadge label="Estimated" />}>
              <div className="space-y-3">
                {dashboard.losingVendors.slice(0, 5).map((item) => (
                  <div key={item.vendor.id} className="border-l-2 border-rose-500 pl-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                      </div>
                      <Confidence value={item.confidence} />
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[#596151] dark:text-zinc-400">{item.reason}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <Panel title="Biggest market movers" action={<SeedDataBadge label="Estimated change" />}>
            <div className="space-y-3">
              {dashboard.weeklyMovers.slice(0, 6).map((item) => {
                const status = marketMoverStatus(item.changePct);
                return (
                  <div key={`${item.vendor.id}_${item.reason}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">
                        <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                      </span>
                      <span className={`font-mono text-sm ${status === "gaining" ? "text-emerald-700 dark:text-emerald-300" : status === "declining" ? "text-rose-700 dark:text-rose-300" : "text-[#697362] dark:text-zinc-500"}`}>
                        {item.changePct > 0 ? "+" : ""}{item.changePct}% {status}
                      </span>
                    </div>
                    <div className="text-xs leading-5 text-[#66705f] dark:text-zinc-400">{item.reason}</div>
                    <div className="mt-1"><Confidence value={item.confidence} /></div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Market share by category" action={<SeedDataBadge label="Seed estimate" />}>
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {dashboard.categoryShare.slice(0, 10).map((category) => (
                <div key={category.category.id}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">{category.category.name}</div>
                  <div className="space-y-2">
                    {category.leaders.map(({ vendor, estimate }) => (
                      <div key={`${category.category.id}_${vendor.id}`}>
                        <div className="flex items-center justify-between gap-3 text-sm dark:text-zinc-200">
                          <span><VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} /></span>
                          <span className="font-mono">{estimate.estimatedShare}%</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8ede2] dark:bg-zinc-800">
                            <div className="h-full rounded-full bg-[#2f5d50] dark:bg-emerald-400" style={{ width: `${Math.max(2, Math.min(100, estimate.estimatedShare))}%` }} />
                          </div>
                          <span className="text-[11px] text-[#697362] dark:text-zinc-500">conf {estimate.confidence}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="Agentic AI momentum" action={<SeedDataBadge label="Estimated" />}>
            <div className="space-y-4">
              {dashboard.agenticMomentum.slice(0, 5).map((item) => (
                <div key={item.vendor.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-[#4d574b] dark:text-zinc-300">
                      <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                    </span>
                    <span className="uppercase text-[#697362] dark:text-zinc-500">{momentumStatus(item.momentum.momentumScore)}</span>
                  </div>
                  <ScoreBar value={item.momentum.momentumScore} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Enterprise risk radar" action={<SeedDataBadge label="Estimated" />}>
            <div className="space-y-3">
              {dashboard.riskAlerts.slice(0, 5).map((item) => (
                <div key={item.vendor.id} className="rounded-md bg-[#faf8f1] px-3 py-2 dark:bg-amber-950/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                    </span>
                    <span className="text-xs uppercase text-[#8a5b2d] dark:text-amber-300">{item.severity}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#5f665a] dark:text-zinc-400">{item.alert}</div>
                  <div className="mt-1"><Confidence value={item.confidence} /></div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Sector-specific leaders" action={<SeedDataBadge label="Estimated" />}>
            <div className="space-y-4">
              {dashboard.sectorLeaders.slice(0, 5).map((sector) => (
                <div key={sector.industry}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">{sector.industry}</div>
                  <div className="mt-2 space-y-2">
                    {sector.vendors.slice(0, 3).map((item) => (
                      <div key={item.vendor.id} className="flex items-center justify-between gap-3 text-sm dark:text-zinc-200">
                        <span><VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} /></span>
                        <span className="font-mono">{item.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-5">
          <CommercialModelsCard />
        </div>

        <div className="mt-5">
          <Panel title="Recent major news" action={<SeedDataBadge label="Seed news" />}>
            <div className="divide-y divide-[#edf0ea] dark:divide-zinc-800">
              {dashboard.majorNews.map((item) => (
                <Link key={item.id} href="/news" className="block py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-[#18201b] dark:text-zinc-100">{item.title}</div>
                    <span className="font-mono text-xs text-[#697362] dark:text-zinc-500">{item.impactScore}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#66705f] dark:text-zinc-400">{item.whyItMatters}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SeedDataBadge label={item.sourceKind === "real" ? "Source linked" : "Seed item"} />
                    <Confidence value={item.confidenceScore} />
                    {item.categories.slice(0, 2).map((category) => (
                      <span key={category} className="text-xs text-[#697362] dark:text-zinc-500">{category}</span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-5 rounded-lg border border-[#dfe4da] bg-[#eef2e8] p-4 dark:border-zinc-800 dark:bg-[#071827]">
          <EstimatedNote />
        </div>
      </main>
    </AppShell>
  );
}
