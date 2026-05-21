"use client";

// Interactive 2x2 quadrant chart.
// ───────────────────────────────
// Renders vendor dots positioned by (momentumScore, overallScore) with
// arrows showing the delta since the prior snapshot. Controls let the
// operator change timeframe and the X/Y cuts — those changes navigate
// to /quadrant?days=...&scoreCut=...&momentumCut=... so the data
// reloads server-side (page is force-dynamic).

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { quadrantOf, QUADRANT_LABELS, type QuadrantData, type QuadrantId } from "@/lib/intelligence/quadrant-shared";

const WIDTH = 760;
const HEIGHT = 560;
const PAD = { top: 28, right: 28, bottom: 44, left: 56 };
const INNER_W = WIDTH - PAD.left - PAD.right;
const INNER_H = HEIGHT - PAD.top - PAD.bottom;

// Visible axis ranges. The plot area is zoomed to the meaningful slice of
// each axis rather than the full 0-100, so vendor positions spread out
// rather than clustering in the middle. Values outside the range are
// clamped to the nearest edge for plotting; the quadrant classification
// itself still uses the raw values.
const AXIS_X_MIN = 25;
const AXIS_X_MAX = 80;
const AXIS_Y_MIN = 25;
const AXIS_Y_MAX = 90;
const X_TICKS = [25, 40, 50, 60, 70, 80];
const Y_TICKS = [25, 40, 50, 60, 70, 90];

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

const QUADRANT_COLOURS: Record<QuadrantId, { bg: string; bgDark: string; label: string; labelDark: string }> = {
  leaders:     { bg: "#ecfdf5", bgDark: "rgba(16,185,129,0.08)",  label: "#047857", labelDark: "#6ee7b7" },
  established: { bg: "#eff6ff", bgDark: "rgba(59,130,246,0.08)",  label: "#1d4ed8", labelDark: "#93c5fd" },
  challengers: { bg: "#fefce8", bgDark: "rgba(250,204,21,0.08)",  label: "#a16207", labelDark: "#fde68a" },
  watchlist:   { bg: "#fef2f2", bgDark: "rgba(239,68,68,0.08)",   label: "#b91c1c", labelDark: "#fca5a5" },
};

function pos(momentum: number, score: number) {
  const fx = clamp01((momentum - AXIS_X_MIN) / (AXIS_X_MAX - AXIS_X_MIN));
  const fy = clamp01((score - AXIS_Y_MIN) / (AXIS_Y_MAX - AXIS_Y_MIN));
  return {
    x: PAD.left + fx * INNER_W,
    y: PAD.top + (1 - fy) * INNER_H,
  };
}

