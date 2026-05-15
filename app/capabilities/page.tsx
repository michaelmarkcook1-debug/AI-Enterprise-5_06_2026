import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { EvidenceBadge, Panel, ScoreBar } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import { listCapabilities, listIntelligenceVendors, listVendorCapabilities } from "@/lib/intelligence/repository";
import {
  capabilityRenderState,
  isInfrastructureOnlyVendor,
  summariseCapabilityOverview,
  type CapabilityRenderMode,
  type CapabilityRenderState,
} from "@/lib/intelligence/capabilities-truthfulness";
import { listConnectorHealth } from "@/lib/connectors/registry";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import type { VendorCapability } from "@/lib/intelligence/types";

export const dynamic = "force-dynamic";

export default async function CapabilitiesPage() {
  const [capabilities, vendorCapabilities, vendors, connectors, provenance] = await Promise.all([
    listCapabilities(),
    listVendorCapabilities(),
    listIntelligenceVendors(),
    Promise.resolve(listConnectorHealth()),
    getDataProvenance(),
  ]);

  // May-2026 update: show ALL spine vendors, not just the top 10. The
  // matrix is wider but operators asked for full coverage so tail
  // vendors (Harvey, Hebbia, Rogo, MoveWorks, AI21, Aleph Alpha, etc.)
  // are visible alongside the headline platforms. Order remains
  // highest-score-first so the most important vendors are above the
  // fold.
  const vendorsToShow = vendors.sort((a, b) => b.overallScore - a.overallScore);
  const byKey = new Map(vendorCapabilities.map((item) => [`${item.vendorId}_${item.capabilityId}`, item]));

  // Compute the render state for every visible cell — used both for the cell
  // UI and for the overview metrics at the top of the page.
  const allStates: CapabilityRenderState[] = vendorsToShow.flatMap((vendor) =>
    capabilities.map((cap) =>
      capabilityRenderState(byKey.get(`${vendor.id}_${cap.id}`), {
        isInfrastructureOnly: isInfrastructureOnlyVendor(vendor.id),
      }),
    ),
  );
  const overview = summariseCapabilityOverview(vendorsToShow.length, capabilities.length, allStates);

  const configuredConnectors = connectors.filter((c) => c.configured).length;
  const totalConnectors = connectors.length;

  return (
    <PageFrame
      title="Capability tracker"
      kicker="Source-backed capability intelligence"
      description="Per-cell maturity across models, assistants, RAG, agents, governance, security, integrations, cost, deployment, and portability. Every cell is gated by source + ProductScope linkage — unverified cells render explicitly, never as fact."
    >
      {/* ─── Overview metrics ─── */}
      <Panel title="Coverage overview">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Vendors" value={overview.totalVendors} note="top-ranked" />
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

      {/* ─── Connection / data panel ─── */}
      <div className="mt-5">
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
      </div>

      {/* ─── Capability matrix ─── */}
      <div className="mt-5">
        <Panel title="Capability matrix">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <OwnershipLegend />
            <ModeLegend />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#dfe4da] text-xs uppercase tracking-wide text-[#697362]">
                  <th className="w-44 py-3 pr-4">Vendor</th>
                  {capabilities.map((capability) => (
                    <th key={capability.id} className="min-w-32 px-3 py-3">{capability.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendorsToShow.map((vendor) => {
                  const isInfra = isInfrastructureOnlyVendor(vendor.id);
                  return (
                    <tr key={vendor.id} className="border-b border-[#edf0ea]">
                      <td className="py-3 pr-4 font-medium align-top">
                        <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} />
                        {isInfra && (
                          <div className="mt-1 inline-flex rounded-full border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                            Infra-only
                          </div>
                        )}
                      </td>
                      {capabilities.map((capability) => {
                        const row = byKey.get(`${vendor.id}_${capability.id}`);
                        const state = capabilityRenderState(row, { isInfrastructureOnly: isInfra });
                        return (
                          <td key={capability.id} className="px-3 py-3 align-top">
                            <CapabilityCell vc={row} state={state} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return "0";
  return ((numerator / denominator) * 100).toFixed(0);
}

function Stat({ label, value, note, tone = "neutral" }: { label: string; value: number | string; note?: string; tone?: "ok" | "warn" | "bad" | "neutral" }) {
  const toneClass = tone === "ok"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    : tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      : tone === "bad"
        ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
        : "border-[#dfe4da] bg-white text-[#4d574b] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums">{value}</span>
        {note && <span className="text-[10px] opacity-70">{note}</span>}
      </div>
    </div>
  );
}

const MODE_LABEL: Record<CapabilityRenderMode, string> = {
  verified: "Verified",
  documented: "Documented",
  seed: "Seed",
  stale: "Stale",
  disputed: "Disputed",
  validation_required: "Validation required",
  unknown: "Unknown",
  infrastructure_only: "Infra-only",
};

const MODE_TONE: Record<CapabilityRenderMode, string> = {
  verified: "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
  documented: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  seed: "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  stale: "border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200",
  disputed: "border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200",
  validation_required: "border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200",
  unknown: "border-zinc-400 bg-zinc-50 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300",
  infrastructure_only: "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
};

function ModeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      {(Object.keys(MODE_LABEL) as CapabilityRenderMode[]).map((mode) => (
        <span key={mode} className={`rounded-full border px-1.5 py-0.5 font-semibold uppercase tracking-wide ${MODE_TONE[mode]}`}>
          {MODE_LABEL[mode]}
        </span>
      ))}
    </div>
  );
}

function CapabilityCell({ vc, state }: { vc: VendorCapability | undefined; state: CapabilityRenderState }) {
  if (state.mode === "infrastructure_only") {
    return <span className="text-[11px] italic text-zinc-500" title={state.reason}>n/a — infra exposure</span>;
  }
  if (state.mode === "unknown") {
    return <span className="text-xs text-[#9aa193]" title={state.reason}>No signal</span>;
  }
  if (state.mode === "validation_required") {
    return (
      <div className="space-y-1.5" title={state.reason}>
        <span className="inline-block rounded-full border border-rose-400 bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
          Source validation required
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {state.showScore && vc && <ScoreBar value={vc.maturityScore} />}
      <div className="flex flex-wrap items-center gap-1">
        {vc && <EvidenceBadge grade={vc.evidenceGrade} />}
        <span
          title={state.reason}
          className={`inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${MODE_TONE[state.mode]}`}
        >
          {MODE_LABEL[state.mode]}
        </span>
        {(vc?.sourceUrls?.[0] || vc?.sourceIds?.[0]) ? (
          <a
            href={vc?.sourceUrls?.[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-300"
          >
            source
          </a>
        ) : null}
      </div>
      {state.confidence > 0 && (
        <div className="text-[10px] text-[#697362] dark:text-zinc-500">
          conf {state.confidence.toFixed(0)}/100
          {vc?.sourceDate && <span className="ml-1">· {vc.sourceDate}</span>}
        </div>
      )}
      {(state.mode === "stale" || state.mode === "seed" || state.mode === "disputed") && state.uncertaintyNote && (
        <div className="text-[10px] italic leading-4 text-[#697362] dark:text-zinc-500" title={state.uncertaintyNote}>
          {state.uncertaintyNote.length > 80 ? state.uncertaintyNote.slice(0, 80) + "…" : state.uncertaintyNote}
        </div>
      )}
    </div>
  );
}

