"use client";

// Vendor uptake explorer — interactive cut of AI-vendor adoption by
// Industry × Region × Company Size. Aggregates 585 segment-share rows
// (sourced from May 2026 vendor market-share research) plus a per-vendor
// large-enterprise vs SME propensity layer. The user picks any combination
// of filters; the chart re-renders with vendor share normalised inside
// the chosen slice.
//
// Pure client-side filtering — the seed data is statically imported so
// the SSR bundle ships it once and every filter change is instant.

import { useMemo, useState } from "react";
import { SeedDataBadge } from "@/components/intelligence-ui";
import {
  REGIONS,
  INDUSTRIES,
  COMPANY_SIZES,
  UPTAKE_VENDORS,
  SEGMENT_SHARES,
  aggregateUptake,
  type CompanySize,
  type Industry,
  type Region,
  type UptakeAggregateRow,
} from "@/lib/intelligence/vendor-uptake-seed";

// Vendor colour palette — kept consistent across charts so a vendor reads
// as the same hue whatever filter is applied.
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

const CONF_DOT: Record<string, string> = {
  "Low":         "bg-rose-400",
  "Low-Medium":  "bg-amber-400",
  "Medium":      "bg-emerald-400",
  "High":        "bg-emerald-600",
};

export default function VendorUptakeExplorer() {
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<Industry[]>([]);
  const [selectedSize, setSelectedSize] = useState<CompanySize | null>(null);
  const [tab, setTab] = useState<"bars" | "heatmap">("bars");

  const aggregate: UptakeAggregateRow[] = useMemo(
    () => aggregateUptake({ regions: selectedRegions, industries: selectedIndustries, companySize: selectedSize }),
    [selectedRegions, selectedIndustries, selectedSize],
  );

  const headlineTop3 = aggregate.slice(0, 3);
  const totalCells = aggregate.reduce((acc, r) => acc + r.contributingCells, 0);
  const filterSummary = describeFilter(selectedRegions, selectedIndustries, selectedSize);

  function toggleRegion(r: Region) {
    setSelectedRegions((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }
  function toggleIndustry(i: Industry) {
    setSelectedIndustries((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  }
  function clearAll() {
    setSelectedRegions([]);
    setSelectedIndustries([]);
    setSelectedSize(null);
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="rounded-xl border border-[#e6dcc3] bg-white p-4 dark:border-[#223a2e] dark:bg-[#0d1f17]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">Filters</h3>
            <p className="text-xs text-[#56657b] dark:text-[#a7bacd]">
              {filterSummary} · {aggregate.length > 0 ? `${totalCells} contributing data cell${totalCells === 1 ? "" : "s"}` : "no data — narrow the filters"}
            </p>
          </div>
          {(selectedRegions.length > 0 || selectedIndustries.length > 0 || selectedSize) && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md border border-[#e6dcc3] bg-white px-3 py-1 text-xs font-semibold text-[#123d2c] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8] dark:hover:bg-[#143049]"
            >
              Clear all
            </button>
          )}
        </div>
        <FilterGroup title="Region (multi-select)">
          {REGIONS.map((r) => (
            <Chip key={r} active={selectedRegions.includes(r)} onClick={() => toggleRegion(r)}>{r}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Industry (multi-select)">
          {INDUSTRIES.map((i) => (
            <Chip key={i} active={selectedIndustries.includes(i)} onClick={() => toggleIndustry(i)}>{i}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Company size (single-select)">
          {COMPANY_SIZES.map((s) => (
            <Chip key={s} active={selectedSize === s} onClick={() => setSelectedSize(selectedSize === s ? null : s)}>{s}</Chip>
          ))}
        </FilterGroup>
      </div>

      {/* Top-3 callout */}
      {headlineTop3.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {headlineTop3.map((row, i) => (
            <div key={row.vendor} className="rounded-xl border border-[#e6dcc3] bg-white p-4 dark:border-[#223a2e] dark:bg-[#0d1f17]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-[#8fa5bb]">#{i + 1}</span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium text-[#56657b] dark:text-[#a7bacd]`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${CONF_DOT[row.confidence] ?? "bg-[#6b7d93]"}`} />
                  {row.confidence}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: colorFor(row.vendor) }} />
                <span className="text-base font-semibold text-[#123d2c] dark:text-[#eef3f8]">{row.vendor}</span>
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold text-[#123d2c] dark:text-[#eef3f8]">{pct(row.share)}</div>
              <div className="mt-0.5 text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">share inside this slice</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-[#e6dcc3] dark:border-[#223a2e]">
        <TabButton active={tab === "bars"} onClick={() => setTab("bars")}>Vendor share (bar)</TabButton>
        <TabButton active={tab === "heatmap"} onClick={() => setTab("heatmap")}>Region × Industry heatmap</TabButton>
      </div>

      {tab === "bars" && (
        <VendorBarChart rows={aggregate} />
      )}
      {tab === "heatmap" && (
        <RegionIndustryHeatmap focusVendor={headlineTop3[0]?.vendor ?? UPTAKE_VENDORS[0]} />
      )}

      {/* Data note */}
      <div className="flex flex-wrap items-center gap-2">
        <SeedDataBadge
          label="Modelled estimate"
          provenance="seed"
          reason="These shares are modelled estimates built in a May 2026 spreadsheet model from the cited research, not measured market data. Treat as directional; per-cell confidence dots show evidence strength."
        />
      </div>
      <p className="text-xs leading-5 text-[#5b6b7f] dark:text-[#8fa5bb]">
        Modelled estimates, aggregated from 585 segment-share rows (5 regions × 9 industries × 13 vendors)
        and per-vendor large-enterprise / SME propensity, normalised within each slice. May 2026
        research basis: Menlo Ventures State of Enterprise GenAI, Ramp AI Index, Enlyft / Similarweb /
        Apptopia measured signals. Confidence dot reflects average evidence strength of the
        contributing cells. Shares are share-of-named-vendor-usage, not audited global market share.
      </p>
    </div>
  );
}

function describeFilter(regions: Region[], industries: Industry[], size: CompanySize | null): string {
  const parts: string[] = [];
  parts.push(regions.length === 0 ? "All regions" : regions.length === 1 ? regions[0] : `${regions.length} regions`);
  parts.push(industries.length === 0 ? "all industries" : industries.length === 1 ? industries[0] : `${industries.length} industries`);
  parts.push(size ?? "all company sizes");
  return parts.join(" · ");
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-[#8fa5bb]">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
          : "border-[#e6dcc3] bg-white text-[#123d2c] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#d8e2ec] dark:hover:bg-[#143049]"
      }`}
    >
      {children}
    </button>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-px px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
          : "text-[#4c5d75] hover:text-[#123d2c] dark:hover:text-[#eef3f8]"
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Bar chart ───────────────────────────────────────────────────── */
function VendorBarChart({ rows }: { rows: UptakeAggregateRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e6dcc3] bg-[#fafbf8] p-8 text-center text-sm text-[#56657b] dark:border-[#2a4a6b] dark:bg-[#0d1f17]/50 dark:text-[#a7bacd]">
        No data for this filter combination.
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.share));
  return (
    <div className="rounded-xl border border-[#e6dcc3] bg-white p-4 dark:border-[#223a2e] dark:bg-[#0d1f17]">
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.vendor} className="grid grid-cols-[140px_1fr_70px_80px] items-center gap-3">
            <div className="flex items-center gap-2 truncate text-sm font-medium text-[#123d2c] dark:text-[#eef3f8]">
              <span className="h-3 w-3 flex-none rounded-sm" style={{ background: colorFor(r.vendor) }} />
              <span className="truncate">{r.vendor}</span>
            </div>
            <div className="relative h-5 rounded-full bg-[#f3ead2] dark:bg-[#143049]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${max > 0 ? (r.share / max) * 100 : 0}%`, background: colorFor(r.vendor) }}
              />
            </div>
            <div className="text-right font-mono text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">{pct(r.share)}</div>
            <div className="flex items-center justify-end gap-1 text-xs text-[#56657b] dark:text-[#a7bacd]">
              <span className={`h-1.5 w-1.5 rounded-full ${CONF_DOT[r.confidence] ?? "bg-[#6b7d93]"}`} />
              {r.confidence}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Heatmap ─────────────────────────────────────────────────────── */
function RegionIndustryHeatmap({ focusVendor }: { focusVendor: string }) {
  const [vendor, setVendor] = useState(focusVendor);

  const matrix = useMemo(() => {
    const grid: Record<string, Record<string, number>> = {};
    for (const row of SEGMENT_SHARES) {
      if (row.vendor !== vendor) continue;
      grid[row.region] = grid[row.region] ?? {};
      grid[row.region][row.industry] = row.share;
    }
    return grid;
  }, [vendor]);

  const allValues = Object.values(matrix).flatMap((row) => Object.values(row));
  const max = allValues.length > 0 ? Math.max(...allValues) : 0;

  function cellColor(value: number): string {
    if (!Number.isFinite(value) || value === 0 || max === 0) return "transparent";
    const intensity = Math.min(1, value / max);
    // Emerald scale, low → very pale, high → strong
    const alpha = 0.08 + intensity * 0.82;
    return `rgba(15, 157, 106, ${alpha})`;
  }

  return (
    <div className="rounded-xl border border-[#e6dcc3] bg-white p-4 dark:border-[#223a2e] dark:bg-[#0d1f17]">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-[#8fa5bb]">Vendor focus</span>
        <select
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          className="rounded-md border border-[#e6dcc3] bg-white px-3 py-1.5 text-sm font-medium text-[#123d2c] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8]"
        >
          {UPTAKE_VENDORS.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-[#8fa5bb]"></th>
              {INDUSTRIES.map((i) => (
                <th key={i} className="px-2 py-2 text-left text-xs font-medium text-[#56657b] dark:text-[#a7bacd]">{shortIndustry(i)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REGIONS.map((r) => (
              <tr key={r} className="border-t border-[#efe9d9]/60">
                <td className="whitespace-nowrap px-2 py-2 text-xs font-semibold text-[#123d2c] dark:text-[#eef3f8]">{r}</td>
                {INDUSTRIES.map((i) => {
                  const v = matrix[r]?.[i] ?? 0;
                  return (
                    <td key={i} className="px-1 py-1 text-center align-middle">
                      <div
                        className="flex h-12 items-center justify-center rounded-md border border-[#e6dcc3] dark:border-[#223a2e]"
                        style={{ background: cellColor(v) }}
                        title={`${vendor} · ${r} · ${i} → ${pct(v)}`}
                      >
                        <span className="font-mono text-xs font-medium text-[#123d2c] dark:text-[#eef3f8]">{v > 0 ? pct(v) : "—"}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">
        Each cell = {vendor}&apos;s share of named-vendor usage in that (region, industry). Colour intensity
        scales relative to {vendor}&apos;s own peak cell.
      </p>
    </div>
  );
}

function shortIndustry(i: Industry): string {
  const map: Record<string, string> = {
    "Technology / software": "Tech / SW",
    "Financial services": "Fin Svc",
    "Legal": "Legal",
    "Professional services / consulting": "Prof Svc",
    "Healthcare / life sciences": "Health / LS",
    "Manufacturing / industrials": "Mfg / Ind",
    "Retail / consumer / ecommerce": "Retail",
    "Public sector / government": "Public sector",
    "Education / research / media": "Edu / R&D",
  };
  return map[i] ?? i;
}