const TIMEFRAMES = [
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

export default function QuadrantChart({ data }: { data: QuadrantData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hovered, setHovered] = useState<string | null>(null);
  const [onlyCrossings, setOnlyCrossings] = useState(false);

  const points = useMemo(() => {
    return onlyCrossings ? data.points.filter((p) => p.crossedQuadrant) : data.points;
  }, [data.points, onlyCrossings]);

  const counts = useMemo(() => {
    const c: Record<QuadrantId, number> = { leaders: 0, established: 0, challengers: 0, watchlist: 0 };
    for (const p of data.points) {
      c[quadrantOf(p.now.score, p.now.momentum, data.scoreCut, data.momentumCut)] += 1;
    }
    return c;
  }, [data]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/quadrant?${params.toString()}`);
  }

  // Cut lines use the same projection as the dots so they stay aligned
  // with the visible range. If the operator sets a cut outside the
  // visible window, clamp the line to the nearest edge.
  const cutPos = pos(data.momentumCut, data.scoreCut);
  const cutX = cutPos.x;
  const cutY = cutPos.y;

  const yTicks = Y_TICKS;
  const xTicks = X_TICKS;

  const hoveredPoint = hovered ? data.points.find((p) => p.vendor.id === hovered) ?? null : null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#dfe4da] bg-white p-3 text-xs dark:border-zinc-800 dark:bg-[#071827]">
        <div className="flex items-center gap-1">
          <span className="font-semibold uppercase tracking-wide text-[#6a725f] dark:text-zinc-500">Timeframe</span>
          {TIMEFRAMES.map((t) => (
            <button
              key={t.days}
              type="button"
              onClick={() => updateParam("days", String(t.days))}
              className={`rounded px-2 py-1 font-medium ${
                data.windowDays === t.days
                  ? "bg-[#192319] text-white dark:bg-white dark:text-[#0c1220]"
                  : "text-[#4d574b] hover:bg-[#e9ede4] dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5">
          <span className="font-semibold uppercase tracking-wide text-[#6a725f] dark:text-zinc-500">Score cut</span>
          <input
            type="number"
            min={1}
            max={99}
            defaultValue={data.scoreCut}
            onBlur={(e) => updateParam("scoreCut", e.target.value)}
            className="w-14 rounded border border-[#cfd7c8] bg-white px-1.5 py-0.5 font-mono dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="flex items-center gap-1.5">
          <span className="font-semibold uppercase tracking-wide text-[#6a725f] dark:text-zinc-500">Momentum cut</span>
          <input
            type="number"
            min={1}
            max={99}
            defaultValue={data.momentumCut}
            onBlur={(e) => updateParam("momentumCut", e.target.value)}
            className="w-14 rounded border border-[#cfd7c8] bg-white px-1.5 py-0.5 font-mono dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={onlyCrossings}
            onChange={(e) => setOnlyCrossings(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <span className="text-[#4d574b] dark:text-zinc-400">Only show quadrant crossings</span>
        </label>

        <div className="ml-auto flex items-center gap-3 text-[10px] uppercase tracking-wide text-[#6a725f] dark:text-zinc-500">
          <span>L {counts.leaders}</span>
          <span>E {counts.established}</span>
          <span>C {counts.challengers}</span>
          <span>W {counts.watchlist}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-[#071827]">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Vendor quadrant: overall score vs momentum">
          {/* Quadrant background fills */}
          {(["leaders", "established", "challengers", "watchlist"] as const).map((q) => {
            const x = q === "leaders" || q === "challengers" ? cutX : PAD.left;
            const y = q === "leaders" || q === "established" ? PAD.top : cutY;
            const w = q === "leaders" || q === "challengers" ? PAD.left + INNER_W - cutX : cutX - PAD.left;
            const h = q === "leaders" || q === "established" ? cutY - PAD.top : PAD.top + INNER_H - cutY;
            const c = QUADRANT_COLOURS[q];
            return (
              <g key={q}>
                <rect x={x} y={y} width={w} height={h} fill={c.bg} className="dark:hidden" />
                <rect x={x} y={y} width={w} height={h} fill={c.bgDark} className="hidden dark:block" />
              </g>
            );
          })}

          {/* Quadrant labels */}
          {(
            [
              { q: "leaders" as QuadrantId,     x: PAD.left + INNER_W - 12, y: PAD.top + 18,         anchor: "end" as const },
              { q: "established" as QuadrantId, x: PAD.left + 12,           y: PAD.top + 18,         anchor: "start" as const },
              { q: "challengers" as QuadrantId, x: PAD.left + INNER_W - 12, y: PAD.top + INNER_H - 8, anchor: "end" as const },
              { q: "watchlist" as QuadrantId,   x: PAD.left + 12,           y: PAD.top + INNER_H - 8, anchor: "start" as const },
            ]
          ).map(({ q, x, y, anchor }) => {
            const c = QUADRANT_COLOURS[q];
            return (
              <g key={q}>
                <text x={x} y={y} textAnchor={anchor} className="dark:hidden" fill={c.label} fontSize={12} fontWeight={600} letterSpacing={1}>
                  {QUADRANT_LABELS[q].toUpperCase()}
                </text>
                <text x={x} y={y} textAnchor={anchor} className="hidden dark:block" fill={c.labelDark} fontSize={12} fontWeight={600} letterSpacing={1}>
                  {QUADRANT_LABELS[q].toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Axis frame */}
          <rect x={PAD.left} y={PAD.top} width={INNER_W} height={INNER_H} fill="none" stroke="currentColor" className="text-[#dfe4da] dark:text-zinc-700" strokeWidth={1} />
          {/* Cut lines */}
          <line x1={cutX} y1={PAD.top} x2={cutX} y2={PAD.top + INNER_H} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" className="text-[#697362] dark:text-zinc-500" />
          <line x1={PAD.left} y1={cutY} x2={PAD.left + INNER_W} y2={cutY} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" className="text-[#697362] dark:text-zinc-500" />

          {/* Y-axis ticks */}
          {yTicks.map((t) => {
            const y = pos(AXIS_X_MIN, t).y;
            return (
              <g key={`y${t}`}>
                <line x1={PAD.left - 4} y1={y} x2={PAD.left} y2={y} stroke="currentColor" className="text-[#9aa691] dark:text-zinc-600" />
                <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize={10} className="fill-[#6a725f] dark:fill-zinc-500">{t}</text>
              </g>
            );
          })}
          {/* X-axis ticks */}
          {xTicks.map((t) => {
            const x = pos(t, AXIS_Y_MIN).x;
            return (
              <g key={`x${t}`}>
                <line x1={x} y1={PAD.top + INNER_H} x2={x} y2={PAD.top + INNER_H + 4} stroke="currentColor" className="text-[#9aa691] dark:text-zinc-600" />
                <text x={x} y={PAD.top + INNER_H + 16} textAnchor="middle" fontSize={10} className="fill-[#6a725f] dark:fill-zinc-500">{t}</text>
              </g>
            );
          })}
          {/* Axis labels */}
          <text x={PAD.left + INNER_W / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-[#4d574b] dark:fill-zinc-300">
            Momentum score →
          </text>
          <text x={14} y={PAD.top + INNER_H / 2} textAnchor="middle" fontSize={11} fontWeight={600} transform={`rotate(-90, 14, ${PAD.top + INNER_H / 2})`} className="fill-[#4d574b] dark:fill-zinc-300">
            Overall score →
          </text>

          {/* Arrow marker definition */}
          <defs>
            <marker id="qarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" className="fill-[#192319] dark:fill-zinc-100" />
            </marker>
          </defs>

          {/* Trajectory arrows + dots */}
          {points.map((p) => {
            const nowPos = pos(p.now.momentum, p.now.score);
            const prevPos = p.prev ? pos(p.prev.momentum, p.prev.score) : null;
            const isHovered = hovered === p.vendor.id;
            const qNow = quadrantOf(p.now.score, p.now.momentum, data.scoreCut, data.momentumCut);
            const colour = QUADRANT_COLOURS[qNow];

            // Only render the arrow if movement is visually meaningful.
            const movedEnough = prevPos && (Math.abs(prevPos.x - nowPos.x) + Math.abs(prevPos.y - nowPos.y) > 4);

            return (
              <g
                key={p.vendor.id}
                onMouseEnter={() => setHovered(p.vendor.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(p.vendor.id)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
                className="cursor-pointer outline-none"
                style={{ opacity: hovered && !isHovered ? 0.35 : 1, transition: "opacity 120ms" }}
              >
                {movedEnough && prevPos && (
                  <line
                    x1={prevPos.x}
                    y1={prevPos.y}
                    x2={nowPos.x}
                    y2={nowPos.y}
                    stroke={colour.label}
                    strokeWidth={1.5}
                    strokeOpacity={0.55}
                    markerEnd="url(#qarrow)"
                  />
                )}
                {prevPos && (
                  <circle cx={prevPos.x} cy={prevPos.y} r={2.5} fill={colour.label} fillOpacity={0.35} />
                )}
                <circle
                  cx={nowPos.x}
                  cy={nowPos.y}
                  r={isHovered ? 7 : 5}
                  fill={colour.label}
                  stroke="white"
                  strokeWidth={1.5}
                  className="dark:stroke-zinc-900"
                />
                {p.crossedQuadrant && (
                  <circle cx={nowPos.x} cy={nowPos.y} r={9} fill="none" stroke={colour.label} strokeWidth={1.2} strokeDasharray="2 1.5" />
                )}
                <text
                  x={nowPos.x + 8}
                  y={nowPos.y + 3}
                  fontSize={10}
                  fontWeight={isHovered ? 700 : 500}
                  className="fill-[#18201b] dark:fill-zinc-100"
                  style={{ pointerEvents: "none" }}
                >
                  {p.vendor.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover detail card */}
        {hoveredPoint && (
          <div className="mt-3 grid gap-2 rounded-md border border-[#dfe4da] bg-[#f7f8f5] p-3 text-xs dark:border-zinc-700 dark:bg-[#0b1f30] md:grid-cols-[1fr_auto_auto_auto_auto]">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#6a725f] dark:text-zinc-500">Vendor</div>
              <div className="font-semibold text-[#18201b] dark:text-zinc-100">{hoveredPoint.vendor.name}</div>
              <div className="text-[#697362] dark:text-zinc-400">{hoveredPoint.vendor.category}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#6a725f] dark:text-zinc-500">Score</div>
              <div className="font-mono font-semibold dark:text-zinc-100">{hoveredPoint.now.score.toFixed(1)}</div>
              {hoveredPoint.delta && (
                <div className={`text-[10px] font-medium ${hoveredPoint.delta.score >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                  {hoveredPoint.delta.score >= 0 ? "▲ +" : "▼ "}{hoveredPoint.delta.score}
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#6a725f] dark:text-zinc-500">Momentum</div>
              <div className="font-mono font-semibold dark:text-zinc-100">{hoveredPoint.now.momentum.toFixed(0)}</div>
              {hoveredPoint.delta && (
                <div className={`text-[10px] font-medium ${hoveredPoint.delta.momentum >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                  {hoveredPoint.delta.momentum >= 0 ? "▲ +" : "▼ "}{hoveredPoint.delta.momentum}
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#6a725f] dark:text-zinc-500">Quadrant</div>
              <div className="font-semibold dark:text-zinc-100">
                {QUADRANT_LABELS[quadrantOf(hoveredPoint.now.score, hoveredPoint.now.momentum, data.scoreCut, data.momentumCut)]}
                {hoveredPoint.crossedQuadrant && <span className="ml-1 text-amber-700 dark:text-amber-400">(crossed)</span>}
              </div>
            </div>
            <a
              href={`/vendors/${hoveredPoint.vendor.slug}`}
              className="self-end justify-self-end text-[#2f5d50] underline hover:text-[#1a3b30] dark:text-emerald-300"
            >
              Open profile →
            </a>
          </div>
        )}
      </div>

      <div className="text-[11px] leading-5 text-[#6a725f] dark:text-zinc-500">
        Cuts at score = {data.scoreCut}, momentum = {data.momentumCut}. Arrows show movement since {new Date(Date.now() - data.windowDays * 86400 * 1000).toLocaleDateString()}. Dashed ring = vendor crossed a quadrant boundary in this window.
      </div>
    </div>
  );
}
