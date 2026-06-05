"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AssessmentResult, VendorResult, PillarId } from "@/lib/types";
import { PILLARS } from "@/lib/types";
import { OwnershipBadge, VendorNameWithOwnership } from "@/components/ownership-indicator";
import {
  WORKFLOW_TYPES,
  rankVendorsForType,
  activeWorkflowTypes,
  type WorkflowType,
  type TypeRankedVendor,
} from "@/lib/workflow-types";

/**
 * Build the URL the Demonstrate tab consumes when a shortlist is sent
 * over from a completed assessment. Mirrors the param names parsed in
 * /app/demonstrate/page.tsx so the tab pre-filters reputation, news,
 * and pillar-merits to the assessed shortlist.
 *
 * Top 3 by `rank` (which the scoring engine produces in finalScore
 * order, descending). Excluded vendors are skipped — a "Not recommended"
 * vendor never makes the auto-populated Demonstrate shortlist.
 */
function buildDemonstrateUrl(result: AssessmentResult): { url: string; top: VendorResult[] } {
  const top = result.ranking.filter((v) => !v.excluded).slice(0, 3);
  const params = new URLSearchParams();
  if (top.length > 0) params.set("vendors", top.map((v) => v.vendorId).join(","));
  if (result.inputSummary.industryName) params.set("industries", result.inputSummary.industryName);
  if (result.inputSummary.useCases.length > 0) params.set("useCases", result.inputSummary.useCases.join(","));
  if (result.inputSummary.region) params.set("region", result.inputSummary.region);
  params.set("dataSensitivity", `${result.inputSummary.dataSensitivity}/5`);
  params.set("costSensitivity", `${result.inputSummary.budgetSensitivity}/5`);
  return { url: `/demonstrate?${params.toString()}`, top };
}

/**
 * Persist the latest assessment shortlist + context to sessionStorage
 * so a user who lands on /demonstrate without query params can still
 * see their most recent shortlist offered. Keyed by a stable name so
 * subsequent assessments overwrite previous runs.
 */
function persistShortlistForDemonstrate(result: AssessmentResult, top: VendorResult[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      "demonstrate_shortlist",
      JSON.stringify({
        runId: result.runId,
        generatedAt: result.generatedAt,
        vendorIds: top.map((v) => v.vendorId),
        vendorNames: top.map((v) => v.vendorName),
        industries: result.inputSummary.industryName ? [result.inputSummary.industryName] : [],
        useCases: result.inputSummary.useCases,
        region: result.inputSummary.region ?? "",
        dataSensitivity: result.inputSummary.dataSensitivity,
        costSensitivity: result.inputSummary.budgetSensitivity,
      }),
    );
  } catch {
    // sessionStorage can throw in private/incognito; swallow.
  }
}

