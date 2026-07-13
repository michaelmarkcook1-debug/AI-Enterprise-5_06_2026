// Cost-vs-capability value scatter — the /models page's signature analytical
// view. Plots every roster model that publishes BOTH a real input price and a
// real Artificial Analysis Intelligence Index: x = input $/1M tokens (log, since
// prices span two orders of magnitude), y = Intelligence Index. The efficiency
// frontier — models no cheaper peer beats on intelligence — is drawn in gold;
// dominated models sit faint behind it, so "what's the best capability per
// dollar" reads at a glance. Pure server component: inline SVG, native <title>
// hovers, no client JS. House palette only (gold + ink, never red↔green).

import Link from "next/link";
import type { ValueField } from "@/lib/model-inventory/value-field";
import { markFrontier } from "@/lib/model-inventory/value-field";

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

// viewBox geometry — a fixed coordinate space the wrapper scales responsively.
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

export default function ValueScatter({ field }: { field: ValueField }) {
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

  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += yMax > 60 ? 20 : 10) yTicks.push(v);
  const xTicks = niceDecades(minP, maxP);

  const frontierPts = marked.filter((p) => p.frontier);
  // Frontier polyline (staircase), left→right (cheap→capable), for the "best value" edge.
  const frontierPath = [...frontierPts]
    .sort((a, b) => a.priceInput1m - b.priceInput1m)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.priceInput1m).toFixed(1)} ${y(p.intelligence).toFixed(1)}`)
    .join(" ");

  return (
    <section className={`${CARD} mb-8`}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">Cost vs capability</h2>
        <span className={`text-xs ${MUTED}`}>{marked.length} priced models</span>
      </div>
      <p className={`mb-4 text-xs ${MUTED}`}>
        Every tracked model that publishes both a real price and an independent Intelligence Index. The{" "}
        <span className="font-semibold text-[#8a6d1f] dark:text-[#d4af37]">gold edge</span> is the efficiency frontier —
        models no cheaper peer beats on intelligence. Models behind it are dominated: something cheaper is at least as
        capable. Lower-left is worse; upper-left is the sweet spot (smart and cheap).
      </p>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img"
          aria-label={`Scatter of ${marked.length} models by input price (log) and intelligence index; ${frontierPts.length} on the efficiency frontier.`}>
          {/* y gridlines + labels */}
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-[#13294b]/10 dark:stroke-white/10" strokeWidth={1} />
              <text x={PAD.l - 8} y={y(v) + 3} textAnchor="end" className="fill-[#5e6b7e] text-[10px] dark:fill-[#a7bacd]">{v}</text>
            </g>
          ))}
          {/* x decade gridlines + labels */}
          {xTicks.map((v) => (
            <g key={`x${v}`}>
              <line x1={x(v)} x2={x(v)} y1={PAD.t} y2={H - PAD.b} className="stroke-[#13294b]/10 dark:stroke-white/10" strokeWidth={1} />
              <text x={x(v)} y={H - PAD.b + 16} textAnchor="middle" className="fill-[#5e6b7e] text-[10px] dark:fill-[#a7bacd]">{money(v)}</text>
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
          {frontierPts.length > 1 && (
            <path d={frontierPath} fill="none" className="stroke-[#b08d2f] dark:stroke-[#e8c95c]" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
          )}

          {/* dominated points (drawn first, behind) */}
          {marked.filter((p) => !p.frontier).map((p) => (
            <circle key={`d-${p.vendorId}-${p.modelName}`} cx={x(p.priceInput1m).toFixed(1)} cy={y(p.intelligence).toFixed(1)} r={3}
              className="fill-none stroke-[#13294b]/40 dark:stroke-white/30" strokeWidth={1}>
              <title>{`${p.modelName} — Intelligence ${p.intelligence}, ${money(p.priceInput1m)}/1M in${p.tokPerSec != null ? `, ${Math.round(p.tokPerSec)} tok/s` : ""}`}</title>
            </circle>
          ))}

          {/* frontier points + labels (drawn last, on top) */}
          {frontierPts.map((p) => {
            const px = x(p.priceInput1m);
            const py = y(p.intelligence);
            const rightEdge = px > W - 130;
            return (
              <g key={`f-${p.vendorId}-${p.modelName}`}>
                <circle cx={px.toFixed(1)} cy={py.toFixed(1)} r={4.5}
                  className="fill-[#b08d2f] stroke-[#0a1f38] dark:fill-[#e8c95c] dark:stroke-[#eef3f8]" strokeWidth={1}>
                  <title>{`${p.modelName} — Intelligence ${p.intelligence}, ${money(p.priceInput1m)}/1M in${p.tokPerSec != null ? `, ${Math.round(p.tokPerSec)} tok/s` : ""}${p.ttftSec != null ? `, ${p.ttftSec}s TTFT` : ""}  ·  efficiency frontier`}</title>
                </circle>
                <text x={rightEdge ? px - 7 : px + 7} y={py + 3} textAnchor={rightEdge ? "end" : "start"}
                  className="fill-[#13294b] text-[9.5px] font-medium dark:fill-[#eef3f8]">
                  {p.modelName.length > 22 ? p.modelName.slice(0, 21) + "…" : p.modelName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] ${MUTED}`}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#b08d2f] dark:bg-[#e8c95c]" /> efficiency frontier (best value at its capability)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-[#13294b]/40 dark:border-white/30" /> dominated (something cheaper is ≥ as capable)
        </span>
      </div>
      <p className={`mt-3 text-[11px] leading-4 ${MUTED}`}>
        Price and speed are real published figures from{" "}
        <a href={field.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Artificial Analysis</a>;
        a model appears only when it publishes both a price and an Intelligence Index — no imputed cost, no default score.
        Input price is the like-for-like axis; hover any point for throughput. Compare vendors on the{" "}
        <Link href="/vendors" className="underline underline-offset-2">leaderboard</Link>.
      </p>
    </section>
  );
}
