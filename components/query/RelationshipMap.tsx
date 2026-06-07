"use client";

// Relationship Map — vendor dependency intelligence.
// ────────────────────────────────────────────────────
// Shows how AI ecosystem vendors depend on each other across
// five critical dimensions: ownership, investment, cloud,
// compute, and model dependencies.
//
// Users should instantly understand: who depends on whom,
// and what breaks if a relationship changes.

import { useState } from "react";

/* ─── Relationship types ─────────────────────────────── */

type RelationType =
  | "ownership"
  | "investment"
  | "cloud"
  | "compute"
  | "model";

interface Relationship {
  from: string;
  to: string;
  type: RelationType;
  /** Plain-English description of the dependency. */
  description: string;
  /** What happens if this relationship changes? */
  risk: string;
  /** Strength: critical = single-source, strong = primary, moderate = one-of-several */
  strength: "critical" | "strong" | "moderate";
}

const RELATION_META: Record<RelationType, { label: string; icon: string; color: string; dotColor: string; description: string }> = {
  ownership: {
    label: "Ownership",
    icon: "🏛️",
    color: "border-rose-300 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/20",
    dotColor: "bg-rose-500",
    description: "One company owns or controls a significant stake in the other.",
  },
  investment: {
    label: "Investment",
    icon: "💰",
    color: "border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/20",
    dotColor: "bg-emerald-500",
    description: "Major financial investment that shapes strategy for both parties.",
  },
  cloud: {
    label: "Runs on their servers",
    icon: "☁️",
    color: "border-sky-300 dark:border-sky-700 bg-sky-50/60 dark:bg-sky-950/20",
    dotColor: "bg-sky-500",
    description: "Relies on another company's servers and data centres to operate.",
  },
  compute: {
    label: "Needs their chips",
    icon: "⚡",
    color: "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20",
    dotColor: "bg-amber-500",
    description: "Depends on specialised hardware from another company to run.",
  },
  model: {
    label: "Built on their AI",
    icon: "🧠",
    color: "border-violet-300 dark:border-violet-700 bg-violet-50/60 dark:bg-violet-950/20",
    dotColor: "bg-violet-500",
    description: "Uses another company's AI as the core engine behind their product.",
  },
};

/* ─── Curated relationship data ──────────────────────── */
// Seed data — labelled as estimated. Will be replaced by live
// intelligence when relationship detection is automated.

