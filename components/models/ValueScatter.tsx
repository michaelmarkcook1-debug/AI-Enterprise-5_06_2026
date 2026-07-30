"use client";

// Cost-vs-capability value scatter — the /models page's signature analytical
// view. Plots every roster model that publishes BOTH a real input price and a
// real Artificial Analysis Intelligence Index: x = input $/1M tokens (log, since
// prices span two orders of magnitude), y = Intelligence Index. The efficiency
// frontier — models no cheaper peer beats on intelligence — is drawn in gold;
// dominated models sit faint behind it, so "what's the best capability per
// dollar" reads at a glance. House palette only (gold + ink, never red↔green).
//
// INTERACTIVE: hovering (or keyboard-focusing) any point opens a detail card.
// This was a pure server component relying on native <title> tooltips, which
// take ~1s to appear, can't be styled, and — with dominated dots drawn at r=3 —
// were nearly impossible to hit. Now every point carries an invisible r=10 hit
// target, the active point is emphasised with crosshairs onto both axes, and
// the card shows the full figures.
//
// The card answers the question the chart raises. For a dominated model,
// "dominated" alone is useless — you want to know BY WHAT. So it names the
// cheapest model that is at least as capable, computed from these same points
// using markFrontier's own dominance rule. No new data, no estimate.
//
// Accessibility: the SVG keeps role="img" + a summary label (so screen readers
// get the shape, not 330 unlabelled circles), frontier points are keyboard
// focusable (~8 stops, not 330), and the full per-model figures remain in the
// table further down /models. Native <title> is retained so the chart still
// says something useful with JS disabled.

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { ValueField, ValuePoint } from "@/lib/model-inventory/value-field";
import { markFrontier } from "@/lib/model-inventory/value-field";

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

