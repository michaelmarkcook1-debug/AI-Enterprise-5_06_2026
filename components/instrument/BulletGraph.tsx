// BulletGraph — the Evidence-Instrument replacement for gauges and radar.
// ──────────────────────────────────────────────────────────────────────
// Stephen Few's bullet graph: one horizontal strip carrying a score bar, a
// benchmark tick (cohort median / target), and faint single-hue qualitative
// bands (light → dark = worse → better). Built to stack — one row per pillar.
// House-style honesty: a null score renders an explicit "insufficient
// evidence" state (never a zero or a default bar), and a low-confidence score
// renders visibly weaker (hatched + faded) so certainty reads at a glance.
// Pure render — no client state, safe in a Server Component.

type Tone = "score" | "positive" | "caution" | "risk";

const BAR: Record<Tone, string> = {
  score: "bg-[#b08d2f] dark:bg-[#e8c95c]", // gold — the neutral "this is the value" bar
  positive: "bg-emerald-600 dark:bg-emerald-400",
  caution: "bg-amber-500 dark:bg-amber-400",
  risk: "bg-rose-500 dark:bg-rose-400",
};

// Diagonal hatch overlay marking a low-confidence bar — theme-independent,
// drawn over whatever fill sits beneath so a thin-evidence score can never
// look as solid as a measured one.
const HATCH: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px)",
};

export interface BulletGraphProps {
  /** The score. `null` → the honest "insufficient evidence" state. */
  value: number | null;
  /** Scale maximum (default 100). Scores clamp to [0, max]. */
  max?: number;
  /** Benchmark / target / cohort-median tick. Omit to draw no tick. */
  benchmark?: number | null;
  /** Semantic tone of the value bar. Default "score" (neutral gold). */
  tone?: Tone;
  /** Render the bar hatched + faded (thin/low-confidence evidence). */
  lowConfidence?: boolean;
  /** Accessible name, e.g. the pillar label. */
  label: string;
  /** Copy for the null state. */
  insufficientLabel?: string;
  className?: string;
}

export default function BulletGraph({
  value,
  max = 100,
  benchmark = null,
  tone = "score",
  lowConfidence = false,
  label,
  insufficientLabel = "insufficient evidence",
  className = "",
}: BulletGraphProps) {
  // ── Honest-absence state: no bar, no tick, no implied zero. ──
  if (value == null) {
    return (
      <div
        className={`relative h-4 w-full overflow-hidden rounded-sm bg-[#e9e0c9]/60 dark:bg-[#102135]/70 ${className}`}
        role="img"
        aria-label={`${label}: insufficient evidence`}
      >
        <span className="absolute inset-0 flex items-center pl-2 font-mono text-[10px] italic text-[#7e8a99] dark:text-[#8fa5bb]">
          {insufficientLabel}
        </span>
      </div>
    );
  }

  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100)).toFixed(1)}%`;
  const tickPct = benchmark != null ? pct(benchmark) : null;

  return (
    <div
      className={`relative h-4 w-full overflow-hidden rounded-sm bg-[#e9e0c9] dark:bg-[#102135] ${className}`}
      role="img"
      aria-label={
        `${label}: ${Math.round(value)} of ${max}` +
        (benchmark != null ? `, benchmark ${Math.round(benchmark)}` : "") +
        (lowConfidence ? ", low confidence" : "")
      }
    >
      {/* qualitative bands: light → dark single hue = worse → better */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-2/5 bg-[#13294b]/[0.035] dark:bg-white/[0.02]" />
      <span className="pointer-events-none absolute inset-y-0 left-2/5 w-[35%] bg-[#13294b]/[0.06] dark:bg-white/[0.05]" />
      <span className="pointer-events-none absolute inset-y-0 left-[75%] right-0 bg-[#13294b]/[0.10] dark:bg-white/[0.09]" />

      {/* the value bar — inset so the taller benchmark tick reads above it */}
      <span
        className={`absolute left-0 top-[3px] bottom-[3px] rounded-sm ${BAR[tone]} ${lowConfidence ? "opacity-55" : ""}`}
        style={{ width: pct(value), ...(lowConfidence ? HATCH : {}) }}
      />

      {/* benchmark tick — full-height, ink, sits above the value bar */}
      {tickPct != null && (
        <span
          className="absolute top-0 bottom-0 w-[2px] bg-[#13294b] opacity-70 dark:bg-[#eef3f8]"
          style={{ left: tickPct }}
        />
      )}
    </div>
  );
}
