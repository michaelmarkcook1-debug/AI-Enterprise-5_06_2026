// Explainability for the composite ranking — shows WHICH criteria + weights drove
// a vendor's position, tied to the evidence/trust layer. Pure server component
// (native <details>, no client JS — keeps the lean public shell). Dark pillars
// render an explicit "insufficient evidence" row, never a default value.

import type { CategoryRankedVendor, EvidenceCompleteness } from "@/lib/ranking/composite-types";
import type { EvidenceGrade } from "@/lib/types";

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

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
        <span className="text-[11px] font-medium underline-offset-2 group-open:underline">
          {ranked ? "Why this rank" : "Why insufficient"}
        </span>
        <span className={`text-[11px] ${MUTED}`}>
          {pct(vendor.coverage)}% pillar-weight evidenced · {COMPLETENESS_LABEL[vendor.evidenceCompleteness]}
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
              <th className="py-1 pr-3 text-right font-medium tabular-nums">Score</th>
              <th className="py-1 pr-3 text-right font-medium tabular-nums">Weight</th>
              <th className="py-1 pr-3 text-right font-medium tabular-nums">Conf.</th>
              <th className="py-1 text-right font-medium tabular-nums">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {vendor.pillars.map((p) => {
              const evidenced = p.state === "scored";
              return (
                <tr key={p.pillar} className={`border-t border-black/5 align-top dark:border-white/10 ${evidenced ? "" : "opacity-70"}`}>
                  <td className="py-1.5 pr-3 font-medium">{p.label}</td>
                  <td className="py-1.5 pr-3">
                    {evidenced ? (
                      <GradeChip grade={p.evidenceGrade} />
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <GradeChip grade={p.evidenceGrade} />
                        <span className={`text-[10px] ${MUTED}`}>insufficient</span>
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                    {p.capabilityScore === null ? "—" : Math.round(p.capabilityScore)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                    {p.effectiveWeight !== null ? `${pct(p.effectiveWeight)}%` : `${pct(p.baseWeight)}%`}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                    {p.confidence === null ? "—" : `${Math.round(p.confidence)}%`}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">
                    {p.contribution === null ? (
                      <span className={MUTED}>{evidenced ? "not counted" : "—"}</span>
                    ) : (
                      `+${p.contribution.toFixed(1)}`
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* What would lift the dark pillars (honest "what's missing"). */}
      {vendor.pillars.some((p) => p.state === "insufficient_evidence" && p.missingEvidence.length > 0) && (
        <div className="mt-2 text-[11px]">
          <span className={`font-medium ${MUTED}`}>To lift the held pillars: </span>
          <span className={MUTED}>
            {vendor.pillars
              .filter((p) => p.state === "insufficient_evidence" && p.missingEvidence.length > 0)
              .map((p) => `${p.label} — ${p.missingEvidence[0]}`)
              .join("; ")}
          </span>
        </div>
      )}

      <p className={`mt-2 text-[10px] ${MUTED}`}>
        Weights renormalize over evidenced pillars; contributions sum to the composite. Market share is
        context, not part of the score.
      </p>
    </details>
  );
}
