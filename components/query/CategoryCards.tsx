"use client";

// Category Cards — locked 4-category AI taxonomy.
// ─────────────────────────────────────────────────
// Models → Platforms → Applications → Infrastructure
// This order is fixed. No additional top-level cards.
// Everything else is a subcategory tag or expansion item.

import { useState } from "react";
import type { Vendor, VendorMomentum } from "@/lib/intelligence/types";

/* ─── Types ──────────────────────────────────────── */

type TopLevelCategory = "Models" | "Platforms" | "Applications" | "Infrastructure";
type CategoryTier = 1 | 2;

interface VendorPlacement {
  /** Matches vendor name in tracked universe (case-insensitive). */
  name: string;
  /** Display name shown on the card — may differ from DB name. */
  displayName: string;
  tier: CategoryTier;
  /** Role context shown on hover or in expansion. */
  roleNote?: string;
}

interface CategoryDef {
  id: TopLevelCategory;
  purpose: string;
  whyItMatters: string;
  subcategoryTags: string[];
  vendors: VendorPlacement[];
  color: {
    border: string;
    bg: string;
    dot: string;
    chipBg: string;
    chipText: string;
  };
}

/* ─── Canonical category ordering ────────────────── */

export const TOP_LEVEL_AI_CATEGORIES = [
  "Models",
  "Platforms",
  "Applications",
  "Infrastructure",
] as const;

// roleTags → category membership, used to auto-include any tracked vendor that
// isn't in the curated placements below so the full live universe always
// surfaces (investors carry only "Investor" and match none of these four
// product categories, so they correctly stay off this view).
const CATEGORY_ROLES: Record<TopLevelCategory, string[]> = {
  Models: ["Model Provider"],
  Platforms: ["Platform Vendor", "Data & Services Provider"],
  Applications: ["Application Vendor", "Vertical Specialist"],
  Infrastructure: ["Infrastructure Player", "Hardware Provider", "Cloud / Hosting Provider"],
};

/* ─── Category definitions with vendor placements ── */

