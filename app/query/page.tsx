// Query — the AI Enterprise 4-category taxonomy.
// ──────────────────────────────────────────────
// Locked top-level categories:
//   1. Models
//   2. Platforms
//   3. Applications
//   4. Infrastructure
//
// No additional top-level cards. Everything else is a subcategory,
// tag, filter, or expansion item inside these four.
//
// No vendor ranking may compare vendors across categories.
// This is a non-negotiable platform rule.
//
// Purpose: After 2–3 minutes an executive understands the shape of the
// AI ecosystem, which companies operate in which category, how the
// categories depend on one another, and what is changing.

import Link from "next/link";
import { Panel } from "@/components/intelligence-ui";
import {
  listIntelligenceVendors,
  listVendorMomentum,
  listNewsItems,
} from "@/lib/intelligence/repository";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import CategoryCards from "@/components/query/CategoryCards";
import MarketMovement from "@/components/query/MarketMovement";
import RelationshipMap from "@/components/query/RelationshipMap";

export const dynamic = "force-dynamic";

export default async function QueryPage() {
  const [provenance, vendors, momentum, news] = await Promise.all([
    getDataProvenance(),
    listIntelligenceVendors(),
    listVendorMomentum(),
    listNewsItems(),
  ]);

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-[#18201b] dark:bg-[#071827] dark:text-zinc-100">
      <main className="mx-auto max-w-7xl px-5 py-8">

      {/* ═══ HERO ═══ */}
      <section className="mb-10">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a725f] dark:text-zinc-500">AI Enterprise · Query</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#121812] dark:text-zinc-50 md:text-4xl lg:text-5xl">
            The AI Market in Three Minutes
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#596151] dark:text-zinc-400">
            Your organisation is making AI investment decisions. Before you choose vendors,
            approve budgets, or set strategy — you need to understand how this market works,
            who depends on whom, and what is changing right now.
          </p>
        </div>

        {/* ── Executive summary — the bottom line ── */}
        <div className="mx-auto mb-10 max-w-3xl rounded-2xl border border-[#dfe4da] bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100 mb-3">The bottom line</h2>
          <div className="space-y-2.5 text-sm leading-6 text-[#4d574b] dark:text-zinc-300">
            <p>
              <strong className="text-[#18201b] dark:text-zinc-100">The AI market has four categories</strong> — Models (the AI brains),
              Platforms (where you deploy and manage them), Applications (where employees and customers use them),
              and Infrastructure (the chips and cloud everything runs on).
            </p>
            <p>
              <strong className="text-[#18201b] dark:text-zinc-100">A disruption in one category affects the others.</strong> If
              chip supply tightens, model companies cannot deliver. If a model provider changes pricing,
              every application built on it is affected. Your vendor risk is not just about your vendor — it is about
              who your vendor depends on.
            </p>
            <p>
              <strong className="text-[#18201b] dark:text-zinc-100">The boundaries between categories are shifting.</strong> Model companies
              are moving into applications. Cloud platforms are building their own models. The vendor
              you choose today may face a very different competitive landscape in twelve months.
            </p>
          </div>
        </div>

        {/* 4 category cards — Models, Platforms, Applications, Infrastructure */}
        <CategoryCards vendors={vendors} momentum={momentum} provenance={provenance} />
      </section>

      {/* How the categories depend on each other */}
      <section className="mb-8">
        <Panel title="How the categories depend on each other">
          <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
            Each category depends on those around it. A disruption in one
            affects vendors and products across the others.
          </p>
          <div className="space-y-2">
            {[
              { from: "Applications", to: "Models + Platforms", risk: "Model companies are starting to offer the same features that specialist application vendors sell — squeezing their differentiation." },
              { from: "Platforms", to: "Models + Infrastructure", risk: "Platform vendors are building AI directly into their products, which could reduce the need for separate AI tools." },
              { from: "Models", to: "Infrastructure", risk: "Chip shortages, cloud pricing, and government export controls directly affect whether model companies can deliver their products and at what cost." },
              { from: "Infrastructure", to: "Global chip supply chain", risk: "Trade tensions, NVIDIA's dominance, and chip export restrictions create supply risk that affects the entire AI market." },
            ].map((dep) => (
              <div key={dep.from} className="rounded-lg border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-[#18201b] dark:text-zinc-100">{dep.from}</span>
                  <span className="text-[#697362]">→ depends on →</span>
                  <span className="font-medium text-[#4d574b] dark:text-zinc-300">{dep.to}</span>
                </div>
                <p className="mt-1 text-xs text-[#5f685a] dark:text-zinc-400">{dep.risk}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {/* Relationship Map — vendor dependencies */}
      <RelationshipMap />

      {/* Market Movement — significant developments */}
      <MarketMovement news={news} provenance={provenance} />

      {/* Next step */}
      <section className="mb-4">
        <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-50/50 px-5 py-4 dark:border-emerald-700/40 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Next step</div>
              <p className="mt-1 text-sm leading-5 text-emerald-900 dark:text-emerald-100">
                Go deeper on individual vendors — what they do well, where the risks are, and how sustainable they are.
              </p>
            </div>
            <Link
              href="/understand"
              className="shrink-0 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
            >
              Understand vendors →
            </Link>
          </div>
        </div>
      </section>
      </main>
    </div>
  );
}
