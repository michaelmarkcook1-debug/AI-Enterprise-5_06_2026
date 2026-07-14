import { ASSESSMENT_DOMAINS } from "@/lib/assessment/domain-rubric";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";
import type { VendorScorecard } from "@/lib/assessment/domain-scores";
import GradeChip from "@/components/assessment/GradeChip";

const MUTED = "text-[#5e6b7e] dark:text-[#a7bacd]";

// Evidence tab (Prompt 2 sign-off): the citation trail split OUT of
// WeightedScorecard rather than duplicating it there. Reads the exact same
// scorecard.domains data WeightedScorecard uses for its per-domain rows —
// no new query, no re-derivation — just a flat, sober, non-interactive view:
// grade + confidence + citations per domain, nothing to drag or re-weight.
export default function EvidenceTrail({ scorecard }: { scorecard: VendorScorecard }) {
  const byDomain = new Map(scorecard.domains.map((d) => [d.domain, d]));

  return (
    <div>
      <p className={`mb-4 text-xs leading-5 ${MUTED}`}>
        <span className="font-semibold uppercase tracking-wide">How this was computed</span>{" "}
        {scorecard.totalEvidenceRows.toLocaleString()} reviewed, source-backed records across{" "}
        {scorecard.scoredCount} of {ASSESSMENT_DOMAINS.length} domains. E1–E5 evidence grades cap what a domain can
        score regardless of the number of sources. Deterministic — no model call.
      </p>
      {ASSESSMENT_DOMAINS.map((domain) => {
        const d = byDomain.get(domain);
        const scored = d && d.state === "scored";
        return (
          <div key={domain} className="border-t border-[#ece4d0] py-3 dark:border-[#223a2e]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-[#123d2c] dark:text-[#eef3f8]">{DOMAIN_LABEL[domain]}</span>
              {scored ? (
                <span className="flex items-center gap-2 text-xs">
                  <GradeChip grade={d!.bestGrade} />
                  <span className={MUTED}>Confidence {d!.confidence}%</span>
                  {d!.lowConfidence && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      Low confidence
                    </span>
                  )}
                </span>
              ) : (
                <span className="rounded-full border border-[#d6c9a8] bg-[#f6f1e3] px-2 py-0.5 text-xs font-semibold text-[#5e6b7e] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#a7bacd]">
                  Insufficient evidence
                </span>
              )}
            </div>
            {scored && d!.citations.length > 0 && (
              <ul className="mt-2 space-y-1 pl-1">
                {d!.citations.map((cit) => (
                  <li key={cit.sourceUrl} className="flex flex-wrap items-center gap-2 text-xs">
                    <GradeChip grade={cit.evidenceGrade} />
                    <a
                      href={cit.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sky-700 hover:underline dark:text-sky-400"
                    >
                      {cit.sourceUrl}
                    </a>
                    <span className={`shrink-0 ${MUTED}`}>{cit.capturedAt.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
