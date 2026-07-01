import Link from "next/link";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";
import { AppShell } from "@/components/app-shell";
import { Confidence, EstimatedNote, Metric, Panel, ScoreBar, SeedDataBadge, EvidenceDepthBadge, lowEvidenceClass } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import { marketMoverStatus, momentumStatus } from "@/lib/intelligence/metrics";
import { getMarketDashboard, listIntelligenceVendors, listVendorMomentum } from "@/lib/intelligence/repository";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import { getRankingHistories } from "@/lib/intelligence/ranking-snapshots";
import CommercialModelsCard from "@/components/dashboard/CommercialModelsCard";
import VendorTrendHover from "@/components/dashboard/VendorTrendHover";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  const [dashboard, provenance, vendors, momentum] = await Promise.all([
    getMarketDashboard(),
    getDataProvenance(),
    listIntelligenceVendors(),
    listVendorMomentum(),
  ]);

  // Day-by-day ranking history powering the hover-over trend graphs on the
  // Who's winning / Who's losing lists. Reads stored daily snapshots where
  // they exist (vendor_ranking_snapshots, written by the ranking-snapshot
  // cron) and falls back to deterministic reconstruction otherwise.
  const rankingHistories = await getRankingHistories(vendors, momentum);

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-5 py-8">
        {/* Indirect-exposure map moved out of the dashboard into its own
            top-level tab (/exposure-map) per the May 2026 navigation
            refresh — the map is dense enough to deserve a dedicated
            surface and was crowding the executive overview here. */}

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="border-b border-[#e6dcc3] pb-6 dark:border-[#1d3a57]">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#5e6b7e] dark:text-[#8fa5bb]">
              <span>Executive market dashboard</span>
              <SeedDataBadge provenance={provenance.source} reason={provenance.reason} />
            </div>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-[#0f2240] dark:text-[#f6f9fc] md:text-5xl">
              AI Enterprise tracks market position, momentum, and enterprise risk across AI platforms.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#54647a] dark:text-[#a7bacd]">
              Seeded market intelligence across category share, agentic momentum, capability change, risk posture, and evidence confidence.
            </p>
            <div className="mt-4">
              <OwnershipLegend />
            </div>
          </section>
          <section className="grid grid-cols-2 gap-4 self-end border-b border-[#e6dcc3] pb-6 dark:border-[#1d3a57]">
            <Metric label="Tracked vendors" value="20" note="MVP universe" />
            <Metric label="Major signals" value={dashboard.majorNews.length} note="Seed news" />
            <Metric label="Risk radar" value={dashboard.riskAlerts.length} note="Estimated status" />
            <Metric label="Categories" value={dashboard.categoryShare.length} note="Category-specific share" />
          </section>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <Panel title="Top enterprise AI platform vendors" action={<Link className="text-xs text-[#b08d2f] hover:underline dark:text-emerald-300" href="/vendors">View all</Link>}>
            <div className="divide-y divide-[#efe9d9] dark:divide-[#1d3a57]">
              {dashboard.topVendors.slice(0, 7).map((vendor, index) => (
                <Link key={vendor.id} href={`/vendors/${vendor.slug}`} className="grid grid-cols-[32px_1fr_120px] items-center gap-3 py-3">
                  <div className="font-mono text-sm text-[#5b6b7f]">{index + 1}</div>
                  <div>
                    <div className="font-medium text-[#13294b] dark:text-[#eef3f8]">
                      <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} />
                    </div>
                    <div className="text-xs text-[#5d6b80] dark:text-[#8fa5bb]">{vendor.category} - {vendor.marketPosition}</div>
                    {vendor.dataConfidence !== "verified" && (
                      <div className="mt-1"><EvidenceDepthBadge depth={vendor.evidenceDepth ?? 0} /></div>
                    )}
                  </div>
                  <div className={`text-right ${lowEvidenceClass(vendor.evidenceDepth ?? 0)}`}>
                    <div className="font-mono text-lg font-semibold dark:text-[#eef3f8]">{vendor.overallScore}</div>
                    <div className="text-[10px] font-mono text-[#8a9382] dark:text-[#7d93aa]">{(vendor.evidenceDepth ?? 0) > 0 ? `${vendor.evidenceDepth}✓ evidence` : "0 evidence"}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <div className="grid gap-5">
            <Panel title="Who's winning" action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}>
              <div className="space-y-3">
                {dashboard.winningVendors.slice(0, 5).map((item) => (
                  <VendorTrendHover
                    key={item.vendor.id}
                    vendorName={item.vendor.name}
                    history={rankingHistories.get(item.vendor.id)}
                    tone="win"
                  >
                    <div className="border-l-2 border-emerald-600 pl-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">
                          <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                        </div>
                        {item.vendor.dataConfidence !== "verified" && <EvidenceDepthBadge depth={item.vendor.evidenceDepth ?? 0} />}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">{item.reason}</div>
                    </div>
                  </VendorTrendHover>
                ))}
              </div>
            </Panel>

            <Panel title="Who's losing" action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}>
              <div className="space-y-3">
                {dashboard.losingVendors.slice(0, 5).map((item) => (
                  <VendorTrendHover
                    key={item.vendor.id}
                    vendorName={item.vendor.name}
                    history={rankingHistories.get(item.vendor.id)}
                    tone="lose"
                  >
                    <div className="border-l-2 border-rose-500 pl-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">
                          <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                        </div>
                        {item.vendor.dataConfidence !== "verified" && <EvidenceDepthBadge depth={item.vendor.evidenceDepth ?? 0} />}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">{item.reason}</div>
                    </div>
                  </VendorTrendHover>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <Panel title="Biggest market movers" action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated change"} provenance={provenance.source} reason={provenance.reason} />}>
            <div className="space-y-3">
              {dashboard.weeklyMovers.slice(0, 6).map((item) => {
                const status = marketMoverStatus(item.changePct);
                return (
                  <div key={`${item.vendor.id}_${item.reason}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">
                        <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                      </span>
                      <span className={`font-mono text-sm ${status === "gaining" ? "text-emerald-700 dark:text-emerald-300" : status === "declining" ? "text-rose-700 dark:text-rose-300" : "text-[#5b6b7f] dark:text-[#8fa5bb]"}`}>
                        {item.changePct > 0 ? "+" : ""}{item.changePct}% {status}
                      </span>
                    </div>
                    <div className="text-xs leading-5 text-[#5d6b80] dark:text-[#a7bacd]">{item.reason}</div>
                    {item.vendor.dataConfidence !== "verified" && (
                      <div className="mt-1"><EvidenceDepthBadge depth={item.vendor.evidenceDepth ?? 0} /></div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Market share by category" action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Seed estimate"} provenance={provenance.source} reason={provenance.reason} />}>
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {dashboard.categoryShare.slice(0, 10).map((category) => (
                <div key={category.category.id}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">{category.category.name}</div>
                  <div className="space-y-2">
                    {category.leaders.map(({ vendor, estimate }) => (
                      <div key={`${category.category.id}_${vendor.id}`}>
                        <div className="flex items-center justify-between gap-3 text-sm dark:text-[#d8e2ec]">
                          <span className="inline-flex items-center gap-1.5">
                            <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} />
                            {vendor.dataConfidence === "seed" && <EvidenceDepthBadge depth={vendor.evidenceDepth ?? 0} />}
                          </span>
                          <span className="font-mono">{estimate.estimatedShare}%</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ece3cb] dark:bg-[#143049]">
                            <div className="h-full rounded-full bg-[#b08d2f] dark:bg-emerald-400" style={{ width: `${Math.max(2, Math.min(100, estimate.estimatedShare))}%` }} />
                          </div>
                          <span className="text-[11px] text-[#5b6b7f] dark:text-[#8fa5bb]">conf {estimate.confidence}</span>
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
          <Panel title="Agentic AI momentum" action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}>
            <div className="space-y-4">
              {dashboard.agenticMomentum.slice(0, 5).map((item) => (
                <div key={item.vendor.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-[#475a72] dark:text-[#c2d1e0]">
                      <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                    </span>
                    <span className="uppercase text-[#5b6b7f] dark:text-[#8fa5bb]">{momentumStatus(item.momentum.momentumScore)}</span>
                  </div>
                  <ScoreBar value={item.momentum.momentumScore} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Enterprise risk radar" action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}>
            <div className="space-y-3">
              {dashboard.riskAlerts.slice(0, 5).map((item) => (
                <div key={item.vendor.id} className="rounded-md bg-[#faf8f1] px-3 py-2 dark:bg-amber-950/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                    </span>
                    <span className="text-xs uppercase text-[#8a5b2d] dark:text-amber-300">{item.severity}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#5f665a] dark:text-[#a7bacd]">{item.alert}</div>
                  <div className="mt-1"><Confidence value={item.confidence} /></div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Sector-specific leaders" action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}>
            <div className="space-y-4">
              {dashboard.sectorLeaders.slice(0, 5).map((sector) => (
                <div key={sector.industry}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">{sector.industry}</div>
                  <div className="mt-2 space-y-2">
                    {sector.vendors.slice(0, 3).map((item) => (
                      <div key={item.vendor.id} className="flex items-center justify-between gap-3 text-sm dark:text-[#d8e2ec]">
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
          <Panel title="Recent major news" action={<SeedDataBadge label={provenance.source === "live" ? "Live news" : "Seed news"} provenance={provenance.source} reason={provenance.reason} />}>
            <div className="divide-y divide-[#efe9d9] dark:divide-[#1d3a57]">
              {dashboard.majorNews.map((item) => (
                <Link key={item.id} href="/news" className="block py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-[#13294b] dark:text-[#eef3f8]">{item.title}</div>
                    <span className="font-mono text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">{item.impactScore}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#5d6b80] dark:text-[#a7bacd]">{item.whyItMatters}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SeedDataBadge label={item.sourceKind === "real" ? "Source linked" : "Seed item"} provenance={item.sourceKind === "real" ? "live" : "seed"} />
                    <Confidence value={item.confidenceScore} />
                    {item.categories.slice(0, 2).map((category) => (
                      <span key={category} className="text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">{category}</span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-5 rounded-lg border border-[#e6dcc3] bg-[#f3ead2] p-4 dark:border-[#1d3a57] dark:bg-[#071827]">
          <EstimatedNote />
        </div>
      </main>
    </AppShell>
  );
}
