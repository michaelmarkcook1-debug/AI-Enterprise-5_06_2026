// Total AI-vendor market share — pie chart.
// ──────────────────────────────────────────
// Pure SVG pie + side legend rendered on the server. Source data is the
// `aggregateUptake({})` result from vendor-uptake-seed (585 segment-share
// rows averaged across all regions + industries, renormalised to sum to 1).
// No client interactivity needed — the data is static seed, so the pie
// ships as part of the SSR HTML and avoids the bundle cost of a chart
// library. Tooltip behaviour is the native <title> element inside each
// slice so it works without JS.

import {
  aggregateUptake,
  type UptakeAggregateRow,
} from "@/lib/intelligence/vendor-uptake-seed";

// Same vendor palette used by the Demonstrate explorer so a vendor reads
// as the same colour on both tabs.
const VENDOR_COLOR: Record<string, string> = {
  "OpenAI":          "#0f9d6a",
  "Anthropic":       "#d97757",
  "Google DeepMind": "#4285f4",
  "Meta":            "#1877f2",
  "xAI":             "#1a1a1a",
  "Perplexity":      "#1fb6ff",
  "Cohere":          "#cc66ff",
  "Mistral AI":      "#ff7f00",
  "IBM watsonx":     "#054ada",
  "Moveworks":       "#7c3aed",
  "Harvey":          "#0e7490",
  "Writer":          "#ec4899",
  "Rogo":            "#65a30d",
};

function colorFor(vendor: string): string {
  return VENDOR_COLOR[vendor] ?? "#6b7280";
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const SIZE = 280;
const RADIUS = 120;
const CENTER = SIZE / 2;

/** Convert polar (radians) to cartesian relative to the pie centre. */
function polar(angle: number, radius: number): { x: number; y: number } {
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

/** Build the `d` attribute for one pie slice (centre → arc → centre). */
function arcPath(startAngle: number, endAngle: number): string {
  const start = polar(startAngle, RADIUS);
  const end = polar(endAngle, RADIUS);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${CENTER} ${CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export default function VendorSharePie() {
  // No filters → overall share across every segment cell.
  const rows: UptakeAggregateRow[] = aggregateUptake({});
  if (rows.length === 0) return null;

  // Build slices with cumulative angles starting at -π/2 so the first
  // (largest) slice sits at the 12-o-clock position.
  let cursor = -Math.PI / 2;
  const slices = rows.map((row) => {
    const angle = row.share * Math.PI * 2;
    const start = cursor;
    const end = cursor + angle;
    cursor = end;
    // Label position — midway along the arc, slightly inside the radius.
    const mid = (start + end) / 2;
    const labelPos = polar(mid, RADIUS * 0.65);
    return { ...row, start, end, path: arcPath(start, end), labelPos };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-center">
      {/* Pie */}
      <div className="mx-auto" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label="AI vendor market share by share-of-named-vendor-usage">
          {slices.map((s) => (
            <g key={s.vendor}>
              <path d={s.path} fill={colorFor(s.vendor)} stroke="#ffffff" strokeWidth={1.5}>
                <title>{`${s.vendor}: ${pct(s.share)}`}</title>
              </path>
              {/* Only label slices ≥ 4% to keep the chart readable. */}
              {s.share >= 0.04 && (
                <text
                  x={s.labelPos.x}
                  y={s.labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={600}
                  className="fill-white pointer-events-none select-none"
                >
                  {pct(s.share)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Legend / ranked list */}
      <ol className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2">
        {rows.map((row, i) => (
          <li
            key={row.vendor}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm hover:bg-[#eef2e8] dark:hover:bg-zinc-800"
          >
            <span className="flex items-center gap-2 truncate">
              <span className="w-4 text-right font-mono text-[11px] text-[#697362] dark:text-zinc-500">{i + 1}</span>
              <span className="h-3 w-3 flex-none rounded-sm" style={{ background: colorFor(row.vendor) }} />
              <span className="truncate font-medium text-[#18201b] dark:text-zinc-100">{row.vendor}</span>
            </span>
            <span className="font-mono font-semibold text-[#18201b] dark:text-zinc-100">{pct(row.share)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
