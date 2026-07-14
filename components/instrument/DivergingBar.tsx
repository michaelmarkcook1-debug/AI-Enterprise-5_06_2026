// DivergingBar — the literal "face-off" encoding for two entities on one metric.
// ──────────────────────────────────────────────────────────────────────
// A back-to-back bar sharing a centre axis: A grows left, B grows right, both
// normalized to a shared max, so the longer side visibly wins the row. Honours
// directionality — `higherIsBetter=false` (price, latency) means the SMALLER
// value wins and takes the gold. Nulls render as an honest "—" with no bar and
// no winner call. Pure render — no client state. Use for exactly 2 entities;
// for 3+, use aligned bars or a table (a divergent structure implies opposition).

type Winner = "a" | "b" | null;

export interface DivergingBarProps {
  a: number | null;
  b: number | null;
  /** Shared scale max. Defaults to the larger of the two values (or 1). */
  max?: number;
  higherIsBetter?: boolean;
  aName?: string;
  bName?: string;
  /** Formats the end-of-bar value labels (e.g. add a unit / round). */
  format?: (n: number) => string;
  className?: string;
}

function decideWinner(a: number | null, b: number | null, higherIsBetter: boolean): Winner {
  if (a == null || b == null || a === b) return null;
  const aWins = higherIsBetter ? a > b : a < b;
  return aWins ? "a" : "b";
}

export default function DivergingBar({
  a,
  b,
  max,
  higherIsBetter = true,
  aName = "A",
  bName = "B",
  format = (n) => String(Math.round(n * 10) / 10),
  className = "",
}: DivergingBarProps) {
  const scale = (max ?? Math.max(a ?? 0, b ?? 0)) || 1;
  const winner = decideWinner(a, b, higherIsBetter);
  const half = (n: number | null) => (n == null ? 0 : Math.max(0, Math.min(50, (n / scale) * 50)));

  const barCls = (side: "a" | "b") =>
    winner === side
      ? "bg-[#b08d2f] dark:bg-[#e8c95c]" // gold — this side wins
      : winner == null
        ? "bg-[#c9bd9e] dark:bg-[#2a4257]" // no call — both neutral
        : "bg-[#d7cdb2] dark:bg-[#213850]"; // the loser — quieter still

  const valCls = (side: "a" | "b") =>
    winner === side ? "text-[#8a6d1f] dark:text-[#e8c95c] font-semibold" : "text-[#5b6b7f] dark:text-[#a7bacd]";

  return (
    <div
      className={`grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 ${className}`}
      role="img"
      aria-label={
        `${aName} ${a == null ? "no data" : format(a)} versus ${bName} ${b == null ? "no data" : format(b)}` +
        (winner ? `; ${winner === "a" ? aName : bName} leads` : "; no winner") +
        (higherIsBetter ? "" : " (lower is better)")
      }
    >
      <span className={`text-right font-mono text-xs tabular-nums ${valCls("a")}`}>
        {a == null ? "—" : format(a)}
      </span>

      <span className="relative flex h-4 items-stretch rounded-sm bg-[#efe7d2] dark:bg-[#102135]">
        {/* left half — A grows toward the centre */}
        <span className="relative flex-1">
          <span
            className={`absolute inset-y-[3px] right-0 rounded-l-sm ${barCls("a")}`}
            style={{ width: `${half(a) * 2}%` }}
          />
        </span>
        {/* centre axis */}
        <span className="w-px shrink-0 bg-[#123d2c]/40 dark:bg-[#eef3f8]/40" />
        {/* right half — B grows toward the centre */}
        <span className="relative flex-1">
          <span
            className={`absolute inset-y-[3px] left-0 rounded-r-sm ${barCls("b")}`}
            style={{ width: `${half(b) * 2}%` }}
          />
        </span>
      </span>

      <span className={`text-left font-mono text-xs tabular-nums ${valCls("b")}`}>
        {b == null ? "—" : format(b)}
      </span>
    </div>
  );
}
