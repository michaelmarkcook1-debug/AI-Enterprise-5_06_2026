"use client";

// Interactive Ecosystem Map — Query tab.
// ─────────────────────────────────────────
// Visually explains the AI market without overwhelming the user.
// Each taxonomy layer is expandable, shows vendors, market context,
// and plain-English tooltips answering "What does this do?" and
// "Why should I care?".
//
// Design principles:
//   - Plain English, no jargon
//   - Progressive disclosure (collapsed → expanded → tooltip)
//   - No cross-category vendor comparisons
//   - Confidence levels visible on every data point

import { useState } from "react";

export interface EcosystemVendor {
  id: string;
  name: string;
  description: string;
  marketPosition: string;
  overallScore: number;
  confidenceScore: number;
  ownershipType: string;
  momentumScore: number;
  momentumDirection: "up" | "down" | "stable";
}

export interface EcosystemLayer {
  id: string;
  label: string;
  purpose: string;
  /** One sentence visible without clicking — why this layer matters to the business. */
  whyItMattersOneLine: string;
  whatItDoes: string;
  whyCare: string;
  vendors: EcosystemVendor[];
  untrackedVendors: string[];
  recentMovement: string;
  marketContext: string;
  color: {
    border: string;
    bg: string;
    bgHover: string;
    text: string;
    dot: string;
    chipBg: string;
    chipText: string;
  };
}

interface Props {
  layers: EcosystemLayer[];
}

