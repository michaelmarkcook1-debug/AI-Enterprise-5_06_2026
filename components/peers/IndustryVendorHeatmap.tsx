// Industry × vendor adoption heatmap — the cross-tab the stacked bars couldn't
// give. Rows = verticals, columns = the most-adopted AI vendors across the base;
// each cell = how many tracked peers in that industry have PUBLICLY DISCLOSED
// adopting that vendor. Reads both ways: a row is an industry's vendor mix, a
// column is a vendor's reach across industries. Single-hue gold intensity ramp
// (never red↔green); a blank cell is an honest "none disclosed", never "not
// used". Pure render — no client state — so it drops into the server or a client
// parent alike. Every cell traces to the named companies in its title/tooltip.

import Link from "next/link";
import type { IndustryUsageRow } from "@/lib/peer/aggregate-usage";

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

// # of disclosed adopters → a four-step gold ramp. Bucketed (not continuous) so
// the legend is legible and dark-mode variants can be paired class-for-class.
function cellClass(n: number): string {
  if (n <= 0) return "";
  if (n === 1) return "bg-[#b08d2f]/15 dark:bg-[#e8c95c]/15";
  if (n <= 3) return "bg-[#b08d2f]/30 dark:bg-[#e8c95c]/25";
  if (n <= 6) return "bg-[#b08d2f]/55 dark:bg-[#e8c95c]/45";
  return "bg-[#b08d2f]/80 dark:bg-[#e8c95c]/70";
}

export interface HeatColumn {
  vendorId: string;
  name: string;
}

export default function IndustryVendorHeatmap({
  rows,
  columns,
  vendorHref,
}: {
  rows: IndustryUsageRow[];
  columns: HeatColumn[];
  vendorHref: (id: string) => string;
}) {
  const shown = rows.filter((r) => r.vendorUsage.length > 0);
  if (shown.length === 0 || columns.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-black/5 p-3 dark:border-white/10">
      <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${MUTED}`}>
        Disclosed AI-vendor adoption · industry × vendor
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white/85 px-2 py-1 dark:bg-[#0a1f38]/85" aria-label="Industry" />
              {columns.map((c) => (
                <th key={c.vendorId} className="px-1 py-1 align-bottom">
                  <Link
                    href={vendorHref(c.vendorId)}
                    className="block w-[54px] truncate text-center font-medium text-[#13294b] hover:underline dark:text-[#eef3f8]"
                    title={c.name}
                  >
                    {c.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.verticalId}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-white/85 px-2 py-1 text-left font-medium text-[#13294b] dark:bg-[#0a1f38]/85 dark:text-[#eef3f8]"
                >
                  {r.label}
                </th>
                {columns.map((c) => {
                  const cell = r.vendorUsage.find((v) => v.vendorId === c.vendorId);
                  const n = cell?.adopters ?? 0;
                  return (
                    <td
                      key={c.vendorId}
                      className={`h-7 w-[54px] border border-white/50 text-center tabular-nums dark:border-white/5 ${cellClass(n)}`}
                      title={
                        cell
                          ? `${c.name} · ${r.label}: ${n} disclosed — ${cell.companies.join(", ")}`
                          : `${c.name} · ${r.label}: none disclosed`
                      }
                    >
                      {n > 0 ? (
                        <span className="text-[#13294b] dark:text-[#f6f0e7]">{n}</span>
                      ) : (
                        <span className="text-[#15263c]/25 dark:text-[#eef3f8]/20">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${MUTED}`}>
        <span>Cell = # of tracked peers that publicly disclosed adopting that vendor</span>
        <span className="flex items-center gap-1">
          fewer
          <span className="inline-block h-3 w-4 bg-[#b08d2f]/15 dark:bg-[#e8c95c]/15" />
          <span className="inline-block h-3 w-4 bg-[#b08d2f]/30 dark:bg-[#e8c95c]/25" />
          <span className="inline-block h-3 w-4 bg-[#b08d2f]/55 dark:bg-[#e8c95c]/45" />
          <span className="inline-block h-3 w-4 bg-[#b08d2f]/80 dark:bg-[#e8c95c]/70" />
          more
        </span>
        <span>· blank = none disclosed (never “not used”)</span>
      </div>
    </div>
  );
}
