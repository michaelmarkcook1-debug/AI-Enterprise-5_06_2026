// Rankings movement indicator — ▲/▼ overall-rank delta from real snapshots.
// Honest: shows movement only when there's prior snapshot history; "new" when a
// vendor has no prior snapshot; "—" when unchanged. The tooltip names the exact
// dates + that it's OVERALL-leaderboard rank (snapshots track global rank, not
// per-category), so the signal is never mislabelled.

import type { RankMovement } from "@/lib/intelligence/rank-movement";

export default function RankMovementIndicator({ movement }: { movement?: RankMovement }) {
  if (!movement) return null;
  const { delta, isNew, fromDate, toDate } = movement;

  if (isNew || delta == null) {
    return (
      <span
        title={`New to the overall leaderboard${toDate ? ` (first snapshot ${toDate})` : ""}`}
        className="inline-flex items-center rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
      >
        ● new
      </span>
    );
  }

  if (delta === 0) {
    return (
      <span
        title={`No change in overall rank${fromDate ? ` since ${fromDate}` : ""}`}
        className="font-mono text-xs tabular-nums text-[#123d2c]/40 dark:text-[#eef3f8]/40"
        aria-label="No change in overall rank"
      >
        —
      </span>
    );
  }

  const up = delta > 0;
  const mag = Math.abs(delta);
  return (
    <span
      title={`${up ? "Up" : "Down"} ${mag} place${mag === 1 ? "" : "s"} in overall rank${fromDate ? ` since ${fromDate}` : ""}`}
      aria-label={`${up ? "Up" : "Down"} ${mag} in overall rank`}
      className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold tabular-nums ${
        up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {up ? "▲" : "▼"} {mag}
    </span>
  );
}
