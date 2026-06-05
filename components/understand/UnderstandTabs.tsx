"use client";

// Understand sub-nav — switches between in-page views of the vendor universe.
//
// Currently only the Capability Matrix view is implemented. The grid /
// breakdown / market-share views are placeholders pending component
// implementation; they render a graceful "coming soon" panel rather than
// crashing the page.

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import VendorFilters from "./VendorFilters";
import CapabilityMatrix from "./CapabilityMatrix";

interface UnderstandTabsProps {
  initialView?: string;
  selectedVendor?: string;
  selectedPillar?: string;
}

export default function UnderstandTabs({
  initialView = "matrix",
  selectedVendor,
  selectedPillar,
}: UnderstandTabsProps) {
  const [activeView, setActiveView] = useState(initialView);
  const [filterVendor, setFilterVendor] = useState(selectedVendor || "");
  const [filterPillar, setFilterPillar] = useState(selectedPillar || "");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateView = (view: string) => {
    setActiveView(view);
    const params = new URLSearchParams(searchParams);
    params.set("view", view);
    router.push(`${pathname}?${params.toString()}`);
  };

  const updateFilters = (vendor?: string, pillar?: string) => {
    if (vendor !== undefined) setFilterVendor(vendor);
    if (pillar !== undefined) setFilterPillar(pillar);

    const params = new URLSearchParams(searchParams);
    if (vendor) params.set("vendor", vendor);
    if (pillar) params.set("pillar", pillar);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Only "matrix" is wired. Unimplemented tabs removed from the nav
  // so the interface feels complete rather than broken.
  const tabs = [
    { id: "matrix", label: "Capability Matrix", icon: "⊞", ready: true },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-1 -mx-4 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => updateView(tab.id)}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeView === tab.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
            {!tab.ready && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <VendorFilters
        selectedVendor={filterVendor}
        selectedPillar={filterPillar}
        onFilterChange={updateFilters}
      />

      {/* Content Views */}
      <div>
        {activeView === "matrix" && (
          <CapabilityMatrix vendorFilter={filterVendor} pillarFilter={filterPillar} />
        )}
        {activeView !== "matrix" && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
              {tabs.find((t) => t.id === activeView)?.label ?? "View"} — coming soon
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              The data layer for this view is wired (see <code className="font-mono">/lib/intelligence/repository</code>),
              but the component still needs to be built. Use the Capability Matrix tab in the meantime.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
