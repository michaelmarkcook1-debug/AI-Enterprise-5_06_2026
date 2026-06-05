// Query tab — overview of the AI market and who is winning.
//
// Consolidates the previously scattered /dashboard market-overview
// sections, the /market category-share + momentum tracker, and the
// /quadrant magic-quadrant chart into a single buyer-journey landing
// page. Sections in render order:
//   1. Top-line scorecard (tracked vendors, categories, signals, alerts)
//   2. AI Atlas (Enhance × Innovate, embedded chart)
//   3. Top enterprise AI platform vendors (ranked leaderboard)
//   4. Who's winning / Who's losing (momentum leaders + laggards)
//   5. Biggest market movers (share / momentum gainers + decliners)
//   6. Category market-share estimates (per-segment leaderboard)
//   7. Agentic AI momentum (with status indicator)
//   8. Sector-specific leaders (per-industry top-3)
//   9. Vendor momentum component breakdown (product · adoption · risk signals)
//   10. Commercial models card (pricing / licensing context)
//   11. Recent news intelligence stream
// Force-dynamic so the page reflects the latest daily-refresh output.

import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import {
  Confidence,
  EstimatedNote,
  Metric,
  Panel,
  ScoreBar,
  SeedDataBadge,
} from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import {
  getMarketDashboard,
  listIntelligenceVendors,
  listVendorMomentum,
} from "@/lib/intelligence/repository";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import { marketMoverStatus, momentumStatus } from "@/lib/intelligence/metrics";
import { buildQuadrantData } from "@/lib/intelligence/quadrant";
import QuadrantChart from "@/components/quadrant/QuadrantChart";
import CommercialModelsCard from "@/components/dashboard/CommercialModelsCard";
import VendorSharePie from "@/components/query/VendorSharePie";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ days?: string; executeCut?: string; visionCut?: string }>;
}

function parseNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export default async function QueryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const windowDays = parseNumber(params.days, 14, 1, 365);
  const executeCut = parseNumber(params.executeCut, 60, 1, 99);
  const visionCut = parseNumber(params.visionCut, 60, 1, 99);

  const [
    dashboard,
    provenance,
    vendors,
    momentum,
    quadrant,
  ] = await Promise.all([
    getMarketDashboard(),
    getDataProvenance(),
    listIntelligenceVendors(),
    listVendorMomentum(),
    buildQuadrantData({ windowDays, executeCut, visionCut }),
  ]);

  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const seenMomentumVendors = new Set<string>();
  const topMomentumRows: typeof momentum = [];
  for (const item of momentum.slice().sort((a, b) => b.momentumScore - a.momentumScore)) {
    if (seenMomentumVendors.has(item.vendorId) || !vendorById.has(item.vendorId)) continue;
    seenMomentumVendors.add(item.vendorId);
    topMomentumRows.push(item);
    if (topMomentumRows.length === 12) break;
  }

  return (
    <PageFrame
      title="Query"
      kicker="Overview the AI market and identify who's winning"
      description="Live market intelligence: tracked vendors, AI Atlas positioning, the executive leaderboard, momentum leaders and laggards, biggest movers, category share, agentic momentum, sector winners, and the classified news stream."
    >
      <div className="mb-5">
        <OwnershipLegend />
      </div>

      {/* 1. Top-line scorecard */}
      <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Tracked vendors" value={vendors.length} note="MVP universe" />
        <Metric label="Major signals" value={dashboard.majorNews.length} note="Seed news" />
        <Metric label="Risk radar" value={dashboard.riskAlerts.length} note="Estimated status" />
        <Metric label="Categories" value={dashboard.categoryShare.length} note="Category-specific share" />
      </section>

      {/* 1.5 Total AI vendor market share — pie chart */}
      <section className="mb-6">
        <Panel title="Total AI vendor market share">
          <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
            Share-of-named-vendor-usage aggregated across 5 regions × 9 industries × 13 vendors
            (May 2026 research basis: Menlo Ventures, Ramp AI Index, Enlyft / Similarweb / Apptopia).
            Drill down by industry / region / company size on the{" "}
            <a href="/demonstrate#uptake" className="font-semibold underline">Demonstrate tab</a>.
          </p>
          <VendorSharePie />
        </Panel>
      </section>

      {/* 2. AI Atlas */}
      <section className="mb-6">
        <Panel title="AI Atlas — Enhance × Innovate">
          <p className="mb-3 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
            Enhance folds in evidence depth, reliability, enterprise-control pillars, industry
            breadth, and risk drag. Innovate folds in momentum, business-fit, market-strength
            pillars, use-case breadth, and share drift. Arrows show movement since the prior
            snapshot.
          </p>
          <QuadrantChart data={quadrant} />
        </Panel>
      </section>

      {/* Sections 3–11 are collapsible so the page isn't overwhelming.
          The AI Atlas chart (above) is always visible as the anchor. */}
      <div className="space-y-3">

      {/* 3. Top vendors + 4. Who's winning / losing — two-column block */}
      <details className="group" open>
        <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-[#dfe4da] bg-white px-4 py-3 text-sm font-semibold text-[#18201b] hover:bg-[#f5f7f2] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
          <span>Vendor leaderboard &amp; momentum signals</span>
          <span className="ml-2 font-normal text-[#697362] text-xs group-open:hidden">▼ expand</span>
          <span className="ml-2 font-normal text-[#697362] text-xs hidden group-open:inline">▲ collapse</span>
        </summary>
        <div className="mt-2">
      <section className="mb-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Panel
          title="Top enterprise AI platform vendors"
          action={<Link className="text-xs text-[#2f5d50] hover:underline dark:text-emerald-300" href="/understand">View full universe →</Link>}
        >
          <div className="divide-y divide-[#edf0ea] dark:divide-zinc-800">
            {dashboard.topVendors.slice(0, 7).map((vendor, index) => (
              <Link key={vendor.id} href={`/vendors/${vendor.slug}`} className="grid grid-cols-[32px_1fr_120px] items-center gap-3 py-3">
                <div className="font-mono text-sm text-[#697362]">{index + 1}</div>
                <div>
                  <div className="font-medium text-[#18201b] dark:text-zinc-100">
                    <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} />
                  </div>
                  <div className="text-xs text-[#66705f] dark:text-zinc-500">{vendor.category} · {vendor.marketPosition}</div>
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
          <Panel
            title="Who's winning"
            action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}
          >
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
          <Panel
            title="Who's losing"
            action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}
          >
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
      </section>

        </div>
      </details>

      <details className="group">
        <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-[#dfe4da] bg-white px-4 py-3 text-sm font-semibold text-[#18201b] hover:bg-[#f5f7f2] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
          <span>Market movers &amp; category share</span>
          <span className="ml-2 font-normal text-[#697362] text-xs group-open:hidden">▼ expand</span>
          <span className="ml-2 font-normal text-[#697362] text-xs hidden group-open:inline">▲ collapse</span>
        </summary>
        <div className="mt-2">
      {/* 5. Market movers + 6. Category share */}
      <section className="mb-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel
          title="Biggest market movers"
          action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated change"} provenance={provenance.source} reason={provenance.reason} />}
        >
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

        <Panel
          title="Category market share estimates"
          action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Seed estimate"} provenance={provenance.source} reason={provenance.reason} />}
        >
          <EstimatedNote />
          <div className="mt-3 grid gap-x-8 gap-y-5 md:grid-cols-2">
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
      </section>

        </div>
      </details>

      <details className="group">
        <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-[#dfe4da] bg-white px-4 py-3 text-sm font-semibold text-[#18201b] hover:bg-[#f5f7f2] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
          <span>Agentic momentum &amp; sector leaders</span>
          <span className="ml-2 font-normal text-[#697362] text-xs group-open:hidden">▼ expand</span>
          <span className="ml-2 font-normal text-[#697362] text-xs hidden group-open:inline">▲ collapse</span>
        </summary>
        <div className="mt-2">
      {/* 7. Agentic momentum + 8. Sector leaders */}
      <section className="mb-6 grid gap-5 lg:grid-cols-2">
        <Panel
          title="Agentic AI momentum"
          action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}
        >
          <div className="space-y-4">
            {dashboard.agenticMomentum.slice(0, 6).map((item) => (
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

        <Panel
          title="Sector-specific leaders"
          action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}
        >
          <div className="space-y-4">
            {dashboard.sectorLeaders.slice(0, 6).map((sector) => (
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
      </section>

        </div>
      </details>

      <details className="group">
        <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-[#dfe4da] bg-white px-4 py-3 text-sm font-semibold text-[#18201b] hover:bg-[#f5f7f2] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
          <span>Momentum component breakdown</span>
          <span className="ml-2 font-normal text-[#697362] text-xs group-open:hidden">▼ expand</span>
          <span className="ml-2 font-normal text-[#697362] text-xs hidden group-open:inline">▲ collapse</span>
        </summary>
        <div className="mt-2">
      {/* 9. Momentum component breakdown */}
      <section className="mb-6">
        <Panel title="Vendor momentum — component breakdown (product velocity · adoption · risk)">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#dfe4da] text-left text-xs uppercase tracking-wide text-[#5f685a]">
                  <th className="py-2 pr-3">Vendor</th>
                  <th className="py-2 pr-3">Momentum</th>
                  <th className="py-2 pr-3">Product velocity</th>
                  <th className="py-2 pr-3">Adoption signal</th>
                  <th className="py-2 pr-3">Risk signal</th>
                  <th className="py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {topMomentumRows.map((m, index) => {
                    const vendor = vendorById.get(m.vendorId);
                    if (!vendor) return null;
                    return (
                      <tr key={`${m.vendorId}_${index}`} className="border-b border-[#edf0ea]/60">
                        <td className="py-2 pr-3"><VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} /></td>
                        <td className="py-2 pr-3 font-semibold text-[#18201b] dark:text-zinc-100">{m.momentumScore.toFixed(0)}</td>
                        <td className="py-2 pr-3">{m.productVelocity.toFixed(0)}</td>
                        <td className="py-2 pr-3">{m.adoptionSignal.toFixed(0)}</td>
                        <td className="py-2 pr-3">{m.riskSignal.toFixed(0)}</td>
                        <td className="py-2"><Confidence value={m.confidence} /></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

        </div>
      </details>

      <details className="group">
        <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-[#dfe4da] bg-white px-4 py-3 text-sm font-semibold text-[#18201b] hover:bg-[#f5f7f2] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
          <span>Commercial models</span>
          <span className="ml-2 font-normal text-[#697362] text-xs group-open:hidden">▼ expand</span>
          <span className="ml-2 font-normal text-[#697362] text-xs hidden group-open:inline">▲ collapse</span>
        </summary>
        <div className="mt-2">
      {/* 10. Commercial models */}
      <section className="mb-6">
        <CommercialModelsCard />
      </section>
        </div>
      </details>

      <details className="group">
        <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-[#dfe4da] bg-white px-4 py-3 text-sm font-semibold text-[#18201b] hover:bg-[#f5f7f2] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
          <span>Recent major news</span>
          <span className="ml-2 font-normal text-[#697362] text-xs group-open:hidden">▼ expand</span>
          <span className="ml-2 font-normal text-[#697362] text-xs hidden group-open:inline">▲ collapse</span>
        </summary>
        <div className="mt-2">
      {/* 11. Recent news */}
      <section className="mb-6">
        <Panel
          title="Recent major news"
          action={<SeedDataBadge label={provenance.source === "live" ? "Live news" : "Seed news"} provenance={provenance.source} reason={provenance.reason} />}
        >
          <div className="divide-y divide-[#edf0ea] dark:divide-zinc-800">
            {dashboard.majorNews.slice(0, 8).map((item) => (
              <Link key={item.id} href="/demonstrate#news" className="block py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#18201b] dark:text-zinc-100">{item.title}</div>
                  <span className="font-mono text-xs text-[#697362] dark:text-zinc-500">{item.impactScore}</span>
                </div>
                <div className="mt-1 text-xs leading-5 text-[#66705f] dark:text-zinc-400">{item.whyItMatters}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SeedDataBadge label={item.sourceKind === "real" ? "Source linked" : "Seed item"} provenance={item.sourceKind === "real" ? "live" : "seed"} />
                  <Confidence value={item.confidenceScore} />
                  {item.categories.slice(0, 2).map((category) => (
                    <span key={category} className="text-xs text-[#697362] dark:text-zinc-500">{category}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </section>

        </div>
      </details>

      </div>{/* end collapsible sections */}

      <div className="rounded-lg border border-[#dfe4da] bg-[#eef2e8] p-4 dark:border-zinc-800 dark:bg-[#071827]">
        <EstimatedNote />
      </div>
    </PageFrame>
  );
}
