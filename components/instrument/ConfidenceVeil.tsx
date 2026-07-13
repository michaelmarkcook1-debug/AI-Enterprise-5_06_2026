// ConfidenceVeil — makes certainty visible without a tooltip.
// ──────────────────────────────────────────────────────────────────────
// Wraps any value/figure and renders it at a visual weight matching its
// confidence, so a thin-evidence number can never look as solid as a
// measured one — the platform's "under-claim, never over-claim" rule turned
// into UI. High passes through untouched; moderate dims slightly; low fades
// and de-saturates with an honest inline caveat available to assistive tech.
// Pure render — no client state.

type Level = "high" | "moderate" | "low";

/** Bucket a 0–100 confidence into a level. `null`/≤0 → "low" (honest floor). */
export function confidenceLevel(confidence: number | null | undefined): Level {
  if (confidence == null || confidence < 40) return "low";
  if (confidence < 70) return "moderate";
  return "high";
}

const VEIL: Record<Level, string> = {
  high: "",
  moderate: "opacity-80",
  low: "opacity-60 saturate-[0.7]",
};

const WORD: Record<Level, string> = {
  high: "high confidence",
  moderate: "moderate confidence",
  low: "low confidence",
};

export interface ConfidenceVeilProps {
  /** A resolved level, or pass `confidence` (0–100) to derive one. */
  level?: Level;
  confidence?: number | null;
  /** What the figure is (for the assistive-tech caveat), e.g. "Vendor resilience score". */
  label?: string;
  as?: "span" | "div";
  className?: string;
  children: React.ReactNode;
}

export default function ConfidenceVeil({
  level,
  confidence,
  label,
  as = "span",
  className = "",
  children,
}: ConfidenceVeilProps) {
  const resolved = level ?? confidenceLevel(confidence);
  const Tag = as;
  const caveat = `${label ? label + " — " : ""}${WORD[resolved]}`;
  return (
    <Tag
      className={`${VEIL[resolved]} ${className}`}
      // A native title gives sighted users the caveat on hover without a JS popover;
      // the aria-label carries it to assistive tech even when the value looks the same.
      title={resolved === "high" ? undefined : caveat}
      aria-label={resolved === "high" ? undefined : caveat}
    >
      {children}
    </Tag>
  );
}
