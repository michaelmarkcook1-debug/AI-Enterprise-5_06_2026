"use client";

import { useState } from "react";

// Inline X icon — avoids the lucide-react dependency for a single glyph.
function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface VendorFiltersProps {
  selectedVendor?: string;
  selectedPillar?: string;
  onFilterChange: (vendor?: string, pillar?: string) => void;
}

// Sample data — in production, fetch from API
const VENDORS = [
  "Salesforce",
  "Microsoft",
  "Oracle",
  "SAP",
  "Workday",
  "ServiceNow",
  "Adobe",
];
const PILLARS = [
  "Execute",
  "Vision",
  "Product Roadmap",
  "Customer Service",
  "Innovation",
  "Market Breadth",
];

export default function VendorFilters({
  selectedVendor = "",
  selectedPillar = "",
  onFilterChange,
}: VendorFiltersProps) {
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [showPillarDropdown, setShowPillarDropdown] = useState(false);

  const clearFilters = () => {
    onFilterChange("", "");
  };

  const hasActiveFilters = selectedVendor || selectedPillar;

  return (
    <div className="flex flex-wrap gap-3 items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
      {/* Vendor Filter */}
      <div className="relative">
        <button
          onClick={() => setShowVendorDropdown(!showVendorDropdown)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            selectedVendor
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
          }`}
        >
          {selectedVendor ? `Vendor: ${selectedVendor}` : "All Vendors"}
        </button>

        {showVendorDropdown && (
          <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-max">
            <button
              onClick={() => {
                onFilterChange("", selectedPillar);
                setShowVendorDropdown(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 border-b border-slate-100"
            >
              All Vendors
            </button>
            {VENDORS.map((vendor) => (
              <button
                key={vendor}
                onClick={() => {
                  onFilterChange(vendor, selectedPillar);
                  setShowVendorDropdown(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 border-b border-slate-100 last:border-b-0"
              >
                {vendor}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pillar Filter */}
      <div className="relative">
        <button
          onClick={() => setShowPillarDropdown(!showPillarDropdown)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            selectedPillar
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
          }`}
        >
          {selectedPillar ? `Pillar: ${selectedPillar}` : "All Pillars"}
        </button>

        {showPillarDropdown && (
          <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-max">
            <button
              onClick={() => {
                onFilterChange(selectedVendor, "");
                setShowPillarDropdown(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 border-b border-slate-100"
            >
              All Pillars
            </button>
            {PILLARS.map((pillar) => (
              <button
                key={pillar}
                onClick={() => {
                  onFilterChange(selectedVendor, pillar);
                  setShowPillarDropdown(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 border-b border-slate-100 last:border-b-0"
              >
                {pillar}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clear button */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="ml-auto px-3 py-2 text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 rounded-lg hover:bg-white transition-colors"
        >
          <X className="w-4 h-4" />
          Clear filters
        </button>
      )}
    </div>
  );
}
