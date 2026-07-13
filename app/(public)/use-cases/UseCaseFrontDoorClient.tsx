"use client";

// C6 guided flow — two calm choices (industry, maturity) → a prioritised 2×2 the
// CIO reads at a glance. HONESTY CONTRACT (methodology: docs/c6-usecase-impact-
// feasibility.md + docs/c6-usecase-impact-curated-v1.md):
//  • Feasibility = deterministic model over REAL workflow attributes → a band, never
//    a false-precision number.
//  • Impact axis = EVIDENCED UPLIFT — a cited, evidence-graded band. No curated row ⇒
//    the honest "impact not yet evidenced" lane, never a default. $ value-at-stake is
//    a secondary, separately-sourced (usually vendor) chip, never drives placement.
//  • Counter-evidence (AI may NOT cleanly help) is shown as a flag, never hidden.
//  • Draft-framed: a starting map to pressure-test, not a verdict.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { IndustryTag } from "@/lib/use-cases";
import {
  frontDoorRank,
  commonFastWins,
  MATURITY_LEVELS,
  type MaturityId,
  type FrontDoorEntry,
  type PriorityQuadrant,
} from "@/lib/usecase-front-door";
import { bumpJourneyStepClient } from "@/lib/member/journey-client";

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

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";
const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5";

const FEAS_TONE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  low: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

const UPLIFT_LABEL: Record<string, string> = {
  "lt_10%": "<10%",
  "10_25%": "10–25%",
  "25_50%": "25–50%",
  "gt_50%": ">50%",
};
const VALUE_LABEL: Record<string, string> = {
  lt_250k: "<$250k/yr",
  "250k_1m": "$250k–1M/yr",
  "1m_5m": "$1–5M/yr",
  "5m_25m": "$5–25M/yr",
  gt_25m: ">$25M/yr",
};
const GRADE_TITLE: Record<string, string> = {
  E2: "E2 — public claim",
  E3: "E3 — vendor case study / commissioned study",
  E4: "E4 — major analyst or government evaluation",
  E5: "E5 — independent / peer-reviewed / RCT / court-validated",
};
const FLAG_META: Record<string, { label: string; blurb: string }> = {
  contested: { label: "Contested evidence", blurb: "Independent evidence that AI may NOT help here" },
  not_a_net_win: { label: "Not evidenced as a net win", blurb: "No independent study shows a net delivery gain" },
  accuracy_only: { label: "Accuracy only", blurb: "Model accuracy is evidenced, but not a realised business outcome" },
  capability_limited: { label: "Capability-limited", blurb: "Frontier models underperform on realistic enterprise tasks" },
};

const QUADRANT_META: Record<PriorityQuadrant, { label: string; blurb: string; tone: string }> = {
  quick_win: {
    label: "Quick wins",
    blurb: "High evidenced uplift · high feasibility. Start here.",
    tone: "border-emerald-400/50 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/20",
  },
  big_bet: {
    label: "Big bets",
    blurb: "High evidenced uplift · harder to land. Plan for them.",
    tone: "border-violet-400/50 bg-violet-50/60 dark:border-violet-800/50 dark:bg-violet-950/20",
  },
  easy_fill_in: {
    label: "Easy fill-ins",
    blurb: "Very feasible · more modest evidenced uplift.",
    tone: "border-sky-400/50 bg-sky-50/60 dark:border-sky-800/50 dark:bg-sky-950/20",
  },
  question_mark: {
    label: "Question marks",
    blurb: "Lower on both axes — revisit as evidence grows.",
    tone: "border-black/15 bg-black/[0.02] dark:border-white/15 dark:bg-white/[0.03]",
  },
};
const QUADRANT_ORDER: PriorityQuadrant[] = ["quick_win", "big_bet", "easy_fill_in", "question_mark"];

