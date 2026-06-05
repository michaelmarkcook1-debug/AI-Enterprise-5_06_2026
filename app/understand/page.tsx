// Understand tab — market nuance, vendor universe, and exposure.
//
// Consolidates the previously separate /vendors universe, /capabilities
// matrix and coverage stats, /exposure-map relationship view, and the
// /methodology framework reference into a single deep-dive page.
// Sections in render order:
//   1. Capability coverage overview (verified / documented / seed / stale / disputed / unknown)
//   2. Data sources backing this surface (connector health + provenance)
//   3. Capability matrix + sub-tabs (UnderstandTabs component)
//   4. Vendor universe (ranked list with momentum + confidence)
//   5. AI Ecosystem Navigator (public→private linkage)
//   6. Methodology — six pillars · evidence grading · score formula

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

  return (
    <PageFrame
      title="Understand"
      kicker="Market nuance, vendor universe, and exposure"
      description="Deep-dive vendor analysis: capability matrix with maturity scoring, the ranked vendor universe, the AI Ecosystem Navigator (public→private linkages), and the methodology backbone — six pillars, evidence grading (E0–E5), and the final-score formula. Filter by vendor or pillar to scope the matrix."
    >
      <div className="mb-5">
        <OwnershipLegend />
      </div>

      {/* 1. Exposure map — moved to the top so the public→private
            linkage view is the first thing the user sees on Understand. */}
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
        <Panel title="Capability coverage overview">
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
        </Panel>
      </section>

      {/* 3. Data sources / connector health */}
      <section className="mb-6">
        <Panel title="Data sources backing this surface">
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
        </Panel>
      </section>

      {/* 4. Capability matrix + sub-tabs */}
      <section id="capabilities" className="mb-8">
        <UnderstandTabs
          initialView={params.view || "matrix"}
          selectedVendor={params.vendor}
          selectedPillar={params.pillar}
        />
      </section>

      {/* 5. Vendor universe */}
      <section id="vendors" className="mb-8">
        <Panel title="Vendor universe — ranked by overall score">
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
        </Panel>
      </section>


      {/* 6. Methodology */}
      <section id="methodology" className="mb-2">
        <Panel title="Methodology — Enterprise AI Assessment Framework v2.0">
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
        </Panel>
      </section>
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
