import type { Calibration, CalibrationBand } from "@/lib/ranking/calibration";

// The standing badge rendered beside the raw composite everywhere the headline
// number appears, so a category leader reads as one at a glance without the raw
// 0–5 evidence score changing. Pure presentation over lib/ranking/calibration.

const BAND_STYLE: Record<CalibrationBand, string> = {
  Leader:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-300",
  "Emerging leader":
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200",
  Strong:
    "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700/60 dark:bg-sky-950/50 dark:text-sky-300",
  Contender:
    "border-[#d6c9a8] bg-[#f6f1e3] text-[#3f5068] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#c2d1e0]",
  Emerging:
    "border-[#e0d6ba] bg-[#faf6ec] text-[#5b6b7f] dark:border-[#24425f] dark:bg-[#0a1e33] dark:text-[#8fa5bb]",
};

const BAND_TITLE: Record<CalibrationBand, string> = {
  Leader: "Leads its category on well-evidenced quality",
  "Emerging leader": "Ranks #1 in its category, but on limited evidence — read with the coverage figure",
  Strong: "Near the top of its category",
  Contender: "Mid-field in its category",
  Emerging: "Lower in its category on current evidence",
};

/**
 * @param calibration the derived band (lib/ranking/calibration)
 * @param size "sm" for dense rows (list / rail), "md" for the verdict card
 * @param showStanding append the factual "#N of M" (default on)
 */
export default function CalibrationBadge({
  calibration,
  size = "sm",
  showStanding = true,
}: {
  calibration: Calibration;
  size?: "sm" | "md";
  showStanding?: boolean;
}) {
  const { band, limitedEvidence, standingLabel } = calibration;
  const pad = size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      <span
        className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${pad} ${BAND_STYLE[band]}`}
        title={BAND_TITLE[band]}
      >
        {band}
      </span>
      {showStanding && (
        <span className={`tabular-nums text-[#5b6b7f] dark:text-[#8fa5bb] ${size === "md" ? "text-[11px]" : "text-[10px]"}`}>
          {standingLabel}
        </span>
      )}
      {limitedEvidence && (
        <span
          className={`inline-flex items-center rounded-full border border-[#e0d6ba] bg-transparent font-medium text-[#8a6d1f] dark:border-[#4a3d1a] dark:text-[#caa54a] ${pad}`}
          title="Coverage or confidence is below the strong-evidence bar — the standing rests on thin evidence."
        >
          limited evidence
        </span>
      )}
    </span>
  );
}
