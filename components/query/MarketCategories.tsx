// Market Categories — 12-category AI market map.
// ────────────────────────────────────────────────
// Shows every major AI market category in stack-layer order,
// with the correct vendors highlighted in each.
// No cross-category comparison. No ranking.

import type { Vendor, VendorMomentum } from "@/lib/intelligence/types";

/* ─── Category definitions ──────────────────────── */

interface CategoryDef {
  id: string;
  label: string;
  /** One sentence a CEO can read without clicking. */
  description: string;
  /** Vendor names in display order (category-specific relevance, not global score). */
  vendorNames: string[];
  color: string;
  icon: string;
}

/**
 * Canonical category ordering — stack-layer order from models down to governance.
 * This order is intentional and must not be sorted by score.
 */
const CATEGORIES: CategoryDef[] = [
  {
    id: "frontier_models",
    label: "Frontier Models / Model Providers",
    description: "Companies that build the core AI. Every other category depends on the models these companies create.",
    vendorNames: ["OpenAI", "Anthropic", "Google", "Meta", "Mistral AI", "xAI", "Cohere", "DeepSeek", "Alibaba", "Moonshot AI", "AI21 Labs", "Aleph Alpha", "Z.ai", "MiniMax"],
    color: "border-violet-400 dark:border-violet-700",
    icon: "1",
  },
  {
    id: "cloud_ai_platforms",
    label: "Cloud AI Platforms / Model Marketplaces",
    description: "Where enterprises access, deploy, and manage AI models. These platforms control how AI reaches your business.",
    vendorNames: ["Microsoft Azure", "AWS", "Google Cloud", "Oracle", "IBM watsonx", "Databricks", "Snowflake"],
    color: "border-sky-400 dark:border-sky-700",
    icon: "2",
  },
  {
    id: "data_ai_platforms",
    label: "Data & AI Platforms",
    description: "Where your business data lives and where AI models connect to it. The quality of your AI depends on the quality of this layer.",
    vendorNames: ["Databricks", "Snowflake", "Google Cloud", "Microsoft", "IBM watsonx", "Oracle", "Palantir"],
    color: "border-cyan-400 dark:border-cyan-700",
    icon: "3",
  },
  {
    id: "agent_platforms",
    label: "Agent Platforms / Orchestration",
    description: "Platforms for building AI agents that can take actions, use tools, and complete multi-step tasks inside your business.",
    vendorNames: ["Microsoft Copilot Studio", "Salesforce", "ServiceNow", "AWS", "Google Agent Platform", "OpenAI", "Anthropic", "IBM watsonx"],
    color: "border-indigo-400 dark:border-indigo-700",
    icon: "4",
  },
  {
    id: "enterprise_assistants",
    label: "Enterprise Assistants / Productivity AI",
    description: "AI assistants embedded in the tools your employees use every day — email, documents, messaging, and search.",
    vendorNames: ["Microsoft", "Google", "OpenAI", "Anthropic", "Glean", "Writer", "Apple Intelligence"],
    color: "border-blue-400 dark:border-blue-700",
    icon: "5",
  },
  {
    id: "developer_coding",
    label: "Developer / Coding Agents",
    description: "AI tools that write, review, and debug software. The fastest-growing category in enterprise AI by revenue.",
    vendorNames: ["Microsoft", "OpenAI", "Anthropic", "Google"],
    color: "border-teal-400 dark:border-teal-700",
    icon: "6",
  },
  {
    id: "enterprise_search_rag",
    label: "Enterprise Search / RAG / Knowledge AI",
    description: "AI that searches across all your company's systems and answers questions using your own data.",
    vendorNames: ["Glean", "Google", "Google Cloud", "Microsoft", "Snowflake", "Databricks", "Cohere", "Hebbia"],
    color: "border-emerald-400 dark:border-emerald-700",
    icon: "7",
  },
  {
    id: "workflow_automation",
    label: "Workflow Automation / ITSM / Service AI",
    description: "AI that handles tickets, routes requests, processes approvals, and automates repetitive business operations.",
    vendorNames: ["ServiceNow", "Moveworks", "Microsoft Copilot Studio", "Salesforce", "SAP", "IBM"],
    color: "border-amber-400 dark:border-amber-700",
    icon: "8",
  },
  {
    id: "crm_customer_ai",
    label: "CRM / Customer AI",
    description: "AI embedded in sales, marketing, and customer service — the tools that face your customers directly.",
    vendorNames: ["Salesforce", "Microsoft", "Oracle", "ServiceNow"],
    color: "border-orange-400 dark:border-orange-700",
    icon: "9",
  },
  {
    id: "industry_regulated",
    label: "Industry & Regulated Vertical AI",
    description: "AI products built for specific industries where compliance, accuracy, and domain expertise are non-negotiable.",
    vendorNames: ["Harvey", "Rogo", "Hebbia", "Writer", "IBM", "IBM watsonx", "Cohere", "Palantir", "Oracle"],
    color: "border-rose-400 dark:border-rose-700",
    icon: "10",
  },
  {
    id: "ai_infrastructure",
    label: "AI Infrastructure / Compute",
    description: "The chips, servers, and data centres that AI runs on. Supply constraints here affect every vendor above.",
    vendorNames: ["NVIDIA", "AMD", "Microsoft Azure", "AWS", "Google Cloud", "Oracle", "CoreWeave", "Lambda", "Broadcom", "Cerebras", "SambaNova", "Arista Networks"],
    color: "border-slate-400 dark:border-slate-700",
    icon: "11",
  },
  {
    id: "ai_governance",
    label: "AI Governance / Security / Trust",
    description: "Tools and frameworks that ensure AI is used safely, ethically, and in compliance with regulations.",
    vendorNames: ["IBM watsonx", "Microsoft", "ServiceNow", "Google", "AWS"],
    color: "border-pink-400 dark:border-pink-700",
    icon: "12",
  },
];

