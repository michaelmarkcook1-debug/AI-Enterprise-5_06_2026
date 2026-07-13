// Explainability for the composite ranking — shows WHICH criteria + weights drove
// a vendor's position, tied to the evidence/trust layer. Pure server component
// (native <details>, no client JS — keeps the lean public shell). Dark pillars
// render an explicit "insufficient evidence" row, never a default value.

import type { CategoryRankedVendor, EvidenceCompleteness } from "@/lib/ranking/composite-types";
import type { EvidenceGrade } from "@/lib/types";

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

const GRADE_TONE: Record<EvidenceGrade, string> = {
  E0: "border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  E1: "border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  E2: "border-amber-400/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  E3: "border-yellow-400/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300",
  E4: "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  E5: "border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

const COMPLETENESS_LABEL: Record<EvidenceCompleteness, string> = {
  full: "full evidence",
  substantial: "substantial evidence",
  partial: "partial evidence",
  insufficient: "insufficient evidence",
};

function GradeChip({ grade }: { grade: EvidenceGrade }) {
  return (
    <span className={`inline-flex rounded border px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide ${GRADE_TONE[grade]}`}>
      {grade}
    </span>
  );
}

function pct(n: number): number {
  return Math.round(n * 100);
}

export default function PillarContributionTable({
  vendor,
  defaultOpen = false,
}: {
  vendor: CategoryRankedVendor;
  defaultOpen?: boolean;
}) {
  const ranked = vendor.state === "ranked";

  return (
    <details open={defaultOpen} className="group mt-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 select-none">
        <span className="text-xs font-medium underline-offset-2 group-open:underline">
          {ranked ? "Why this rank" : "Why insufficient"}
        </span>
        <span className={`text-xs ${MUTED}`}>
          {vendor.domainScored}/{vendor.domainTotal} domains evidenced · {COMPLETENESS_LABEL[vendor.evidenceCompleteness]}
          {" · "}{pct(vendor.coverage)}% pillar-weight
        </span>
      </summary>

      {!ranked && vendor.excludedReason && (
        <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          Not ranked — {vendor.excludedReason}. We hold the vendor rather than rank it on partial evidence.
        </p>
      )}

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className={MUTED}>
              <th className="py-1 pr-3 font-medium">Pillar</th>
              <th className="py-1 pr-3 font-medium">Evidence</th>
              <th className="py-1 pr-3 text-right font-medium tabular-nums">Score /5</th>
              <th className="py-1 pr-3 text-right font-medium tabular-nums">Weight</th>
              <th className="py-1 pr-3 text-right font-medium tabular-nums">Conf.</th>
              <th className="py-1 text-right font-medium tabular-nums">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {vendor.rankPillars.map((p) => {
              const scored = p.state === "scored";
              const context = p.state === "not_in_composite";
              return (
                <tr key={p.pillar} className={`border-t border-black/5 align-top dark:border-white/10 ${scored ? "" : "opacity-70"}`}>
                  <td className="py-1.5 pr-3 font-medium">{p.label}</td>
                  <td className="py-1.5 pr-3">
                    {scored && p.bestGrade ? (
                      <GradeChip grade={p.bestGrade} />
                    ) : context ? (
                      <span className={`text-[10px] ${MUTED}`}>context only</span>
                    ) : (
                      <span className={`text-[10px] ${MUTED}`}>insufficient</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                    {p.score === null ? "—" : p.score.toFixed(1)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                    {context ? "—" : `${pct(p.weight)}%`}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                    {p.confidence === null ? "—" : `${p.confidence}%`}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">
                    {p.contribution === null ? (
                      <span className={MUTED}>{context ? "not scored" : "not counted"}</span>
                    ) : (
                      `+${p.contribution.toFixed(2)}`
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Honest "what's held" — pillars with active domains but no reviewed evidence. */}
      {vendor.rankPillars.some((p) => p.state === "insufficient_evidence") && (
        <div className="mt-2 text-[11px]">
          <span className={`font-medium ${MUTED}`}>Held (no reviewed evidence yet): </span>
          <span className={MUTED}>
            {vendor.rankPillars.filter((p) => p.state === "insufficient_evidence").map((p) => p.label).join(", ")}
          </span>
        </div>
      )}

      <p className={`mt-2 text-[10px] ${MUTED}`}>
        Each pillar rolls up its evidence domains: domain score (0–5) × weight × a confidence blend
        (0.7 + 0.3×confidence). Contributions sum to the {vendor.assessmentComposite === null ? "composite" : `${vendor.assessmentComposite.toFixed(2)}/5 composite`} above.
        Market share / position is context, not part of the score.
      </p>
    </details>
  );
}
