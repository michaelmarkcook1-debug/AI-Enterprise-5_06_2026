// Assess tab — assess vendors against your specific needs.
//
// Consolidates the previously separate /assessment fit-form, the
// /briefings executive synthesis, the dashboard enterprise-risk radar,
// and the /watchlists monitoring setup into one decision-grade page.
// Sections in render order:
//   1. Executive briefing summary (board-ready synthesis)
//   2. Who's winning / losing / watchlist (briefing extracts)
//   3. Enterprise risk radar (vendor-level risk alerts)
//   4. AI platform fit assessment form (Quick / Guided / Advanced)
//   5. Watchlists & alerts (ongoing monitoring setup)
// Force-dynamic so the briefing reflects the latest refresh.

import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import DataSourceRail from "@/components/data-source-rail";
import { Confidence, Panel, SeedDataBadge } from "@/components/intelligence-ui";
import { VendorNameWithOwnership } from "@/components/ownership-indicator";
import { generateWeeklyBriefing } from "@/lib/intelligence/briefings";
import {
  getMarketDashboard,
  listIntelligenceVendors,
  listWatchlists,
} from "@/lib/intelligence/repository";
import { listVendorProfiles } from "@/lib/repositories/vendor-profiles";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import { INDUSTRIES, archetypeOf } from "@/lib/industries";
import { PRIMARY_OBJECTIVES, ECOSYSTEMS, workflowsForTier } from "@/lib/use-cases";
import { parseTier } from "@/lib/assessment/tiers";
import AnalystInsight from "@/components/analyst-insight";
import { assessInsight } from "@/lib/insights/tab-insights";
import AssessForm from "./AssessForm";
import TierBar from "../assessment/TierBar";
import { WatchlistManager } from "../watchlists/WatchlistManager";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tier?: string }>;
}

