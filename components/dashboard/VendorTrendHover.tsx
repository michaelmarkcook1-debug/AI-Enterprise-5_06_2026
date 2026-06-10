"use client";

// Hover-over ranking-trend graph for the dashboard "Who's winning" /
// "Who's losing" lists. Wraps a vendor row; on hover (or keyboard focus)
// it surfaces a card with a day-by-day line graph of the vendor's ranking
// metrics from the day tracking started through today.
//
// Data is reconstructed deterministically in lib/intelligence/ranking-history.ts
// — see that file for why (no per-day snapshot table exists yet).

import { useId } from "react";
import type { VendorRankingHistory } from "@/lib/intelligence/ranking-history";

interface VendorTrendHoverProps {
  vendorName: string;
  history?: VendorRankingHistory;
  tone: "win" | "lose";
  children: React.ReactNode;
}

const CHART_W = 296;
const CHART_H = 104;
const PAD_X = 6;
const PAD_Y = 10;

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function buildPath(values: number[], min: number, max: number): string {
  const span = max - min || 1;
  const n = values.length;
  return values
    .map((v, i) => {
      const x = PAD_X + (n === 1 ? 0 : (i / (n - 1)) * (CHART_W - PAD_X * 2));
      const y = PAD_Y + (1 - (v - min) / span) * (CHART_H - PAD_Y * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function VendorTrendHover({ vendorName, history, tone, children }: VendorTrendHoverProps) {
  const gradientId = useId();

  if (!history || history.points.length < 2) {
    return <>{children}</>;
  }

  const { points, trackingStart, scoreDelta, rankDelta } = history;
  const scores = points.map((p) => p.score);
  const momenta = points.map((p) => p.momentum);
  const last = points[points.length - 1];

  // Shared vertical scale across both lines so they're visually comparable.
  const allValues = [...scores, ...momenta];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const min = Math.max(0, Math.floor(rawMin) - 4);
  const max = Math.min(100, Math.ceil(rawMax) + 4);

  const scorePath = buildPath(scores, min, max);
  const momentumPath = buildPath(momenta, min, max);
  const areaPath = `${scorePath} L${(CHART_W - PAD_X).toFixed(1)},${(CHART_H - PAD_Y).toFixed(1)} L${PAD_X.toFixed(1)},${(CHART_H - PAD_Y).toFixed(1)} Z`;

  const lineColor = tone === "win" ? "#059669" : "#e11d48";
  const lineColorDark = tone === "win" ? "#34d399" : "#fb7185";

  const scoreUp = scoreDelta >= 0;
  const rankUp = rankDelta >= 0;

  return (
    <div className="group/trend relative">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-[330px] -translate-x-1/2 rounded-lg border border-[#e6dcc3] bg-white p-3 opacity-0 shadow-xl transition-opacity duration-150 group-hover/trend:visible group-hover/trend:opacity-100 group-focus-within/trend:visible group-focus-within/trend:opacity-100 dark:border-zinc-700 dark:bg-[#0b1f30]"
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xs font-semibold text-[#13294b] dark:text-zinc-100">{vendorName}</div>
          <div className="text-[10px] uppercase tracking-wide text-[#8a9382] dark:text-zinc-500">Ranking trend</div>
        </div>
        <div className="mt-0.5 text-[10px] text-[#5e6b7e] dark:text-zinc-500">
          Tracked since {formatDate(trackingStart)} · {points.length} days
        </div>

        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="mt-2 w-full"
          role="img"
          aria-label={`${vendorName} ranking score from ${formatDate(trackingStart)} to ${formatDate(last.date)}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* baseline grid */}
          <line x1={PAD_X} y1={CHART_H - PAD_Y} x2={CHART_W - PAD_X} y2={CHART_H - PAD_Y} stroke="currentColor" strokeWidth="1" className="text-[#efe9d9] dark:text-zinc-800" />
          <line x1={PAD_X} y1={PAD_Y} x2={CHART_W - PAD_X} y2={PAD_Y} stroke="currentColor" strokeWidth="1" className="text-[#efe9d9] dark:text-zinc-800" />
          {/* momentum line (faint, secondary metric) */}
          <path d={momentumPath} fill="none" stroke="currentColor" strokeWidth="1.25" strokeDasharray="3 2.5" className="text-[#9aa691] dark:text-zinc-500" />
          {/* score area + line */}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={scorePath}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            stroke={lineColor}
            className="dark:hidden"
          />
          <path
            d={scorePath}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            stroke={lineColorDark}
            className="hidden dark:block"
          />
        </svg>

        <div className="mt-1 flex items-center justify-between text-[10px] text-[#5e6b7e] dark:text-zinc-500">
          <span>{formatDate(trackingStart)}</span>
          <span className="flex items-center gap-3">
            <span><span className="inline-block h-[2px] w-3 align-middle" style={{ backgroundColor: lineColor }} /> Ranking score</span>
            <span><span className="inline-block h-[2px] w-3 border-t border-dashed border-[#9aa691] align-middle" /> Momentum</span>
          </span>
          <span>{formatDate(last.date)}</span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-[#efe9d9] pt-2 dark:border-zinc-800">
          <div>
            <div className="text-[9px] uppercase tracking-wide text-[#8a9382] dark:text-zinc-500">Score</div>
            <div className="font-mono text-sm font-semibold text-[#13294b] dark:text-zinc-100">{last.score.toFixed(1)}</div>
            <div className={`text-[10px] font-medium ${scoreUp ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {scoreUp ? "▲" : "▼"} {scoreUp ? "+" : ""}{scoreDelta.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-[#8a9382] dark:text-zinc-500">Rank</div>
            <div className="font-mono text-sm font-semibold text-[#13294b] dark:text-zinc-100">#{last.rank}</div>
            <div className={`text-[10px] font-medium ${rankUp ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {rankUp ? "▲" : "▼"} {rankDelta === 0 ? "flat" : `${Math.abs(rankDelta)} ${rankDelta >= 0 ? "up" : "down"}`}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-[#8a9382] dark:text-zinc-500">Momentum</div>
            <div className="font-mono text-sm font-semibold text-[#13294b] dark:text-zinc-100">{last.momentum.toFixed(0)}</div>
            <div className="text-[10px] text-[#8a9382] dark:text-zinc-500">/100</div>
          </div>
        </div>
        <div className="mt-1.5 text-[9px] leading-3 text-[#9aa691] dark:text-zinc-600">
          {history.source === "snapshot"
            ? "Tracked daily snapshots — captured point-in-time history."
            : history.source === "mixed"
              ? "Recent points are tracked daily snapshots; earlier history is reconstructed backfill."
              : "Reconstructed daily series — directional estimate pending snapshot capture."}
        </div>
      </div>
    </div>
  );
}
