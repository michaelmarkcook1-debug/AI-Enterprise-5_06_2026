import type { Metadata } from "next";
import Link from "next/link";
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
import { VERTICALS } from "@/lib/peer/segments";
import { TRACKED_VENDOR_NAMES } from "@/lib/sourcing/ai-news-manifest";
import { absoluteUrl } from "@/lib/site";

// Peer-AI benchmark — the demand-side twin of the vendor assessment.
// BUYER-FIRST (2026-07-13): the page leads with the buyer's OWN cohort answer
// (CohortExplorer) — "enterprises like mine, and am I behind?" — and demotes the
// whole-base aggregate to a "zoom out". Pure curated/cited data (lib/peer/*),
// zero DB, zero LLM at request time.

const TITLE = "Peer AI benchmark — what are enterprises like mine doing with AI?";
const DESCRIPTION =
  "Your cohort (vertical × size × region) on cited AI-adoption research: are you ahead or behind, what platforms and use-cases your peers deploy, and named exemplar deployments. Private usage is never asserted; thin segments read as limited data.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/peers" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/peers"), type: "website" },
};

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

export default function PeersPage() {
  const coverage = getUsageCoverage();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
          Observable · cited · never guessed
        </p>
        <h1 className="font-display mt-2 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          What are enterprises like mine doing with AI?
        </h1>
        <p className={`mt-3 max-w-2xl text-base leading-7 ${MUTED}`}>
          Set your segment below and see how your cohort adopts AI — the cited benchmark, whether you sit ahead
          or behind, the platforms and use-cases your peers deploy, and named exemplars. Anything private reads
          “not disclosed”; thin segments read “limited data”.
        </p>
      </header>

      {/* ── The buyer's OWN cohort — the answer they came for, first. ── */}
      <CohortExplorer />

      {/* ── Zoom out — the whole tracked base (context, demoted). ── */}
      <section className="mt-10">
        <div className="mb-3 max-w-3xl">
          <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">
            Zoom out — the whole tracked base
          </h2>
          <p className={`mt-1 text-sm leading-6 ${MUTED}`}>
            Beyond your cohort: cited adoption benchmarks compiled for {coverage.verticalsWithBenchmark} of{" "}
            {VERTICALS.length} verticals; {coverage.verticalsWithVendorUsage} show disclosed vendor usage, across{" "}
            {coverage.companies} tracked companies. Found a fit worth checking?{" "}
            <Link href="/use-cases" className="underline underline-offset-2 hover:no-underline">
              assess it properly
            </Link>{" "}
            against the full evidence-graded scorecard.
          </p>
        </div>
        <PeerUsageOverview
          rows={getBaseUsageAggregate()}
          topVendors={getTopVendorsAcrossBase()}
          useCases={getBaseUseCases()}
          asOf={getUsageAsOf()}
          coverage={coverage}
          vendorNames={TRACKED_VENDOR_NAMES}
        />
      </section>

      {/* ── Methodology — collapsed; the honesty contract for anyone who wants it. ── */}
      <details className="mt-10 rounded-xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
        <summary className="cursor-pointer select-none font-[var(--font-display)] text-lg font-bold tracking-tight">
          How to read this — signals, rubric &amp; the red line
        </summary>
        <p className={`mt-2 text-xs ${MUTED}`}>
          Each band is <strong>computed from a documented rubric</strong> over observable evidence — never assigned on
          judgment or graded by an LLM. The per-signal rule:
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SIGNAL_KINDS.map((k) => (
            <div key={k.kind} className="rounded-lg border border-black/5 p-4 dark:border-white/10">
              <h3 className="text-sm font-semibold">{k.label}</h3>
              <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{k.description}</p>
              <p className="mt-1.5 text-xs leading-5 text-[#b08d2f] dark:text-[#d4af37]">Rubric: {RUBRIC_TEXT[k.kind]}</p>
            </div>
          ))}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <h3 className="text-sm font-semibold">The red line</h3>
            <p className={`mt-1 text-xs leading-5 ${MUTED}`}>
              We show what a company has publicly disclosed or what is externally observable. We never claim how a
              company uses AI internally when that is private — those cells read “not disclosed”, and inferences carry
              an explicit “est.” flag. Bands trace to real disclosed facts; nothing is invented.
            </p>
          </div>
        </div>
      </details>

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