const CATEGORIES: CategoryDef[] = [
  {
    id: "Models",
    purpose: "Core AI intelligence layer — the companies that build the AI brains everything else runs on.",
    whyItMatters: "Which model your vendors use determines what AI can do, what it costs, and how your data is handled.",
    subcategoryTags: ["Frontier Models", "Model APIs", "Open-Weight Models", "Reasoning Models", "Multimodal Models"],
    color: { border: "border-violet-400 dark:border-violet-700", bg: "bg-violet-50/50 dark:bg-violet-950/20", dot: "bg-violet-500", chipBg: "bg-violet-100 dark:bg-violet-900/50", chipText: "text-violet-800 dark:text-violet-200" },
    vendors: [
      // Tier 1 — always visible
      { name: "OpenAI", displayName: "OpenAI", tier: 1 },
      { name: "Anthropic", displayName: "Anthropic", tier: 1 },
      { name: "Google", displayName: "Google / Gemini", tier: 1, roleNote: "Gemini model family via Google DeepMind" },
      { name: "Meta", displayName: "Meta / Llama", tier: 1, roleNote: "Open-weight Llama models" },
      { name: "Mistral AI", displayName: "Mistral AI", tier: 1 },
      { name: "xAI", displayName: "xAI", tier: 1, roleNote: "Grok model family" },
      { name: "Cohere", displayName: "Cohere", tier: 1 },
      { name: "DeepSeek", displayName: "DeepSeek", tier: 1 },
      // Tier 2 — expansion area
      { name: "AI21 Labs", displayName: "AI21 Labs", tier: 2 },
      { name: "Aleph Alpha", displayName: "Aleph Alpha", tier: 2, roleNote: "European sovereign models" },
      { name: "Alibaba", displayName: "Alibaba / Qwen", tier: 2, roleNote: "Qwen model family" },
      { name: "Moonshot AI", displayName: "Moonshot AI / Kimi", tier: 2 },
      { name: "Z.ai", displayName: "Zhipu / Z.ai", tier: 2 },
      { name: "MiniMax", displayName: "MiniMax", tier: 2 },
      { name: "Amazon Nova", displayName: "Amazon Nova", tier: 2, roleNote: "Amazon's own foundation models" },
      { name: "IBM", displayName: "IBM Granite", tier: 2, roleNote: "IBM's open-licence model family" },
    ],
  },
  {
    id: "Platforms",
    purpose: "Where enterprises build, deploy, govern, and manage AI — the operating layer between models and business.",
    whyItMatters: "These platforms control how AI reaches your organisation. Your choice here determines cost, security, and vendor lock-in.",
    subcategoryTags: ["Cloud AI Platforms", "Model Marketplaces", "Agent Platforms", "Data & AI Platforms", "Governance Platforms", "Workflow Orchestration"],
    color: { border: "border-sky-400 dark:border-sky-700", bg: "bg-sky-50/50 dark:bg-sky-950/20", dot: "bg-sky-500", chipBg: "bg-sky-100 dark:bg-sky-900/50", chipText: "text-sky-800 dark:text-sky-200" },
    vendors: [
      // Tier 1
      { name: "Microsoft", displayName: "Microsoft / Azure AI Foundry", tier: 1, roleNote: "Azure AI Foundry + Copilot Studio" },
      { name: "AWS", displayName: "AWS / Bedrock", tier: 1, roleNote: "Bedrock model marketplace + SageMaker" },
      { name: "Google", displayName: "Google Cloud / Vertex AI", tier: 1, roleNote: "Vertex AI + Gemini Enterprise Agent Platform" },
      { name: "IBM", displayName: "IBM watsonx", tier: 1, roleNote: "Governed AI platform + Granite models" },
      { name: "Databricks", displayName: "Databricks", tier: 1, roleNote: "Data Intelligence Platform + Mosaic AI" },
      { name: "Snowflake", displayName: "Snowflake", tier: 1, roleNote: "Cortex AI + Cortex Agents" },
      { name: "Salesforce", displayName: "Salesforce Agentforce", tier: 1, roleNote: "Agent platform + Data Cloud" },
      { name: "ServiceNow", displayName: "ServiceNow", tier: 1, roleNote: "AI Agents + workflow orchestration" },
      { name: "Oracle", displayName: "Oracle", tier: 1, roleNote: "OCI Generative AI + Fusion AI Agents" },
      // Tier 2
      { name: "Palantir", displayName: "Palantir", tier: 2, roleNote: "AI operating system for enterprise data" },
      { name: "SAP", displayName: "SAP", tier: 2, roleNote: "Joule + Business AI across ERP" },
      { name: "UiPath", displayName: "UiPath", tier: 2, roleNote: "RPA + AI agent automation" },
      { name: "Automation Anywhere", displayName: "Automation Anywhere", tier: 2 },
      { name: "C3.ai", displayName: "C3 AI", tier: 2, roleNote: "Enterprise AI for industrial/government" },
    ],
  },
  {
    id: "Applications",
    purpose: "AI tools used directly by employees, business functions, and customers — where people experience AI every day.",
    whyItMatters: "Fastest path to business results, but most exposed to disruption if model providers add the same features.",
    subcategoryTags: ["Enterprise Assistants", "Developer / Coding Agents", "Enterprise Search / RAG", "Workflow Automation", "Customer AI", "Legal AI", "Financial Services AI", "HR / ITSM / Service AI"],
    color: { border: "border-emerald-400 dark:border-emerald-700", bg: "bg-emerald-50/50 dark:bg-emerald-950/20", dot: "bg-emerald-500", chipBg: "bg-emerald-100 dark:bg-emerald-900/50", chipText: "text-emerald-800 dark:text-emerald-200" },
    vendors: [
      // Tier 1
      { name: "Microsoft", displayName: "Microsoft 365 Copilot", tier: 1, roleNote: "Enterprise productivity assistant" },
      { name: "OpenAI", displayName: "ChatGPT Enterprise", tier: 1, roleNote: "Enterprise AI assistant" },
      { name: "Anthropic", displayName: "Claude Enterprise", tier: 1, roleNote: "Enterprise AI assistant" },
      { name: "Google", displayName: "Google Gemini for Workspace", tier: 1, roleNote: "Workspace-embedded AI" },
      { name: "Glean", displayName: "Glean", tier: 1, roleNote: "Enterprise search + knowledge assistant" },
      { name: "Writer", displayName: "Writer", tier: 1, roleNote: "Enterprise content AI" },
      { name: "Harvey", displayName: "Harvey", tier: 1, roleNote: "Legal AI" },
      { name: "Rogo", displayName: "Rogo", tier: 1, roleNote: "Financial services AI" },
      { name: "Hebbia", displayName: "Hebbia", tier: 1, roleNote: "Document intelligence for finance" },
      { name: "Moveworks", displayName: "Moveworks", tier: 1, roleNote: "IT/HR service AI (ServiceNow)" },
      { name: "ServiceNow", displayName: "ServiceNow AI", tier: 1, roleNote: "Now Assist + AI Agents" },
      { name: "Salesforce", displayName: "Salesforce AI / Agentforce", tier: 1, roleNote: "CRM-embedded AI agents" },
      { name: "Microsoft", displayName: "GitHub Copilot", tier: 1, roleNote: "AI-assisted software development" },
      // Tier 2
      { name: "Jasper", displayName: "Jasper", tier: 2, roleNote: "Marketing content AI" },
    ],
  },
  {
    id: "Infrastructure",
    purpose: "Chips, cloud, data centres, and networking that AI runs on — the physical foundation of everything above.",
    whyItMatters: "Supply constraints here affect every AI vendor. If chip supply tightens or cloud prices rise, every layer above is affected.",
    subcategoryTags: ["GPUs / Silicon", "Cloud Compute", "Inference Infrastructure", "Training Infrastructure", "AI Data Centres", "Sovereign Cloud", "Networking"],
    color: { border: "border-slate-400 dark:border-slate-700", bg: "bg-slate-50/50 dark:bg-slate-950/20", dot: "bg-slate-500", chipBg: "bg-slate-100 dark:bg-slate-900/50", chipText: "text-slate-700 dark:text-slate-200" },
    vendors: [
      // Tier 1
      { name: "NVIDIA", displayName: "NVIDIA", tier: 1, roleNote: "Dominant AI chip supplier" },
      { name: "AMD", displayName: "AMD", tier: 1, roleNote: "Primary GPU alternative to NVIDIA" },
      { name: "CoreWeave", displayName: "CoreWeave", tier: 1, roleNote: "GPU cloud for AI workloads" },
      { name: "Oracle", displayName: "Oracle Cloud Infrastructure", tier: 1, roleNote: "Large-scale GPU cloud" },
      { name: "AWS", displayName: "AWS", tier: 1, roleNote: "Cloud compute + Trainium chips" },
      { name: "Microsoft Azure", displayName: "Microsoft Azure", tier: 1, roleNote: "Cloud compute + exclusive OpenAI host" },
      { name: "Google Cloud", displayName: "Google Cloud", tier: 1, roleNote: "Cloud compute + TPU chips" },
      // Tier 2
      { name: "Intel", displayName: "Intel", tier: 2 },
      { name: "Broadcom", displayName: "Broadcom", tier: 2, roleNote: "Custom AI chips for hyperscalers" },
      { name: "Cerebras", displayName: "Cerebras", tier: 2, roleNote: "Wafer-scale AI processors" },
      { name: "SambaNova", displayName: "SambaNova", tier: 2, roleNote: "Purpose-built AI inference chips" },
      { name: "Lambda", displayName: "Lambda", tier: 2, roleNote: "GPU cloud for AI labs" },
      { name: "Arista Networks", displayName: "Arista Networks", tier: 2, roleNote: "AI data centre networking" },
    ],
  },
];