const RELATIONSHIPS: Relationship[] = [
  // ── Ownership ──
  {
    from: "Microsoft",
    to: "OpenAI",
    type: "ownership",
    description: "Microsoft has invested roughly $13 billion and holds a major stake in OpenAI, with exclusive rights to sell OpenAI's products commercially.",
    risk: "OpenAI's business direction is tied to Microsoft. If this relationship shifts — through governance changes, regulatory action, or strategic disagreement — it affects every company using OpenAI products.",
    strength: "critical",
  },
  {
    from: "Amazon",
    to: "Anthropic",
    type: "investment",
    description: "Amazon has invested up to $4 billion in Anthropic, making it the largest outside backer. In return, Anthropic prioritises Amazon's cloud platform.",
    risk: "Anthropic's availability on Amazon's platform is partly a condition of this deal. If Amazon demands exclusivity, it could limit where Anthropic's AI is available.",
    strength: "strong",
  },
  {
    from: "Google",
    to: "Anthropic",
    type: "investment",
    description: "Google has invested roughly $2 billion in Anthropic, providing both funding and access to Google's specialised AI chips.",
    risk: "Anthropic is backed by both Google and Amazon — direct competitors. If either demands exclusivity, Anthropic's multi-platform availability could narrow.",
    strength: "strong",
  },
  {
    from: "Microsoft",
    to: "Mistral AI",
    type: "investment",
    description: "Microsoft made a smaller investment in Mistral AI and made Mistral's products available on Microsoft's cloud platform.",
    risk: "Smaller investment. Mistral stays independent but gains access to Microsoft's customer base.",
    strength: "moderate",
  },
  {
    from: "Salesforce",
    to: "Anthropic",
    type: "investment",
    description: "Salesforce has invested in Anthropic to power AI features across Salesforce's business products.",
    risk: "Salesforce's AI features depend partly on continued access to Anthropic's technology. A change in terms could affect Salesforce's AI roadmap.",
    strength: "moderate",
  },

  // ── Cloud dependency — whose servers they run on ──
  {
    from: "OpenAI",
    to: "Microsoft Azure",
    type: "cloud",
    description: "OpenAI runs exclusively on Microsoft's cloud platform under a long-term exclusive agreement.",
    risk: "Single-supplier risk. If Microsoft's cloud has capacity problems, price increases, or relationship friction, OpenAI has no alternative — and neither do its customers.",
    strength: "critical",
  },
  {
    from: "Anthropic",
    to: "AWS",
    type: "cloud",
    description: "Anthropic runs primarily on Amazon's cloud, where its AI is available to Amazon's business customers.",
    risk: "Amazon is the primary but not only cloud provider. Anthropic also runs on Google's cloud, giving it a backup if either relationship changes.",
    strength: "strong",
  },
  {
    from: "Anthropic",
    to: "Google Cloud",
    type: "cloud",
    description: "Anthropic also runs on Google's cloud, using Google's specialised AI chips for building its AI.",
    risk: "Having two cloud providers reduces risk, but creates complexity — and both providers are also investors, which could lead to competing demands.",
    strength: "strong",
  },
  {
    from: "Cohere",
    to: "Oracle Cloud",
    type: "cloud",
    description: "Cohere has a partnership with Oracle and is available on Oracle's cloud platform, alongside Amazon's and Google's.",
    risk: "Spread across three cloud providers. Less concentrated risk than companies relying on a single cloud.",
    strength: "moderate",
  },

  // ── Compute — whose chips they need ──
  {
    from: "OpenAI",
    to: "NVIDIA",
    type: "compute",
    description: "OpenAI's AI is built and run on NVIDIA's specialised chips, accessed through Microsoft's cloud.",
    risk: "If NVIDIA's chips are in short supply or prices rise, OpenAI's ability to build and deliver its products is directly limited. There is currently no alternative at this scale.",
    strength: "critical",
  },
  {
    from: "Anthropic",
    to: "Google TPU",
    type: "compute",
    description: "Anthropic uses Google's own specialised AI chips for a significant share of its work, reducing reliance on NVIDIA.",
    risk: "Access to these chips is tied to the Google investment relationship. It provides a valuable alternative to NVIDIA, but comes with investor strings attached.",
    strength: "strong",
  },
  {
    from: "Anthropic",
    to: "NVIDIA",
    type: "compute",
    description: "Anthropic also uses NVIDIA chips through Amazon's cloud for building and running its AI.",
    risk: "Using both Google's chips and NVIDIA's chips means Anthropic is less vulnerable to supply problems with either one.",
    strength: "strong",
  },
  {
    from: "xAI",
    to: "NVIDIA",
    type: "compute",
    description: "xAI has built one of the world's largest collections of NVIDIA's AI chips to power its Grok AI.",
    risk: "Enormous hardware investment. The value of this bet depends entirely on NVIDIA continuing to lead in chip performance and availability.",
    strength: "critical",
  },
  {
    from: "Meta",
    to: "NVIDIA",
    type: "compute",
    description: "Meta's AI research and its freely available Llama AI are built on massive collections of NVIDIA chips.",
    risk: "Meta's ability to keep releasing powerful, freely available AI depends on continued access to NVIDIA's best chips. Government export controls could affect this.",
    strength: "critical",
  },
  {
    from: "CoreWeave",
    to: "NVIDIA",
    type: "compute",
    description: "CoreWeave's entire business is renting out NVIDIA's AI chips to other companies. It has no alternative supplier.",
    risk: "Total dependency. CoreWeave's survival depends on NVIDIA's willingness to supply chips and on what prices NVIDIA sets. If NVIDIA changes terms, CoreWeave has no fallback.",
    strength: "critical",
  },

  // ── Model dependency — whose AI brains they use ──
  {
    from: "Harvey",
    to: "OpenAI",
    type: "model",
    description: "Harvey's legal AI product is powered by OpenAI's technology. If you use Harvey, you are indirectly using OpenAI.",
    risk: "If OpenAI raises prices, changes terms, or has an outage, Harvey's product is directly affected. Harvey's customers would feel the impact immediately.",
    strength: "critical",
  },
  {
    from: "Rogo",
    to: "Anthropic",
    type: "model",
    description: "Rogo's financial research product runs on Anthropic's Claude AI. If you use Rogo, you are indirectly using Anthropic.",
    risk: "Rogo's capabilities are limited by what Claude can do. If Anthropic changes pricing or policies, those changes flow directly through to Rogo's customers.",
    strength: "critical",
  },
  {
    from: "Sierra",
    to: "Anthropic",
    type: "model",
    description: "Sierra's AI-powered customer service product is built on Anthropic's Claude AI.",
    risk: "The quality of Sierra's customer service depends directly on Anthropic's AI performance. If Claude has issues, Sierra's customers feel it immediately.",
    strength: "strong",
  },
  {
    from: "Glean",
    to: "OpenAI",
    type: "model",
    description: "Glean's company-wide search product uses OpenAI's AI alongside Glean's own search technology.",
    risk: "Glean has some protection because it also uses its own technology, but the quality of AI-generated answers still depends on OpenAI.",
    strength: "strong",
  },
  {
    from: "Writer",
    to: "Proprietary",
    type: "model",
    description: "Writer builds and uses its own AI rather than buying from OpenAI or Anthropic. This makes it more independent but costlier to develop.",
    risk: "Less exposed to supplier risk, but must spend significantly more on research and development. May struggle to keep pace with larger AI companies.",
    strength: "moderate",
  },
  {
    from: "Perplexity",
    to: "Multiple Providers",
    type: "model",
    description: "Perplexity uses AI from several providers (OpenAI, Anthropic, and its own) to power its search product.",
    risk: "Using multiple AI providers reduces dependence on any single one, but adds complexity and makes costs harder to manage.",
    strength: "moderate",
  },
  {
    from: "ServiceNow",
    to: "Multiple Providers",
    type: "model",
    description: "ServiceNow uses AI from multiple providers in its business products, giving it flexibility to switch if needed.",
    risk: "Can switch providers if one becomes too expensive or unreliable, but each integration takes time and effort to change.",
    strength: "moderate",
  },
  {
    from: "UiPath",
    to: "Multiple Providers",
    type: "model",
    description: "UiPath uses AI from OpenAI, Google, and Microsoft for different parts of its automation products.",
    risk: "Flexibility to choose the best AI for each task, but requires ongoing work to keep up with changes from each provider.",
    strength: "moderate",
  },
  {
    from: "Moveworks",
    to: "OpenAI",
    type: "model",
    description: "Moveworks' AI assistant for businesses runs primarily on OpenAI's technology.",
    risk: "Product quality depends on OpenAI. Moveworks' advantage comes from how it connects AI to business workflows, not from the AI itself.",
    strength: "strong",
  },
  {
    from: "Hebbia",
    to: "Anthropic",
    type: "model",
    description: "Hebbia's document analysis product uses Anthropic's Claude AI to read and interpret complex documents.",
    risk: "Depends on Anthropic for the core AI capability, but Hebbia's own document handling technology provides additional value beyond the AI itself.",
    strength: "strong",
  },

  // ── New infrastructure dependencies ──
  {
    from: "Broadcom",
    to: "TSMC",
    type: "compute",
    description: "Broadcom designs custom AI chips for the largest cloud providers, but relies on TSMC in Taiwan to manufacture them.",
    risk: "Any disruption to TSMC — from geopolitical tension, natural disaster, or capacity constraints — would halt Broadcom's ability to deliver chips to its cloud customers.",
    strength: "critical",
  },
  {
    from: "Cerebras",
    to: "TSMC",
    type: "compute",
    description: "Cerebras builds the largest AI chip ever made, but relies entirely on TSMC to manufacture its wafer-scale processors.",
    risk: "Total manufacturing dependency. Cerebras has no alternative fabrication source for its unique chip design.",
    strength: "critical",
  },
  {
    from: "Lambda",
    to: "NVIDIA",
    type: "compute",
    description: "Lambda's cloud business is built entirely on renting out NVIDIA GPU capacity to AI companies and researchers.",
    risk: "Same single-supplier risk as CoreWeave. Lambda's business depends on NVIDIA's willingness to supply chips and the prices they set.",
    strength: "critical",
  },

  // ── New model dependencies ──
  {
    from: "Cursor",
    to: "Anthropic",
    type: "model",
    description: "Cursor's AI code editor uses Anthropic's Claude as its primary AI engine for code generation and editing.",
    risk: "Cursor's product quality is directly tied to Claude's performance. If Anthropic changes pricing or terms, Cursor's costs and user experience are immediately affected.",
    strength: "critical",
  },
  {
    from: "Cursor",
    to: "OpenAI",
    type: "model",
    description: "Cursor also offers OpenAI models as an alternative to Claude, giving users a choice of AI provider.",
    risk: "Multi-provider strategy provides some insurance, but most users default to Claude — making Anthropic the primary dependency.",
    strength: "strong",
  },
  {
    from: "GitHub Copilot",
    to: "OpenAI",
    type: "model",
    description: "GitHub Copilot is powered by OpenAI models, accessed through Microsoft's ownership of both GitHub and its stake in OpenAI.",
    risk: "Deeply integrated through Microsoft's corporate structure. The dependency is structural — GitHub, OpenAI, and Azure are all part of the Microsoft ecosystem.",
    strength: "critical",
  },
  {
    from: "GitHub Copilot",
    to: "Microsoft",
    type: "ownership",
    description: "GitHub is wholly owned by Microsoft, which also controls the OpenAI relationship that powers Copilot.",
    risk: "Complete ownership. GitHub's AI strategy is set by Microsoft. Competitors who depend on GitHub Copilot are indirectly dependent on Microsoft's priorities.",
    strength: "critical",
  },
  {
    from: "Cognition",
    to: "Anthropic",
    type: "model",
    description: "Cognition's Devin autonomous coding agent uses Anthropic's Claude as a core AI engine.",
    risk: "Cognition's ability to deliver autonomous software engineering depends on Claude's reasoning capabilities. A regression in Claude's performance would directly affect Devin's output quality.",
    strength: "strong",
  },
  {
    from: "CrowdStrike",
    to: "Multiple Providers",
    type: "model",
    description: "CrowdStrike's Charlotte AI uses multiple AI providers alongside its own proprietary threat detection models.",
    risk: "CrowdStrike's core value is its proprietary security data and detection logic, not the underlying AI. Less exposed to single-provider risk than most application vendors.",
    strength: "moderate",
  },
  {
    from: "Ironclad",
    to: "OpenAI",
    type: "model",
    description: "Ironclad's contract management product uses OpenAI's AI to draft, review, and analyse legal contracts.",
    risk: "Core contract analysis capability depends on OpenAI. If OpenAI changes pricing or terms, Ironclad's value proposition to legal teams is directly affected.",
    strength: "strong",
  },
  {
    from: "Synthesia",
    to: "Proprietary",
    type: "model",
    description: "Synthesia builds its own specialised AI for generating realistic video with human avatars — a capability no general-purpose AI provider offers at this quality.",
    risk: "Lower supplier risk because the core technology is proprietary. However, this means higher R&D costs and a narrower talent pool to hire from.",
    strength: "moderate",
  },

  // ── New cloud dependencies ──
  {
    from: "Palantir",
    to: "AWS",
    type: "cloud",
    description: "Palantir's AI platform runs primarily on Amazon's cloud, where most of its commercial customers deploy.",
    risk: "Strong but not exclusive cloud dependency. Palantir also deploys on Azure and on-premises, giving it more flexibility than single-cloud vendors.",
    strength: "strong",
  },
  {
    from: "Databricks",
    to: "Multiple Clouds",
    type: "cloud",
    description: "Databricks runs across Amazon, Microsoft, and Google cloud platforms, giving customers a choice of where their data lives.",
    risk: "Multi-cloud approach reduces lock-in risk but requires Databricks to maintain three separate integrations — adding cost and complexity.",
    strength: "moderate",
  },

  // ── New investment/ownership ──
  {
    from: "ServiceNow",
    to: "Moveworks",
    type: "ownership",
    description: "ServiceNow acquired Moveworks for $2.85 billion in 2026 to accelerate its AI agent strategy.",
    risk: "Moveworks is now fully absorbed into ServiceNow. Companies that previously used Moveworks independently are now tied to the ServiceNow platform.",
    strength: "critical",
  },
];

