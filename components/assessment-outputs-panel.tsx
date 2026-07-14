// Surfaces the latest assessment's v1.3 outputs on Monitor + Demonstrate.
// ────────────────────────────────────────────────────────────────────────
// Previously the assessment→Monitor/Demonstrate hand-off carried only vendor
// IDs + a few context strings, so opportunity value, EU AI Act risk class,
// stack concentration and the scoring rationale never reached these tabs.
// This compact panel reads a persisted AssessmentResult and shows them,
// colour-coded. Server component (no interactivity).

import Link from "next/link";
import type { AssessmentResult } from "@/lib/types";
import { toneClasses } from "@/lib/ui/semantic-colors";

function fmtBand(token?: string): string {
  if (!token) return "—";
  return token
    .replace(/_/g, " ")
    .replace(/\blt /g, "< ")
    .replace(/\bgt /g, "> ")
    .replace(/(\d+)m\b/g, "£$1M")
    .replace(/(\d+)k\b/g, "£$1k");
}
function fmtMoney(n?: number): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${n}`;
}

const PRIORITY_TONE = { flagship: "emerald", high: "emerald", medium: "sky", low: "slate" } as const;
const RISK_TONE = { minimal: "emerald", limited: "amber", high_risk: "rose", prohibited_adjacent: "rose" } as const;

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#e3d9c0] bg-[#faf7ef] px-3 py-2.5 dark:border-[#223a2e] dark:bg-[#0d1f17]">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7d93] dark:text-[#7a9bb8]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">{children}</div>
    </div>
  );
}

export default function AssessmentOutputsPanel({ result }: { result: AssessmentResult }) {
  const opp = result.opportunity;
  const conc = result.buyerConcentration;
  const riskClass = result.inputSummary?.useCaseRiskClass;
  const top = result.ranking?.find((v) => !v.excluded);
  const rationale = result.tierOverlay?.rationale ?? [];

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-[#e3d9c0] bg-[#fffdf7] dark:border-[#223a2e] dark:bg-[#0d1f17]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece4d0] px-4 py-3 dark:border-[#16314e]">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#3f5068] dark:text-[#9fb3c8]">
          From your latest assessment
        </h2>
        <span className="text-xs text-[#6b7d93] dark:text-[#7a9bb8]">
          {result.inputSummary?.industryName ?? "—"} · {new Date(result.generatedAt).toLocaleDateString("en-GB")}
        </span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {opp && (
          <Stat label="Opportunity value">
            <span className={`mr-1.5 rounded px-1.5 py-0.5 text-xs font-bold uppercase ${toneClasses(PRIORITY_TONE[opp.priority] ?? "slate")}`}>{opp.priority}</span>
            {opp.estimatedAnnualValue != null ? fmtMoney(opp.estimatedAnnualValue) + "/yr" : fmtBand(opp.valueAtStake)}
          </Stat>
        )}
        {riskClass && (
          <Stat label="EU AI Act class">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${toneClasses(RISK_TONE[riskClass] ?? "slate")}`}>{fmtBand(riskClass)}</span>
          </Stat>
        )}
        {conc?.topParent && (
          <Stat label="Stack concentration">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${toneClasses(conc.share >= 0.6 ? "amber" : "slate")}`}>
              {Math.round(conc.share * 100)}% {conc.topParent}
            </span>
          </Stat>
        )}
        {top && (
          <Stat label="Lead recommendation">
            {top.vendorName} <span className="text-[#6b7d93] dark:text-[#7a9bb8]">· {top.finalScore.toFixed(0)}/100</span>
          </Stat>
        )}
      </div>

      {rationale.length > 0 && (
        <div className="border-t border-[#ece4d0] px-4 py-3 dark:border-[#16314e]">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7d93] dark:text-[#7a9bb8]">What shaped the scoring</div>
          <ul className="space-y-1">
            {rationale.slice(0, 3).map((r) => (
              <li key={r} className="flex gap-2 text-xs leading-5 text-[#475a72] dark:text-[#a7bacd]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#a07f1f] dark:bg-[#d4af37]" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-[#ece4d0] px-4 py-2 dark:border-[#16314e]">
        <Link href={`/results/${result.runId}`} className="text-xs font-medium text-[#a07f1f] hover:underline dark:text-[#d4af37]">
          View full assessment →
        </Link>
      </div>
    </section>
  );
}
