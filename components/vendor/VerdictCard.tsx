import Link from "next/link";
import TrackButton from "@/components/member/TrackButton";
import ExportPackLinks from "@/components/export/ExportPackLinks";
import CalibrationBadge from "@/components/ranking/CalibrationBadge";
import { calibrationBand } from "@/lib/ranking/calibration";

const MUTED = "text-[#5e6b7e] dark:text-[#a7bacd]";

function tone(score: number): string {
  if (score >= 4) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 3) return "text-amber-700 dark:text-amber-300";
  if (score >= 2) return "text-[#a07f1f] dark:text-[#d4af37]";
  return "text-rose-700 dark:text-rose-300";
}

export interface VerdictStanding {
  categoryId: string;
  categoryName: string;
  rank: number;
  rankedCount: number;
}

// The verdict card (Prompt 2) — always visible above the fold, the "answer"
// that progressive disclosure asks for before the depth. composite/confidence
// come from lib/assessment/verdict-summary.ts, itself computeWeightedComposite
// over the SAME scorecard every tab reads — never a separate number.
export default function VerdictCard({
  vendorName,
  vendorSlug,
  standing,
  composite,
  confidence,
  coverage,
  momentum,
  whySentence,
  onInterrogateClick,
  onAddToDecisionClick,
}: {
  vendorName: string;
  vendorSlug: string;
  standing: VerdictStanding | null;
  composite: number | null;
  confidence: number | null;
  coverage: number | null;
  momentum: number | null;
  whySentence: string | null;
  onInterrogateClick?: () => void;
  onAddToDecisionClick?: () => void;
}) {
  return (
    <div className="mb-6 rounded-xl border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[#13294b] dark:text-[#f6f9fc]">{vendorName}</h1>
          {standing && (
            <p className={`mt-0.5 text-sm ${MUTED}`}>
              <Link href={`/category/${standing.categoryId}`} className="hover:underline">
                #{standing.rank} of {standing.rankedCount} in {standing.categoryName}
              </Link>
            </p>
          )}
        </div>
        <TrackButton item={`vendor:${vendorSlug}`} label={vendorName} />
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {composite != null ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <span className={`font-mono text-3xl font-semibold tabular-nums ${tone(composite)}`}>
                {composite.toFixed(2)}
                <span className={`text-base ${MUTED}`}>/5</span>
              </span>
              <span className={`ml-2 text-xs ${MUTED}`}>composite</span>
            </span>
            {/* Standing band beside the evidence-capped raw score, so "#1" reads as
                a leader at a glance. The header already shows "#N of M in <cat>", so
                the badge omits the standing string here. */}
            {standing && confidence != null && coverage != null && (
              <CalibrationBadge
                calibration={calibrationBand(standing.rank, standing.rankedCount, coverage, confidence)}
                size="md"
                showStanding={false}
              />
            )}
          </div>
        ) : (
          <span className={`text-sm ${MUTED}`}>Composite unavailable — insufficient evidence</span>
        )}
        {confidence != null && (
          <div className="text-sm">
            <span className="font-mono font-semibold text-[#13294b] dark:text-[#eef3f8]">{confidence}%</span>
            <span className={`ml-1 text-xs ${MUTED}`}>confidence</span>
          </div>
        )}
        {coverage != null && (
          <div className="text-sm">
            <span className="font-mono font-semibold text-[#13294b] dark:text-[#eef3f8]">{Math.round(coverage * 100)}%</span>
            <span className={`ml-1 text-xs ${MUTED}`}>coverage</span>
          </div>
        )}
        {momentum != null && (
          <div className="text-sm">
            <span className={`font-mono font-semibold ${momentum > 0 ? "text-emerald-700 dark:text-emerald-300" : momentum < 0 ? "text-rose-700 dark:text-rose-300" : MUTED}`}>
              {momentum > 0 ? "+" : ""}
              {momentum.toFixed(1)}
            </span>
            <span className={`ml-1 text-xs ${MUTED}`}>momentum</span>
          </div>
        )}
      </div>

      {whySentence && <p className={`mt-3 text-sm leading-6 ${MUTED}`}>{whySentence}</p>}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#ece4d0] pt-4 dark:border-[#1d3a57]">
        <button
          type="button"
          onClick={onInterrogateClick}
          className="rounded-full border border-[#d6c9a8] px-3 py-1.5 text-xs font-medium text-[#4c5d75] hover:bg-white dark:border-[#2a4a6b] dark:text-[#a7bacd] dark:hover:bg-[#0c2238]"
        >
          Interrogate for my context
        </button>
        <button
          type="button"
          onClick={onAddToDecisionClick}
          className="rounded-full border border-[#d6c9a8] px-3 py-1.5 text-xs font-medium text-[#4c5d75] hover:bg-white dark:border-[#2a4a6b] dark:text-[#a7bacd] dark:hover:bg-[#0c2238]"
        >
          Add to decision
        </button>
        <ExportPackLinks href={`/api/export/procurement-pack?vendor=${vendorSlug}`} label="Export" />
      </div>
    </div>
  );
}