const BAND_LABEL: Record<string, { label: string; tone: string }> = {
  enterprise_scale: { label: "Enterprise-scale candidate", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  controlled_deployment: { label: "Controlled deployment", tone: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  pilot_only: { label: "Pilot only", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  not_recommended: { label: "Not recommended", tone: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

export default function ResultsView({ runId }: { runId: string }) {
  const [data] = useState<AssessmentResult | null>(() => {
    if (typeof window === "undefined") return null;
    const cached = window.sessionStorage.getItem(`assessment_${runId}`);
    return cached ? (JSON.parse(cached) as AssessmentResult) : null;
  });
  const [openVendor, setOpenVendor] = useState<string | null>(null);

  // Pre-build the Demonstrate URL the moment we have a result so the
  // CTA below can render synchronously without a render-tear flash.
  const demonstrate = useMemo(
    () => (data ? buildDemonstrateUrl(data) : null),
    [data],
  );

  // Auto-persist the top-3 shortlist + context to sessionStorage so
  // /demonstrate can pick it up even if the user navigates without the
  // query string (e.g. via the top-nav).
  useEffect(() => {
    if (data && demonstrate) {
      persistShortlistForDemonstrate(data, demonstrate.top);
    }
  }, [data, demonstrate]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-600">
        <div>
          No cached result for run <code className="font-mono text-xs">{runId}</code>.{" "}
          <Link href="/assess" className="underline">Start a new assessment</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#071827] text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/assess" className="text-sm text-zinc-500 hover:underline">← Assess</Link>
        <div className="mt-4 flex items-baseline justify-between gap-6">
          <h1 className="text-3xl font-semibold tracking-tight">Ranked shortlist</h1>
          <div className="text-xs text-zinc-500 font-mono">{data.runId}</div>
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Industry: <strong>{data.inputSummary.industryName}</strong> · Use cases: {data.inputSummary.useCases.join(", ")} · Sensitivity {data.inputSummary.dataSensitivity}/5 · Risk tolerance {data.inputSummary.riskTolerance}/5
        </p>
        <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm">
          <strong>Why this ranking:</strong> {data.comparisonSummary}
        </div>

        {/* v1.1.0 — workflow-risk overlay reasoning. Rendered when the
            engine threaded a profile onto the result. Tells users which
            regulatory regimes their selections triggered, what
            effective values the engine used, and whether their
            autonomy choice conflicted with the workflows. */}
        <WorkflowOverlayPanel data={data} />

        {/* Auto-populated Demonstrate CTA — the top 3 non-excluded
            vendors + the assessment context are pre-attached as URL
            params, so a single click lands the user on /demonstrate
            with reputation, news, and pillar-merits already filtered
            to the shortlist. Also persisted to sessionStorage so the
            Demonstrate tab can offer the same shortlist if the user
            navigates via the top nav. */}
        {demonstrate && demonstrate.top.length > 0 && (
          <div className="mt-4 rounded-2xl border-2 border-emerald-500/60 bg-emerald-50/60 px-5 py-4 dark:border-emerald-500/40 dark:bg-emerald-950/30">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Next: ratify your shortlist
                </div>
                <div className="mt-1 text-sm leading-5 text-emerald-900 dark:text-emerald-100">
                  Your top {demonstrate.top.length}{" "}
                  ({demonstrate.top.map((v) => v.vendorName).join(", ")}){" "}
                  will appear on the Demonstrate tab with reputation,
                  news, and pillar merits scoped to your industry, use
                  cases, region, and sensitivity inputs.
                </div>
              </div>
              <Link
                href={demonstrate.url}
                className="shrink-0 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
              >
                Open in Demonstrate →
              </Link>
            </div>
          </div>
        )}

        <ExportBar runId={data.runId} result={data} />

        {/* Best AI vendor per workflow type. The 75 selectable workflows
            consolidate into four primary modes of use; each card shows the
            single best vendor for that mode and expands to the full ranked
            list. Same assessment run, re-ranked per type via each type's
            pillar-weight profile (see lib/workflow-types.ts). */}
        <WorkflowTypeResults
          ranking={data.ranking}
          activeUseCaseIds={data.inputSummary.useCases}
        />
      </main>
    </div>
  );
}

/* ─── Workflow-type-led results ──────────────────────────────────── */

function WorkflowTypeResults({
  ranking,
  activeUseCaseIds,
}: {
  ranking: VendorResult[];
  activeUseCaseIds: string[];
}) {
  // Which of the four types the buyer actually scoped (selected ≥1
  // workflow of that type). All four are still shown.
  const active = useMemo(() => activeWorkflowTypes(activeUseCaseIds), [activeUseCaseIds]);

  // Per-type ranked lists, computed once from the shared ranking.
  const perType = useMemo(
    () =>
      WORKFLOW_TYPES.map((type) => ({
        type,
        ranked: rankVendorsForType(ranking, type),
      })),
    [ranking],
  );

  // Which type card is expanded to its full ranked list.
  const [openType, setOpenType] = useState<string | null>(null);
  // Which vendor's full detail is open (inside an expanded type list).
  const [openVendor, setOpenVendor] = useState<string | null>(null);
  const vendorById = useMemo(
    () => new Map(ranking.map((v) => [v.vendorId, v])),
    [ranking],
  );

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">Best vendor by workflow type</h2>
        <span className="text-xs text-zinc-500">click a card for the full ranked list</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {perType.map(({ type, ranked }) => (
          <WorkflowTypeCard
            key={type.id}
            type={type}
            ranked={ranked}
            isActive={active.has(type.id)}
            isOpen={openType === type.id}
            onToggle={() => {
              setOpenType(openType === type.id ? null : type.id);
              setOpenVendor(null);
            }}
            openVendor={openVendor}
            onToggleVendor={(id) => setOpenVendor(openVendor === id ? null : id)}
            vendorById={vendorById}
          />
        ))}
      </div>
    </div>
  );
}

function WorkflowTypeCard({
  type,
  ranked,
  isActive,
  isOpen,
  onToggle,
  openVendor,
  onToggleVendor,
  vendorById,
}: {
  type: WorkflowType;
  ranked: TypeRankedVendor[];
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  openVendor: string | null;
  onToggleVendor: (id: string) => void;
  vendorById: Map<string, VendorResult>;
}) {
  const eligible = ranked.filter((r) => !r.excluded);
  const top = eligible[0] ?? null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900 ${
        isOpen ? "md:col-span-2" : ""
      } ${isActive ? "border-zinc-300 dark:border-zinc-700" : "border-zinc-200 dark:border-zinc-800"}`}
    >
      {/* Accent bar */}
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${type.accent.bar}`} />

      <button onClick={onToggle} className="w-full text-left p-5 pl-6" aria-expanded={isOpen}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${type.accent.chip}`}>
                {type.shortLabel}
              </span>
              {isActive && (
                <span className="rounded-full border border-current/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Selected
                </span>
              )}
            </div>
            <div className="mt-1.5 text-base font-semibold">{type.label}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{type.tagline}</div>
          </div>
        </div>

        {/* Best vendor headline */}
        {top ? (
          <div className={`mt-4 flex items-center justify-between gap-4 rounded-xl px-3 py-3 ${type.accent.softBg}`}>
            <div className="flex items-center gap-3 min-w-0">
              <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold ${type.accent.chip}`}>
                1
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  <VendorNameWithOwnership name={top.vendorName} ownershipType={top.ownership} compactBadge />
                </div>
                <div className="text-[11px] text-zinc-500">Best vendor for this type</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-2xl font-semibold tabular-nums ${type.accent.text}`}>{top.typeScore.toFixed(0)}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">fit / 100</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-3 text-xs text-zinc-500 dark:bg-zinc-800/60">
            No eligible vendor for this workflow type in the current shortlist.
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-zinc-400">{eligible.length} ranked vendor{eligible.length === 1 ? "" : "s"}</span>
          <span className={`font-medium ${type.accent.text}`}>{isOpen ? "Hide full ranking ▲" : "View full ranking ▼"}</span>
        </div>
      </button>

      {/* Full ranked list */}
      {isOpen && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <p className="px-6 pt-4 text-xs text-zinc-500">{type.description}</p>
          <ol className="px-4 py-3">
            {ranked.map((r) => {
              const detail = vendorById.get(r.vendorId);
              const vendorOpen = openVendor === r.vendorId;
              return (
                <li key={r.vendorId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <button
                    onClick={() => onToggleVendor(r.vendorId)}
                    className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 text-right font-mono text-xs ${r.excluded ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500"}`}>
                        {r.excluded ? "—" : r.rank}
                      </span>
                      <span className="truncate text-sm font-medium">
                        <VendorNameWithOwnership name={r.vendorName} ownershipType={r.ownership} compactBadge />
                      </span>
                      {r.excluded && (
                        <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-600 dark:bg-red-950/40 dark:text-red-300">
                          Excluded
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-mono text-sm tabular-nums ${r.excluded ? "text-zinc-300 dark:text-zinc-600" : type.accent.text}`}>
                        {r.excluded ? "—" : r.typeScore.toFixed(0)}
                      </span>
                      <span className="text-[10px] text-zinc-400">{vendorOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {vendorOpen && detail && (
                    <div className="px-2 pb-3">
                      <VendorCard vr={detail} open onToggle={() => onToggleVendor(r.vendorId)} embedded />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * Workflow-risk overlay reasoning panel.
 *
 * Render-only — reads the `workflowRiskProfile` field that v1.1.0 of
 * the engine attaches to AssessmentResult. Older results without that
 * field render nothing (panel returns null), so this is safe to call
 * unconditionally.
 *
 * What this surfaces:
 *   - Regulatory regimes the buyer's workflows triggered
 *   - Effective data sensitivity vs the dialled value (when raised)
 *   - Effective reliability requirement
 *   - Autonomy conflict warning when the buyer asked for more autonomy
 *     than any selected workflow safely supports
 *   - Workflow complexity distribution
 *   - The plain-English rationale strings from the overlay
 */
function WorkflowOverlayPanel({ data }: { data: AssessmentResult }) {
  // The overlay field is tacked onto the result by the engine but is
  // not in the base AssessmentResult type. Cast-and-read defensively.
  type OverlayShape = {
    regulatoryRegimes: string[];
    requiredEvidenceDomains: string[];
    effectiveDataSensitivity: number;
    effectiveReliabilityRequirement: number;
    autonomyConflict: boolean;
    safestAutonomyDefault: string;
    complexityCounts: { simple: number; moderate: number; complex: number };
    rationale: string[];
  };
  const profile = (data as AssessmentResult & { workflowRiskProfile?: OverlayShape }).workflowRiskProfile;
  if (!profile) return null;

  const dialledSens = data.inputSummary.dataSensitivity;
  const sensRaised = profile.effectiveDataSensitivity > dialledSens;
  const noNotableShifts =
    !sensRaised
    && !profile.autonomyConflict
    && profile.regulatoryRegimes.length === 0
    && profile.effectiveReliabilityRequirement <= 3;
  if (noNotableShifts) return null;

  const totalWorkflows =
    profile.complexityCounts.simple
    + profile.complexityCounts.moderate
    + profile.complexityCounts.complex;

  return (
    <div className="mt-4 rounded-xl border-2 border-amber-300/70 bg-amber-50/60 px-5 py-4 dark:border-amber-700/50 dark:bg-amber-950/30">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">
        Workflow-risk overlay applied
      </div>
      <div className="mt-2 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Effective data sensitivity"
          value={`${profile.effectiveDataSensitivity}/5`}
          delta={sensRaised ? `↑ from ${dialledSens}` : undefined}
          tone={sensRaised ? "warn" : "neutral"}
        />
        <Stat
          label="Reliability requirement"
          value={`${profile.effectiveReliabilityRequirement}/5`}
          tone={profile.effectiveReliabilityRequirement >= 4 ? "warn" : "neutral"}
        />
        <Stat
          label="Regulatory regimes"
          value={profile.regulatoryRegimes.length > 0 ? profile.regulatoryRegimes.join(" · ") : "None"}
          tone={profile.regulatoryRegimes.length > 0 ? "warn" : "neutral"}
        />
        <Stat
          label="Autonomy"
          value={profile.autonomyConflict ? "Conflict" : "OK"}
          delta={profile.autonomyConflict ? `safest = ${profile.safestAutonomyDefault.replace(/_/g, " ")}` : undefined}
          tone={profile.autonomyConflict ? "bad" : "ok"}
        />
      </div>
      {totalWorkflows > 0 && (
        <div className="mt-3 text-[11px] text-amber-900/80 dark:text-amber-200/80">
          Workflow complexity mix:
          <strong className="ml-1">{profile.complexityCounts.simple}</strong> simple ·
          <strong className="ml-1">{profile.complexityCounts.moderate}</strong> moderate ·
          <strong className="ml-1">{profile.complexityCounts.complex}</strong> complex
          ({totalWorkflows} workflow{totalWorkflows === 1 ? "" : "s"} selected)
        </div>
      )}
      {profile.rationale.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-900 dark:text-amber-100">
          {profile.rationale.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="select-none text-amber-700/60">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label, value, delta, tone,
}: {
  label: string;
  value: string;
  delta?: string;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "ok" ? "text-emerald-700 dark:text-emerald-300"
    : tone === "warn" ? "text-amber-800 dark:text-amber-200"
    : tone === "bad" ? "text-rose-700 dark:text-rose-300"
    : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-md border border-amber-200/60 bg-white/70 p-2 dark:border-amber-800/40 dark:bg-zinc-900/40">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${toneClass}`}>{value}</div>
      {delta && <div className="text-[10px] text-zinc-500">{delta}</div>}
    </div>
  );
}

function VendorCard({ vr, open, onToggle, embedded = false }: { vr: VendorResult; open: boolean; onToggle: () => void; embedded?: boolean }) {
  const band = BAND_LABEL[vr.recommendationBand];
  // Embedded mode (inside a workflow-type ranked list) skips the outer
  // card chrome + clickable header — the parent row already shows the
  // vendor name + score — and renders just the detail body.
  if (embedded) {
    return (
      <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="text-xs text-zinc-500">{vr.industryRationale}</div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400">Overall</span>
            <span className="font-mono text-lg font-semibold tabular-nums">{vr.excluded ? "—" : vr.finalScore.toFixed(0)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${band.tone}`}>{band.label}</span>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PILLARS.map((p) => (
            <PillarBar key={p.id} label={p.label} score={vr.pillarScores[p.id as PillarId]} />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <VendorDetailBody vr={vr} />
        </div>
      </div>
    );
  }
  return (
    <div className={`rounded-2xl border bg-white dark:bg-zinc-900 ${vr.excluded ? "border-red-200 dark:border-red-900/50" : "border-zinc-200 dark:border-zinc-800"}`}>
      <button onClick={onToggle} className="w-full text-left p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-base font-semibold">
              {vr.rank}
            </div>
            <div>
              <div className="text-xl font-semibold">
                <VendorNameWithOwnership name={vr.vendorName} ownershipType={vr.ownership} compactBadge={false} />
              </div>
              <div className="mt-1 text-xs text-zinc-500">{vr.industryRationale}</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-semibold tabular-nums">{vr.excluded ? "—" : vr.finalScore.toFixed(0)}</div>
            <div className="mt-2"><OwnershipBadge ownershipType={vr.ownership} /></div>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${band.tone}`}>{band.label}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-6 gap-2">
          {PILLARS.map((p) => (
            <PillarBar key={p.id} label={p.label} score={vr.pillarScores[p.id as PillarId]} />
          ))}
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 p-6 grid gap-6 md:grid-cols-2">
          <VendorDetailBody vr={vr} />
        </div>
      )}
    </div>
  );
}

