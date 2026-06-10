// Understand — what is this vendor and where does it fit?
// ───────────────────────────────────────────────────────
// The definitive AI vendor intelligence layer. Answers:
// "What is this vendor and where does it fit in the AI ecosystem?"
//
// Sections in render order:
//   0. Quick access — AI Atlas + Leadership Matrix
//   1. AI Ecosystem Navigator (public→private linkage)
//   2. Coverage overview
//   3. Data sources / connector health
//   4. Capability matrix
//   5. Strategic intelligence (sustainability, encroachment, dependency, optionality)
//   6. Vendor universe
//   7. Methodology

import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel, ScoreBar } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import UnderstandTabs from "@/components/understand/UnderstandTabs";
import ExposureMapHero from "@/components/dashboard/ExposureMapHero";
import {
  listCapabilities,
  listIntelligenceVendors,
  listVendorCapabilities,
  listVendorMomentum,
} from "@/lib/intelligence/repository";
import {
  capabilityRenderState,
  isInfrastructureOnlyVendor,
  summariseCapabilityOverview,
  type CapabilityRenderState,
} from "@/lib/intelligence/capabilities-truthfulness";
import { listConnectorHealth } from "@/lib/connectors/registry";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import { strategicScores } from "@/lib/intelligence/strategic-scores";
import AnalystInsight from "@/components/analyst-insight";
import CollapsiblePanel from "@/components/collapsible-panel";
import TrendSpark from "@/components/trend-spark";
import { getRankingHistories } from "@/lib/intelligence/ranking-snapshots";
import { understandInsight } from "@/lib/insights/tab-insights";
import { SeedDataBadge } from "@/components/intelligence-ui";
import { isRankable } from "@/lib/intelligence/roles";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ view?: string; vendor?: string; pillar?: string }>;
}