/* ─── Component ──────────────────────────────────────── */

const ALL_TYPES: RelationType[] = ["ownership", "investment", "cloud", "compute", "model"];

export default function RelationshipMap() {
  const [activeTypes, setActiveTypes] = useState<Set<RelationType>>(new Set(ALL_TYPES));
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  const toggle = (t: RelationType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size > 1) next.delete(t); // keep at least one active
      } else {
        next.add(t);
      }
      return next;
    });
  };

  // Filter relationships by active types
  const filtered = RELATIONSHIPS.filter((r) => activeTypes.has(r.type));

  // Group by "from" vendor
  const byVendor = new Map<string, Relationship[]>();
  for (const r of filtered) {
    const bucket = byVendor.get(r.from) ?? [];
    bucket.push(r);
    byVendor.set(r.from, bucket);
  }

  // Sort vendors: those with critical dependencies first, then by relationship count
  const sortedVendors = [...byVendor.entries()].sort((a, b) => {
    const aCrit = a[1].filter((r) => r.strength === "critical").length;
    const bCrit = b[1].filter((r) => r.strength === "critical").length;
    if (bCrit !== aCrit) return bCrit - aCrit;
    return b[1].length - a[1].length;
  });

  return (
    <section className="mb-8">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-[#18201b] dark:text-zinc-100">
          Who Depends on Whom
        </h2>
        <p className="mt-1 text-sm text-[#5f685a] dark:text-zinc-400">
          The AI market is built on a web of dependencies — money, technology, and infrastructure
          flow between these companies. When one relationship changes, it can affect every vendor
          and customer connected to it.
        </p>
      </div>

      {/* Filter chips */}
      <div className="mb-5 flex flex-wrap gap-2">
        {ALL_TYPES.map((t) => {
          const meta = RELATION_META[t];
          const isActive = activeTypes.has(t);
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? `${meta.color} border-current`
                  : "border-[#dfe4da] bg-white text-[#9da596] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
              }`}
            >
              <span aria-hidden>{meta.icon}</span>
              {meta.label}
              <span className="ml-1 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold dark:bg-zinc-800/60">
                {RELATIONSHIPS.filter((r) => r.type === t).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Vendor dependency cards */}
      <div className="space-y-3">
        {sortedVendors.map(([vendor, rels]) => {
          const isExpanded = expandedVendor === vendor;
          const hasCritical = rels.some((r) => r.strength === "critical");

          return (
            <div
              key={vendor}
              className={`rounded-xl border transition-all ${
                hasCritical
                  ? "border-rose-200 dark:border-rose-900/60"
                  : "border-[#dfe4da] dark:border-zinc-800"
              } bg-white dark:bg-zinc-900`}
            >
              {/* Header — always visible */}
              <button
                onClick={() => setExpandedVendor(isExpanded ? null : vendor)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">
                    {vendor}
                  </span>
                  {hasCritical && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                      Single-supplier risk
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Dependency type dots */}
                  <div className="flex gap-1">
                    {[...new Set(rels.map((r) => r.type))].map((t) => (
                      <span
                        key={t}
                        className={`h-2 w-2 rounded-full ${RELATION_META[t].dotColor}`}
                        title={RELATION_META[t].label}
                      />
                    ))}
                  </div>
                  {/* Arrow connectors preview */}
                  <span className="text-xs text-[#9da596] dark:text-zinc-500">
                    → {rels.map((r) => r.to).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(", ")}
                    {rels.map((r) => r.to).filter((v, i, a) => a.indexOf(v) === i).length > 3 && " ..."}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 12 12" className={`transition-transform text-[#9da596] ${isExpanded ? "rotate-180" : ""}`}>
                    <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>

              {/* Expanded — full dependency detail */}
              {isExpanded && (
                <div className="border-t border-[#eef2e8] px-5 py-4 dark:border-zinc-800">
                  <div className="space-y-3">
                    {rels.map((r, idx) => {
                      const meta = RELATION_META[r.type];
                      return (
                        <div
                          key={idx}
                          className={`rounded-lg border-l-4 p-3.5 ${
                            r.strength === "critical"
                              ? "border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/10"
                              : r.strength === "strong"
                              ? "border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10"
                              : "border-l-zinc-300 bg-zinc-50/40 dark:border-l-zinc-600 dark:bg-zinc-800/30"
                          }`}
                        >
                          {/* Dependency header */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm" aria-hidden>{meta.icon}</span>
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#697362] dark:text-zinc-500">
                              {meta.label}
                            </span>
                            <span className="text-[#697362] dark:text-zinc-500">·</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              r.strength === "critical"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                : r.strength === "strong"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}>
                              {r.strength === "critical" ? "No alternative" : r.strength === "strong" ? "Primary supplier" : "One of several"}
                            </span>
                          </div>

                          {/* Arrow connector */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{r.from}</span>
                            <span className="text-xs text-[#9da596]">depends on</span>
                            <span className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{r.to}</span>
                          </div>

                          {/* What it does */}
                          <p className="text-xs leading-5 text-[#4d574b] dark:text-zinc-300">
                            {r.description}
                          </p>

                          {/* What to watch */}
                          <div className="mt-2 rounded-md bg-white/60 px-3 py-2 dark:bg-zinc-800/40">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#697362] dark:text-zinc-500">
                              What to watch
                            </div>
                            <p className="mt-0.5 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
                              {r.risk}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Provenance */}
      <div className="mt-4 flex items-center gap-2 text-[10px] text-[#9da596] dark:text-zinc-500">
        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Seed
        </span>
        <span>Based on public disclosures and reporting. Updated periodically, not in real time.</span>
      </div>
    </section>
  );
}
