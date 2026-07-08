import type { Metadata } from "next";
import CohortExplorer from "@/components/peers/CohortExplorer";
import PeerUsageOverview from "@/components/peers/PeerUsageOverview";
import TabChat from "@/components/chat/TabChat";
import { SIGNAL_KINDS } from "@/lib/peer/heatmap";
import { RUBRIC_TEXT } from "@/lib/peer/rubric";
import {
  getBaseUsageAggregate,
  getTopVendorsAcrossBase,
  getBaseUseCases,
  getUsageAsOf,
  getUsageCoverage,
} from "@/lib/peer/aggregate-usage";
import { TRACKED_VENDOR_NAMES } from "@/lib/sourcing/ai-news-manifest";
import { absoluteUrl } from "@/lib/site";

// Peer-AI benchmark — the demand-side twin of the vendor assessment.
// Pure curated/cited data (lib/peer/*), zero DB, zero LLM at request time.

const TITLE = "Peer AI benchmark — what are enterprises like mine doing with AI?";
const DESCRIPTION =
  "Your cohort (vertical × size × region) on cited AI-adoption research: adoption benchmarks, deployed use-cases, disclosed platforms, and named exemplar deployments. Private usage is never asserted; thin segments read as limited data.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/peers" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/peers"), type: "website" },
};

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

export default function PeersPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
          Observable · cited · never guessed
        </p>
        <h1 className="font-display mt-2 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          What are enterprises like mine doing with AI?
        </h1>
        <p className={`mt-3 max-w-2xl text-sm ${MUTED}`}>
          State your segment — vertical, size, region — and see how your cohort adopts AI:
          cited survey benchmarks, the use-cases and platforms they deploy, where you stand,
          and named exemplars with publicly disclosed deployments. Anything private reads
          honestly as “not disclosed”; thin segments read “limited data”.
        </p>
        <p className="mt-3 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium">
          Bands computed from cited evidence via a documented rubric — never guesses, never LLM-graded
        </p>
      </header>

      {/* ── DEFAULT view: the whole tracked base, aggregated (redesign 2026-07-06).
             Real cited data only — BTOS adoption breadth + disclosed vendor usage. ── */}
      <PeerUsageOverview
        rows={getBaseUsageAggregate()}
        topVendors={getTopVendorsAcrossBase()}
        useCases={getBaseUseCases()}
        asOf={getUsageAsOf()}
        coverage={getUsageCoverage()}
        vendorNames={TRACKED_VENDOR_NAMES}
      />

      {/* ── Narrow to your own cohort (the prior default, now a drill-down). ── */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">Narrow to your own cohort</h2>
        <p className="mt-1 max-w-2xl text-sm text-[#15263c]/65 dark:text-[#eef3f8]/60">
          State your segment — vertical, size, region — to see cited benchmarks, disclosed platforms
          and named exemplars scoped to enterprises like yours.
        </p>
        <div className="mt-4">
          <CohortExplorer />
        </div>
      </section>

      {/* ── Methodology — what each signal means and where the red line is ── */}
      <section className="mt-10 rounded-xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
        <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">
          How to read this
        </h2>
        <p className={`mt-1 text-xs ${MUTED}`}>
          Each band is <strong>computed from a documented rubric</strong> over observable
          evidence — never assigned on judgment or graded by an LLM. The per-signal rule:
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SIGNAL_KINDS.map((k) => (
            <div key={k.kind} className="rounded-lg border border-black/5 p-4 dark:border-white/10">
              <h3 className="text-sm font-semibold">{k.label}</h3>
              <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{k.description}</p>
              <p className="mt-1.5 text-[11px] leading-5 text-[#b08d2f] dark:text-[#d4af37]">
                Rubric: {RUBRIC_TEXT[k.kind]}
              </p>
            </div>
          ))}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <h3 className="text-sm font-semibold">The red line</h3>
            <p className={`mt-1 text-xs leading-5 ${MUTED}`}>
              We show what a company has publicly disclosed or what is externally
              observable. We never claim how a company uses AI internally when that is
              private — those cells read “not disclosed”, and inferences carry an
              explicit “est.” flag. Bands trace to real disclosed facts; nothing is invented.
            </p>
          </div>
        </div>
      </section>

      {/* Piece 3 — Ask AI, grounded in the cited peer dataset only. */}
      <TabChat
        tab={{ kind: "peers" }}
        label="Peer AI benchmark"
        chips={[
          "Who leads on disclosed AI adoption?",
          "What has JPMorgan disclosed?",
          "Which of these signals are estimates?",
        ]}
      />
    </main>
  );
}
