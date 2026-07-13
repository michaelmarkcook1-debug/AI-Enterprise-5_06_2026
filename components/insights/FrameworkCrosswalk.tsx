// C2 — Framework-mapping crosswalk (public, on /insights).
// Renders the 12 assessment domains → NIST AI RMF / ISO/IEC 42001 / EU AI Act.
// POSITIONING ONLY (C14): "aligned to / informed by" — never certification or
// endorsement. The whole crosswalk is labelled "indicative — pending analyst
// review" until an analyst signs off. Server component; pure reference data.

import Link from "next/link";
import {
  getFrameworkCrosswalk,
  FRAMEWORK_SOURCES,
  CROSSWALK_STATUS,
  type MappingStrength,
} from "@/lib/insights/framework-crosswalk";

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

function StrengthChip({ strength }: { strength: MappingStrength }) {
  const map: Record<MappingStrength, { label: string; cls: string }> = {
    solid: { label: "aligned", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
    partial: { label: "partial", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
    gap: { label: "no clean mapping", cls: "bg-[#ece3cb] text-[#3f5068] dark:bg-[#143049] dark:text-[#a7bacd]" },
  };
  const { label, cls } = map[strength];
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function Refs({ refs }: { refs: string[] }) {
  if (refs.length === 0) return <span className={`text-xs ${MUTED}`}>—</span>;
  return (
    <ul className="space-y-0.5">
      {refs.map((r) => (
        <li key={r} className="text-xs leading-5">{r}</li>
      ))}
    </ul>
  );
}

export default function FrameworkCrosswalk() {
  const rows = getFrameworkCrosswalk();

  return (
    <section className="mb-10" id="framework-alignment">
      <h2 className="mb-1 font-[var(--font-display)] text-xl font-extrabold tracking-tight">
        Framework alignment
      </h2>
      <p className={`mb-3 max-w-2xl text-sm ${MUTED}`}>
        How the 12 assessment domains line up with the governance frameworks your risk, audit and procurement
        functions already recognise — so the scorecard is an artifact you can defend to a board, not one firm&rsquo;s
        opinion.
      </p>

      {/* Positioning + status — the two claims that keep this honest. */}
      <div className="mb-4 space-y-2">
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Indicative — pending analyst review.</strong> This crosswalk is a draft mapping shown for review.
          References are given to the framework <em>function / control-objective / article</em> level (verified against
          the primary sources); finer sub-control precision is not yet asserted. Treat it as directional until an
          analyst who works with these frameworks has signed it off.
        </p>
        <p className={`text-xs leading-5 ${MUTED}`}>
          <strong>Aligned to / informed by — not certified.</strong> These are independent frameworks we map our
          rubric against for transparency. Nothing here implies certification, endorsement, or accreditation by NIST,
          ISO/IEC, or the EU, and no official marks are used.
        </p>
      </div>

      {/* Primary sources */}
      <div className={`mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs ${MUTED}`}>
        <span>Primary sources:</span>
        {Object.values(FRAMEWORK_SOURCES).map((s) => (
          <a
            key={s.name}
            href={s.primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
            title={s.full}
          >
            {s.name} ↗
          </a>
        ))}
      </div>

      {/* Crosswalk table */}
      <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[720px] text-left">
          <thead className="bg-black/[0.03] text-xs uppercase tracking-wide dark:bg-white/5">
            <tr>
              <th className="px-3 py-2 font-semibold">Assessment domain</th>
              <th className="px-3 py-2 font-semibold">NIST AI RMF</th>
              <th className="px-3 py-2 font-semibold">ISO/IEC 42001</th>
              <th className="px-3 py-2 font-semibold">EU AI Act</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {rows.map((r) => (
              <tr key={r.domain} className="align-top">
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{r.label}</span>
                    <StrengthChip strength={r.strength} />
                  </div>
                  <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{r.cioLine}</p>
                  <p className="mt-1 text-xs leading-5 text-[#7a8aa0] dark:text-[#8fa5bb]">{r.note}</p>
                </td>
                <td className="px-3 py-3"><Refs refs={r.nist} /></td>
                <td className="px-3 py-3"><Refs refs={r.iso} /></td>
                <td className="px-3 py-3"><Refs refs={r.euAiAct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tie back to the deterministic rubric / evidence trail (C3). */}
      <p className={`mt-3 max-w-3xl text-xs leading-5 ${MUTED}`}>
        Each domain&rsquo;s alignment traces to the same deterministic rubric behind the rankings: a 0–5 score built
        only from reviewed, source-backed evidence, with every score clicking through to its citations. &ldquo;Aligned
        to NIST MAP&rdquo; is a mapping of the domain, not a decorative badge —{" "}
        <Link href="/vendors" className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
          see the evidence trail on any vendor
        </Link>{" "}
        for what actually moved a score. Status: {CROSSWALK_STATUS}.
      </p>
    </section>
  );
}