export default async function UnderstandPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [
    capabilities,
    vendorCapabilities,
    vendors,
    momentum,
    connectors,
    provenance,
  ] = await Promise.all([
    listCapabilities(),
    listVendorCapabilities(),
    listIntelligenceVendors(),
    listVendorMomentum(),
    Promise.resolve(listConnectorHealth()),
    getDataProvenance(),
  ]);

  const vendorsRanked = [...vendors].sort((a, b) => b.overallScore - a.overallScore);
  // Role-aware: strategic/ranked tables assess AI products only — exclude
  // investors and pure hardware/fabs (they remain in the full universe catalog
  // and on the market-map surfaces).
  const rankableVendors = vendorsRanked.filter(isRankable);
  const byKey = new Map(vendorCapabilities.map((item) => [`${item.vendorId}_${item.capabilityId}`, item]));
  const allStates: CapabilityRenderState[] = vendorsRanked.flatMap((vendor) =>
    capabilities.map((cap) =>
      capabilityRenderState(byKey.get(`${vendor.id}_${cap.id}`), {
        isInfrastructureOnly: isInfrastructureOnlyVendor(vendor.id),
      }),
    ),
  );
  const overview = summariseCapabilityOverview(vendorsRanked.length, capabilities.length, allStates);
  const momentumByVendor = new Map(momentum.map((m) => [m.vendorId, m]));

  const configuredConnectors = connectors.filter((c) => c.configured).length;
  const totalConnectors = connectors.length;

  const histories = await getRankingHistories(vendors, momentum);

  // Analyst insight — computed from the same strategic scores the page renders
  const insightScores = rankableVendors.slice(0, 12).map((v) => {
    const mom = momentumByVendor.get(v.id);
    const { sustainability, encroachment } = strategicScores(v, mom?.momentumScore ?? 50);
    return { vendor: v, sustainability, encroachment };
  });
  const insightAvg = insightScores.length > 0 ? Math.round(insightScores.reduce((s, x) => s + x.sustainability, 0) / insightScores.length) : 0;
  const insightDurable = [...insightScores].sort((a, b) => b.sustainability - a.sustainability)[0];
  const insightRisk = [...insightScores].sort((a, b) => b.encroachment - a.encroachment)[0];
  const insightSpread = insightScores.length > 0 ? Math.max(...insightScores.map((x) => x.sustainability)) - Math.min(...insightScores.map((x) => x.sustainability)) : 0;
  const insightParagraph = understandInsight({
    vendorCount: insightScores.length,
    avgSustainability: insightAvg,
    mostDurable: insightDurable ? { name: insightDurable.vendor.name, sustainability: insightDurable.sustainability } : null,
    highestRisk: insightRisk ? { name: insightRisk.vendor.name, encroachment: insightRisk.encroachment } : null,
    spread: insightSpread,
  });

  return (
    <PageFrame
      title="Understand"
      kicker="What is this vendor and where does it fit?"
      description="The definitive AI vendor intelligence layer — capability matrix, strategic sustainability, platform encroachment risk, dependency analysis, vendor viability, and the methodology backbone. Understand every vendor's position, defensibility, and risk profile before you assess."
    >
      <AnalystInsight paragraph={insightParagraph} />

      <div className="mb-5">
        <OwnershipLegend />
      </div>

      {/* 0. Quick access — AI Atlas. (The former "Vendor Leadership Matrix" 2×2 was
          retired 10 Jun 2026: composite scoring for multi-category vendors must not
          render as a rank or quadrant.) */}
      <section className="mb-6 grid gap-4">
        <Link
          href="/atlas"
          className="group rounded-xl border border-[#dfe4da] bg-white p-5 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Interactive</div>
          <div className="mt-1 text-lg font-semibold text-[#18201b] dark:text-zinc-100">AI Ecosystem Navigator</div>
          <p className="mt-1 text-xs text-[#5f685a] dark:text-zinc-400">
            Full interactive ecosystem map — who backs whom, who hosts whom, where risk concentrates. Click to explore.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 transition-colors group-hover:text-emerald-800 dark:text-emerald-400 dark:group-hover:text-emerald-300">
            Open Atlas →
          </span>
        </Link>
      </section>

      {/* 0.5 Strategic Sustainability Overview */}
      <section className="mb-6">
        <Panel title="Strategic sustainability overview">
          <p className="mb-3 text-xs text-[#5f685a] dark:text-zinc-400">
            Aggregate view of vendor defensibility across the tracked universe. Identifies which vendors have durable advantages and which face disruption risk.
          </p>
          {(() => {
            const top12 = rankableVendors.slice(0, 12);
            const scores = top12.map((v) => {
              const mom = momentumByVendor.get(v.id);
              const { sustainability, encroachment } = strategicScores(v, mom?.momentumScore ?? 50);
              return { vendor: v, sustainability, encroachment };
            });
            const avgSus = scores.length > 0 ? Math.round(scores.reduce((s, x) => s + x.sustainability, 0) / scores.length) : 0;
            const highestSus = [...scores].sort((a, b) => b.sustainability - a.sustainability)[0];
            const highestRisk = [...scores].sort((a, b) => b.encroachment - a.encroachment)[0];
            return (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-[#dfe4da] p-3 dark:border-zinc-800">
                  <div className="text-[10px] uppercase tracking-wider text-[#697362]">Avg sustainability</div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-[#18201b] dark:text-zinc-100">{avgSus}/100</div>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Most durable</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-800 dark:text-emerald-200">{highestSus?.vendor.name ?? "—"}</div>
                  <div className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">Sustainability: {highestSus?.sustainability ?? 0}</div>
                </div>
                <div className="rounded-md border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/60 dark:bg-rose-950/20">
                  <div className="text-[10px] uppercase tracking-wider text-rose-700 dark:text-rose-300">Highest disruption risk</div>
                  <div className="mt-1 text-sm font-semibold text-rose-800 dark:text-rose-200">{highestRisk?.vendor.name ?? "—"}</div>
                  <div className="text-[10px] text-rose-700/70 dark:text-rose-300/70">Encroachment: {highestRisk?.encroachment ?? 0}</div>
                </div>
              </div>
            );
          })()}
          <SeedDataBadge label="Estimated" provenance="seed" reason="Sustainability scores computed from seed pillar data." />
        </Panel>
      </section>

      {/* 1. AI Ecosystem Navigator (public→private linkage snapshot) */}
      <section id="exposure" className="mb-8">
        <Panel title="AI Ecosystem Navigator (public → private linkage)">
          <p className="mb-3 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
            Hover a logo to highlight its dependencies. Click to pin (up to 3). Filter by
            relationship type or confidence. Every edge is publicly source-backed — seed-confidence
            edges render dashed and require independent verification.
          </p>
          <ExposureMapHero />
        </Panel>
      </section>

      {/* 2. Coverage overview */}
      <section className="mb-6">
        <CollapsiblePanel title="Capability coverage overview" summary={`${capabilities.length} capabilities tracked`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Vendors" value={overview.totalVendors} note="tracked" />
            <Stat label="Capabilities" value={overview.capabilitiesTracked} note="tracked" />
            <Stat label="Verified" value={overview.cellsVerified} tone="ok" note={`${pct(overview.cellsVerified, overview.cellsTotal)}%`} />
            <Stat label="Documented" value={overview.cellsDocumented} tone="ok" note={`${pct(overview.cellsDocumented, overview.cellsTotal)}%`} />
            <Stat label="Seed" value={overview.cellsSeed} tone="warn" note={`${pct(overview.cellsSeed, overview.cellsTotal)}%`} />
            <Stat label="Stale" value={overview.cellsStale} tone="warn" />
            <Stat label="Validation required" value={overview.cellsValidationRequired} tone="bad" />
            <Stat label="Disputed" value={overview.cellsDisputed} tone="bad" />
            <Stat label="Unknown" value={overview.cellsUnknown} tone="bad" />
            <Stat label="Infrastructure-only" value={overview.cellsInfrastructureOnly} tone="neutral" />
          </div>
        </CollapsiblePanel>
      </section>

      {/* 3. Data sources / connector health */}
      <section className="mb-6">
        <CollapsiblePanel title="Data sources backing this surface" summary={"provenance register"}>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="text-xs leading-5 text-[#596151] dark:text-zinc-400">
                <strong>{configuredConnectors}/{totalConnectors}</strong> connectors configured ·{" "}
                <strong>{provenance.evidenceCount}</strong> verified evidence rows ·{" "}
                <strong>{provenance.approvedProposalCount}</strong> approved proposals
              </p>
              <p className="mt-1 text-[11px] italic text-[#697362] dark:text-zinc-500">{provenance.reason}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href="/admin/data-sources" className="rounded-full border border-[#dfe4da] bg-white px-3 py-1 font-semibold text-[#18201b] hover:bg-[#eef2e8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
                Connector status →
              </Link>
              <Link href="/admin/ingestion" className="rounded-full border border-[#dfe4da] bg-white px-3 py-1 font-semibold text-[#18201b] hover:bg-[#eef2e8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
                Run ingestion →
              </Link>
              <Link href="/admin/evidence" className="rounded-full border border-[#dfe4da] bg-white px-3 py-1 font-semibold text-[#18201b] hover:bg-[#eef2e8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
                Approve evidence →
              </Link>
            </div>
          </div>
        </CollapsiblePanel>
      </section>

      {/* 4. Capability matrix + sub-tabs */}
      <section id="capabilities" className="mb-8">
        <UnderstandTabs
          initialView={params.view || "matrix"}
          selectedVendor={params.vendor}
          selectedPillar={params.pillar}
        />
      </section>

      {/* 5. Strategic Intelligence — new scores from the implementation pack */}
      <section id="strategic" className="mb-8">
        <Panel title="Strategic vendor intelligence">
          <p className="mb-2 text-xs text-[#5f685a] dark:text-zinc-400">
            Strategic sustainability, platform encroachment risk, dependency risk, and optionality
            for the top tracked vendors. These scores are derived from existing pillar scores,
            momentum, market position, and ecosystem data.
          </p>
          <SeedDataBadge label="Estimated" provenance="seed" reason="Strategic scores are computed from seed pillar data. Will refine as live evidence deepens." />
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#dfe4da] text-left text-[10px] uppercase tracking-wide text-[#5f685a]">
                  <th className="py-2 pr-3">Vendor</th>
                  <th className="py-2 pr-3">Trend</th>
                  <th className="py-2 pr-3 text-right">Sustainability</th>
                  <th className="py-2 pr-3 text-right">Encroachment risk</th>
                  <th className="py-2 pr-3 text-right">Dependency risk</th>
                  <th className="py-2 pr-3 text-right">Optionality</th>
                  <th className="py-2 text-right">Viability</th>
                </tr>
              </thead>
              <tbody>
                {rankableVendors.slice(0, 12).map((vendor) => {
                  const mom = momentumByVendor.get(vendor.id);
                  // All five scores from the single canonical module —
                  // formulas live in lib/intelligence/strategic-scores.ts
                  const { sustainability, encroachment, dependency, optionality, viability } =
                    strategicScores(vendor, mom?.momentumScore ?? 50);

                  const riskTone = (v: number) => v >= 60 ? "text-rose-700 dark:text-rose-300" : v >= 35 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300";
                  const scoreTone = (v: number) => v >= 70 ? "text-emerald-700 dark:text-emerald-300" : v >= 45 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300";

                  return (
                    <tr key={vendor.id} className="border-b border-[#edf0ea]/60">
                      <td className="py-2.5 pr-3">
                        <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} />
                      </td>
                      <td className="py-2.5 pr-3">
                        {(() => {
                          const h = histories.get(vendor.id);
                          return h && h.points.length >= 2 ? (
                            <TrendSpark
                              label={`${vendor.name} — overall score`}
                              points={h.points.map((pt) => ({ date: pt.date, value: pt.score }))}
                            />
                          ) : <span className="text-[10px] text-[#8a948a]">accumulating</span>;
                        })()}
                      </td>
                      <td className={`py-2.5 pr-3 text-right font-mono font-semibold ${scoreTone(sustainability)}`}>{sustainability}</td>
                      <td className={`py-2.5 pr-3 text-right font-mono font-semibold ${riskTone(encroachment)}`}>{encroachment}</td>
                      <td className={`py-2.5 pr-3 text-right font-mono font-semibold ${riskTone(dependency)}`}>{dependency}</td>
                      <td className={`py-2.5 pr-3 text-right font-mono font-semibold ${scoreTone(optionality)}`}>{optionality}</td>
                      <td className={`py-2.5 text-right font-mono font-semibold ${scoreTone(viability)}`}>{viability}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-3 text-[11px] text-[#5f685a] dark:text-zinc-400 md:grid-cols-2 lg:grid-cols-3">
            <div><strong>Sustainability:</strong> Likelihood the vendor&apos;s advantage remains defensible over 6–24 months.</div>
            <div><strong>Encroachment risk:</strong> Risk that a frontier model or hyperscaler absorbs the vendor&apos;s differentiation.</div>
            <div><strong>Dependency risk:</strong> Exposure to model, cloud, GPU, or platform dependencies.</div>
            <div><strong>Optionality:</strong> Whether adopting this vendor increases or reduces future flexibility.</div>
            <div><strong>Viability:</strong> Vendor health — funding, revenue maturity, customer base, delivery record.</div>
          </div>
        </Panel>
      </section>

      {/* 6. Vendor universe */}
      <section id="vendors" className="mb-8">
        <CollapsiblePanel title="Vendor universe — ranked by overall score" summary={`${rankableVendors.length} vendors`}>
          <div className="divide-y divide-[#edf0ea] dark:divide-zinc-800">
            {vendorsRanked.map((vendor, index) => {
              const mom = momentumByVendor.get(vendor.id);
              return (
                <Link
                  key={vendor.id}
                  href={`/vendors/${vendor.slug}`}
                  className="grid gap-4 py-4 md:grid-cols-[36px_1fr_160px_160px] md:items-center"
                >
                  <div className="font-mono text-sm text-[#697362]">{index + 1}</div>
                  <div>
                    <div className="text-base font-semibold text-[#18201b] dark:text-zinc-100">
                      <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} compactBadge={false} />
                    </div>
                    <div className="mt-1 text-sm text-[#596151] dark:text-zinc-400">{vendor.category} · {vendor.marketPosition}</div>
                    <div className="mt-2 text-xs leading-5 text-[#66705f] dark:text-zinc-500">{vendor.description}</div>
                  </div>
                  <div>
                    <ScoreBar label="Overall" value={vendor.overallScore} />
                  </div>
                  <div className="md:text-right">
                    <Confidence value={vendor.confidenceScore} />
                    <div className="mt-2 text-xs text-[#66705f] dark:text-zinc-500">Momentum {mom?.momentumScore ?? 0}/100</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CollapsiblePanel>
      </section>

      {/* 7. Methodology */}
      <section id="methodology" className="mb-2">
        <CollapsiblePanel title="Methodology — Enterprise AI Assessment Framework v2.0" summary={"weights, evidence grades, scoring rubric"}>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">Six pillars (default weights)</h3>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-zinc-700 dark:text-zinc-300">
                <li>Business Fit — 15%</li>
                <li>Enterprise Control — 25%</li>
                <li>Reliability &amp; Safety — 15%</li>
                <li>Integration &amp; Operations — 15%</li>
                <li>Vendor Resilience — 15%</li>
                <li>Market Strength — 15%</li>
              </ul>
              <p className="mt-3 text-xs italic text-zinc-600 dark:text-zinc-400">
                Pillar weights shift dynamically by industry, data sensitivity, risk tolerance,
                autonomy appetite and budget sensitivity.
              </p>

              <h3 className="mt-6 text-sm font-semibold text-[#18201b] dark:text-zinc-100">Risk engine</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                Fatal blockers exclude vendors in incompatible contexts. Severe / moderate risks
                apply penalties scaled by the user&apos;s risk tolerance. Industry-critical control
                areas with no E3+ evidence trigger severe risk (or fatal in regulated industries).
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">Evidence grading (E0–E5)</h3>
              <div className="mt-2 grid grid-cols-1 gap-1 text-sm">
                {[
                  ["E0", "0.0", "No evidence"],
                  ["E1", "0.4", "Vendor claim only"],
                  ["E2", "0.6", "Public documentation"],
                  ["E3", "0.75", "Public test / sandbox / API verification"],
                  ["E4", "0.9", "Production customer evidence"],
                  ["E5", "1.0", "Independent audit / verified benchmark"],
                ].map(([g, m, d]) => (
                  <div key={g} className="grid grid-cols-12 border-b border-zinc-100 py-1.5 dark:border-zinc-800">
                    <div className="col-span-2 font-mono">{g}</div>
                    <div className="col-span-2">×{m}</div>
                    <div className="col-span-8 text-zinc-600 dark:text-zinc-400">{d}</div>
                  </div>
                ))}
              </div>

              <h3 className="mt-6 text-sm font-semibold text-[#18201b] dark:text-zinc-100">Final score formula</h3>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-900">{`Final Score =
  Σ(Pillar Score × Dynamic Context Weight × Evidence Confidence)
  + Strategic Fit Bonus
  + Sector Adoption Fit Bonus
  − Risk Penalties
  − Missing Evidence Penalty
  − Adoption Friction Penalty`}</pre>
            </div>
          </div>
        </CollapsiblePanel>
      </section>

      {/* Next actions */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link href="/query" className="rounded-md border border-[#cfd7c8] px-3 py-2 font-semibold hover:bg-[#eef2e8] dark:border-zinc-700 dark:hover:bg-zinc-900">← Market intelligence</Link>
        <Link href="/assess" className="rounded-md border border-[#cfd7c8] px-3 py-2 font-semibold hover:bg-[#eef2e8] dark:border-zinc-700 dark:hover:bg-zinc-900">Assess your needs →</Link>
        <Link href="/atlas" className="rounded-md border border-[#cfd7c8] px-3 py-2 font-semibold hover:bg-[#eef2e8] dark:border-zinc-700 dark:hover:bg-zinc-900">Open AI Atlas →</Link>
      </div>
    </PageFrame>
  );
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return "0";
  return ((numerator / denominator) * 100).toFixed(0);
}

function Stat({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  note?: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "bad"
      ? "text-rose-700 dark:text-rose-300"
      : "text-[#18201b] dark:text-zinc-100";
  return (
    <div className="rounded-md border border-[#dfe4da] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#697362] dark:text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${toneClass}`}>{value}</div>
      {note && <div className="text-[10px] text-[#697362] dark:text-zinc-500">{note}</div>}
    </div>
  );
}