// viewBox geometry — a fixed coordinate space the wrapper scales responsively.
// Because the SVG scales uniformly (viewBox + h-auto w-full), a point's
// position as a PERCENTAGE of the viewBox is exactly its position in the
// rendered box — which is what lets the HTML tooltip sit over the right dot
// without measuring anything.
const W = 760;
const H = 400;
const PAD = { l: 54, r: 20, t: 24, b: 48 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

function niceDecades(min: number, max: number): number[] {
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  const out: number[] = [];
  for (let k = lo; k <= hi; k++) out.push(10 ** k);
  return out.filter((v) => v >= min * 0.5 && v <= max * 2);
}

function money(n: number): string {
  if (n >= 1) return `$${n % 1 === 0 ? n : n.toFixed(n < 10 ? 1 : 0)}`;
  return `$${n.toFixed(n < 0.1 ? 3 : 2)}`;
}

/** Full precision for the card — the axis labels round, the detail shouldn't. */
function moneyExact(n: number): string {
  return n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`;
}

type Marked = ValuePoint & { frontier: boolean };
type Plotted = Marked & { i: number; px: number; py: number; dominatedBy: Marked | null };

export default function ValueScatter({ field }: { field: ValueField }) {
  const [active, setActive] = useState<number | null>(null);

  // Geometry + dominance are pure functions of `field`; recomputing them on
  // every hover would walk 330 points per mousemove.
  const { plotted, frontierPath, yTicks, xTicks, frontierCount } = useMemo(() => {
    const marked = markFrontier(field.points);
    const prices = marked.map((p) => p.priceInput1m);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const maxIntel = Math.max(...marked.map((p) => p.intelligence));
    const yMax = Math.max(20, Math.ceil(maxIntel / 10) * 10);

    const lMin = Math.log10(minP);
    const lMax = Math.log10(maxP);
    const span = lMax - lMin || 1; // guard single-price degenerate case

    const x = (price: number) => PAD.l + ((Math.log10(price) - lMin) / span) * PLOT_W;
    const y = (intel: number) => PAD.t + (1 - intel / yMax) * PLOT_H;

    // For each dominated point: the CHEAPEST model at least as capable. That is
    // exactly what makes it dominated under markFrontier's rule, and it is the
    // model a buyer should look at instead.
    const byPriceAsc = [...marked].sort((a, b) => a.priceInput1m - b.priceInput1m);
    const dominatorFor = (p: Marked): Marked | null => {
      if (p.frontier) return null;
      for (const q of byPriceAsc) {
        if (q === p) continue;
        if (q.priceInput1m <= p.priceInput1m && q.intelligence >= p.intelligence) return q;
      }
      return null;
    };

    const pts: Plotted[] = marked.map((p, i) => ({
      ...p,
      i,
      px: x(p.priceInput1m),
      py: y(p.intelligence),
      dominatedBy: dominatorFor(p),
    }));

    const fPts = pts.filter((p) => p.frontier);
    const path = [...fPts]
      .sort((a, b) => a.priceInput1m - b.priceInput1m)
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`)
      .join(" ");

    // Ticks carry their own pixel position. Deriving it at render time meant
    // recomputing min/max per tick and re-reading yMax back out of the tick
    // array — fragile and needlessly O(n) inside a map.
    const yT: Array<{ v: number; pos: number }> = [];
    for (let v = 0; v <= yMax; v += yMax > 60 ? 20 : 10) yT.push({ v, pos: y(v) });
    const xT = niceDecades(minP, maxP).map((v) => ({ v, pos: x(v) }));

    return {
      plotted: pts,
      frontierPath: path,
      yTicks: yT,
      xTicks: xT,
      frontierCount: fPts.length,
    };
  }, [field.points]);

  // One delegated handler rather than 330 closures re-created each render.
  const onOver = useCallback((e: React.MouseEvent | React.FocusEvent) => {
    const raw = (e.target as SVGElement).getAttribute?.("data-i");
    if (raw !== null && raw !== undefined) setActive(Number(raw));
  }, []);
  const clear = useCallback(() => setActive(null), []);

  const hot = active === null ? null : plotted[active] ?? null;
  const frontierPts = plotted.filter((p) => p.frontier);
  const dominatedPts = plotted.filter((p) => !p.frontier);

  return (
    <section className={`${CARD} mb-8`}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">Cost vs capability</h2>
        <span className={`text-xs ${MUTED}`}>{plotted.length} priced models</span>
      </div>
      <p className={`mb-4 text-xs ${MUTED}`}>
        Every tracked model that publishes both a real price and an independent Intelligence Index. The{" "}
        <span className="font-semibold text-[#8a6d1f] dark:text-[#d4af37]">gold edge</span> is the efficiency frontier —
        models no cheaper peer beats on intelligence. Models behind it are dominated: something cheaper is at least as
        capable. Lower-left is worse; upper-left is the sweet spot (smart and cheap).{" "}
        <span className="font-medium text-[#123d2c] dark:text-[#eef3f8]">Hover any point for its figures.</span>
      </p>

      <div className="overflow-x-auto">
        <div className="relative min-w-[560px]">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Scatter of ${plotted.length} models by input price (log) and intelligence index; ${frontierCount} on the efficiency frontier.`}
            onMouseLeave={clear}
          >
            {/* y gridlines + labels */}
            {yTicks.map((t) => (
              <g key={`y${t.v}`}>
                <line x1={PAD.l} x2={W - PAD.r} y1={t.pos} y2={t.pos} className="stroke-[#123d2c]/10 dark:stroke-white/10" strokeWidth={1} />
                <text x={PAD.l - 8} y={t.pos + 3} textAnchor="end" className="fill-[#5e6b7e] text-[10px] dark:fill-[#a7bacd]">{t.v}</text>
              </g>
            ))}
            {/* x decade gridlines + labels */}
            {xTicks.map((t) => (
              <g key={`x${t.v}`}>
                <line x1={t.pos} x2={t.pos} y1={PAD.t} y2={H - PAD.b} className="stroke-[#123d2c]/10 dark:stroke-white/10" strokeWidth={1} />
                <text x={t.pos} y={H - PAD.b + 16} textAnchor="middle" className="fill-[#5e6b7e] text-[10px] dark:fill-[#a7bacd]">{money(t.v)}</text>
              </g>
            ))}
            {/* axis titles */}
            <text x={PAD.l + PLOT_W / 2} y={H - 6} textAnchor="middle" className="fill-[#5e6b7e] text-[11px] font-medium dark:fill-[#a7bacd]">
              Input price · $ / 1M tokens (log scale)
            </text>
            <text transform={`translate(14 ${PAD.t + PLOT_H / 2}) rotate(-90)`} textAnchor="middle" className="fill-[#5e6b7e] text-[11px] font-medium dark:fill-[#a7bacd]">
              Intelligence Index
            </text>

            {/* frontier edge */}
            {frontierCount > 1 && (
              <path d={frontierPath} fill="none" className="stroke-[#b08d2f] dark:stroke-[#e8c95c]" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
            )}

            {/* crosshair for the active point — reads its value off both axes */}
            {hot && (
              <g pointerEvents="none">
                <line x1={PAD.l} x2={hot.px} y1={hot.py} y2={hot.py} className="stroke-[#b08d2f]/50 dark:stroke-[#e8c95c]/50" strokeWidth={1} strokeDasharray="3 3" />
                <line x1={hot.px} x2={hot.px} y1={hot.py} y2={H - PAD.b} className="stroke-[#b08d2f]/50 dark:stroke-[#e8c95c]/50" strokeWidth={1} strokeDasharray="3 3" />
              </g>
            )}

            {/* dominated points (drawn first, behind) */}
            {dominatedPts.map((p) => (
              <circle
                key={`d-${p.vendorId}-${p.modelName}`}
                cx={p.px.toFixed(1)}
                cy={p.py.toFixed(1)}
                r={active === p.i ? 5 : 3}
                pointerEvents="none"
                className={
                  active === p.i
                    ? "fill-[#123d2c] stroke-[#b08d2f] dark:fill-[#eef3f8] dark:stroke-[#e8c95c]"
                    : "fill-none stroke-[#123d2c]/40 dark:stroke-white/30"
                }
                strokeWidth={active === p.i ? 2 : 1}
              />
            ))}

            {/* frontier points + labels (drawn last, on top) */}
            {frontierPts.map((p) => {
              const rightEdge = p.px > W - 130;
              return (
                <g key={`f-${p.vendorId}-${p.modelName}`}>
                  <circle
                    cx={p.px.toFixed(1)}
                    cy={p.py.toFixed(1)}
                    r={active === p.i ? 6.5 : 4.5}
                    pointerEvents="none"
                    className="fill-[#b08d2f] stroke-[#0b2519] dark:fill-[#e8c95c] dark:stroke-[#eef3f8]"
                    strokeWidth={active === p.i ? 2 : 1}
                  />
                  <text
                    x={rightEdge ? p.px - 9 : p.px + 9}
                    y={p.py + 3}
                    textAnchor={rightEdge ? "end" : "start"}
                    pointerEvents="none"
                    className="fill-[#123d2c] text-[9.5px] font-medium dark:fill-[#eef3f8]"
                  >
                    {p.modelName.length > 22 ? p.modelName.slice(0, 21) + "…" : p.modelName}
                  </text>
                </g>
              );
            })}

            {/* Hit targets — ONE layer on top of everything, generously sized.
                The visible dominated dot is r=3, far too small to hit reliably;
                these are r=10 and invisible. Only frontier points are focusable:
                330 tab stops would wreck keyboard navigation, and the full
                figures for every model are in the table below. */}
            <g onMouseOver={onOver} onFocus={onOver} onBlur={clear}>
              {plotted.map((p) => (
                <circle
                  key={`h-${p.vendorId}-${p.modelName}`}
                  data-i={p.i}
                  cx={p.px.toFixed(1)}
                  cy={p.py.toFixed(1)}
                  r={10}
                  fill="transparent"
                  className="cursor-pointer outline-none focus-visible:stroke-[#b08d2f] dark:focus-visible:stroke-[#e8c95c]"
                  strokeWidth={2}
                  {...(p.frontier ? { tabIndex: 0 } : {})}
                >
                  <title>
                    {`${p.modelName} — Intelligence ${p.intelligence}, ${money(p.priceInput1m)}/1M in`}
                    {p.tokPerSec != null ? `, ${Math.round(p.tokPerSec)} tok/s` : ""}
                    {p.frontier ? "  ·  efficiency frontier" : ""}
                  </title>
                </circle>
              ))}
            </g>
          </svg>

          {/* Detail card. Positioned as a % of the viewBox, which maps exactly
              onto the rendered box because the SVG scales uniformly. Flips away
              from the right edge and below-the-point near the top so it never
              runs off the plot. */}
          {hot && (
            <div
              role="tooltip"
              aria-live="polite"
              className="pointer-events-none absolute z-10 w-[15rem] rounded-lg border border-black/10 bg-white p-3 text-[12px] leading-5 shadow-xl dark:border-white/15 dark:bg-[#0f2019]"
              style={{
                left: `${(hot.px / W) * 100}%`,
                top: `${(hot.py / H) * 100}%`,
                transform: `translate(${hot.px > W * 0.62 ? "calc(-100% - 14px)" : "14px"}, ${hot.py < H * 0.3 ? "0" : "-100%"})`,
              }}
            >
              <p className="font-semibold text-[#123d2c] dark:text-[#eef3f8]">{hot.modelName}</p>
              <p className={`mt-0.5 text-[11px] ${MUTED}`}>{hot.vendorId}</p>

              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                <dt className={MUTED}>Intelligence</dt>
                <dd className="text-right font-mono tabular-nums">{hot.intelligence}</dd>
                <dt className={MUTED}>Input / 1M</dt>
                <dd className="text-right font-mono tabular-nums">{moneyExact(hot.priceInput1m)}</dd>
                {hot.priceOutput1m != null && (
                  <>
                    <dt className={MUTED}>Output / 1M</dt>
                    <dd className="text-right font-mono tabular-nums">{moneyExact(hot.priceOutput1m)}</dd>
                  </>
                )}
                {hot.tokPerSec != null && (
                  <>
                    <dt className={MUTED}>Throughput</dt>
                    <dd className="text-right font-mono tabular-nums">{Math.round(hot.tokPerSec)} tok/s</dd>
                  </>
                )}
                {hot.ttftSec != null && (
                  <>
                    <dt className={MUTED}>First token</dt>
                    <dd className="text-right font-mono tabular-nums">{hot.ttftSec}s</dd>
                  </>
                )}
              </dl>

              {hot.frontier ? (
                <p className="mt-2 border-t border-black/5 pt-2 text-[11px] font-medium text-[#8a6d1f] dark:border-white/10 dark:text-[#d4af37]">
                  On the efficiency frontier — nothing cheaper matches it.
                </p>
              ) : hot.dominatedBy ? (
                <p className={`mt-2 border-t border-black/5 pt-2 text-[11px] dark:border-white/10 ${MUTED}`}>
                  Dominated by{" "}
                  <span className="font-medium text-[#123d2c] dark:text-[#eef3f8]">{hot.dominatedBy.modelName}</span> —
                  index {hot.dominatedBy.intelligence} at {moneyExact(hot.dominatedBy.priceInput1m)}.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] ${MUTED}`}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#b08d2f] dark:bg-[#e8c95c]" /> efficiency frontier (best value at its capability)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-[#123d2c]/40 dark:border-white/30" /> dominated (something cheaper is ≥ as capable)
        </span>
      </div>
      <p className={`mt-3 text-[11px] leading-4 ${MUTED}`}>
        Price and speed are real published figures from{" "}
        <a href={field.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Artificial Analysis</a>;
        a model appears only when it publishes both a price and an Intelligence Index — no imputed cost, no default score.
        Input price is the like-for-like axis. Compare vendors on the{" "}
        <Link href="/vendors" className="underline underline-offset-2">leaderboard</Link>.
      </p>
    </section>
  );
}
