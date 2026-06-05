// Demonstrate tab — market ratification on a vendor shortlist.
//
// This page is the final step of the QUAD buyer journey: after Assess
// produces a shortlist, Demonstrate gathers third-party proof points
// (reputation, analyst signals, news, customer references) so the buyer
// can defend the shortlist against peers.
//
// Accepts ?vendors=id1,id2,... (slug or id). Falls back to the full
// reputation universe when no shortlist is supplied so the page is
// still useful for browsing.
//
// Sections in render order:
//   1. Shortlist summary (vendors being demonstrated)
//   2. Reputation pillars (developer / employee / customer signals)
//   3. Recent news mentions for the shortlist
//   4. Workflow / industry / region / cost-sensitivity merits

import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel, ScoreBar, SeedDataBadge } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import {
  listNewsItems,
  listIntelligenceVendors,
  listVendorMomentum,
  listVendorPillarScores,
} from "@/lib/intelligence/repository";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import {
  REPUTATION_VENDOR_IDS,
  CUSTOMER_REPUTATION,
  DEVELOPER_REPUTATION,
  EMPLOYEE_REPUTATION,
} from "@/lib/reputation/seed";
import ReputationTabs from "../reputation/ReputationTabs";
import VendorUptakeExplorer from "@/components/demonstrate/VendorUptakeExplorer";
import TokenPricingTable from "@/components/demonstrate/TokenPricingTable";
import RestoreShortlistBanner from "@/components/demonstrate/RestoreShortlistBanner";
import { pricingForVendorIds } from "@/lib/model-inventory/token-pricing";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    vendors?: string;
    industries?: string;
    useCases?: string;
    region?: string;
    dataSensitivity?: string;
    costSensitivity?: string;
  }>;
}

