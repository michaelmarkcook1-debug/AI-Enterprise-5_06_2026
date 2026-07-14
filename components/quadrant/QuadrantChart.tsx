"use client";

// AI Atlas chart — analyst-style 2x2.
// ─────────────────────────────────────────
// Y = ability to execute, X = completeness of vision (see
// lib/intelligence/vendor-health.ts computeQuadrantAxes for the math).
// Arrows show movement since the prior snapshot. Controls navigate to
// /quadrant?days=...&executeCut=...&visionCut=... so the data reloads
// server-side (page is force-dynamic).

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { quadrantOf, QUADRANT_LABELS, type QuadrantData, type QuadrantId } from "@/lib/intelligence/quadrant-shared";

const WIDTH = 760;
const HEIGHT = 560;
const PAD = { top: 28, right: 28, bottom: 44, left: 64 };
const INNER_W = WIDTH - PAD.left - PAD.right;
const INNER_H = HEIGHT - PAD.top - PAD.bottom;

// Both axes range 35-85 to spread vendors visually across the quadrant.
// Execute + vision are 0-100 composites; narrowing from the extremes
// prevents clustering in the center and makes distribution more apparent.
const AXIS_X_MIN = 35;
const AXIS_X_MAX = 85;
const AXIS_Y_MIN = 35;
const AXIS_Y_MAX = 85;

const X_TICKS = [35, 45, 55, 65, 75, 85];
const Y_TICKS = [35, 45, 55, 65, 75, 85];

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

function radiusForShare(share: number, minShare: number, maxShare: number) {
  if (maxShare === minShare) return 6;
  const normalized = (share - minShare) / (maxShare - minShare);
  // Market share bubble radius scaling: min 3px, max 10px.
  return 3 + normalized * 7;
}

/** Project (vision, execute) into the SVG plot area. */
function pos(vision: number, execute: number) {
  const fx = clamp01((vision - AXIS_X_MIN) / (AXIS_X_MAX - AXIS_X_MIN));
  const fy = clamp01((execute - AXIS_Y_MIN) / (AXIS_Y_MAX - AXIS_Y_MIN));
  return {
    x: PAD.left + fx * INNER_W,
    y: PAD.top + (1 - fy) * INNER_H,
  };
}

const QUADRANT_COLOURS: Record<QuadrantId, { bg: string; bgDark: string; label: string; labelDark: string }> = {
  leaders:     { bg: "#ecfdf5", bgDark: "rgba(16,185,129,0.10)", label: "#047857", labelDark: "#e8c95c" },
  challengers: { bg: "#eff6ff", bgDark: "rgba(59,130,246,0.10)", label: "#1d4ed8", labelDark: "#93c5fd" },
  visionaries: { bg: "#fefce8", bgDark: "rgba(250,204,21,0.10)", label: "#a16207", labelDark: "#fde68a" },
  niche:       { bg: "#fef2f2", bgDark: "rgba(239,68,68,0.10)",  label: "#b91c1c", labelDark: "#fca5a5" },
};