export default function EcosystemMap({ layers }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ layerId: string; vendorId: string } | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      {layers.map((layer, i) => {
        const isExpanded = expanded === layer.id;
        const vendorCount = layer.vendors.length + layer.untrackedVendors.length;

        return (
          <div key={layer.id}>
            {/* Layer card */}
            <div
              className={`relative rounded-2xl border-2 transition-all duration-200 ${layer.color.border} ${isExpanded ? layer.color.bg : "bg-white dark:bg-zinc-900"} ${isExpanded ? "" : `hover:${layer.color.bgHover} cursor-pointer`}`}
              onClick={() => !isExpanded && setExpanded(layer.id)}
              role={isExpanded ? undefined : "button"}
              tabIndex={isExpanded ? undefined : 0}
              onKeyDown={(e) => !isExpanded && e.key === "Enter" && setExpanded(layer.id)}
            >
              {/* Layer badge */}
              <div className={`absolute -top-3 left-6 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${layer.color.dot}`}>
                Layer {i + 1}
              </div>

              {/* Header — always visible */}
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className={`text-lg font-semibold md:text-xl ${layer.color.text}`}>
                      {layer.label}
                    </h2>
                    <p className="mt-1 text-sm text-[#56657b] dark:text-zinc-400">
                      {layer.purpose}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-[#13294b] dark:bg-zinc-800/60 dark:text-zinc-200">
                      {vendorCount} vendors
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded ? null : layer.id); }}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${layer.color.border} hover:bg-white/80 dark:hover:bg-zinc-800`}
                      aria-label={isExpanded ? `Collapse ${layer.label}` : `Expand ${layer.label}`}
                      aria-expanded={isExpanded}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Collapsed content — visible without clicking */}
                {!isExpanded && (
                  <>
                    {/* Why it matters — always visible */}
                    <p className="mt-2 text-xs leading-5 text-[#475a72] dark:text-zinc-300 italic">
                      Why it matters: {layer.whyItMattersOneLine}
                    </p>
                    {/* Vendor preview */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {layer.vendors.slice(0, 5).map((v) => (
                        <span key={v.id} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${layer.color.chipBg} ${layer.color.chipText}`}>
                          {v.name}
                        </span>
                      ))}
                      {vendorCount > 5 && (
                        <span className="rounded-full px-2.5 py-0.5 text-[11px] text-[#5b6b7f] dark:text-zinc-500">
                          +{vendorCount - 5} more
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Expanded content — progressive disclosure */}
              {isExpanded && (
                <div className="border-t border-white/40 px-6 py-5 dark:border-zinc-700/40">
                  {/* Tooltips answering the two key questions */}
                  <div className="mb-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-white/70 p-3 dark:bg-zinc-800/50">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-zinc-500">What it does</div>
                      <p className="mt-1 text-sm leading-5 text-[#13294b] dark:text-zinc-100">{layer.whatItDoes}</p>
                    </div>
                    <div className="rounded-lg bg-white/70 p-3 dark:bg-zinc-800/50">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-zinc-500">Why it matters</div>
                      <p className="mt-1 text-sm leading-5 text-[#13294b] dark:text-zinc-100">{layer.whyCare}</p>
                    </div>
                  </div>

                  {/* Market context */}
                  <div className="mb-5 rounded-lg bg-white/50 p-3 dark:bg-zinc-800/30">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-zinc-500">Who leads today</span>
                      <span className="text-[10px] italic text-[#5b6b7f] dark:text-zinc-500">estimated</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#475a72] dark:text-zinc-300">{layer.marketContext}</p>
                    {layer.recentMovement && (
                      <p className="mt-2 text-xs leading-5 text-[#56657b] dark:text-zinc-400">
                        <strong>What changed recently:</strong> {layer.recentMovement}
                      </p>
                    )}
                  </div>

                  {/* Vendor cards */}
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-zinc-500 mb-3">
                    Companies in this category
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {layer.vendors.map((v) => (
                      <div
                        key={v.id}
                        className="relative rounded-lg border border-white/60 bg-white/80 px-3 py-2.5 transition-colors hover:bg-white dark:border-zinc-700/60 dark:bg-zinc-800/60 dark:hover:bg-zinc-800"
                        onMouseEnter={() => setTooltip({ layerId: layer.id, vendorId: v.id })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#13294b] dark:text-zinc-100">{v.name}</span>
                          <div className="flex items-center gap-1.5">
                            {/* Momentum arrow */}
                            <span className={`text-[10px] font-bold ${
                              v.momentumDirection === "up" ? "text-emerald-600 dark:text-emerald-400" :
                              v.momentumDirection === "down" ? "text-rose-600 dark:text-rose-400" :
                              "text-zinc-400"
                            }`}>
                              {v.momentumDirection === "up" ? "↑" : v.momentumDirection === "down" ? "↓" : "→"}
                            </span>
                            {/* Confidence dot */}
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              v.confidenceScore >= 70 ? "bg-emerald-500" :
                              v.confidenceScore >= 45 ? "bg-amber-500" :
                              "bg-zinc-400"
                            }`} title={`Confidence: ${v.confidenceScore}`} />
                          </div>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#5b6b7f] dark:text-zinc-400">{v.marketPosition}</p>

                        {/* Tooltip on hover */}
                        {tooltip?.layerId === layer.id && tooltip?.vendorId === v.id && (
                          <div className="absolute left-0 right-0 -bottom-1 translate-y-full z-10 rounded-lg border border-[#e6dcc3] bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                            <p className="text-xs leading-4 text-[#475a72] dark:text-zinc-300">{v.description}</p>
                            <div className="mt-2 flex items-center gap-3 text-[10px] text-[#5b6b7f] dark:text-zinc-500">
                              <span>Data confidence: {v.confidenceScore}%</span>
                              <span>Trend direction: {v.momentumScore > 60 ? "Improving" : v.momentumScore < 40 ? "Declining" : "Steady"}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Untracked vendors */}
                  {layer.untrackedVendors.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] text-[#5b6b7f] dark:text-zinc-500 mb-1.5">Also in this category (not yet tracked):</div>
                      <div className="flex flex-wrap gap-1.5">
                        {layer.untrackedVendors.map((name) => (
                          <span key={name} className="rounded-full border border-[#d6c9a8]/60 px-2.5 py-0.5 text-[11px] text-[#5b6b7f] dark:border-zinc-700/60 dark:text-zinc-400">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dependency connector */}
            {i < layers.length - 1 && (
              <div className="flex flex-col items-center py-1.5" aria-hidden>
                <div className="h-4 w-px bg-[#d6c9a8] dark:bg-zinc-700" />
                <svg width="12" height="8" viewBox="0 0 12 8" className="text-[#d6c9a8] dark:text-zinc-700">
                  <path d="M6 8L0 0h12z" fill="currentColor" />
                </svg>
                <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-[#b0b8a8] dark:text-zinc-600">depends on</span>
                <div className="h-4 w-px bg-[#d6c9a8] dark:bg-zinc-700" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
