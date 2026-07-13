"use client";

// Capability Matrix — REAL DATA version.
// ────────────────────────────────────────
// Replaces the former hardcoded sample (Salesforce/Oracle/SAP/Workday…)
// that never reflected the tracked vendor universe. The server page now
// passes every rankable vendor, every tracked capability, and the
// truthfulness-gated render state for each cell. Filters cover the FULL
// vendor list and capability categories — nothing is sampled.

import { useMemo, useState } from "react";

export interface MatrixVendor {
  id: string;
  name: string;
  category: string;
}

export interface MatrixCapability {
  id: string;
  name: string;
  category: string;
}

export interface MatrixCell {
  mode:
    | "verified"
    | "documented"
    | "seed"
    | "stale"
    | "disputed"
    | "validation_required"
    | "unknown"
    | "infrastructure_only";
  showScore: boolean;
  score: number;
  confidence: number;
}

const MODE_LABEL: Record<MatrixCell["mode"], string> = {
  verified: "Verified",
  documented: "Documented",
  seed: "Seed",
  stale: "Stale",
  disputed: "Disputed",
  validation_required: "Validate",
  unknown: "—",
  infrastructure_only: "Infra-only",
};

const MODE_TONE: Record<MatrixCell["mode"], string> = {
  verified: "text-emerald-700 dark:text-emerald-300",
  documented: "text-[#13294b] dark:text-[#d8e2ec]",
  seed: "text-amber-700 dark:text-amber-300",
  stale: "text-amber-700 dark:text-amber-300",
  disputed: "text-rose-700 dark:text-rose-300",
  validation_required: "text-rose-700 dark:text-rose-300",
  unknown: "text-[#8a93a3] dark:text-[#4c5d75]",
  infrastructure_only: "text-[#8a93a3] dark:text-[#6b7d92]",
};

function scoreTone(v: number) {
  if (v >= 80) return "text-emerald-700 dark:text-emerald-300";
  if (v >= 60) return "text-amber-700 dark:text-amber-300";
  return "text-rose-700 dark:text-rose-300";
}

export default function CapabilityMatrix({
  vendors,
  capabilities,
  cells,
}: {
  vendors: MatrixVendor[];
  capabilities: MatrixCapability[];
  /** key `${vendorId}_${capabilityId}` */
  cells: Record<string, MatrixCell>;
}) {
  const [vendorFilter, setVendorFilter] = useState("");
  const [capCategory, setCapCategory] = useState("");

  const capCategories = useMemo(
    () => Array.from(new Set(capabilities.map((c) => c.category))).sort(),
    [capabilities],
  );

  const visibleVendors = useMemo(
    () => (vendorFilter ? vendors.filter((v) => v.id === vendorFilter) : vendors),
    [vendors, vendorFilter],
  );
  const visibleCaps = useMemo(
    () => (capCategory ? capabilities.filter((c) => c.category === capCategory) : capabilities),
    [capabilities, capCategory],
  );

  return (
    <div>
      {/* Filters — full universe, not a sample */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-[#475a72] dark:text-[#a7bacd]">
          Vendor
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="rounded-md border border-[#ddd3b6] bg-[#fdfaf1] px-2.5 py-1.5 text-xs font-normal text-[#13294b] focus:outline-none focus:ring-1 focus:ring-[#b08d2f] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8]"
          >
            <option value="">All {vendors.length} vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#475a72] dark:text-[#a7bacd]">
          Capability area
          <select
            value={capCategory}
            onChange={(e) => setCapCategory(e.target.value)}
            className="rounded-md border border-[#ddd3b6] bg-[#fdfaf1] px-2.5 py-1.5 text-xs font-normal text-[#13294b] focus:outline-none focus:ring-1 focus:ring-[#b08d2f] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8]"
          >
            <option value="">All areas</option>
            {capCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        {(vendorFilter || capCategory) && (
          <button
            type="button"
            onClick={() => { setVendorFilter(""); setCapCategory(""); }}
            className="rounded-md border border-dashed border-[#ddd3b6] px-2.5 py-1.5 text-xs text-[#5b6b7f] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:text-[#8fa5bb] dark:hover:bg-[#143049]"
          >
            ✕ Clear
          </button>
        )}
        <span className="ml-auto text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">
          {visibleVendors.length} vendor{visibleVendors.length !== 1 ? "s" : ""} × {visibleCaps.length} capabilit{visibleCaps.length !== 1 ? "ies" : "y"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#ece4d0] text-xs uppercase tracking-wide text-[#5b6b7f] dark:border-[#1d3a57] dark:text-[#8fa5bb]">
              <th className="sticky left-0 z-10 bg-[#fffdf7] py-2 pr-3 dark:bg-[#0c2238]">Vendor</th>
              {visibleCaps.map((cap) => (
                <th key={cap.id} className="px-2 py-2 text-center font-semibold" title={cap.category}>
                  {cap.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#efe9d9] dark:divide-[#1d3a57]">
            {visibleVendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-[#faf5e9] dark:hover:bg-[#0e2740]/60">
                <td className="sticky left-0 z-10 bg-[#fffdf7] py-2 pr-3 dark:bg-[#0c2238]">
                  <div className="text-xs font-semibold text-[#13294b] dark:text-[#eef3f8]">{vendor.name}</div>
                  <div className="text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">{vendor.category}</div>
                </td>
                {visibleCaps.map((cap) => {
                  const cell = cells[`${vendor.id}_${cap.id}`];
                  if (!cell) {
                    return <td key={cap.id} className="px-2 py-2 text-center text-xs text-[#8a93a3] dark:text-[#4c5d75]">—</td>;
                  }
                  return (
                    <td key={cap.id} className="px-2 py-2 text-center">
                      {cell.showScore ? (
                        <div>
                          <span className={`font-mono text-sm font-bold tabular-nums ${scoreTone(cell.score)}`}>{cell.score}</span>
                          <div className={`text-[9px] uppercase tracking-wide ${MODE_TONE[cell.mode]}`}>{MODE_LABEL[cell.mode]}</div>
                        </div>
                      ) : (
                        <span className={`text-xs font-semibold uppercase tracking-wide ${MODE_TONE[cell.mode]}`}>
                          {MODE_LABEL[cell.mode]}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#efe9d9] pt-3 text-xs text-[#5b6b7f] dark:border-[#1d3a57] dark:text-[#8fa5bb]">
        <span><strong className="text-emerald-700 dark:text-emerald-300">Verified</strong> E3+ evidence with sources</span>
        <span><strong className="text-[#13294b] dark:text-[#d8e2ec]">Documented</strong> public docs, unverified</span>
        <span><strong className="text-amber-700 dark:text-amber-300">Seed / Stale</strong> directional only</span>
        <span><strong className="text-rose-700 dark:text-rose-300">Disputed / Validate</strong> human review needed</span>
        <span><strong>Infra-only</strong> capability comparison not applicable</span>
      </div>
    </div>
  );
}
