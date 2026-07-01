"use client";

// C6 guided flow — two calm choices (industry, maturity) → prioritised use-cases.
// HONESTY CONTRACT (methodology: docs/c6-usecase-impact-feasibility.md):
//  • Feasibility = deterministic model over REAL workflow attributes → shown as a
//    band with the formula disclosed, never a false-precision number.
//  • Impact = curated + cited per (use-case × industry). No curated row ⇒ the
//    honest "impact not yet evidenced" state — never a default.
//  • Draft-framed: a starting map to pressure-test, not a verdict.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { IndustryTag } from "@/lib/use-cases";
import {
  frontDoorRank,
  MATURITY_LEVELS,
  type MaturityId,
  type FrontDoorEntry,
} from "@/lib/usecase-front-door";

const INDUSTRIES: { id: IndustryTag; label: string }[] = [
  { id: "financial_services", label: "Financial services" },
  { id: "insurance", label: "Insurance" },
  { id: "healthcare", label: "Healthcare" },
  { id: "pharma_life_sciences", label: "Pharma & life sciences" },
  { id: "legal", label: "Legal" },
  { id: "professional_services", label: "Professional services" },
  { id: "technology_software", label: "Technology & software" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "retail_consumer", label: "Retail & consumer" },
  { id: "telecom_media", label: "Telecom & media" },
  { id: "public_sector", label: "Public sector" },
  { id: "education", label: "Education" },
  { id: "energy_utilities", label: "Energy & utilities" },
  { id: "transport_logistics", label: "Transport & logistics" },
  { id: "real_estate", label: "Real estate" },
  { id: "aerospace_defence", label: "Aerospace & defence" },
];

const CATEGORY_LABEL: Record<string, string> = {
  frontier_model_api: "Frontier model APIs",
  enterprise_assistant: "Enterprise assistants",
  developer_coding_agent: "Developer & coding agents",
  agent_platform: "Agent platforms",
  rag_enterprise_search: "RAG & enterprise search",
  workflow_automation_ai: "Workflow automation AI",
  crm_customer_ai: "CRM & customer AI",
  itsm_hr_service_ai: "ITSM / HR / service AI",
  cloud_ai_platform: "Cloud AI platforms",
  regulated_industry_ai: "Regulated-industry AI",
  ai_silicon: "AI silicon",
  ai_cloud_compute: "AI cloud compute",
  neocloud_inference: "Neocloud inference",
};

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";
const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5";

const FEAS_TONE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  low: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

export default function UseCaseFrontDoorClient() {
  const [industry, setIndustry] = useState<IndustryTag | null>(null);
  const [maturity, setMaturity] = useState<MaturityId | null>(null);
  const [showAll, setShowAll] = useState(false);

  const results: FrontDoorEntry[] = useMemo(
    () => (industry && maturity ? frontDoorRank(industry, maturity) : []),
    [industry, maturity],
  );
  const visible = showAll ? results : results.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Step 1 — industry */}
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-semibold">1 · Your industry</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {INDUSTRIES.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setIndustry(i.id)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                industry === i.id
                  ? "border-[#13294b] bg-[#13294b] text-white dark:border-[#d4af37] dark:bg-[#d4af37] dark:text-[#0a1f38]"
                  : "border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </section>

      {/* Step 2 — maturity */}
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-semibold">2 · Your data & AI maturity</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MATURITY_LEVELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMaturity(m.id)}
              className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                maturity === m.id
                  ? "border-[#13294b] bg-[#13294b] text-white dark:border-[#d4af37] dark:bg-[#d4af37] dark:text-[#0a1f38]"
                  : "border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {/* Results */}
      {industry && maturity && (
        <section>
          <div className="mb-3 rounded-md border border-sky-300/40 bg-sky-50/60 px-3 py-2 text-xs text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-200">
            <strong>Draft map — pressure-test this.</strong> A starting view from a transparent
            feasibility model over our curated workflow library, not a verdict. Feasibility ranks
            how easy a workflow is to land — it says nothing about whether it&apos;s worth doing;
            that&apos;s impact, shown only where a cited estimate exists.
          </div>

          <ol className="space-y-3">
            {visible.map((e) => (
              <li key={e.useCase.id} className={`${CARD} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{e.useCase.label}</h3>
                    {e.useCase.description && (
                      <p className={`mt-1 max-w-2xl text-xs leading-5 ${MUTED}`}>{e.useCase.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${FEAS_TONE[e.feasibility]}`}>
                      {e.feasibility} feasibility
                    </span>
                    {e.impact ? (
                      <span
                        className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        title={`${e.impact.sourceName} · ${e.impact.evidenceGrade} · ${e.impact.confidence}% confidence · directional estimate`}
                      >
                        impact: {e.impact.valueBand.replace(/_/g, "–")} · uplift {e.impact.upliftBand}
                      </span>
                    ) : (
                      <span className={`rounded border border-dashed border-black/20 px-1.5 py-0.5 text-[10px] dark:border-white/20 ${MUTED}`}>
                        impact not yet evidenced
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={MUTED}>Vendors for this:</span>
                  {e.routes.map((r) => (
                    <Link
                      key={r}
                      href={`/category/${r}`}
                      className="rounded-full border border-black/15 px-2 py-0.5 font-medium underline-offset-2 hover:underline dark:border-white/15"
                    >
                      {CATEGORY_LABEL[r] ?? r} →
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          {results.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className={`mt-3 text-xs underline underline-offset-2 ${MUTED}`}
            >
              {showAll ? "Show top 10" : `Show all ${results.length} workflows`}
            </button>
          )}

          <p className={`mt-4 text-[11px] leading-5 ${MUTED}`}>
            Feasibility is a documented, deterministic model over the workflow library&apos;s real
            attributes (complexity, reliability bar, risk tier, regulatory load) plus your stated
            maturity — methodology in the open. Impact estimates appear only as cited, evidence-graded
            directional bands; where none exists we say so rather than inventing one.
          </p>
        </section>
      )}
    </div>
  );
}
