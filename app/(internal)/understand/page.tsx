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
import { Panel, ScoreBar, EvidenceDepthBadge } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import CapabilityMatrix, { type MatrixCell } from "@/components/understand/CapabilityMatrix";
import ExposureMapHero from "@/components/dashboard/ExposureMapHero";
import {
  listCapabilities,
  listIntelligenceVendors,
  listVendorCapabilities,
  listVendorMomentum,
  getEvidenceDepthByVendor,
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
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function UnderstandPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;

  const [
    capabilities,
    vendorCapabilities,
    vendors,
    momentum,
    connectors,
    provenance,
    evidenceDepthByVendor,
  ] = await Promise.all([
    listCapabilities(),
    listVendorCapabilities(),
    listIntelligenceVendors(),
    listVendorMomentum(),
    Promise.resolve(listConnectorHealth()),
    getDataProvenance(),
    getEvidenceDepthByVendor(),
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
                <div className="rounded-md border border-[#e6dcc3] p-3 dark:border-[#223a2e]">
                  <div className="text-[10px] uppercase tracking-wider text-[#5b6b7f]">Avg sustainability</div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-[#123d2c] dark:text-[#eef3f8]">{avgSus}/100</div>
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
              <Link href="/admin/data-sources" className="rounded-full border border-[#e6dcc3] bg-white px-3 py-1 font-semibold text-[#123d2c] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8] dark:hover:bg-[#143049]">
                Connector status →
              </Link>
              <Link href="/admin/ingestion" className="rounded-full border border-[#e6dcc3] bg-white px-3 py-1 font-semibold text-[#123d2c] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8] dark:hover:bg-[#143049]">
                Run ingestion →
              </Link>
              <Link href="/admin/evidence" className="rounded-full border border-[#e6dcc3] bg-white px-3 py-1 font-semibold text-[#123d2c] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8] dark:hover:bg-[#143049]">
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

      {/* 5 + 6. RELOCATED (C7 — one vendor, one place). The per-vendor
          "Strategic vendor intelligence" table and the "Vendor universe" list
          used to live here and duplicated the Query ranking (Chris flagged the
          same vendor showing twice). Those per-vendor scores — sustainability,
          encroachment, dependency, optionality, viability — now render on each
          vendor's own profile under "Strategic position", reached in one click
          from the Query leaderboard. Nothing was deleted; it moved. The
          aggregate views above (ecosystem map, coverage, capability matrix,
          methodology) stay because they are genuinely market-wide, not
          per-vendor. */}
      <section id="strategic" className="mb-8">
        <Panel title="Per-vendor detail lives on the vendor profile">
          <p className="text-sm leading-6 text-[#3f5068] dark:text-[#c2d1e0]">
            Strategic sustainability, encroachment, dependency, optionality and viability — plus the
            full vendor list — now sit on each vendor&apos;s own profile, so a vendor appears in{" "}
            <strong>one place</strong> instead of being duplicated here and in Query. Open any vendor
            from the{" "}
            <Link href="/query" className="font-semibold text-[#123d2c] underline underline-offset-2 hover:no-underline dark:text-[#eef3f8]">
              Query leaderboard
            </Link>{" "}
            to see its Strategic position, scores, dependencies and live news together.
          </p>
        </Panel>
      </section>

      {/* 7. Methodology */}
      <section id="methodology" className="mb-2">
        <CollapsiblePanel title="Methodology — Enterprise AI Assessment Framework v2.0" summary={"weights, evidence grades, scoring rubric"}>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">Six pillars (default weights)</h3>
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

              <h3 className="mt-6 text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">Risk engine</h3>
              <p className="mt-2 text-sm leading-6 text-[#2e3f57] dark:text-[#c2d1e0]">
                Fatal blockers exclude vendors in incompatible contexts. Severe / moderate risks
                apply penalties scaled by the user&apos;s risk tolerance. Industry-critical control
                areas with no E3+ evidence trigger severe risk (or fatal in regulated industries).
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">Evidence grading (E0–E5)</h3>
              <div className="mt-2 grid grid-cols-1 gap-1 text-sm">
                {[
                  ["E0", "0.0", "No evidence"],
                  ["E1", "0.4", "Vendor claim only"],
                  ["E2", "0.6", "Public documentation"],
                  ["E3", "0.75", "Public test / sandbox / API verification"],
                  ["E4", "0.9", "Production customer evidence"],
                  ["E5", "1.0", "Independent audit / verified benchmark"],
                ].map(([g, m, d]) => (
                  <div key={g} className="grid grid-cols-12 border-b border-[#ece4d0] py-1.5 dark:border-[#223a2e]">
                    <div className="col-span-2 font-mono">{g}</div>
                    <div className="col-span-2">×{m}</div>
                    <div className="col-span-8 text-[#3f5068] dark:text-[#a7bacd]">{d}</div>
                  </div>
                ))}
              </div>

              <h3 className="mt-6 text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">Final score formula</h3>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-[#f6f1e3] p-3 text-xs dark:bg-[#0d1f17]">{`Final Score =
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
        <Link href="/query" className="rounded-md border border-[#d6c9a8] px-3 py-2 font-semibold hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:hover:bg-[#0d1f17]">← Market intelligence</Link>
        <Link href="/assess" className="rounded-md border border-[#d6c9a8] px-3 py-2 font-semibold hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:hover:bg-[#0d1f17]">Assess your needs →</Link>
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
      : "text-[#123d2c] dark:text-[#eef3f8]";
  return (
    <div className="rounded-md border border-[#e6dcc3] bg-white p-3 dark:border-[#223a2e] dark:bg-[#0d1f17]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-[#8fa5bb]">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${toneClass}`}>{value}</div>
      {note && <div className="text-[10px] text-[#5b6b7f] dark:text-[#8fa5bb]">{note}</div>}
    </div>
  );
}