function Chips({ entry }: { entry: FrontDoorEntry }) {
  const { feasibility, impact, flags } = entry;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${FEAS_TONE[feasibility]}`}>
        {feasibility} feasibility
      </span>
      {impact ? (
        <span
          className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          title={`${impact.upliftBasis} — ${impact.sourceName} · ${impact.confidence}% confidence · directional estimate`}
        >
          uplift {UPLIFT_LABEL[impact.upliftBand] ?? impact.upliftBand}
          <span
            className="rounded-sm bg-black/10 px-1 text-[9px] font-bold dark:bg-white/15"
            title={GRADE_TITLE[impact.evidenceGrade] ?? impact.evidenceGrade}
          >
            {impact.evidenceGrade}
          </span>
        </span>
      ) : (
        <span className={`rounded border border-dashed border-black/20 px-1.5 py-0.5 text-xs dark:border-white/20 ${MUTED}`}>
          impact not yet evidenced
        </span>
      )}
      {impact?.value && (
        <span
          className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200"
          title={`${impact.value.basis} — ${impact.value.sourceName} · ${GRADE_TITLE[impact.value.evidenceGrade] ?? impact.value.evidenceGrade} · vendor-sourced, directional`}
        >
          value {VALUE_LABEL[impact.value.band] ?? impact.value.band} · vendor-sourced
        </span>
      )}
      {flags.map((f, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded border border-rose-400/50 bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-300"
          title={`${f.summary} — ${f.sourceName} (${f.evidenceGrade})`}
        >
          ⚠ {FLAG_META[f.kind]?.label ?? f.kind}
        </span>
      ))}
    </div>
  );
}

// Accessible evidence disclosure — the cited source as a CLICKABLE link (matching
// /legislation), not a hover-only title. So the provenance that is this product's
// whole point is reachable on mobile + keyboard + screen-reader, not just on hover.
const SRC_LINK =
  "font-medium text-sky-700 underline underline-offset-2 hover:no-underline dark:text-sky-400";
function Evidence({ entry }: { entry: FrontDoorEntry }) {
  const { impact, flags } = entry;
  if (!impact && flags.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className={`cursor-pointer list-none text-xs font-medium ${MUTED} hover:underline`}>
        Evidence &amp; sources
      </summary>
      <div className="mt-1.5 space-y-1.5 border-l-2 border-black/10 pl-2.5 dark:border-white/15">
        {impact && (
          <p className="text-xs leading-4">
            <span className="font-medium text-[#13294b] dark:text-[#eef3f8]">
              Uplift {UPLIFT_LABEL[impact.upliftBand] ?? impact.upliftBand} · {impact.evidenceGrade} · {impact.confidence}% confidence · {impact.asOf}
            </span>{" "}
            <span className={MUTED}>{impact.upliftBasis}.</span>{" "}
            <a href={impact.sourceUrl} target="_blank" rel="noopener noreferrer" className={SRC_LINK}>
              {impact.sourceName} ↗
            </a>{" "}
            <span className={MUTED}>— directional estimate.</span>
          </p>
        )}
        {impact?.value && (
          <p className="text-xs leading-4">
            <span className="font-medium text-amber-800 dark:text-amber-300">
              Value {VALUE_LABEL[impact.value.band] ?? impact.value.band} · {impact.value.evidenceGrade} · vendor-sourced
            </span>{" "}
            <span className={MUTED}>{impact.value.basis}.</span>{" "}
            <a href={impact.value.sourceUrl} target="_blank" rel="noopener noreferrer" className={SRC_LINK}>
              {impact.value.sourceName} ↗
            </a>
          </p>
        )}
        {flags.map((f, i) => (
          <p key={i} className="text-xs leading-4">
            <span className="font-medium text-rose-800 dark:text-rose-300">⚠ {FLAG_META[f.kind]?.label ?? f.kind} · {f.evidenceGrade}</span>{" "}
            <span className={MUTED}>{f.summary}</span>{" "}
            <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className={SRC_LINK}>
              {f.sourceName} ↗
            </a>
          </p>
        ))}
      </div>
    </details>
  );
}

function EntryRow({ entry }: { entry: FrontDoorEntry }) {
  return (
    <li className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{entry.useCase.label}</h3>
          {entry.useCase.description && (
            <p className={`mt-1 max-w-2xl text-xs leading-5 ${MUTED}`}>{entry.useCase.description}</p>
          )}
        </div>
      </div>
      <div className="mt-2.5">
        <Chips entry={entry} />
      </div>
      <Evidence entry={entry} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {entry.routes.map((r) => (
          <Link
            key={r}
            href={`/category/${r}`}
            onClick={() => bumpJourneyStepClient(2)}
            className="rounded-full bg-[#b08d2f] px-3 py-1 text-xs font-semibold text-[#1a1605] transition-colors hover:bg-[#987625] dark:bg-[#d4af37] dark:text-[#1a1605] dark:hover:bg-[#e8c95c]"
          >
            See the shortlist: {CATEGORY_LABEL[r] ?? r} →
          </Link>
        ))}
      </div>
    </li>
  );
}

export default function UseCaseFrontDoorClient() {
  const [industry, setIndustry] = useState<IndustryTag | null>(null);
  const [maturity, setMaturity] = useState<MaturityId | null>(null);
  const [showAllPending, setShowAllPending] = useState(false);

  // Golden path (Prompt 4), step 1 of 5. Landing here starts the guided journey.
  useEffect(() => {
    bumpJourneyStepClient(1);
  }, []);

  const results: FrontDoorEntry[] = useMemo(
    () => (industry && maturity ? frontDoorRank(industry, maturity) : []),
    [industry, maturity],
  );
  const preview = useMemo(() => commonFastWins(6), []);
  const selectionComplete = Boolean(industry && maturity);

  // Split into the 2×2 (evidenced impact) + the honest "not yet evidenced" lane.
  const byQuadrant = useMemo(() => {
    const m: Record<PriorityQuadrant, FrontDoorEntry[]> = {
      quick_win: [], big_bet: [], easy_fill_in: [], question_mark: [],
    };
    for (const e of results) if (e.quadrant) m[e.quadrant].push(e);
    return m;
  }, [results]);
  const pending = useMemo(() => results.filter((e) => !e.quadrant), [results]);
  const placedCount = results.length - pending.length;

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

      {/* Cold-state preview — never a bare selector screen. */}
      {!selectionComplete && preview.length > 0 && (
        <section>
          <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/50 dark:text-amber-200">
            <strong>Common fast wins to start.</strong> High-feasibility workflows most teams can land
            early. Pick your industry and maturity above for the full impact × feasibility map.
          </div>
          <ol className="space-y-3">
            {preview.map((e) => (
              <EntryRow key={e.useCase.id} entry={e} />
            ))}
          </ol>
        </section>
      )}

      {/* The 2×2 map */}
      {selectionComplete && (
        <section className="space-y-4">
          <div className="rounded-md border border-sky-300/40 bg-sky-50/60 px-3 py-2 text-xs text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-200">
            <strong>Draft map — pressure-test this.</strong> Feasibility is a transparent, deterministic
            model over the workflow&apos;s real attributes. Impact is <em>evidenced task uplift</em> — a
            cited, evidence-graded band (E2–E5); where no credible source exists we say &ldquo;impact not
            yet evidenced&rdquo; rather than invent one. Uplift is usually a task-level figure from
            independent studies — not a promise of org-wide gains. Not a verdict.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {QUADRANT_ORDER.map((q) => {
              const meta = QUADRANT_META[q];
              const entries = byQuadrant[q];
              return (
                <div key={q} className={`rounded-xl border p-4 ${meta.tone}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#13294b] dark:text-[#eef3f8]">{meta.label}</h3>
                    <span className={`text-xs ${MUTED}`}>{entries.length}</span>
                  </div>
                  <p className={`mb-3 text-xs ${MUTED}`}>{meta.blurb}</p>
                  {entries.length === 0 ? (
                    <p className={`text-xs italic ${MUTED}`}>Nothing evidenced here for this selection.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {entries.map((e) => (
                        <li key={e.useCase.id} className="rounded-lg border border-black/5 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/5">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-xs font-semibold">{e.useCase.label}</span>
                          </div>
                          <div className="mt-1.5">
                            <Chips entry={e} />
                          </div>
                          <Evidence entry={e} />
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {e.routes.map((r) => (
                              <Link
                                key={r}
                                href={`/category/${r}`}
                                onClick={() => bumpJourneyStepClient(2)}
                                className="rounded-full border border-[#b08d2f]/50 px-2 py-0.5 text-xs font-medium text-[#8a6d1f] hover:bg-[#b08d2f]/10 dark:border-[#d4af37]/40 dark:text-[#d4af37]"
                              >
                                {CATEGORY_LABEL[r] ?? r} →
                              </Link>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {/* Impact-not-yet-evidenced lane — feasibility shown, impact honestly absent. */}
          {pending.length > 0 && (
            <div className={`${CARD} p-4`}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-[#13294b] dark:text-[#eef3f8]">Impact not yet evidenced</h3>
                <span className={`text-xs ${MUTED}`}>{pending.length}</span>
              </div>
              <p className={`mb-3 text-xs ${MUTED}`}>
                Feasible to varying degrees, but we have no cited impact estimate for these yet — so we
                don&apos;t place them on the map. {placedCount} of {results.length} workflows are evidenced.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {(showAllPending ? pending : pending.slice(0, 8)).map((e) => (
                  <li key={e.useCase.id} className="rounded-lg border border-black/5 px-2.5 py-2 dark:border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium">{e.useCase.label}</span>
                      <Chips entry={e} />
                    </div>
                    <Evidence entry={e} />
                  </li>
                ))}
              </ul>
              {pending.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllPending((s) => !s)}
                  className={`mt-3 text-xs underline underline-offset-2 ${MUTED}`}
                >
                  {showAllPending ? "Show fewer" : `Show all ${pending.length}`}
                </button>
              )}
            </div>
          )}

          <p className={`text-xs leading-5 ${MUTED}`}>
            Impact estimates are analyst-curated from named, checkable sources (methodology + full source
            list in the C6 curation doc), shown as evidence-graded directional bands. A dollar value
            appears only where a named — usually vendor — source gives one, flagged as such. Where AI is
            not clearly a net win, we flag it rather than hide it.
          </p>
        </section>
      )}
    </div>
  );
}
