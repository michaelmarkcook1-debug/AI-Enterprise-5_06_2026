// The honest use-case surface (2026-07-13 owner reframe). Replaces the industry ×
// maturity gate — which implied a per-industry sourcing read the evidence didn't
// support (23 of 29 cited rows are horizontal) — with the CITED evidence itself,
// ungated and strongest-first. Pure server component; every figure is a real,
// named-source row from lib/usecase-impact-data (never synthesised, never a
// default). Where AI isn't clearly a net win, the counter-evidence flag shows.

import Link from "next/link";
import { evidencedUseCases, unevidencedUseCaseCount, type EvidencedUseCase } from "@/lib/usecase-front-door";

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";
const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5";

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
const UPLIFT_LABEL: Record<string, string> = { "lt_10%": "<10%", "10_25%": "10–25%", "25_50%": "25–50%", "gt_50%": ">50%" };
const VALUE_LABEL: Record<string, string> = {
  lt_250k: "<$250k/yr", "250k_1m": "$250k–1M/yr", "1m_5m": "$1–5M/yr", "5m_25m": "$5–25M/yr", gt_25m: ">$25M/yr",
};
const GRADE_TITLE: Record<string, string> = {
  E2: "E2 — public claim",
  E3: "E3 — vendor case study / commissioned study",
  E4: "E4 — major analyst or government evaluation",
  E5: "E5 — independent / peer-reviewed / RCT / court-validated",
};
const FLAG_LABEL: Record<string, string> = {
  contested: "Contested evidence",
  not_a_net_win: "Not evidenced as a net win",
  accuracy_only: "Accuracy only",
  capability_limited: "Capability-limited",
};
const INDUSTRY_LABEL: Record<string, string> = {
  financial_services: "Financial services",
  legal: "Legal",
  technology_software: "Technology & software",
  healthcare: "Healthcare",
  insurance: "Insurance",
};

function Row({ e }: { e: EvidencedUseCase }) {
  const { useCase, impact, flags, routes } = e;
  const scope =
    impact.industryTag === "*"
      ? "cross-industry evidence"
      : `${INDUSTRY_LABEL[impact.industryTag] ?? impact.industryTag}-specific study`;
  return (
    <li className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{useCase.label}</h3>
          {useCase.description && <p className={`mt-1 max-w-2xl text-sm leading-6 ${MUTED}`}>{useCase.description}</p>}
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded bg-[#b08d2f]/12 px-2 py-0.5 text-sm font-semibold text-[#8a6d1f] dark:bg-[#d4af37]/15 dark:text-[#d4af37]"
          title={`${impact.confidence}% confidence · directional estimate`}
        >
          +{UPLIFT_LABEL[impact.upliftBand] ?? impact.upliftBand} task uplift
          <span className="rounded-sm bg-black/10 px-1 text-xs font-bold dark:bg-white/15" title={GRADE_TITLE[impact.evidenceGrade] ?? impact.evidenceGrade}>
            {impact.evidenceGrade}
          </span>
        </span>
      </div>

      <p className="mt-2 text-sm leading-6">
        <span className={MUTED}>{impact.upliftBasis}.</span>{" "}
        <a href={impact.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 underline underline-offset-2 hover:no-underline dark:text-sky-400">
          {impact.sourceName} ↗
        </a>{" "}
        <span className={MUTED}>· {scope} · as of {impact.asOf} · directional estimate.</span>
      </p>

      {impact.value && (
        <p className="mt-1 text-sm leading-6">
          <span className="font-medium text-amber-800 dark:text-amber-300">Value {VALUE_LABEL[impact.value.band] ?? impact.value.band} · vendor-sourced</span>{" "}
          <span className={MUTED}>{impact.value.basis}.</span>{" "}
          <a href={impact.value.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 underline underline-offset-2 hover:no-underline dark:text-sky-400">
            {impact.value.sourceName} ↗
          </a>
        </p>
      )}

      {flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {flags.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded border border-rose-400/50 bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-300"
              title={`${f.summary} — ${f.sourceName} (${f.evidenceGrade})`}
            >
              ⚠ {FLAG_LABEL[f.kind] ?? f.kind}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`text-xs font-medium ${MUTED}`}>See vendors:</span>
        {routes.map((r) => (
          <Link
            key={r}
            href={`/category/${r}`}
            className="rounded-full bg-[#b08d2f] px-3 py-1 text-xs font-semibold text-[#1a1605] transition-colors hover:bg-[#987625] dark:bg-[#d4af37] dark:hover:bg-[#e8c95c]"
          >
            {CATEGORY_LABEL[r] ?? r} →
          </Link>
        ))}
      </div>
    </li>
  );
}

export default function UseCaseEvidenceLibrary() {
  const entries = evidencedUseCases();
  const unevidenced = unevidencedUseCaseCount();

  return (
    <section>
      <ol className="space-y-3">
        {entries.map((e, i) => (
          <Row key={`${e.useCase.id}-${e.impact.industryTag}-${i}`} e={e} />
        ))}
      </ol>
      <p className={`mt-5 max-w-3xl text-sm leading-6 ${MUTED}`}>
        These <strong className="text-[#13294b] dark:text-[#eef3f8]">{entries.length}</strong> workflows have an
        independently-cited, evidence-graded study behind their task-level uplift — most cross-industry, a few
        industry-specific (labelled). Another <strong className="text-[#13294b] dark:text-[#eef3f8]">{unevidenced}</strong>{" "}
        workflows in the library have no cited impact study yet, so we don&apos;t put a number on them rather than
        guess. Uplift is a task-level figure from a single study — not a promise of org-wide gains; where AI isn&apos;t
        clearly a net win, we flag it.
      </p>
    </section>
  );
}
