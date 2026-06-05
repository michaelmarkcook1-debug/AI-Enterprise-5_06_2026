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
          className="min-w-[220px] flex-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="Search token pricing"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
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
        <div className="mb-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          Scoped to: {scopedLabel}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60">
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
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((row) => {
              const isCheapest = row.inputPerM === cheapestInput;
              return (
                <tr key={row.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
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
                  <td className="px-3 py-2 text-xs text-zinc-500">{row.note}</td>
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
                      <span className="text-zinc-300 dark:text-zinc-600 italic text-xs">unverified</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-500">
                    {row.outputPerM !== null ? fmtUsd(row.outputPerM) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-500">
                    {row.cachedInputPerM != null ? fmtUsd(row.cachedInputPerM) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500 max-w-[280px]">{row.note}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-500">
                  No models match {query ? `“${query}”` : "this filter"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] leading-5 text-zinc-500">
        {TOKEN_PRICING_DISCLAIMER}
      </p>
      <p className="mt-1 text-[10px] text-zinc-400">
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
        className={`inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 ${active ? "text-zinc-900 dark:text-zinc-100" : ""}`}
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
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}