/* ─── Props ──────────────────────────────────────── */

interface Props {
  vendors: Vendor[];
  momentum: VendorMomentum[];
  provenance: { source: "seed" | "live"; reason: string };
}

/* ─── Component ──────────────────────────────────── */

export default function CategoryCards({ vendors, momentum, provenance }: Props) {
  const [expanded, setExpanded] = useState<Set<TopLevelCategory>>(new Set());
  const vendorByName = new Map(vendors.map((v) => [v.name.toLowerCase(), v]));
  const momentumById = new Map(momentum.map((m) => [m.vendorId, m]));

  const toggle = (id: TopLevelCategory) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Data-status label
  const dataLabel = provenance.source === "live" ? "Live source" : "Estimated scoring";

  return (
    <div className="space-y-4">
      {CATEGORIES.map((cat) => {
        const isExpanded = expanded.has(cat.id);

        // Resolve vendors against tracked universe — hide missing
        const resolvedTier1: Array<{ placement: VendorPlacement; vendor: Vendor }> = [];
        const resolvedTier2: Array<{ placement: VendorPlacement; vendor: Vendor }> = [];
        const seen = new Set<string>(); // dedupe by DB id

        for (const p of cat.vendors) {
          const v = vendorByName.get(p.name.toLowerCase());
          if (!v || seen.has(v.id)) continue;
          seen.add(v.id);
          if (p.tier === 1) resolvedTier1.push({ placement: p, vendor: v });
          else resolvedTier2.push({ placement: p, vendor: v });
        }

        // Auto-include any tracked vendor whose role matches this category but
        // isn't curated above — so the full live universe is never silently
        // excluded. These land in the tier-2 expansion area.
        const wantRoles = CATEGORY_ROLES[cat.id];
        for (const v of vendors) {
          if (seen.has(v.id)) continue;
          if (!(v.roleTags ?? []).some((r) => wantRoles.includes(r))) continue;
          seen.add(v.id);
          resolvedTier2.push({ placement: { name: v.name, displayName: v.name, tier: 2 }, vendor: v });
        }

        // Average confidence across resolved vendors
        const allResolved = [...resolvedTier1, ...resolvedTier2];
        const avgConf = allResolved.length > 0
          ? Math.round(allResolved.reduce((s, r) => s + r.vendor.confidenceScore, 0) / allResolved.length)
          : 0;

        return (
          <div
            key={cat.id}
            className={`rounded-2xl border-2 ${cat.color.border} ${cat.color.bg} transition-all`}
          >
            {/* Card header */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${cat.color.dot}`} />
                  <h3 className="text-lg font-semibold text-[#13294b] dark:text-zinc-100">
                    {cat.id}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    provenance.source === "live"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}>
                    {dataLabel}
                  </span>
                  {avgConf > 0 && (
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-[#475a72] dark:bg-zinc-800/60 dark:text-zinc-300">
                      Confidence {avgConf}
                    </span>
                  )}
                </div>
              </div>

              {/* Purpose */}
              <p className="text-sm text-[#56657b] dark:text-zinc-400 mb-1">
                {cat.purpose}
              </p>
              <p className="text-xs italic text-[#475a72] dark:text-zinc-300 mb-3">
                Why it matters: {cat.whyItMatters}
              </p>

              {/* Subcategory tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {cat.subcategoryTags.map((tag) => (
                  <span
                    key={tag}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${cat.color.chipBg} ${cat.color.chipText}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Tier 1 — always visible */}
              {resolvedTier1.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-zinc-500 mb-2">
                    Major vendors
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {resolvedTier1.map(({ placement, vendor }) => {
                      const mom = momentumById.get(vendor.id);
                      const momScore = mom?.momentumScore ?? 50;
                      const direction = momScore > 60 ? "up" : momScore < 40 ? "down" : "stable";

                      return (
                        <span
                          key={`${cat.id}-${vendor.id}-${placement.displayName}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#13294b] shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100"
                          title={placement.roleNote ? `${placement.displayName} — ${placement.roleNote}` : placement.displayName}
                        >
                          {placement.displayName}
                          <span className={`text-[9px] font-bold ${
                            direction === "up" ? "text-emerald-600 dark:text-emerald-400"
                            : direction === "down" ? "text-rose-600 dark:text-rose-400"
                            : "text-zinc-400"
                          }`}>
                            {direction === "up" ? "↑" : direction === "down" ? "↓" : "→"}
                          </span>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            vendor.confidenceScore >= 75 ? "bg-emerald-500"
                            : vendor.confidenceScore >= 55 ? "bg-amber-500"
                            : "bg-zinc-400"
                          }`} />
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tier 2 — expansion */}
              {resolvedTier2.length > 0 && (
                <>
                  <button
                    onClick={() => toggle(cat.id)}
                    className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#5b6b7f] hover:text-[#13294b] dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors"
                    aria-expanded={isExpanded}
                    aria-controls={`${cat.id}-tier2`}
                  >
                    {isExpanded ? "Hide" : "Show"} additional vendors ({resolvedTier2.length})
                    <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div id={`${cat.id}-tier2`} className="mt-2 flex flex-wrap gap-1.5">
                      {resolvedTier2.map(({ placement, vendor }) => (
                        <span
                          key={`${cat.id}-${vendor.id}-${placement.displayName}`}
                          className="inline-flex items-center gap-1 rounded-full border border-[#e6dcc3]/60 bg-white/50 px-2.5 py-0.5 text-[10px] font-medium text-[#5b6b7f] dark:border-zinc-700/60 dark:bg-zinc-800/40 dark:text-zinc-400"
                          title={placement.roleNote ? `${placement.displayName} — ${placement.roleNote}` : placement.displayName}
                        >
                          {placement.displayName}
                          <span className={`h-1 w-1 rounded-full ${
                            vendor.confidenceScore >= 75 ? "bg-emerald-500"
                            : vendor.confidenceScore >= 55 ? "bg-amber-500"
                            : "bg-zinc-400"
                          }`} />
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-[#9da596] dark:text-zinc-500 pt-1">
        <span className="flex items-center gap-1"><span className="text-emerald-600">{"↑"}</span> Improving</span>
        <span className="flex items-center gap-1"><span className="text-zinc-400">{"→"}</span> Steady</span>
        <span className="flex items-center gap-1"><span className="text-rose-600">{"↓"}</span> Declining</span>
        <span className="mx-1">|</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> High confidence</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Medium</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> Low</span>
      </div>
    </div>
  );
}
