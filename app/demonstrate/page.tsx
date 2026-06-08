// Demonstrate — CIO Board Defence Module (Pack 02 detailed build).
// ─────────────────────────────────────────────────────────────────
// 13 board-defence sections structured around the questions the board,
// CFO, procurement, audit, and risk committee will ask.

import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel, ScoreBar, SeedDataBadge } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import {
  listNewsItems,
  listIntelligenceVendors,
  listVendorMomentum,
  listVendorPillarScores,
  getMarketDashboard,
} from "@/lib/intelligence/repository";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import {
  REPUTATION_VENDOR_IDS,
  CUSTOMER_REPUTATION,
  DEVELOPER_REPUTATION,
  EMPLOYEE_REPUTATION,
} from "@/lib/reputation/seed";
import {
  SEED_BUSINESS_CASE,
  SEED_COMPETITOR_PROFILES,
  SEED_ENTERPRISE_RISKS,
  SEED_RISK_MITIGATIONS,
  SEED_KPIS,
  SEED_BOARD_ASSUMPTIONS,
} from "@/lib/decision-intelligence/seed";
import { riskColor, statusColor } from "@/lib/decision-intelligence/types";
import type { DecisionStatus } from "@/lib/decision-intelligence/types";
import ReputationTabs from "../reputation/ReputationTabs";
import { fetchLiveGitHubSignals, mergeGitHubIntoReputation } from "@/lib/reputation/live-github";
import VendorUptakeExplorer from "@/components/demonstrate/VendorUptakeExplorer";
import TokenPricingTable from "@/components/demonstrate/TokenPricingTable";
import RestoreShortlistBanner from "@/components/demonstrate/RestoreShortlistBanner";
import BoardPackExporter from "@/components/demonstrate/BoardPackExporter";
import { pricingForVendorIds } from "@/lib/model-inventory/token-pricing";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    vendors?: string; industries?: string; useCases?: string;
    region?: string; dataSensitivity?: string; costSensitivity?: string;
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

  const [news, vendors, momentum, pillarScores, provenance, dashboard, liveGithub] = await Promise.all([
    listNewsItems(), listIntelligenceVendors(), listVendorMomentum(),
    listVendorPillarScores(), getDataProvenance(), getMarketDashboard(),
    fetchLiveGitHubSignals().catch(() => []),
  ]);

  // Merge live GitHub stats into seed developer reputation
  const liveDeveloperReputation = mergeGitHubIntoReputation(DEVELOPER_REPUTATION, liveGithub);

  const byId = new Map(vendors.map((v) => [v.id, v]));
  const bySlug = new Map(vendors.map((v) => [v.slug, v]));
  const shortlistVendors = shortlistKeys.length > 0
    ? shortlistKeys.map((k) => byId.get(k) ?? bySlug.get(k)).filter((v): v is NonNullable<typeof v> => Boolean(v))
    : [];
  const shortlistIds = new Set(shortlistVendors.map((v) => v.id));
  const momentumByVendor = new Map(momentum.map((m) => [m.vendorId, m]));
  const pillarsByVendor = new Map<string, typeof pillarScores>();
  for (const p of pillarScores) { const l = pillarsByVendor.get(p.vendorId) ?? []; l.push(p); pillarsByVendor.set(p.vendorId, l); }

  const reputationUniverse = new Set(REPUTATION_VENDOR_IDS);
  const reputationIds = shortlistVendors.length > 0 ? shortlistVendors.map((v) => v.id).filter((id) => reputationUniverse.has(id)) : REPUTATION_VENDOR_IDS;
  const reputationRows = reputationIds.map((id) => ({ id, name: byId.get(id)?.name ?? id, slug: byId.get(id)?.slug ?? id, ownershipType: byId.get(id)?.ownershipType }));
  const reputationRowsToRender = reputationRows.length > 0 ? reputationRows : REPUTATION_VENDOR_IDS.map((id) => ({ id, name: byId.get(id)?.name ?? id, slug: byId.get(id)?.slug ?? id, ownershipType: byId.get(id)?.ownershipType }));

  const filteredNews = shortlistIds.size > 0 ? news.filter((n) => n.vendors.some((vid) => shortlistIds.has(vid))) : news.slice(0, 8);

  // Scores
  const hasShortlist = shortlistVendors.length > 0;
  const cioConfidence = hasShortlist ? Math.round(shortlistVendors.reduce((s, v) => s + v.overallScore * 0.4 + v.confidenceScore * 0.3 + (momentumByVendor.get(v.id)?.momentumScore ?? 50) * 0.3, 0) / shortlistVendors.length) : 0;
  const defenceDimensions = [hasShortlist, industries.length > 0, useCases.length > 0, reputationRows.length > 0, filteredNews.length > 0, true].filter(Boolean).length;
  const boardDefenceScore = Math.round((defenceDimensions / 6) * 100);
  const decisionStatus: DecisionStatus = cioConfidence >= 70 ? "Defensible" : cioConfidence >= 55 ? "Defensible with Conditions" : cioConfidence >= 40 ? "Pilot First" : cioConfidence > 0 ? "Reassess" : "Reassess";

  return (
    <PageFrame
      title="Demonstrate"
      kicker="How do you defend this decision to the board?"
      description="The CIO Board Defence module. Structure your AI investment case around the questions the board, CFO, procurement, audit, and risk committee will ask."
    >
      <RestoreShortlistBanner hasUrlShortlist={hasShortlist} />

      {/* Executive Defence Summary */}
      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <ScoreCard label="Board Defence Score" value={boardDefenceScore} sub={`${defenceDimensions}/6 dimensions`} tone="sky" />
        <ScoreCard label="CIO Confidence Score" value={hasShortlist ? cioConfidence : null} sub="Vendor quality + evidence + momentum" tone="emerald" />
        <div className="rounded-xl border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#697362]">Recommendation</div>
          <div className={`mt-1 text-lg font-semibold ${statusColor(decisionStatus)}`}>{hasShortlist ? decisionStatus : "—"}</div>
        </div>
        <div className="rounded-xl border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#697362]">Shortlist</div>
          <div className="mt-1 text-sm font-semibold text-[#18201b] dark:text-zinc-100">{hasShortlist ? shortlistVendors.map((v) => v.name).join(", ") : "Not set"}</div>
          <div className="mt-1 text-[10px] text-[#697362]">{industries.join(", ") || "All industries"} · {region || "Global"}</div>
        </div>
      </section>
      <SeedDataBadge label="Estimated" provenance="seed" reason="Scores derived from seed data. Board Defence Score measures case completeness." />

      <div className="mt-6 space-y-3">
        {/* 1. Why invest? */}
        <BS title="Why are we investing?" open>
          <Panel title="Business case">
            <div className="grid gap-4 md:grid-cols-2">
              <div><div className="text-[10px] uppercase tracking-wider text-[#697362]">Business problem</div><p className="mt-1 text-sm leading-6 text-[#4d574b]">{SEED_BUSINESS_CASE.businessProblem}</p></div>
              <div><div className="text-[10px] uppercase tracking-wider text-[#697362]">Intended outcomes</div><ul className="mt-1 space-y-1 text-sm text-[#4d574b]">{SEED_BUSINESS_CASE.intendedOutcomes.map((o) => <li key={o} className="flex gap-2"><span className="text-emerald-600">·</span>{o}</li>)}</ul></div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4 text-xs">
              <div className="rounded-md border border-[#dfe4da] p-3 dark:border-zinc-800"><strong>Productivity:</strong> {SEED_BUSINESS_CASE.productivityImpact}</div>
              <div className="rounded-md border border-[#dfe4da] p-3 dark:border-zinc-800"><strong>Cost reduction:</strong> {SEED_BUSINESS_CASE.costReductionPotential}</div>
              <div className="rounded-md border border-[#dfe4da] p-3 dark:border-zinc-800"><strong>Revenue:</strong> {SEED_BUSINESS_CASE.revenuePotential}</div>
              <div className="rounded-md border border-[#dfe4da] p-3 dark:border-zinc-800"><strong>CX/EX:</strong> {SEED_BUSINESS_CASE.cxExImpact}</div>
            </div>
            <SeedDataBadge label="Estimated" provenance="seed" reason="Business case is a template. Customise with organisation-specific data." />
          </Panel>
        </BS>

        {/* 2. Why now? */}
        <BS title="Why now?">
          <Panel title="Cost of inaction">
            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <div className="rounded-md border border-[#dfe4da] p-3 dark:border-zinc-800"><strong>Competitive gap:</strong> Peers adopting AI see 15–30% productivity gains within 12 months.</div>
              <div className="rounded-md border border-[#dfe4da] p-3 dark:border-zinc-800"><strong>Technology timing:</strong> Enterprise AI platforms maturing rapidly — delaying increases switching cost.</div>
              <div className="rounded-md border border-[#dfe4da] p-3 dark:border-zinc-800"><strong>Talent window:</strong> AI-skilled workforce increasingly scarce — early movers secure better talent.</div>
            </div>
            <SeedDataBadge label="Estimated" provenance="seed" reason="Industry benchmark estimates, not client-specific." />
          </Panel>
        </BS>

        {/* 3. Why these vendors? */}
        <BS title="Why these vendors?">
          {hasShortlist ? (
            <Panel title="Vendor selection defence">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b border-[#dfe4da] text-left text-xs uppercase tracking-wide text-[#5f685a]">
                    <th className="py-2 pr-3">Vendor</th><th className="py-2 pr-3">Momentum</th><th className="py-2 pr-3">Top pillars</th><th className="py-2">Confidence</th>
                  </tr></thead>
                  <tbody>{shortlistVendors.map((v) => {
                    const mom = momentumByVendor.get(v.id);
                    const pillars = (pillarsByVendor.get(v.id) ?? []).slice().sort((a, b) => b.capabilityScore - a.capabilityScore).slice(0, 3);
                    return (<tr key={v.id} className="border-b border-[#edf0ea]/60 align-top">
                      <td className="py-3 pr-3"><VendorNameWithOwnership name={v.name} ownershipType={v.ownershipType} /></td>
                      <td className="py-3 pr-3"><div className="flex items-center gap-2"><div className="w-24"><ScoreBar value={mom?.momentumScore ?? 50} /></div><span className="text-xs font-semibold">{(mom?.momentumScore ?? 50).toFixed(0)}</span></div></td>
                      <td className="py-3 pr-3"><ul className="space-y-1 text-xs">{pillars.length > 0 ? pillars.map((p) => <li key={p.pillar} className="flex justify-between gap-2"><span>{p.pillar}</span><span className="font-semibold">{p.capabilityScore.toFixed(0)}</span></li>) : <li className="text-[#5f685a]">—</li>}</ul></td>
                      <td className="py-3">{mom ? <Confidence value={mom.confidence} /> : <span className="text-xs text-[#5f685a]">—</span>}</td>
                    </tr>);
                  })}</tbody>
                </table>
              </div>
            </Panel>
          ) : <Panel title="Vendor selection"><p className="text-sm text-[#4d574b]">Run an assessment in <Link href="/assess" className="underline font-semibold">Assess</Link> to populate.</p></Panel>}
        </BS>

        {/* 4. What are competitors doing? */}
        <BS title="What are competitors doing?">
          <Panel title="Competitor adoption intelligence">
            <div className="space-y-3">
              {SEED_COMPETITOR_PROFILES.map((c) => (
                <div key={c.peer} className="rounded-lg border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{c.peer}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${c.maturity === "Advanced" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : c.maturity === "Scaling" ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"}`}>{c.maturity}</span>
                  </div>
                  <div className="mt-2 text-xs text-[#5f685a]"><strong>Use cases:</strong> {c.useCases.join(", ")}</div>
                  <div className="mt-1 text-xs text-[#5f685a]"><strong>Known vendors:</strong> {c.knownVendors.join(", ")}</div>
                  <div className="mt-2 text-xs font-medium text-[#18201b] dark:text-zinc-100"><strong>CIO implication:</strong> {c.implication}</div>
                </div>
              ))}
            </div>
            <SeedDataBadge label="Estimated" provenance="seed" reason="Peer adoption profiles are industry estimates, not verified intelligence." />
          </Panel>
          <div className="mt-3" id="uptake"><Panel title="Peer adoption — vendor uptake"><VendorUptakeExplorer /></Panel></div>
        </BS>

        {/* 5. Market sentiment */}
        <BS title="What is market sentiment?">
          <div id="reputation"><OwnershipLegend /><div className="mt-3"><Panel title="Three-pillar reputation"><ReputationTabs vendors={reputationRowsToRender} developer={liveDeveloperReputation} employee={EMPLOYEE_REPUTATION} customer={CUSTOMER_REPUTATION} /></Panel></div></div>
        </BS>

        {/* 6. What could go wrong? */}
        <BS title="What could go wrong?">
          <Panel title="Enterprise risk register">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-[#dfe4da] text-left text-[10px] uppercase tracking-wide text-[#5f685a]">
                  <th className="py-2 pr-3">Risk</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Severity</th><th className="py-2 pr-3">Likelihood</th><th className="py-2 pr-3">Mitigation</th><th className="py-2">Owner</th>
                </tr></thead>
                <tbody>{SEED_ENTERPRISE_RISKS.map((r) => (
                  <tr key={r.id} className="border-b border-[#edf0ea]/60 align-top">
                    <td className="py-2 pr-3 text-xs font-medium">{r.risk}</td>
                    <td className="py-2 pr-3 text-xs text-[#697362]">{r.category}</td>
                    <td className={`py-2 pr-3 text-xs font-semibold ${riskColor(r.severity)}`}>{r.severity}</td>
                    <td className={`py-2 pr-3 text-xs font-semibold ${riskColor(r.likelihood)}`}>{r.likelihood}</td>
                    <td className="py-2 pr-3 text-xs text-[#5f685a] max-w-[250px]">{r.mitigation}</td>
                    <td className="py-2 text-xs text-[#697362]">{r.owner}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <SeedDataBadge label="Estimated" provenance="seed" reason="Risk register is a template. Customise severity and likelihood for your context." />
          </Panel>
        </BS>

        {/* 7. How are risks mitigated? */}
        <BS title="How are risks mitigated?">
          <Panel title="Risk mitigation controls">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {SEED_RISK_MITIGATIONS.map((m) => (
                <div key={m.control} className="rounded-md border border-[#dfe4da] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{m.control}</span>
                    <span className={`text-[10px] font-semibold uppercase ${m.status === "Recommended" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{m.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#5f685a] dark:text-zinc-400">{m.description}</p>
                </div>
              ))}
            </div>
          </Panel>
        </BS>

        {/* 8. What does it cost? */}
        <BS title="What does it cost?">
          <div id="pricing"><Panel title="Token pricing — list price per 1M tokens">
            {(() => { const scoped = shortlistIds.size > 0 ? pricingForVendorIds([...shortlistIds]) : []; return <TokenPricingTable rows={scoped.length > 0 ? scoped : undefined} scopedLabel={scoped.length > 0 ? shortlistVendors.map((v) => v.name).join(", ") : undefined} />; })()}
          </Panel></div>
        </BS>

        {/* 9. How will success be measured? */}
        <BS title="How will success be measured?">
          <Panel title="Value realisation KPIs">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-[#dfe4da] text-left text-[10px] uppercase tracking-wide text-[#5f685a]">
                  <th className="py-2 pr-3">Metric</th><th className="py-2 pr-3">Baseline</th><th className="py-2 pr-3">Target</th><th className="py-2 pr-3">Owner</th><th className="py-2 pr-3">Cadence</th><th className="py-2">Method</th>
                </tr></thead>
                <tbody>{SEED_KPIS.map((k) => (
                  <tr key={k.metric} className="border-b border-[#edf0ea]/60">
                    <td className="py-2 pr-3 text-xs font-medium">{k.metric}</td>
                    <td className="py-2 pr-3 text-xs text-[#697362]">{k.baseline}</td>
                    <td className="py-2 pr-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{k.target}</td>
                    <td className="py-2 pr-3 text-xs text-[#697362]">{k.owner}</td>
                    <td className="py-2 pr-3 text-xs text-[#697362]">{k.cadence}</td>
                    <td className="py-2 text-xs text-[#697362]">{k.method}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <SeedDataBadge label="Estimated" provenance="seed" reason="KPIs are templates. Populate with your organisation's baseline data." />
          </Panel>
        </BS>

        {/* 10. Will this decision age well? */}
        <BS title="Will this decision age well?">
          <Panel title="Decision sustainability">
            <p className="mb-3 text-sm text-[#4d574b]">Track whether this recommendation holds over time via the <Link href="/monitor" className="font-semibold underline">Monitor tab</Link>.</p>
            <div className="grid gap-3 md:grid-cols-2 text-xs">
              <div className="rounded-md border border-[#dfe4da] p-3 dark:border-zinc-800"><strong>Assumption monitoring:</strong> {SEED_BOARD_ASSUMPTIONS.length} assumptions tracked. {SEED_BOARD_ASSUMPTIONS.filter((a) => a.status === "Watch" || a.status === "At Risk").length} require attention.</div>
              <div className="rounded-md border border-[#dfe4da] p-3 dark:border-zinc-800"><strong>Reassessment triggers:</strong> Automatic alerts when vendor momentum drops, regulation emerges, or assumptions weaken.</div>
            </div>
          </Panel>
        </BS>

        {/* 11. What assumptions must remain true? */}
        <BS title="What assumptions must remain true?">
          <Panel title="Assumption monitor">
            <div className="space-y-3">
              {SEED_BOARD_ASSUMPTIONS.map((a) => (
                <div key={a.id} className="rounded-lg border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{a.title}</div>
                      <div className="mt-1 text-xs text-[#5f685a]"><strong>Failure trigger:</strong> {a.failureTrigger}</div>
                      <div className="mt-1 text-xs text-[#5f685a]"><strong>Current signal:</strong> {a.currentSignal}</div>
                      <div className="mt-1 text-xs text-[#5f685a]"><strong>Action:</strong> {a.recommendedAction}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${a.status === "Stable" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : a.status === "Watch" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200" : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"}`}>{a.status}</span>
                  </div>
                </div>
              ))}
            </div>
            <SeedDataBadge label="Estimated" provenance="seed" reason="Assumptions are curated examples. Will populate from stored assessments." />
          </Panel>
        </BS>

        {/* 12. Latest signals */}
        <BS title="What are the latest signals?">
          <div id="news"><Panel title={shortlistIds.size > 0 ? "Shortlist news" : "Recent intelligence"}>
            {filteredNews.length === 0 ? <p className="text-sm text-[#5f685a]">No recent news.</p> : (
              <div className="divide-y divide-[#edf0ea]">{filteredNews.slice(0, 6).map((item) => (
                <article key={item.id} className="py-4">
                  <div className="flex flex-wrap gap-2">{item.categories.slice(0, 3).map((c) => <span key={c} className="rounded bg-[#eef2e8] px-2 py-0.5 text-[10px] text-[#455044]">{c}</span>)}</div>
                  <h3 className="mt-2 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs text-[#4d574b]">{item.whyItMatters}</p>
                  <div className="mt-2 flex gap-3 text-[10px] text-[#697362]"><Confidence value={item.confidenceScore} /><span>Impact: {item.impactScore}</span></div>
                </article>
              ))}</div>
            )}
          </Panel></div>
        </BS>
      </div>

      {/* Board Pack Generator */}
      <section className="mt-6 mb-2">
        <Panel title="Board pack generator">
          <BoardPackExporter
            boardDefenceScore={boardDefenceScore}
            cioConfidenceScore={hasShortlist ? cioConfidence : 0}
            recommendation={hasShortlist ? decisionStatus : "No shortlist selected"}
            businessCase={SEED_BUSINESS_CASE}
            vendors={shortlistVendors.map((v) => {
              const mom = momentumByVendor.get(v.id);
              const pills = (pillarsByVendor.get(v.id) ?? []).slice().sort((a, b) => b.capabilityScore - a.capabilityScore).slice(0, 3);
              return {
                name: v.name,
                role: v.category ?? "Enterprise AI",
                score: v.overallScore,
                confidence: mom?.confidence ?? v.confidenceScore,
                topPillars: pills.map((p) => p.pillar),
                risks: (v.riskProfile ?? []).slice(0, 2),
              };
            })}
            competitors={SEED_COMPETITOR_PROFILES}
            risks={SEED_ENTERPRISE_RISKS}
            mitigations={SEED_RISK_MITIGATIONS}
            assumptions={SEED_BOARD_ASSUMPTIONS}
            kpis={SEED_KPIS}
          />
        </Panel>
      </section>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link href="/assess" className="rounded-md border border-[#cfd7c8] px-3 py-2 font-semibold hover:bg-[#eef2e8] dark:border-zinc-700 dark:hover:bg-zinc-900">← Run new assessment</Link>
        <Link href="/monitor" className="rounded-md border border-[#cfd7c8] px-3 py-2 font-semibold hover:bg-[#eef2e8] dark:border-zinc-700 dark:hover:bg-zinc-900">Monitor decisions →</Link>
      </div>
    </PageFrame>
  );
}

function BS({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="group" open={open}>
      <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-[#dfe4da] bg-white px-4 py-3 text-sm font-semibold text-[#18201b] hover:bg-[#f5f7f2] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
        <span>{title}</span>
        <span className="ml-2 font-normal text-[#697362] text-xs group-open:hidden">▼</span>
        <span className="ml-2 font-normal text-[#697362] text-xs hidden group-open:inline">▲</span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function ScoreCard({ label, value, sub, tone }: { label: string; value: number | null; sub: string; tone: "emerald" | "sky" | "amber" }) {
  const border = tone === "emerald" ? "border-emerald-200 dark:border-emerald-900/60" : tone === "sky" ? "border-sky-200 dark:border-sky-900/60" : "border-amber-200 dark:border-amber-900/60";
  const bg = tone === "emerald" ? "bg-emerald-50 dark:bg-emerald-950/30" : tone === "sky" ? "bg-sky-50 dark:bg-sky-950/30" : "bg-amber-50 dark:bg-amber-950/30";
  const text = tone === "emerald" ? "text-emerald-700 dark:text-emerald-300" : tone === "sky" ? "text-sky-700 dark:text-sky-300" : "text-amber-700 dark:text-amber-300";
  const textSub = tone === "emerald" ? "text-emerald-800/70 dark:text-emerald-300/70" : tone === "sky" ? "text-sky-800/70 dark:text-sky-300/70" : "text-amber-800/70 dark:text-amber-300/70";
  return (
    <div className={`rounded-xl border ${border} ${bg} p-4`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${text}`}>{label}</div>
      <div className={`mt-1 font-mono text-3xl font-semibold ${text}`}>{value !== null ? value : "—"}</div>
      <div className={`mt-1 text-[10px] ${textSub}`}>{sub}</div>
    </div>
  );
}