export default async function AssessPage({ searchParams }: PageProps) {
  const { tier: tierParam } = await searchParams;
  const tier = parseTier(tierParam);
  const [brief, vendorProfiles, dashboard, provenance, watchlists, vendors] = await Promise.all([
    generateWeeklyBriefing(),
    listVendorProfiles(),
    getMarketDashboard(),
    getDataProvenance(),
    listWatchlists(),
    listIntelligenceVendors(),
  ]);

  return (
    <PageFrame
      aside={<DataSourceRail tab="assess" />}
      title="Assess"
      kicker="What should your organisation deploy?"
      description="Three assessment tiers: Opportunity (where should we start?), Strategy (what should we deploy?), and Procurement (should we buy this?). Each tier scores vendors against your industry, workflows, risk profile, governance, and budget — with results flowing directly into Demonstrate for board defence."
    >
      {/* The former executive-briefing panel moved to the top of Query as the
          market overview (12 Jun 2026); the confidence-note panel was deleted.
          Assess now opens directly on its primary action: the assessment form. */}
      <AnalystInsight paragraph={assessInsight({
        vendorCount: vendorProfiles.length,
        watchlists: watchlists.length,
        riskAlerts: dashboard.riskAlerts.length,
        highSeverity: dashboard.riskAlerts.filter((a) => a.severity === "high").length,
      })} />

      {/* 1. Assessment form — FIRST so the primary action is immediately reachable */}
      <section id="fit" className="mb-8">
        <Panel title="Choose your assessment">
          <p className="mb-4 text-sm text-[#475a72] dark:text-[#b9c8d9]">
            Select the assessment that matches your decision stage. Opportunity identifies where
            to start. Strategy recommends what to deploy. Procurement scores whether to buy.
            All three use the AnalystGenius proprietary scoring engine with evidence grading.
          </p>
          <TierBar current={tier} />
          <AssessForm
            tier={tier}
            industries={Object.values(INDUSTRIES).map((i) => ({ id: i.id, name: i.name }))}
            useCases={workflowsForTier(tier).map((u) => {
              // Resolve each workflow's engine archetypes (direct + via 15-tag
              // roll-up) so the client can tailor the picker to the selected
              // industry. Empty array = horizontal (shown to everyone).
              const resolved = new Set<string>(u.archetypes ?? []);
              for (const t of u.industries ?? []) {
                const a = archetypeOf(t);
                if (a) resolved.add(a);
              }
              return {
                id: u.id,
                label: u.label,
                category: u.category,
                subcategory: u.subcategory,
                description: u.description,
                archetypes: Array.from(resolved),
              };
            })}
            objectives={PRIMARY_OBJECTIVES}
            ecosystems={ECOSYSTEMS}
            vendors={vendorProfiles.map((v) => ({ id: v.id, name: v.name, category: v.category, ownershipType: v.ownership }))}
          />
        </Panel>
      </section>

      {/* 2. Market context — collapsible so it doesn't block the form on return visits */}
      <details className="group mb-6">
        <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-[#e6dcc3] bg-white px-4 py-3 text-sm font-semibold text-[#13294b] hover:bg-[#faf5e9] dark:border-[#1d3a57] dark:bg-[#0c2238] dark:text-[#eef3f8] dark:hover:bg-[#143049]">
          <span>Market context — briefing &amp; risk signals</span>
          <span className="ml-2 font-normal text-[#5b6b7f] dark:text-[#8fa5bb] text-xs group-open:hidden">▼ expand</span>
          <span className="ml-2 font-normal text-[#5b6b7f] dark:text-[#8fa5bb] text-xs hidden group-open:inline">▲ collapse</span>
        </summary>
        <div className="mt-2 space-y-5">
          {/* Winning / losing / watchlist */}
          <section className="grid gap-5 lg:grid-cols-3">
            <Panel title="Who is winning">
              <ul className="space-y-2 text-sm leading-6 text-[#475a72] dark:text-[#b9c8d9]">
                {brief.whoIsWinning.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </Panel>
            <Panel title="Who is losing">
              <ul className="space-y-2 text-sm leading-6 text-[#475a72] dark:text-[#b9c8d9]">
                {brief.whoIsLosing.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </Panel>
            <Panel title="Watchlist & risk (briefing)">
              <ul className="space-y-2 text-sm leading-6 text-[#475a72] dark:text-[#b9c8d9]">
                {brief.riskWatch.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </Panel>
          </section>

          {/* Enterprise risk radar */}
          <section id="risk">
            <Panel
              title="Enterprise risk radar"
              action={<SeedDataBadge label={provenance.source === "live" ? "Live model" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {dashboard.riskAlerts.map((item) => (
                  <div key={item.vendor.id} className="rounded-md bg-[#faf8f1] px-3 py-2 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                      </span>
                      <span className={`text-xs uppercase ${item.severity === "high" ? "text-rose-700 dark:text-rose-300" : item.severity === "medium" ? "text-amber-700 dark:text-amber-300" : "text-[#5b6b7f] dark:text-[#a7bacd]"}`}>
                        {item.severity}
                      </span>
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[#5f665a] dark:text-[#a7bacd]">{item.alert}</div>
                    <div className="mt-1"><Confidence value={item.confidence} /></div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        </div>
      </details>

      {/* 3. Watchlists & alerts */}
      <section id="watchlists" className="mb-2">
        <Panel title="Watchlists & alerts (monitoring setup)">
          <p className="mb-4 text-xs leading-5 text-[#56657b] dark:text-[#a7bacd]">
            Create watchlists for vendors, industries, capability areas, risks, news types, market
            share movement, and regulation. Alerts are mock/generated in the MVP.
          </p>
          <WatchlistManager
            initialWatchlists={watchlists}
            vendorOptions={vendors.map((vendor) => ({
              id: vendor.id,
              name: vendor.name,
              ownershipType: vendor.ownershipType,
            }))}
          />
        </Panel>
      </section>

      {/* Next actions */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link href="/understand" className="rounded-md border border-[#d6c9a8] px-3 py-2 font-semibold hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:hover:bg-[#0c2238]">← Research vendors</Link>
        <Link href="/demonstrate" className="rounded-md border border-[#d6c9a8] px-3 py-2 font-semibold hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:hover:bg-[#0c2238]">Defend decision →</Link>
        <Link href="/monitor" className="rounded-md border border-[#d6c9a8] px-3 py-2 font-semibold hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:hover:bg-[#0c2238]">Monitor decisions →</Link>
      </div>
    </PageFrame>
  );
}
