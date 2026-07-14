// Honest "live data unavailable" state — shown instead of EVER substituting
// seed/placeholder data when the live, source-backed feed isn't available
// (DB outage) or isn't yet backed by verified evidence (provenance ≠ "live").
// See lib/data/availability.ts + lib/intelligence/provenance.ts.

const CARD =
  "rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 dark:border-amber-400/20";
const MUTED = "text-[#123d2c]/70 dark:text-[#eef3f8]/70";

export default function DataUnavailable({
  title = "Live data unavailable",
  detail,
  reason,
}: {
  /** Headline, e.g. "Live rankings unavailable". */
  title?: string;
  /** One-line explanation of WHAT is missing and what it depends on. */
  detail?: string;
  /** Optional machine reason (e.g. provenance.reason) for operators. */
  reason?: string;
}) {
  return (
    <div className={CARD} role="status">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className={`mt-2 text-sm ${MUTED}`}>
        {detail ??
          "We only show source-backed data. The live feed isn't available right now — rather than display placeholder figures, we're holding this section until verified data lands."}
      </p>
      {reason && <p className={`mt-1.5 text-xs ${MUTED}`}>{reason}</p>}
    </div>
  );
}