/* ─── Props ────────────────────────────────────── */

interface Props {
  vendors: Vendor[];
  momentum: VendorMomentum[];
  provenance: { source: "seed" | "live"; reason: string };
}

/* ─── Component ────────────────────────────────── */

export default function MarketCategories({ vendors, momentum, provenance }: Props) {
  const vendorByName = new Map(vendors.map((v) => [v.name, v]));
  const momentumById = new Map(momentum.map((m) => [m.vendorId, m]));

  return (
    <section className="mb-8">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-[#18201b] dark:text-zinc-100">
          AI Market Categories
        </h2>
        <p className="mt-1 text-sm text-[#5f685a] dark:text-zinc-400">
          12 categories that make up the AI market, from model providers at the top to
          governance at the bottom. Each card shows the companies that matter in that category.
        </p>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          // Resolve vendor names against tracked universe — skip untracked
          const resolved = cat.vendorNames
            .map((name) => vendorByName.get(name))
            .filter((v): v is Vendor => v != null);

          return (
            <div
              key={cat.id}
              className={`rounded-xl border-l-4 ${cat.color} border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eef2e8] text-[10px] font-bold text-[#4d574b] dark:bg-zinc-800 dark:text-zinc-300">
                    {cat.icon}
                  </span>
                  <h3 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">
                    {cat.label}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full bg-[#eef2e8] px-2 py-0.5 text-[10px] font-semibold text-[#455044] dark:bg-zinc-800 dark:text-zinc-300">
                    {resolved.length} tracked
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    provenance.source === "live"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}>
                    {provenance.source === "live" ? "Live" : "Seed"}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs leading-5 text-[#5f685a] dark:text-zinc-400 mb-3">
                {cat.description}
              </p>

              {/* Vendor chips — in category-specific order, not score order */}
              {resolved.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {resolved.map((v) => {
                    const mom = momentumById.get(v.id);
                    const momScore = mom?.momentumScore ?? 50;
                    const direction = momScore > 60 ? "up" : momScore < 40 ? "down" : "stable";
                    const confLevel = v.confidenceScore >= 75 ? "high" : v.confidenceScore >= 55 ? "medium" : "low";

                    return (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe4da] bg-[#f7f8f5] px-2.5 py-1 text-[11px] font-medium text-[#18201b] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        title={`${v.name} · Confidence: ${v.confidenceScore}% · Trend: ${direction}`}
                      >
                        {v.name}
                        {/* Trend arrow */}
                        <span className={`text-[9px] font-bold ${
                          direction === "up" ? "text-emerald-600 dark:text-emerald-400"
                          : direction === "down" ? "text-rose-600 dark:text-rose-400"
                          : "text-zinc-400"
                        }`}>
                          {direction === "up" ? "↑" : direction === "down" ? "↓" : "→"}
                        </span>
                        {/* Confidence dot */}
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          confLevel === "high" ? "bg-emerald-500"
                          : confLevel === "medium" ? "bg-amber-500"
                          : "bg-zinc-400"
                        }`} />
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] italic text-[#9da596] dark:text-zinc-500">
                  No tracked vendors in this category yet.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-[#9da596] dark:text-zinc-500">
        <span className="flex items-center gap-1"><span className="text-emerald-600">{"↑"}</span> Improving</span>
        <span className="flex items-center gap-1"><span className="text-zinc-400">{"→"}</span> Steady</span>
        <span className="flex items-center gap-1"><span className="text-rose-600">{"↓"}</span> Declining</span>
        <span className="mx-1">|</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> High confidence</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Medium</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> Low</span>
      </div>
    </section>
  );
}