/** Shared detail sections — used by the standalone VendorCard and the
 *  embedded (inside-a-workflow-type-list) variant. */
function VendorDetailBody({ vr }: { vr: VendorResult }) {
  return (
    <>
      <Section title="Top strengths">
        {vr.topStrengths.length === 0 ? <Empty /> : <ul className="list-disc pl-5 text-sm space-y-1">{vr.topStrengths.map((s, i) => <li key={i}>{s}</li>)}</ul>}
      </Section>
      <Section title="Top risks">
        {vr.topRisks.length === 0 ? <Empty /> : <ul className="list-disc pl-5 text-sm space-y-1">{vr.topRisks.map((s, i) => <li key={i}>{s}</li>)}</ul>}
      </Section>
      <Section title="Missing evidence">
        {vr.missingEvidence.length === 0 ? <Empty /> : <ul className="list-disc pl-5 text-sm space-y-1">{vr.missingEvidence.map((s, i) => <li key={i}>{s}</li>)}</ul>}
      </Section>
      <Section title="Recommended validation steps">
        <ul className="list-disc pl-5 text-sm space-y-1">{vr.validationSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </Section>
      <Section title="Pillar drill-down">
        <div className="text-xs space-y-2">
          {vr.pillarBreakdown.map((b) => (
            <div key={b.pillar} className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-2">
              <div className="flex items-center justify-between">
                <strong>{PILLARS.find((p) => p.id === b.pillar)!.label}</strong>
                <span className="font-mono">{b.score.toFixed(0)} × {(b.weight * 100).toFixed(0)}% = {b.weightedContribution.toFixed(1)}</span>
              </div>
              <div className="mt-1 text-zinc-500">
                {b.contributingDomains.filter((d) => d.evidenceCount > 0).map((d) => `${d.domain}:${d.score.toFixed(0)}`).join(" · ") || "no evidence"}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Score adjustments">
        <table className="text-xs w-full">
          <tbody>
            <tr><td className="py-0.5">Strategic fit bonus</td><td className="text-right font-mono">+{vr.bonuses.strategicFit.toFixed(1)}</td></tr>
            <tr><td className="py-0.5">Sector adoption bonus</td><td className="text-right font-mono">+{vr.bonuses.sectorAdoptionFit.toFixed(1)}</td></tr>
            <tr><td className="py-0.5">Risk penalty</td><td className="text-right font-mono">−{vr.penalties.risk.toFixed(1)}</td></tr>
            <tr><td className="py-0.5">Missing evidence</td><td className="text-right font-mono">−{vr.penalties.missingEvidence.toFixed(1)}</td></tr>
            <tr><td className="py-0.5">Adoption friction</td><td className="text-right font-mono">−{vr.penalties.adoptionFriction.toFixed(1)}</td></tr>
          </tbody>
        </table>
      </Section>
      {vr.excluded && (
        <Section title="Excluded">
          <div className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {vr.excludedReason}
          </div>
        </Section>
      )}
    </>
  );
}

function ExportBar({ runId, result }: { runId: string; result: AssessmentResult }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function exportAs(type: "json" | "html" | "compliance") {
    setBusy(type);
    try {
      const res = await fetch(`/api/assessment/${encodeURIComponent(runId)}/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ exportType: type, result }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (type === "json") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ranking-${runId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs uppercase tracking-wide text-zinc-500 mr-1">Export:</span>
      <button onClick={() => exportAs("html")} disabled={busy !== null}
        className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50">
        {busy === "html" ? "Generating…" : "Board pack (HTML)"}
      </button>
      <button onClick={() => exportAs("compliance")} disabled={busy !== null}
        className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50">
        {busy === "compliance" ? "Generating…" : "Compliance pack"}
      </button>
      <button onClick={() => exportAs("json")} disabled={busy !== null}
        className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50">
        {busy === "json" ? "Generating…" : "Audit JSON"}
      </button>
    </div>
  );
}

function PillarBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 truncate">{label}</div>
      <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div className="h-full bg-zinc-900 dark:bg-white" style={{ width: `${Math.max(2, Math.min(100, score))}%` }} />
      </div>
      <div className="mt-1 text-xs font-mono">{score.toFixed(0)}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</div>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="text-xs text-zinc-400 italic">None</div>;
}
