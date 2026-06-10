"use client";

// TrendSpark — provenance-aware inline sparkline with hover detail.
// ──────────────────────────────────────────────────────────────────
// The app's signature micro-interaction: a quiet 64×20 line beside a
// number; hovering (or focusing — keyboard reachable) raises a card with
// the trend window, start → end values, delta, and — true to the house
// style — the PROVENANCE of the series (captured snapshots vs
// reconstructed history). Never fabricates: render nothing below two
// points.

import { useId, useState } from "react";

export interface SparkPoint {
  date: string;
  value: number;
}

export default function TrendSpark({
  points,
  label,
  provenance = "reconstructed",
  width = 64,
  height = 20,
}: {
  points: SparkPoint[];
  label: string;
  /** "snapshot" = captured daily snapshots; "reconstructed" = derived from current score + momentum deltas. */
  provenance?: "snapshot" | "reconstructed";
  width?: number;
  height?: number;
}) {
  const [open, setOpen] = useState(false);
  const gradId = useId();
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const delta = Math.round((last.value - first.value) * 10) / 10;
  const rising = delta >= 0;
  const stroke = rising ? "#059669" : "#dc2626";

  return (
    <span
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`${label} trend: ${rising ? "up" : "down"} ${Math.abs(delta)} over ${points.length} points`}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="block">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradId})`} />
          <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={width} cy={y(last.value)} r="2" fill={stroke} />
        </svg>
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute top-full left-1/2 z-30 mt-2 w-52 -translate-x-1/2 rounded-lg border border-[#e6dcc3] bg-white p-2.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-zinc-400">{label}</span>
          <span className="mt-1 block font-mono text-xs text-[#13294b] dark:text-zinc-100">
            {first.value} → {last.value}{" "}
            <span className={rising ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
              ({rising ? "+" : ""}{delta})
            </span>
          </span>
          <span className="mt-0.5 block text-[10px] text-[#5b6b7f] dark:text-zinc-500">
            {first.date} → {last.date} · {points.length} points
          </span>
          <span className="mt-1 block text-[9px] uppercase tracking-wide text-[#7e8a99] dark:text-zinc-500">
            {provenance === "snapshot" ? "captured daily snapshots" : "reconstructed — replaced by real snapshots as they accumulate"}
          </span>
        </span>
      )}
    </span>
  );
}
