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
import DataSourceRail from "@/components/data-source-rail";
import { Confidence, Panel, ScoreBar } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import CapabilityMatrix, { type MatrixCell } from "@/components/understand/CapabilityMatrix";
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

export default async function UnderstandPage() {
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
      aside={<DataSourceRail tab="understand" />}
      title="Understand"
      kicker="What is this vendor and where does it fit?"
      description="The definitive AI vendor intelligence layer — capability matrix, strategic sustainability, platform encroachment risk, dependency analysis, vendor viability, and the methodology backbone. Understand every vendor's position, defensibility, and risk profile before you assess."
    >
      <AnalystInsight paragraph={insightParagraph} />

      <div className="mb-5">
        <OwnershipLegend />
      </div>

      {/* 0. Strategic Sustainability Overview.
          (The standalone /atlas quick-access card was removed 12 Jun 2026 —
          the same ecosystem map is embedded right below as ExposureMapHero,
          so the extra route read as a meaningless duplicate tab.) */}
      <section className="mb-6">
        <Panel title="Strategic sustainability overview">
          <p className="mb-3 text-xs text-[#56657b] dark:text-[#a7bacd]">
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
                <div className="rounded-md border border-[#e6dcc3] p-3 dark:border-[#1d3a57]">
                  <div className="text-[10px] uppercase tracking-wider text-[#5b6b7f]">Avg sustainability</div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-[#13294b] dark:text-[#eef3f8]">{avgSus}/100</div>
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
          <p className="mb-3 text-xs leading-5 text-[#56657b] dark:text-[#a7bacd]">
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
              <p className="text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">
                <strong>{configuredConnectors}/{totalConnectors}</strong> connectors configured ·{" "}
                <strong>{provenance.evidenceCount}</strong> verified evidence rows ·{" "}
                <strong>{provenance.approvedProposalCount}</strong> approved proposals
              </p>
              <p className="mt-1 text-[11px] italic text-[#5b6b7f] dark:text-[#8fa5bb]">{provenance.reason}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href="/admin/data-sources" className="rounded-full border border-[#e6dcc3] bg-white px-3 py-1 font-semibold text-[#13294b] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8] dark:hover:bg-[#143049]">
                Connector status →
              </Link>
              <Link href="/admin/ingestion" className="rounded-full border border-[#e6dcc3] bg-white px-3 py-1 font-semibold text-[#13294b] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8] dark:hover:bg-[#143049]">
                Run ingestion →
              </Link>
              <Link href="/admin/evidence" className="rounded-full border border-[#e6dcc3] bg-white px-3 py-1 font-semibold text-[#13294b] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8] dark:hover:bg-[#143049]">
                Approve evidence →
              </Link>
            </div>
          </div>
        </CollapsiblePanel>
      </section>

      {/* 4. Capability matrix — REAL vendor universe, truthfulness-gated cells */}
      <section id="capabilities" className="mb-8">
        <Panel title="Capability matrix">
          <p className="mb-3 text-xs leading-5 text-[#56657b] dark:text-[#a7bacd]">
            Every rankable vendor against every tracked capability. Cells render a maturity
            score only when the evidence gate allows it — otherwise they state honestly why
            not (seed, stale, disputed, validation required, or not applicable).
          </p>
          {(() => {
            const matrixVendors = rankableVendors.map((v) => ({ id: v.id, name: v.name, category: v.category }));
            const matrixCaps = capabilities.map((c) => ({ id: c.id, name: c.name, category: c.category }));
            const cellMap: Record<string, MatrixCell> = {};
            for (const vendor of rankableVendors) {
              for (const cap of capabilities) {
                const vc = byKey.get(`${vendor.id}_${cap.id}`);
                const state = capabilityRenderState(vc, { isInfrastructureOnly: isInfrastructureOnlyVendor(vendor.id) });
                cellMap[`${vendor.id}_${cap.id}`] = {
                  mode: state.mode,
                  showScore: state.showScore,
                  score: Math.round(vc?.maturityScore ?? 0),
                  confidence: state.confidence,
                };
              }
            }
            return <CapabilityMatrix vendors={matrixVendors} capabilities={matrixCaps} cells={cellMap} />;
          })()}
        </Panel>
      </section>

      {/* 5. Strategic Intelligence — new scores from the implementation pack */}
      <section id="strategic" className="mb-8">
        <Panel title="Strategic vendor intelligence">
          <p className="mb-2 text-xs text-[#56657b] dark:text-[#a7bacd]">
            Strategic sustainability, platform encroachment risk, dependency risk, and optionality
            for the top tracked vendors. These scores are derived from existing pillar scores,
            momentum, market position, and ecosystem data.
          </p>
          <SeedDataBadge label="Estimated" provenance="seed" reason="Strategic scores are computed from seed pillar data. Will refine as live evidence deepens." />
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6dcc3] text-left text-[10px] uppercase tracking-wide text-[#56657b]">
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
                    <tr key={vendor.id} className="border-b border-[#efe9d9]/60">
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
                          ) : <span className="text-[10px] text-[#7e8a99]">accumulating</span>;
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
          <div className="mt-3 grid gap-3 text-[11px] text-[#56657b] dark:text-[#a7bacd] md:grid-cols-2 lg:grid-cols-3">
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
        {/* No displayed rank numbers: the order is a deterministic score sort for
            readability, but vendors are only RANKED within their own category /
            layer — a flat all-market position number would mislead. */}
        <CollapsiblePanel title="Vendor universe" summary={`${rankableVendors.length} vendors`}>
          <div className="divide-y divide-[#efe9d9] dark:divide-[#1d3a57]">
            {vendorsRanked.map((vendor) => {
              const mom = momentumByVendor.get(vendor.id);
              return (
                <Link
                  key={vendor.id}
                  href={`/vendors/${vendor.slug}`}
                  className="grid gap-4 py-4 md:grid-cols-[1fr_160px_160px] md:items-center"
                >
                  <div>
                    <div className="text-base font-semibold text-[#13294b] dark:text-[#eef3f8]">
                      <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} compactBadge={false} />
                    </div>
                    <div className="mt-1 text-sm text-[#54647a] dark:text-[#a7bacd]">{vendor.category} · {vendor.marketPosition}</div>
                    <div className="mt-2 text-xs leading-5 text-[#5d6b80] dark:text-[#8fa5bb]">{vendor.description}</div>
                  </div>
                  <div>
                    <ScoreBar label="Overall" value={vendor.overallScore} />
                  </div>
                  <div className="md:text-right">
                    <Confidence value={vendor.confidenceScore} />
                    <div className="mt-2 text-xs text-[#5d6b80] dark:text-[#8fa5bb]">Momentum {mom?.momentumScore ?? 0}/100</div>
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
              <h3 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Six pillars (default weights)</h3>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-[#2e3f57] dark:text-[#c2d1e0]">
                <li>Business Fit — 15%</li>
                <li>Enterprise Control — 25%</li>
                <li>Reliability &amp; Safety — 15%</li>
                <li>Integration &amp; Operations — 15%</li>
                <li>Vendor Resilience — 15%</li>
                <li>Market Strength — 15%</li>
              </ul>
              <p className="mt-3 text-xs italic text-[#3f5068] dark:text-[#a7bacd]">
                Pillar weights shift dynamically by industry, data sensitivity, risk tolerance,
                autonomy appetite and budget sensitivity.
              </p>

              <h3 className="mt-6 text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Risk engine</h3>
              <p className="mt-2 text-sm leading-6 text-[#2e3f57] dark:text-[#c2d1e0]">
                Fatal blockers exclude vendors in incompatible contexts. Severe / moderate risks
                apply penalties scaled by the user&apos;s risk tolerance. Industry-critical control
                areas with no E3+ evidence trigger severe risk (or fatal in regulated industries).
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Evidence grading (E0–E5)</h3>
              <div className="mt-2 grid grid-cols-1 gap-1 text-sm">
                {[
                  ["E0", "0.0", "No evidence"],
                  ["E1", "0.4", "Vendor claim only"],
                  ["E2", "0.6", "Public documentation"],
                  ["E3", "0.75", "Public test / sandbox / API verification"],
                  ["E4", "0.9", "Production customer evidence"],
                  ["E5", "1.0", "Independent audit / verified benchmark"],
                ].map(([g, m, d]) => (
                  <div key={g} className="grid grid-cols-12 border-b border-[#ece4d0] py-1.5 dark:border-[#1d3a57]">
                    <div className="col-span-2 font-mono">{g}</div>
                    <div className="col-span-2">×{m}</div>
                    <div className="col-span-8 text-[#3f5068] dark:text-[#a7bacd]">{d}</div>
                  </div>
                ))}
              </div>

              <h3 className="mt-6 text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Final score formula</h3>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-[#f6f1e3] p-3 text-xs dark:bg-[#0c2238]">{`Final Score =
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
        <Link href="/query" className="rounded-md border border-[#d6c9a8] px-3 py-2 font-semibold hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:hover:bg-[#0c2238]">← Market intelligence</Link>
        <Link href="/assess" className="rounded-md border border-[#d6c9a8] px-3 py-2 font-semibold hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:hover:bg-[#0c2238]">Assess your needs →</Link>
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
      : "text-[#13294b] dark:text-[#eef3f8]";
  return (
    <div className="rounded-md border border-[#e6dcc3] bg-white p-3 dark:border-[#1d3a57] dark:bg-[#0c2238]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-[#8fa5bb]">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${toneClass}`}>{value}</div>
      {note && <div className="text-[10px] text-[#5b6b7f] dark:text-[#8fa5bb]">{note}</div>}
    </div>
  );
}