const TIMEFRAMES = [
  { days: 7,  label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

export default function QuadrantChart({ data }: { data: QuadrantData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hovered, setHovered] = useState<string | null>(null);
  const [onlyCrossings, setOnlyCrossings] = useState(false);

  const uniquePoints = useMemo(() => {
    const byVendor = new Map<string, QuadrantData["points"][number]>();

    for (const point of data.points) {
      const current = byVendor.get(point.vendor.id);
      const candidateIsStronger =
        !current ||
        point.now.score > current.now.score ||
        (point.now.score === current.now.score && point.now.momentum > current.now.momentum);

      if (candidateIsStronger) {
        byVendor.set(point.vendor.id, point);
      }
    }

    return Array.from(byVendor.values());
  }, [data.points]);

  const points = useMemo(() => {
    return onlyCrossings ? uniquePoints.filter((p) => p.crossedQuadrant) : uniquePoints;
  }, [uniquePoints, onlyCrossings]);

  const radiusBounds = useMemo(() => {
    if (uniquePoints.length === 0) return null;
    const shares = uniquePoints.map((p) => p.marketShare);
    return {
      minShare: Math.min(...shares),
      maxShare: Math.max(...shares),
    };
  }, [uniquePoints]);

  const counts = useMemo(() => {
    const c: Record<QuadrantId, number> = { leaders: 0, challengers: 0, visionaries: 0, niche: 0 };
    for (const p of uniquePoints) {
      c[quadrantOf(p.now.execute, p.now.vision, data.executeCut, data.visionCut)] += 1;
    }
    return c;
  }, [data.executeCut, data.visionCut, uniquePoints]);

  const movementSinceLabel = useMemo(() => {
    const generatedAtMs = Date.parse(data.generatedAt);
    if (!Number.isFinite(generatedAtMs)) {
      return `${data.windowDays} days ago`;
    }

    return new Date(generatedAtMs - data.windowDays * 86400 * 1000).toISOString().slice(0, 10);
  }, [data.generatedAt, data.windowDays]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/quadrant?${params.toString()}`);
  }

  const cutPos = pos(data.visionCut, data.executeCut);
  const cutX = cutPos.x;
  const cutY = cutPos.y;

  const hoveredPoint = hovered ? uniquePoints.find((p) => p.vendor.id === hovered) ?? null : null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e6dcc3] bg-white p-3 text-xs dark:border-[#223a2e] dark:bg-[#081410]">
        <div className="flex items-center gap-1">
          <span className="font-semibold uppercase tracking-wide text-[#5e6b7e] dark:text-[#8fa5bb]">Timeframe</span>
          {TIMEFRAMES.map((t) => (
            <button
              key={t.days}
              type="button"
              onClick={() => updateParam("days", String(t.days))}
              className={`rounded px-2 py-1 font-medium ${
                data.windowDays === t.days
                  ? "bg-[#123d2c] text-white dark:bg-white dark:text-[#0c1220]"
                  : "text-[#475a72] hover:bg-[#f1ead6] dark:text-[#a7bacd] dark:hover:bg-[#0d1f17]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5">
          <span className="font-semibold uppercase tracking-wide text-[#5e6b7e] dark:text-[#8fa5bb]">Enhance cut</span>
          <input
            type="number"
            min={1}
            max={99}
            defaultValue={data.executeCut}
            onBlur={(e) => updateParam("executeCut", e.target.value)}
            className="w-14 rounded border border-[#d6c9a8] bg-white px-1.5 py-0.5 font-mono dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8]"
          />
        </label>

        <label className="flex items-center gap-1.5">
          <span className="font-semibold uppercase tracking-wide text-[#5e6b7e] dark:text-[#8fa5bb]">Innovate cut</span>
          <input
            type="number"
            min={1}
            max={99}
            defaultValue={data.visionCut}
            onBlur={(e) => updateParam("visionCut", e.target.value)}
            className="w-14 rounded border border-[#d6c9a8] bg-white px-1.5 py-0.5 font-mono dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8]"
          />
        </label>

        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={onlyCrossings}
            onChange={(e) => setOnlyCrossings(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <span className="text-[#475a72] dark:text-[#a7bacd]">Only show quadrant crossings</span>
        </label>

        <div className="ml-auto flex items-center gap-3 text-[10px] uppercase tracking-wide text-[#5e6b7e] dark:text-[#8fa5bb]">
          <span>Leaders {counts.leaders}</span>
          <span>Challengers {counts.challengers}</span>
          <span>Visionaries {counts.visionaries}</span>
          <span>Niche {counts.niche}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-[#e6dcc3] bg-white p-4 dark:border-[#223a2e] dark:bg-[#081410]">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="AI Atlas: Enhance vs Innovate">
          {/* Quadrant background fills */}
          {(["leaders", "challengers", "visionaries", "niche"] as const).map((q) => {
            const x = q === "leaders" || q === "visionaries" ? cutX : PAD.left;
            const y = q === "leaders" || q === "challengers" ? PAD.top : cutY;
            const w = q === "leaders" || q === "visionaries" ? PAD.left + INNER_W - cutX : cutX - PAD.left;
            const h = q === "leaders" || q === "challengers" ? cutY - PAD.top : PAD.top + INNER_H - cutY;
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
              { q: "leaders" as QuadrantId,     x: PAD.left + INNER_W - 12, y: PAD.top + 18,         anchor: "end"   as const },
              { q: "challengers" as QuadrantId, x: PAD.left + 12,           y: PAD.top + 18,         anchor: "start" as const },
              { q: "visionaries" as QuadrantId, x: PAD.left + INNER_W - 12, y: PAD.top + INNER_H - 8, anchor: "end"   as const },
              { q: "niche" as QuadrantId,       x: PAD.left + 12,           y: PAD.top + INNER_H - 8, anchor: "start" as const },
            ]
          ).map(({ q, x, y, anchor }) => {
            const c = QUADRANT_COLOURS[q];
            return (
              <g key={q}>
                <text x={x} y={y} textAnchor={anchor} className="dark:hidden" fill={c.label} fontSize={12} fontWeight={700} letterSpacing={1}>
                  {QUADRANT_LABELS[q].toUpperCase()}
                </text>
                <text x={x} y={y} textAnchor={anchor} className="hidden dark:block" fill={c.labelDark} fontSize={12} fontWeight={700} letterSpacing={1}>
                  {QUADRANT_LABELS[q].toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Axis frame */}
          <rect x={PAD.left} y={PAD.top} width={INNER_W} height={INNER_H} fill="none" stroke="currentColor" className="text-[#e6dcc3] dark:text-[#64798f]" strokeWidth={1} />
          {/* Cut lines */}
          <line x1={cutX} y1={PAD.top} x2={cutX} y2={PAD.top + INNER_H} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" className="text-[#5b6b7f] dark:text-[#8fa5bb]" />
          <line x1={PAD.left} y1={cutY} x2={PAD.left + INNER_W} y2={cutY} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" className="text-[#5b6b7f] dark:text-[#8fa5bb]" />

          {/* Y-axis ticks */}
          {Y_TICKS.map((t) => {
            const y = pos(AXIS_X_MIN, t).y;
            return (
              <g key={`y${t}`}>
                <line x1={PAD.left - 4} y1={y} x2={PAD.left} y2={y} stroke="currentColor" className="text-[#9aa691] dark:text-[#7d93aa]" />
                <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize={10} className="fill-[#5e6b7e] dark:fill-[#8fa5bb]">{t}</text>
              </g>
            );
          })}
          {/* X-axis ticks */}
          {X_TICKS.map((t) => {
            const x = pos(t, AXIS_Y_MIN).x;
            return (
              <g key={`x${t}`}>
                <line x1={x} y1={PAD.top + INNER_H} x2={x} y2={PAD.top + INNER_H + 4} stroke="currentColor" className="text-[#9aa691] dark:text-[#7d93aa]" />
                <text x={x} y={PAD.top + INNER_H + 16} textAnchor="middle" fontSize={10} className="fill-[#5e6b7e] dark:fill-[#8fa5bb]">{t}</text>
              </g>
            );
          })}
          {/* Axis labels */}
          <text x={PAD.left + INNER_W / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-[#475a72] dark:fill-[#c2d1e0]">
            Innovate →
          </text>
          <text x={16} y={PAD.top + INNER_H / 2} textAnchor="middle" fontSize={11} fontWeight={600} transform={`rotate(-90, 16, ${PAD.top + INNER_H / 2})`} className="fill-[#475a72] dark:fill-[#c2d1e0]">
            Enhance →
          </text>

          {/* Arrow marker definition */}
          <defs>
            <marker id="qarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" className="fill-[#123d2c] dark:fill-[#eef3f8]" />
            </marker>
          </defs>

          {/* Trajectory arrows + dots */}
          {points.map((p) => {
            const nowPos = pos(p.now.vision, p.now.execute);
            const prevPos = p.prev ? pos(p.prev.vision, p.prev.execute) : null;
            const isHovered = hovered === p.vendor.id;
            const qNow = quadrantOf(p.now.execute, p.now.vision, data.executeCut, data.visionCut);
            const colour = QUADRANT_COLOURS[qNow];
            const radius = radiusBounds ? radiusForShare(p.marketShare, radiusBounds.minShare, radiusBounds.maxShare) : 6;

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
                    x1={prevPos.x} y1={prevPos.y} x2={nowPos.x} y2={nowPos.y}
                    stroke={colour.label} strokeWidth={1.5} strokeOpacity={0.55}
                    markerEnd="url(#qarrow)"
                  />
                )}
                {prevPos && (
                  <circle cx={prevPos.x} cy={prevPos.y} r={2.5} fill={colour.label} fillOpacity={0.35} />
                )}
                <circle
                  cx={nowPos.x} cy={nowPos.y}
                  r={isHovered ? radius + 1.5 : radius}
                  fill={colour.label}
                  stroke="white" strokeWidth={1.5}
                  className="dark:stroke-[#0b2519]"
                />
                {p.crossedQuadrant && (
                  <circle cx={nowPos.x} cy={nowPos.y} r={9} fill="none" stroke={colour.label} strokeWidth={1.2} strokeDasharray="2 1.5" />
                )}
                <text
                  x={nowPos.x + 8} y={nowPos.y + 3}
                  fontSize={10} fontWeight={isHovered ? 700 : 500}
                  className="fill-[#123d2c] dark:fill-[#eef3f8]"
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
          <div className="mt-3 grid gap-3 rounded-md border border-[#e6dcc3] bg-[#faf6ec] p-3 text-xs dark:border-[#2a4a6b] dark:bg-[#0b1f30] md:grid-cols-[1.3fr_auto_auto_auto_auto]">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#5e6b7e] dark:text-[#8fa5bb]">Vendor</div>
              <div className="font-semibold text-[#123d2c] dark:text-[#eef3f8]">{hoveredPoint.vendor.name}</div>
              <div className="text-[#5b6b7f] dark:text-[#a7bacd]">{hoveredPoint.vendor.category}</div>
              {hoveredPoint.isLosing && (
                <div className="mt-1 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                  On losing list
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#5e6b7e] dark:text-[#8fa5bb]">Enhance</div>
              <div className="font-mono font-semibold dark:text-[#eef3f8]">{hoveredPoint.now.execute.toFixed(1)}</div>
              {hoveredPoint.delta && (
                <div className={`text-[10px] font-medium ${hoveredPoint.delta.execute >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                  {hoveredPoint.delta.execute >= 0 ? "▲ +" : "▼ "}{hoveredPoint.delta.execute}
                </div>
              )}
              <div className="mt-1 text-[10px] leading-tight text-[#5b6b7f] dark:text-[#8fa5bb]">
                conf {hoveredPoint.components.execute.confidence}<br />
                rel  {hoveredPoint.components.execute.reliability}<br />
                ind  {hoveredPoint.components.execute.breadth}<br />
                risk {hoveredPoint.components.execute.riskDrag}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#5e6b7e] dark:text-[#8fa5bb]">Innovate</div>
              <div className="font-mono font-semibold dark:text-[#eef3f8]">{hoveredPoint.now.vision.toFixed(1)}</div>
              {hoveredPoint.delta && (
                <div className={`text-[10px] font-medium ${hoveredPoint.delta.vision >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                  {hoveredPoint.delta.vision >= 0 ? "▲ +" : "▼ "}{hoveredPoint.delta.vision}
                </div>
              )}
              <div className="mt-1 text-[10px] leading-tight text-[#5b6b7f] dark:text-[#8fa5bb]">
                mom  {hoveredPoint.components.vision.momentum}<br />
                prod {hoveredPoint.components.vision.product}<br />
                use  {hoveredPoint.components.vision.useCases}<br />
                shr  {hoveredPoint.components.vision.shareDrag}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#5e6b7e] dark:text-[#8fa5bb]">Quadrant</div>
              <div className="font-semibold dark:text-[#eef3f8]">
                {QUADRANT_LABELS[quadrantOf(hoveredPoint.now.execute, hoveredPoint.now.vision, data.executeCut, data.visionCut)]}
                {hoveredPoint.crossedQuadrant && <span className="ml-1 text-amber-700 dark:text-amber-400">(crossed)</span>}
              </div>
              <div className="mt-1 text-[10px] text-[#5b6b7f] dark:text-[#8fa5bb]">
                score {hoveredPoint.now.score.toFixed(0)} · mom {hoveredPoint.now.momentum.toFixed(0)}
              </div>
            </div>
            <a
              href={`/vendors/${hoveredPoint.vendor.slug}`}
              className="self-end justify-self-end text-[#b08d2f] underline hover:text-[#1a3b30] dark:text-emerald-300"
            >
              Open profile →
            </a>
          </div>
        )}
      </div>

      <div className="text-[11px] leading-5 text-[#5e6b7e] dark:text-[#8fa5bb]">
        Cuts at Enhance = {data.executeCut}, Innovate = {data.visionCut}. Enhance = 0.40·confidence + 0.30·(enterprise-control + reliability-safety + vendor-resilience) + 0.20·industry breadth − 7·risk count. Innovate = 0.40·momentum + 0.30·(business-fit + market-strength + integration-ops) + 0.20·use-case breadth − 1.5·negative share drift. Vendors on the &quot;Who&apos;s losing&quot; list are guaranteed to fall outside the Leaders quadrant. Arrows show movement since {movementSinceLabel}.
      </div>
    </div>
  );
}
