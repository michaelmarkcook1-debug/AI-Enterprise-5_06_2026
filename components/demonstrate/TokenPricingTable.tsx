"use client";

// Token pricing comparison table for the Demonstrate tab.
// ──────────────────────────────────────────────────────────
// Searchable, sortable, vendor-filterable table of clean input-token
// list pricing across the tracked frontier + enterprise models. Client
// component so the user can search / sort / filter without a round-trip.
// Data is the curated reference set in lib/model-inventory/token-pricing.ts
// (sourced from ai_enterprise_clean_input_pricing.xlsx).

import { useMemo, useState } from "react";
import {
  TOKEN_PRICING,
  TOKEN_PRICING_CAPTURED_AT,
  TOKEN_PRICING_DISCLAIMER,
  PRICING_VENDORS,
  type TokenPrice,
} from "@/lib/model-inventory/token-pricing";

type SortKey = "vendor" | "model" | "input" | "output" | "cached";
type SortDir = "asc" | "desc";

function fmtUsd(n: number | null): string {
  if (n === null) return "—";
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export default function TokenPricingTable({
  rows = TOKEN_PRICING,
  scopedLabel,
}: {
  rows?: TokenPrice[];
  /** When the table is scoped to a shortlist, a short label to show. */
  scopedLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [vendor, setVendor] = useState<string | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("input");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Vendor chips — only those present in the (possibly scoped) row set.
  const vendors = useMemo(() => {
    const present = new Set(rows.map((r) => r.vendorName));
    return PRICING_VENDORS.filter((v) => present.has(v));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (vendor !== "all" && r.vendorName !== vendor) return false;
      if (q.length === 0) return true;
      return (
        r.vendorName.toLowerCase().includes(q)
        || r.modelName.toLowerCase().includes(q)
        || r.note.toLowerCase().includes(q)
        || r.note.toLowerCase().includes(q)
      );
    });
  }, [rows, vendor, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "vendor": cmp = a.vendorName.localeCompare(b.vendorName) || a.modelName.localeCompare(b.modelName); break;
        case "model": cmp = a.modelName.localeCompare(b.modelName); break;
        case "input": cmp = (a.inputPerM ?? Infinity) - (b.inputPerM ?? Infinity); break;
        case "output": cmp = (a.outputPerM ?? Infinity) - (b.outputPerM ?? Infinity); break;
        case "cached": cmp = (a.cachedInputPerM ?? Infinity) - (b.cachedInputPerM ?? Infinity); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  // The cheapest input price among verified (non-null) visible rows.
  const cheapestInput = useMemo(() => {
    const verified = sorted.map((s) => s.inputPerM).filter((v): v is number => v !== null);
    return verified.length > 0 ? Math.min(...verified) : null;
  }, [sorted]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${rows.length} models — vendor, model, basis, notes…`}
          className="min-w-[220px] flex-1 rounded-md border border-[#e3d9c0] bg-white px-3 py-1.5 text-sm placeholder:text-[#6b7d93] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8]"
          aria-label="Search token pricing"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="rounded-md px-2 py-1 text-xs text-[#4c5d75] hover:text-[#15263c] dark:hover:text-[#eef3f8]"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        <FilterChip active={vendor === "all"} onClick={() => setVendor("all")}>
          All vendors
        </FilterChip>
        {vendors.map((v) => (
          <FilterChip key={v} active={vendor === v} onClick={() => setVendor(v)}>
            {v}
          </FilterChip>
        ))}
      </div>

      {scopedLabel && (
        <div className="mb-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Scoped to: {scopedLabel}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[#e3d9c0] dark:border-[#1d3a57]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f6f1e3] text-left text-xs uppercase tracking-wide text-[#4c5d75] dark:bg-[#0c2238]/60">
            <tr>
              <Th onClick={() => toggleSort("vendor")} active={sortKey === "vendor"} dir={sortDir}>Vendor</Th>
              <Th onClick={() => toggleSort("model")} active={sortKey === "model"} dir={sortDir}>Model / SKU</Th>
              <th className="px-3 py-2 font-semibold">Notes</th>
              <Th onClick={() => toggleSort("input")} active={sortKey === "input"} dir={sortDir} numeric>Input /1M</Th>
              <Th onClick={() => toggleSort("output")} active={sortKey === "output"} dir={sortDir} numeric>Output /1M</Th>
              <Th onClick={() => toggleSort("cached")} active={sortKey === "cached"} dir={sortDir} numeric>Cached in /1M</Th>
              <th className="px-3 py-2 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ece4d0] dark:divide-[#1d3a57]">
            {sorted.map((row) => {
              const isCheapest = row.inputPerM === cheapestInput;
              return (
                <tr key={row.id} className="align-top hover:bg-[#f6f1e3] dark:hover:bg-[#143049]/40">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{row.vendorName}</td>
                  <td className="px-3 py-2">
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                      title="Open official pricing page"
                    >
                      {row.modelName}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-xs text-[#4c5d75]">{row.note}</td>
                  <td className="px-3 py-2 text-right">
                    {row.inputPerM !== null ? (
                      <>
                        <span className={`font-mono tabular-nums font-semibold ${isCheapest ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                          {fmtUsd(row.inputPerM)}
                        </span>
                        {isCheapest && (
                          <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            cheapest
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[#c2d1e0] dark:text-[#7d93aa] italic text-xs">unverified</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[#4c5d75]">
                    {row.outputPerM !== null ? fmtUsd(row.outputPerM) : <span className="text-[#c2d1e0] dark:text-[#7d93aa]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[#4c5d75]">
                    {row.cachedInputPerM != null ? fmtUsd(row.cachedInputPerM) : <span className="text-[#c2d1e0] dark:text-[#7d93aa]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#4c5d75] max-w-[280px]">{row.note}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-[#4c5d75]">
                  No models match {query ? `“${query}”` : "this filter"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs leading-5 text-[#4c5d75]">
        {TOKEN_PRICING_DISCLAIMER}
      </p>
      <p className="mt-1 text-xs text-[#6b7d93]">
        Captured {TOKEN_PRICING_CAPTURED_AT}. USD per 1M input tokens.
        Click a model name to open the official pricing page.
      </p>
    </div>
  );
}

function Th({
  children, onClick, active, dir, numeric,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
  numeric?: boolean;
}) {
  return (
    <th className={`px-3 py-2 font-semibold ${numeric ? "text-right" : ""}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-[#15263c] dark:hover:text-[#eef3f8] ${active ? "text-[#15263c] dark:text-[#eef3f8]" : ""}`}
      >
        {children}
        <span aria-hidden className="text-[8px]">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function FilterChip({
  children, active, onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-[#0c2238] text-white dark:bg-white dark:text-[#13294b]"
          : "bg-[#ece3cb] text-[#2e3f57] hover:bg-[#e3d9c0] dark:bg-[#143049] dark:text-[#c2d1e0] dark:hover:bg-[#1c3d5c]"
      }`}
    >
      {children}
    </button>
  );
}
