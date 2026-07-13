"use client";

// Legislative / regulatory tracker — client filter UI over the curated, cited
// register. Pure presentation over static reference data passed from the server
// shell; no fetch, no LLM. Honesty: every card shows its primary-source link,
// status, "as of" date, a directional flag where interpretation is involved, and
// the whole surface carries the "not legal advice" + "pending analyst review"
// disclaimers. Impact is NEVER shown — we cite what an instrument requires and
// which assessment domains it touches, not an invented number.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LegislativeInstrument, Jurisdiction } from "@/lib/legislative/instruments";
import { JURISDICTION_LABEL, STATUS_LABEL } from "@/lib/legislative/instruments";
import { filterInstruments, domainLabelsFor } from "@/lib/legislative/registry";
import type { IndustryTag } from "@/lib/use-cases";

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";
const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5";

const VERTICAL_LABEL: Record<string, string> = {
  financial_services: "Financial services",
  insurance: "Insurance",
  healthcare: "Healthcare",
  pharma_life_sciences: "Pharma & life sciences",
  legal: "Legal",
  professional_services: "Professional services",
  technology_software: "Technology & software",
  manufacturing: "Manufacturing",
  retail_consumer: "Retail & consumer",
  telecom_media: "Telecom & media",
  public_sector: "Public sector",
  education: "Education",
  energy_utilities: "Energy & utilities",
  transport_logistics: "Transport & logistics",
  real_estate: "Real estate",
  aerospace_defence: "Aerospace & defence",
};

const STATUS_TONE: Record<string, string> = {
  in_force: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-300",
  enacted: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700/60 dark:bg-sky-950/50 dark:text-sky-300",
  proposed: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200",
  framework: "border-[#d6c9a8] bg-[#f6f1e3] text-[#3f5068] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#c2d1e0]",
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function InstrumentCard({ inst }: { inst: LegislativeInstrument }) {
  const inForce = fmtDate(inst.inForceDate);
  const chips = domainLabelsFor(inst);
  return (
    <li className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">{inst.shortName}</h3>
            <span className={`rounded-full border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_TONE[inst.status]}`}>
              {STATUS_LABEL[inst.status]}
            </span>
            {inst.directional && (
              <span
                className="rounded-full border border-[#e0d6ba] px-1.5 py-0.5 text-xs font-medium text-[#8a6d1f] dark:border-[#4a3d1a] dark:text-[#caa54a]"
                title="Scope/status involves interpretation — read directionally, verify against the source."
              >
                directional
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-xs ${MUTED}`}>
            {JURISDICTION_LABEL[inst.jurisdiction]} · {inst.name}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {inForce ? (
            <div className="text-xs">
              <span className={MUTED}>In force </span>
              <span className="font-mono tabular-nums text-[#13294b] dark:text-[#eef3f8]">{inForce}</span>
            </div>
          ) : (
            <div className={`text-xs ${MUTED}`}>no single in-force date</div>
          )}
        </div>
      </div>

      <p className="mt-2 max-w-2xl text-xs leading-5 text-[#15263c] dark:text-[#eef3f8]">{inst.whatItRequires}</p>
      {inst.timelineNote && <p className={`mt-1 max-w-2xl text-xs leading-5 ${MUTED}`}>{inst.timelineNote}</p>}

      {/* Domain tie-in — the reg → the assessment domains it touches → vendor evidence. */}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}>Touches</span>
          {chips.map((c) => (
            <span
              key={c.id}
              className="rounded border border-[#e0d6ba] bg-[#faf6ec] px-1.5 py-0.5 text-xs text-[#475a72] dark:border-[#2a4a6b] dark:bg-[#143049] dark:text-[#c2d1e0]"
            >
              {c.label}
            </span>
          ))}
        </div>
      )}

      {inst.verticals.length > 0 && (
        <p className={`mt-2 text-xs ${MUTED}`}>
          Sector-specific: {inst.verticals.map((v) => VERTICAL_LABEL[v] ?? v).join(", ")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#ece4d0] pt-2 dark:border-[#1d3a57]">
        <a
          href={inst.citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-sky-700 underline underline-offset-2 hover:no-underline dark:text-sky-400"
        >
          Primary source: {inst.citation.sourceName} ↗
        </a>
        <span className={`text-xs ${MUTED}`}>as of {fmtDate(inst.asOf)}</span>
      </div>
    </li>
  );
}

export default function LegislationClient({
  instruments,
  jurisdictions,
  verticals,
}: {
  instruments: LegislativeInstrument[];
  jurisdictions: Jurisdiction[];
  verticals: IndustryTag[];
}) {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null);
  const [vertical, setVertical] = useState<IndustryTag | null>(null);

  const filtered = useMemo(
    () => filterInstruments({ jurisdiction, vertical, source: instruments }),
    [jurisdiction, vertical, instruments],
  );

  const chipCls = (active: boolean) =>
    `rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-[#13294b] bg-[#13294b] text-white dark:border-[#d4af37] dark:bg-[#d4af37] dark:text-[#0a1f38]"
        : "border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
    }`;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-semibold">Jurisdiction</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setJurisdiction(null)} className={chipCls(jurisdiction === null)}>
            All
          </button>
          {jurisdictions.map((j) => (
            <button key={j} type="button" onClick={() => setJurisdiction(j)} className={chipCls(jurisdiction === j)}>
              {JURISDICTION_LABEL[j]}
            </button>
          ))}
        </div>

        {verticals.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-semibold">Sector lens</h2>
            <p className={`mt-1 text-xs ${MUTED}`}>
              Filtering by a sector keeps economy-wide instruments AND that sector&apos;s specific rules.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setVertical(null)} className={chipCls(vertical === null)}>
                All sectors
              </button>
              {verticals.map((v) => (
                <button key={v} type="button" onClick={() => setVertical(v)} className={chipCls(vertical === v)}>
                  {VERTICAL_LABEL[v] ?? v}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Register */}
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-[var(--font-display)] text-lg font-extrabold tracking-tight">
            Instruments{" "}
            <span className={`text-sm font-normal ${MUTED}`}>
              ({filtered.length}
              {jurisdiction || vertical ? " matching" : ""})
            </span>
          </h2>
        </div>
        {filtered.length === 0 ? (
          <div className={`${CARD} p-5`}>
            <p className="text-sm">No tracked instrument matches this filter yet. Clear the filter to see the full register.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {filtered.map((inst) => (
              <InstrumentCard key={inst.id} inst={inst} />
            ))}
          </ol>
        )}
      </section>

      <p className={`text-xs leading-5 ${MUTED}`}>
        Each instrument maps to the{" "}
        <Link href="/insights" className="underline underline-offset-2 hover:no-underline">
          assessment domains
        </Link>{" "}
        it touches (the NIST / ISO 42001 / EU AI Act crosswalk) — so you can trace a regulation to the domains, then to the{" "}
        <Link href="/vendors" className="underline underline-offset-2 hover:no-underline">
          vendors&apos; evidence
        </Link>{" "}
        on them.
      </p>
    </div>
  );
}
