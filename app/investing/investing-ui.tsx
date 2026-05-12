import Link from "next/link";
import type { ReactNode } from "react";
import { Confidence, EvidenceBadge, Panel, ScoreBar } from "@/components/intelligence-ui";
import { VendorNameWithOwnership } from "@/components/ownership-indicator";
import type { InvestmentProviderProfile } from "@/lib/investing/types";

export function WarningStrip() {
  // The two chips here are NOT data-provenance markers — "Investor Tools" is a
  // section label, "Not financial advice" is a legal disclaimer. They render
  // as neutral amber chips so the loud "NOT LIVE" rose styling is reserved
  // for actual data-source claims (provider tables, simulator cells, etc.)
  // which carry their own SeedDataBadge per row.
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200">
      <div className="mb-1 flex flex-wrap gap-2">
        <DisclaimerChip>Investor Tools</DisclaimerChip>
        <DisclaimerChip>Not financial advice</DisclaimerChip>
      </div>
      Investor Tools are for market intelligence and hypothetical scenario modelling only. They are not financial advice. Outputs are based on documented, estimated, inferred, or seed data as labelled. Future returns are not guaranteed.
    </div>
  );
}

function DisclaimerChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100/60 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
      {children}
    </span>
  );
}

export function InvestingCard({
  title,
  provider,
  score,
  reason,
  risk,
  href,
}: {
  title: string;
  provider: InvestmentProviderProfile | null;
  score?: number;
  reason?: string;
  risk?: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-[#071827]">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">{title}</div>
      {provider ? (
        <>
          <div className="mt-3 flex items-center justify-between gap-3">
            <VendorNameWithOwnership name={provider.name} ownershipType={ownershipFor(provider)} />
            <span className="font-mono text-lg font-semibold">{Math.round(score ?? provider.investmentAttractivenessScore)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Confidence value={provider.evidenceConfidence} />
            <EvidenceBadge grade={provider.evidenceGrade} />
          </div>
          <p className="mt-3 text-xs leading-5 text-[#596151] dark:text-zinc-400">{reason ?? provider.keyThesis}</p>
          <p className="mt-2 text-xs leading-5 text-[#7a5847] dark:text-amber-300">Risk: {risk ?? provider.mainRisk}</p>
        </>
      ) : (
        <div className="mt-3 text-sm text-[#596151] dark:text-zinc-400">No seed signal available.</div>
      )}
    </div>
  );

  return href && provider ? <Link href={href}>{body}</Link> : body;
}

export function ProviderScoreTable({ providers }: { providers: InvestmentProviderProfile[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-[#697362] dark:text-zinc-500">
          <tr>
            <th className="py-2 pr-4">Provider</th>
            <th className="py-2 pr-4">Exposure class</th>
            <th className="py-2 pr-4">Investability</th>
            <th className="py-2 pr-4">Provider quality</th>
            <th className="py-2 pr-4">Investment attractiveness</th>
            <th className="py-2 pr-4">Catalyst</th>
            <th className="py-2 pr-4">Long-term</th>
            <th className="py-2 pr-4">Valuation risk</th>
            <th className="py-2">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e7ebe2] dark:divide-zinc-800">
          {providers.map((provider) => (
            <tr key={provider.id}>
              <td className="py-3 pr-4 font-medium">
                <Link href={`/investor-tools/provider/${provider.slug}`}>
                  <VendorNameWithOwnership name={provider.name} ownershipType={ownershipFor(provider)} />
                  {provider.ticker && <span className="ml-2 text-xs text-[#697362] dark:text-zinc-500">{provider.ticker}</span>}
                </Link>
              </td>
              <td className="py-3 pr-4 text-xs">{label(provider.exposureClass)}</td>
              <td className="py-3 pr-4 text-xs">{label(provider.investabilityStatus)}</td>
              <td className="py-3 pr-4">{provider.aiProviderQualityScore}</td>
              <td className="py-3 pr-4">{provider.investmentAttractivenessScore}</td>
              <td className="py-3 pr-4">{provider.shortTermCatalystScore}</td>
              <td className="py-3 pr-4">{provider.longTermHoldScore}</td>
              <td className="py-3 pr-4">{provider.valuationRiskScore}</td>
              <td className="py-3"><Confidence value={provider.evidenceConfidence} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScoreStack({ provider }: { provider: InvestmentProviderProfile }) {
  return (
    <div className="space-y-3">
      <ScoreBar label="AI Provider Quality" value={provider.aiProviderQualityScore} />
      <ScoreBar label="Investment Attractiveness" value={provider.investmentAttractivenessScore} />
      <ScoreBar label="Short-Term Catalyst" value={provider.shortTermCatalystScore} />
      <ScoreBar label="Long-Term Hold" value={provider.longTermHoldScore} />
      <ScoreBar label="Speculative Upside" value={provider.speculativeUpsideScore} />
      <ScoreBar label="Valuation Risk" value={provider.valuationRiskScore} />
      <ScoreBar label="AI Capital Efficiency" value={provider.aiCapitalEfficiencyScore} />
      <ScoreBar label="Infrastructure Dependency" value={provider.infrastructureDependencyScore} />
    </div>
  );
}

export function SmallPanel({ title, children }: { title: string; children: ReactNode }) {
  return <Panel title={title}>{children}</Panel>;
}

export function ownershipFor(provider: InvestmentProviderProfile) {
  return provider.publicStatus === "public" ? "public" : provider.publicStatus === "private" ? "private" : "subsidiary";
}

export function label(value: string) {
  return value.replace(/_/g, " ");
}
