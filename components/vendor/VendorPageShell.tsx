"use client";

import { useRef, useState, type ReactNode } from "react";
import VerdictCard, { type VerdictStanding } from "@/components/vendor/VerdictCard";

export type VendorTabKey = "assessment" | "evidence" | "market" | "dependencies" | "peers" | "financials";

const TAB_LABEL: Record<VendorTabKey, string> = {
  assessment: "Assessment",
  evidence: "Evidence",
  market: "Market & reputation",
  dependencies: "Dependencies",
  peers: "Peers",
  financials: "Financials",
};

// Owns which tab is active. Heavy data-fetching stays server-side in
// page.tsx — each tab's content arrives here as ALREADY-RENDERED JSX (a
// Server Component passed as a prop retains its server-rendered nature; this
// shell only ever touches show/hide state, never re-fetches anything).
export default function VendorPageShell({
  vendorName,
  vendorSlug,
  standing,
  composite,
  confidence,
  coverage,
  momentum,
  whySentence,
  verdictExtras,
  tabs,
  availableTabs,
}: {
  vendorName: string;
  vendorSlug: string;
  standing: VerdictStanding | null;
  composite: number | null;
  confidence: number | null;
  coverage: number | null;
  momentum: number | null;
  whySentence: string | null;
  /** Renders between the verdict card and the tab bar — e.g. PrepKitPanel,
   *  which the IA spec homes as a "verdict action", not tab content. */
  verdictExtras?: ReactNode;
  tabs: Partial<Record<VendorTabKey, ReactNode>>;
  /** Canonical order — only tabs with real content render a button. */
  availableTabs: VendorTabKey[];
}) {
  const [activeTab, setActiveTab] = useState<VendorTabKey>(availableTabs[0] ?? "assessment");
  const tabsRef = useRef<HTMLDivElement>(null);

  function jumpToAssessment() {
    setActiveTab("assessment");
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <VerdictCard
        vendorName={vendorName}
        vendorSlug={vendorSlug}
        standing={standing}
        composite={composite}
        confidence={confidence}
        coverage={coverage}
        momentum={momentum}
        whySentence={whySentence}
        onInterrogateClick={jumpToAssessment}
        onAddToDecisionClick={jumpToAssessment}
      />
      {verdictExtras}

      <div ref={tabsRef} className="mb-3 flex flex-wrap gap-1 border-b border-[#e3d9c0] dark:border-[#1d3a57]">
        {availableTabs.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            aria-current={activeTab === key ? "true" : undefined}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? "border-b-2 border-[#b08d2f] text-[#13294b] dark:border-[#d4af37] dark:text-[#eef3f8]"
                : "text-[#7a8aa0] hover:text-[#4c5d75] dark:text-[#7a9bb8] dark:hover:text-[#eef3f8]"
            }`}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>

      <div>{tabs[activeTab]}</div>
    </>
  );
}
