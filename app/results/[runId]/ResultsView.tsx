"use client";

import Link from "next/link";
import { useState } from "react";
import type { AssessmentResult, VendorResult, PillarId } from "@/lib/types";
import { PILLARS } from "@/lib/types";
import { OwnershipBadge, VendorNameWithOwnership } from "@/components/ownership-indicator";

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

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-600">
        <div>
          No cached result for run <code className="font-mono text-xs">{runId}</code>.{" "}
          <Link href="/assessment" className="underline">Start a new assessment</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#071827] text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/assessment" className="text-sm text-zinc-500 hover:underline">← New assessment</Link>
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

        <ExportBar runId={data.runId} result={data} />

        <div className="mt-8 space-y-4">
          {data.ranking.map((vr) => (
            <VendorCard
              key={vr.vendorId}
              vr={vr}
              open={openVendor === vr.vendorId}
              onToggle={() => setOpenVendor(openVendor === vr.vendorId ? null : vr.vendorId)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function VendorCard({ vr, open, onToggle }: { vr: VendorResult; open: boolean; onToggle: () => void }) {
  const band = BAND_LABEL[vr.recommendationBand];
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
        </div>
      )}
    </div>
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