export default async function DemonstratePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const shortlistKeys = (params.vendors ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const industries = (params.industries ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const useCases = (params.useCases ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const region = params.region ?? "";
  const dataSensitivity = params.dataSensitivity ?? "";
  const costSensitivity = params.costSensitivity ?? "";

  const [news, vendors, momentum, pillarScores, provenance] = await Promise.all([
    listNewsItems(),
    listIntelligenceVendors(),
    listVendorMomentum(),
    listVendorPillarScores(),
    getDataProvenance(),
  ]);

  // Resolve shortlist keys against id OR slug.
  const byId = new Map(vendors.map((v) => [v.id, v]));
  const bySlug = new Map(vendors.map((v) => [v.slug, v]));
  const shortlistVendors = shortlistKeys.length > 0
    ? shortlistKeys.map((k) => byId.get(k) ?? bySlug.get(k)).filter((v): v is NonNullable<typeof v> => Boolean(v))
    : [];
  const shortlistIds = new Set(shortlistVendors.map((v) => v.id));

  // Reputation tables are seeded only for REPUTATION_VENDOR_IDS — restrict
  // the rows to that intersection so DeveloperTable/EmployeeTable/CustomerTable
  // never see a vendor without seeded rows (which would crash on .map).
  const reputationUniverse = new Set(REPUTATION_VENDOR_IDS);
  const reputationIds = shortlistVendors.length > 0
    ? shortlistVendors.map((v) => v.id).filter((id) => reputationUniverse.has(id))
    : REPUTATION_VENDOR_IDS;
  const reputationRows = reputationIds.map((id) => ({
    id,
    name: byId.get(id)?.name ?? id,
    slug: byId.get(id)?.slug ?? id,
    ownershipType: byId.get(id)?.ownershipType,
  }));
  // When the shortlist has zero overlap with the reputation universe,
  // fall back to the full set so the page still renders useful proof points.
  const reputationRowsToRender = reputationRows.length > 0 ? reputationRows : REPUTATION_VENDOR_IDS.map((id) => ({
    id,
    name: byId.get(id)?.name ?? id,
    slug: byId.get(id)?.slug ?? id,
    ownershipType: byId.get(id)?.ownershipType,
  }));

  // Filter news to shortlist when present, otherwise show top of stream.
  // NewsItem.vendors is an array of vendor IDs the story relates to.
  const filteredNews = shortlistIds.size > 0
    ? news.filter((n) => n.vendors.some((vid) => shortlistIds.has(vid)))
    : news.slice(0, 8);

  const momentumByVendor = new Map(momentum.map((m) => [m.vendorId, m]));
  const pillarsByVendor = new Map<string, typeof pillarScores>();
  for (const p of pillarScores) {
    const list = pillarsByVendor.get(p.vendorId) ?? [];
    list.push(p);
    pillarsByVendor.set(p.vendorId, list);
  }

  const seedCount = filteredNews.filter((n) => n.sourceKind !== "real").length;
  const liveCount = filteredNews.length - seedCount;

  return (
    <PageFrame
      title="Demonstrate"
      kicker="Market ratification on your shortlist"
      description="Defend your shortlist against peers. Pulls third-party proof points — developer, employee, and customer reputation, classified news, and pillar-by-pillar merits — for the vendors selected in Assess. Pass ?vendors=slug-a,slug-b in the URL (Assess writes this for you) to scope every panel to your shortlist."
    >
      {/* Restore-shortlist banner — client component that reads
          sessionStorage and offers a one-click restore when the user
          navigated here from the top nav without URL params. */}
      <RestoreShortlistBanner hasUrlShortlist={shortlistVendors.length > 0} />

      {/* Section 1 — shortlist summary */}
      <div className="mb-6">
        <Panel title={shortlistVendors.length > 0 ? `Shortlist (${shortlistVendors.length})` : "No shortlist set — showing full universe"}>
          {shortlistVendors.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {shortlistVendors.map((v) => (
                  <span key={v.id} className="rounded-full border border-[#cfd7c8] bg-[#eef2e8] px-3 py-1 text-xs font-medium text-[#18201b] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                    {v.name}
                  </span>
                ))}
              </div>
              <div className="grid gap-3 text-xs text-[#5f685a] sm:grid-cols-2 lg:grid-cols-5">
                <div><strong className="text-[#18201b]">Industries:</strong> {industries.length > 0 ? industries.join(", ") : "—"}</div>
                <div><strong className="text-[#18201b]">Use cases:</strong> {useCases.length > 0 ? useCases.join(", ") : "—"}</div>
                <div><strong className="text-[#18201b]">Region:</strong> {region || "—"}</div>
                <div><strong className="text-[#18201b]">Data sensitivity:</strong> {dataSensitivity || "—"}</div>
                <div><strong className="text-[#18201b]">Cost sensitivity:</strong> {costSensitivity || "—"}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#4d574b]">
              Run an assessment in <Link href="/assess" className="underline font-semibold">Assess</Link> to
              generate a shortlist, then return here to ratify it against the market.
              Or browse the full reputation universe below.
            </p>
          )}
        </Panel>
      </div>

      {/* Section 1b — Vendor uptake explorer (industry × region × company size) */}
      <div id="uptake" className="mb-8">
        <Panel title="AI vendor uptake — by industry, region & company size">
          <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
            Dynamic share-of-named-vendor-usage across 5 regions × 9 industries × 13 vendors,
            with an optional large-enterprise vs SME re-weighting. Aggregated from May 2026
            research (Menlo Ventures, Ramp AI Index, Enlyft/Similarweb/Apptopia). Use this to
            defend your shortlist with quantitative peer-cohort context: &quot;in BFSI North America
            Large-Enterprise, Anthropic leads by share — here&apos;s the cut.&quot;
          </p>
          <VendorUptakeExplorer />
        </Panel>
      </div>

      {/* Section 1c — Token pricing comparison */}
      <div id="pricing" className="mb-8">
        <Panel title="Token pricing — list price per 1M tokens">
          <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
            Side-by-side input / output / blended list pricing across the tracked frontier and
            enterprise models. Sort any column, filter by tier, and flex the input:output mix to
            match your workload. The cheapest blended row is flagged. Use this to defend the
            commercial case for your shortlist — but remember list price is the ceiling, not the
            negotiated rate.
          </p>
          {(() => {
            // Scope to the shortlist when at least one shortlisted vendor
            // actually has token pricing (frontier-model vendors do; pure
            // app vendors like ServiceNow don't). Otherwise show the full
            // table so the section is never empty.
            const scoped = shortlistIds.size > 0 ? pricingForVendorIds([...shortlistIds]) : [];
            const useScoped = scoped.length > 0;
            return (
              <TokenPricingTable
                rows={useScoped ? scoped : undefined}
                scopedLabel={
                  useScoped
                    ? shortlistVendors.map((v) => v.name).join(", ")
                    : undefined
                }
              />
            );
          })()}
        </Panel>
      </div>

      {/* Section 2 — reputation pillars */}
      <div id="reputation" className="mb-8">
        <div className="mb-3">
          <OwnershipLegend />
        </div>
        <Panel title="Three-pillar reputation (developer · employee · customer)">
          <p className="mb-3 text-xs leading-5 text-[#5f685a]">
            Public-source reputation across the three constituencies that ratify a vendor's market
            standing. Developer signals from GitHub, Reddit, HackerNews. Employee signals from
            Glassdoor, LinkedIn, tribunal filings. Customer signals from G2, Capterra, TrustRadius,
            status-page archives.
          </p>
          <ReputationTabs
            vendors={reputationRowsToRender}
            developer={DEVELOPER_REPUTATION}
            employee={EMPLOYEE_REPUTATION}
            customer={CUSTOMER_REPUTATION}
          />
        </Panel>
      </div>

      {/* Section 3 — merits per shortlist vendor */}
      {shortlistVendors.length > 0 && (
        <div className="mb-8">
          <Panel title="Pillar merits across your shortlist">
            <p className="mb-3 text-xs leading-5 text-[#5f685a]">
              Side-by-side pillar scores so you can defend why each vendor made the shortlist.
              Higher scores = stronger evidence against the named pillar.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#dfe4da] text-left text-xs uppercase tracking-wide text-[#5f685a]">
                    <th className="py-2 pr-3">Vendor</th>
                    <th className="py-2 pr-3">Momentum</th>
                    <th className="py-2 pr-3">Top pillars</th>
                    <th className="py-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {shortlistVendors.map((v) => {
                    const mom = momentumByVendor.get(v.id);
                    const pillars = (pillarsByVendor.get(v.id) ?? [])
                      .slice()
                      .sort((a, b) => b.capabilityScore - a.capabilityScore)
                      .slice(0, 3);
                    return (
                      <tr key={v.id} className="border-b border-[#edf0ea]/60 align-top">
                        <td className="py-3 pr-3"><VendorNameWithOwnership name={v.name} ownershipType={v.ownershipType} /></td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24"><ScoreBar value={mom?.momentumScore ?? 50} /></div>
                            <span className="text-xs font-semibold text-[#18201b]">{(mom?.momentumScore ?? 50).toFixed(0)}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <ul className="space-y-1 text-xs">
                            {pillars.length > 0 ? pillars.map((p) => (
                              <li key={p.pillar} className="flex items-center justify-between gap-2">
                                <span className="text-[#4d574b]">{p.pillar}</span>
                                <span className="font-semibold text-[#18201b]">{p.capabilityScore.toFixed(0)}</span>
                              </li>
                            )) : <li className="text-[#5f685a]">no pillar data</li>}
                          </ul>
                        </td>
                        <td className="py-3">
                          {mom ? <Confidence value={mom.confidence} /> : <span className="text-xs text-[#5f685a]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* Section 4 — news mentions */}
      <div id="news">
        {seedCount > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex flex-wrap items-center gap-2">
              <SeedDataBadge
                label={liveCount === 0 ? "All items are seed" : `${seedCount} seed · ${liveCount} live`}
                provenance={liveCount > 0 ? "live" : "seed"}
                reason={provenance.reason}
              />
              <span>
                {liveCount === 0
                  ? "Every story below is illustrative seed copy until verified evidence is promoted."
                  : `${liveCount} stor${liveCount === 1 ? "y is" : "ies are"} source-backed; the rest are seed.`}
              </span>
            </div>
          </div>
        )}
        <Panel title={shortlistIds.size > 0 ? "Shortlist news mentions" : "Recent news intelligence"}>
          {filteredNews.length === 0 ? (
            <p className="text-sm text-[#5f685a]">No recent news for the shortlist.</p>
          ) : (
            <div className="divide-y divide-[#edf0ea]">
              {filteredNews.map((item) => {
                const primaryVendorId = item.vendors[0];
                const vendor = primaryVendorId ? byId.get(primaryVendorId) : null;
                return (
                  <article key={item.id} className="grid gap-4 py-5 lg:grid-cols-[1fr_180px]">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        {item.categories.map((c) => (
                          <span key={c} className="rounded bg-[#eef2e8] px-2 py-1 text-xs text-[#455044]">{c}</span>
                        ))}
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-[#18201b]">{item.title}</h2>
                      {vendor && (
                        <p className="mt-1 text-xs text-[#5f685a]">
                          <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} />
                        </p>
                      )}
                      <p className="mt-2 text-sm leading-6 text-[#4d574b]">{item.summary}</p>
                      <p className="mt-2 text-sm leading-6 text-[#596151]">
                        <strong>Why it matters:</strong> {item.whyItMatters}
                      </p>
                    </div>
                    <div className="space-y-2 text-xs text-[#5f685a] lg:text-right">
                      <div><Confidence value={item.confidenceScore} /></div>
                      {item.publishedAt && (
                        <div>{new Date(item.publishedAt).toLocaleDateString()}</div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </PageFrame>
  );
}
