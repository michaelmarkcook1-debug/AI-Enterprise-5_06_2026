// Colored bar chart for AI usage in the peer tab — pure SVG (no chart library,
// matching components/quadrant/QuadrantChart.tsx's convention). Renders the
// SAME disclosed, cited counts already computed in lib/peer/aggregate-usage.ts;
// this is a visualization layer only — no new numbers, no new claim.

const WIDTH = 720;
const ROW_H = 34;
const BAR_H = 20;
const LABEL_W = 190;
const TOTAL_W_LABEL = 34;
const PAD_TOP = 8;
const PAD_BOTTOM = 8;

// A curated, muted categorical palette — distinguishable, professional (not
// neon), readable in both light and dark mode. Assigned deterministically per
// vendor id so the SAME vendor is always the SAME color across every chart on
// the page (top-vendor summary + every per-industry breakdown).
const PALETTE = [
  "#2563eb", // blue
  "#16a34a", // green
  "#d97706", // amber
  "#dc2626", // red
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#db2777", // pink
  "#65a30d", // olive
  "#78716c", // stone
  "#0f766e", // teal
];

export interface VendorColorMap {
  [vendorId: string]: string;
}

/** Deterministic vendor → color assignment, stable across renders/pages as
 *  long as the same vendor ordering is passed in (sorted by total usage desc,
 *  so the biggest players get the first, most distinguishable colors). */
export function assignVendorColors(vendorIdsInOrder: string[]): VendorColorMap {
  const map: VendorColorMap = {};
  const seen = new Set<string>();
  let i = 0;
  for (const id of vendorIdsInOrder) {
    if (seen.has(id)) continue;
    seen.add(id);
    map[id] = PALETTE[i % PALETTE.length];
    i++;
  }
  return map;
}

export interface SimpleBarDatum {
  vendorId: string;
  label: string;
  value: number;
}

/** Single-series horizontal bar chart — one colored bar per vendor. Used for
 *  "most-adopted across disclosed peers" (the whole-base summary). */
export function SimpleBarChart({
  data,
  colors,
  vendorHref,
}: {
  data: SimpleBarDatum[];
  colors: VendorColorMap;
  vendorHref: (vendorId: string) => string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const innerW = WIDTH - LABEL_W - TOTAL_W_LABEL - 12;
  const height = PAD_TOP + PAD_BOTTOM + data.length * ROW_H;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" role="img" aria-label="Most-adopted vendors across disclosed peers">
      {data.map((d, i) => {
        const y = PAD_TOP + i * ROW_H;
        const barW = (d.value / max) * innerW;
        const color = colors[d.vendorId] ?? PALETTE[i % PALETTE.length];
        return (
          <g key={d.vendorId}>
            <text x={LABEL_W - 8} y={y + BAR_H / 2 + 4} textAnchor="end" fontSize={12} className="fill-[#13294b] dark:fill-[#eef3f8]">
              {d.label}
            </text>
            <rect x={LABEL_W} y={y} width={innerW} height={BAR_H} rx={3} className="fill-black/5 dark:fill-white/5" />
            <a href={vendorHref(d.vendorId)}>
              <rect x={LABEL_W} y={y} width={Math.max(barW, 2)} height={BAR_H} rx={3} fill={color} />
            </a>
            <text x={LABEL_W + Math.max(barW, 2) + 6} y={y + BAR_H / 2 + 4} fontSize={11} fontWeight={600} className="fill-[#13294b] dark:fill-[#eef3f8] tabular-nums">
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface StackedBarRow {
  key: string;
  label: string;
  segments: { vendorId: string; vendorName: string; count: number }[];
}

/** Stacked horizontal bar chart — one bar per industry, segmented and colored
 *  by vendor. Visualizes "industry usage by vendor" directly: bar length =
 *  total disclosed adoptions in that industry; segment width = that vendor's
 *  share. Rows with zero disclosed usage render an empty/dashed track, never
 *  a fabricated segment. */
export function StackedUsageBarChart({
  rows,
  colors,
  vendorHref,
}: {
  rows: StackedBarRow[];
  colors: VendorColorMap;
  vendorHref: (vendorId: string) => string;
}) {
  if (rows.length === 0) return null;
  const totals = rows.map((r) => r.segments.reduce((s, seg) => s + seg.count, 0));
  const max = Math.max(...totals, 1);
  const innerW = WIDTH - LABEL_W - TOTAL_W_LABEL - 12;
  const height = PAD_TOP + PAD_BOTTOM + rows.length * ROW_H;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" role="img" aria-label="Disclosed AI-vendor usage by industry">
      {rows.map((row, i) => {
        const y = PAD_TOP + i * ROW_H;
        const total = totals[i];
        let x = LABEL_W;
        return (
          <g key={row.key}>
            <text x={LABEL_W - 8} y={y + BAR_H / 2 + 4} textAnchor="end" fontSize={12} className="fill-[#13294b] dark:fill-[#eef3f8]">
              {row.label}
            </text>
            <rect x={LABEL_W} y={y} width={innerW} height={BAR_H} rx={3} className="fill-black/5 dark:fill-white/5" />
            {total === 0 ? (
              <text x={LABEL_W + 8} y={y + BAR_H / 2 + 4} fontSize={10} className="fill-[#15263c]/40 dark:fill-[#eef3f8]/40 italic">
                no disclosed adopters cited yet
              </text>
            ) : (
              row.segments.map((seg) => {
                const segW = (seg.count / max) * innerW;
                const rectX = x;
                x += segW;
                return (
                  <a key={seg.vendorId} href={vendorHref(seg.vendorId)}>
                    <rect x={rectX} y={y} width={Math.max(segW, 1.5)} height={BAR_H} fill={colors[seg.vendorId] ?? "#78716c"}>
                      <title>{`${seg.vendorName}: ${seg.count} disclosed adopter${seg.count === 1 ? "" : "s"} in ${row.label}`}</title>
                    </rect>
                  </a>
                );
              })
            )}
            {total > 0 && (
              <text x={LABEL_W + innerW + 6} y={y + BAR_H / 2 + 4} fontSize={11} fontWeight={600} className="fill-[#13294b] dark:fill-[#eef3f8] tabular-nums">
                {total}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Shared color-keyed legend — vendor name + swatch, for either chart above. */
export function VendorColorLegend({
  vendors,
  colors,
}: {
  vendors: { vendorId: string; name: string }[];
  colors: VendorColorMap;
}) {
  if (vendors.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#15263c]/65 dark:text-[#eef3f8]/60">
      {vendors.map((v) => (
        <span key={v.vendorId} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[v.vendorId] ?? "#78716c" }} />
          {v.name}
        </span>
      ))}
    </div>
  );
}
