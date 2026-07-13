import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site";

// Orientation surface — the plain-English answer to "what is this, how do I do an
// assessment, and where does the data come from". Deliberately the CLARITY
// STANDARD for the redesign: readable type (no 10–11px), generous space, at most
// one badge, the answer before the apparatus. Static, no DB — it explains the
// system, it doesn't query it.

const TITLE = "How it works";
const DESCRIPTION =
  "What this is, how to run an assessment in three steps, and where the data comes from — in plain English.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/how-it-works" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/how-it-works"), type: "website" },
};

const STEPS: { n: string; title: string; body: string; cta?: { label: string; href: string } }[] = [
  {
    n: "1",
    title: "Pick a market, or a vendor",
    body: "Start from the rankings and choose a category (frontier models, coding agents, agent platforms…), or go straight to a vendor you're weighing up. Every category is ranked within itself — never one big cross-market league table.",
    cta: { label: "Open the rankings", href: "/vendors" },
  },
  {
    n: "2",
    title: "Read the evidence-scored assessment",
    body: "Each vendor is scored across 12 domains on a 0–5 scale, and every score is built from real, cited evidence — audit reports, filings, product docs, analyst coverage. Where the evidence is thin, it says “insufficient evidence” rather than guessing a number.",
  },
  {
    n: "3",
    title: "Make it yours, then take it to the room",
    body: "Weight the 12 domains to what matters for your situation, or Interrogate the assessment — type your real context (“ServiceNow renews in 3 months, EU-only, regulated”) and it re-weights and re-ranks with a cited explanation. Save the decision or export a procurement pack for your meeting.",
    cta: { label: "Try it on Anthropic", href: "/vendors/anthropic" },
  },
];

const JOBS: { title: string; body: string; href: string }[] = [
  { title: "Watch the market", body: "What moved today, who leads each category, and who depends on whom for compute, models, cloud and capital.", href: "/" },
  { title: "Assess & decide", body: "The evidence-scored assessment of any vendor — weight it to your priorities and save a decision.", href: "/vendors" },
  { title: "Benchmark vs peers", body: "What enterprises like yours — your industry, size and region — have actually disclosed adopting.", href: "/peers" },
  { title: "Track the models", body: "Every frontier model plotted on cost versus capability, with the efficiency frontier called out.", href: "/models" },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      {/* Hero — the one-line what-it-is, big and unmissable. */}
      <header className="mb-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b08d2f] dark:text-[#d4af37]">
          How it works
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold leading-[1.1] tracking-tight text-[#13294b] dark:text-[#eef3f8] sm:text-5xl">
          The enterprise-AI market, scored on evidence — and readable in a glance.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#3f5068] dark:text-[#c7d4e2]">
          This is an independent read on the enterprise-AI vendors: who leads each category, who relies on
          whom, and what&apos;s moving this week. Every score traces back to a public source you can open — and
          where the evidence is thin, we say so instead of inventing a number.
        </p>
      </header>

      {/* Do an assessment — the core action, spelled out. */}
      <section className="mb-14">
        <h2 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#13294b] dark:text-[#eef3f8]">
          Run an assessment in three steps
        </h2>
        <ol className="mt-6 space-y-5">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="flex gap-5 rounded-2xl border border-[#e6dcc3] bg-white/60 p-6 dark:border-[#22405f] dark:bg-white/[0.04]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#13294b] font-[var(--font-display)] text-lg font-bold text-[#f6f0e7] dark:bg-[#d4af37] dark:text-[#0a1f38]">
                {s.n}
              </span>
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-[#13294b] dark:text-[#eef3f8]">{s.title}</h3>
                <p className="mt-2 text-base leading-7 text-[#3f5068] dark:text-[#c7d4e2]">{s.body}</p>
                {s.cta && (
                  <Link
                    href={s.cta.href}
                    className="mt-3 inline-flex items-center gap-1.5 text-base font-semibold text-[#a07f1f] underline-offset-4 hover:underline dark:text-[#d4af37]"
                  >
                    {s.cta.label} <span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Where the data comes from — the "where is it stored / how is it honest" answer. */}
      <section className="mb-14 rounded-2xl border border-[#d4af37]/40 bg-[#fbf6e4]/60 p-7 dark:border-[#d4af37]/30 dark:bg-[#1a1605]/25">
        <h2 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#13294b] dark:text-[#eef3f8]">
          Where the numbers come from
        </h2>
        <p className="mt-4 text-base leading-7 text-[#3f5068] dark:text-[#c7d4e2]">
          Everything lives in a live database that refreshes every day from public sources: independent model
          benchmarks (Artificial Analysis), monitored news, official regulatory trackers, and cited vendor and
          adoption evidence. Scores are computed by a fixed rubric — no vendor can pay to move one.
        </p>
        <ul className="mt-4 space-y-2 text-base leading-7 text-[#3f5068] dark:text-[#c7d4e2]">
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b08d2f] dark:bg-[#d4af37]" />
            <span><strong className="font-semibold text-[#13294b] dark:text-[#eef3f8]">Nothing is invented.</strong> A number appears only when real evidence backs it; otherwise you see “insufficient evidence.”</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b08d2f] dark:bg-[#d4af37]" />
            <span><strong className="font-semibold text-[#13294b] dark:text-[#eef3f8]">Estimates are labelled.</strong> Anything directional wears a quiet marker, so measured fact and modelled signal never blur.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b08d2f] dark:bg-[#d4af37]" />
            <span><strong className="font-semibold text-[#13294b] dark:text-[#eef3f8]">Every score opens its source.</strong> Expand any domain to see the citations and dates it was built from.</span>
          </li>
        </ul>
      </section>

      {/* The four jobs — where to go for what. */}
      <section className="mb-12">
        <h2 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#13294b] dark:text-[#eef3f8]">
          Four things you can do here
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {JOBS.map((j) => (
            <Link
              key={j.href}
              href={j.href}
              className="group rounded-2xl border border-[#e6dcc3] bg-white/60 p-6 transition-colors hover:border-[#b08d2f] dark:border-[#22405f] dark:bg-white/[0.04] dark:hover:border-[#d4af37]"
            >
              <h3 className="text-lg font-semibold text-[#13294b] group-hover:text-[#a07f1f] dark:text-[#eef3f8] dark:group-hover:text-[#d4af37]">
                {j.title} <span aria-hidden className="opacity-0 transition-opacity group-hover:opacity-100">→</span>
              </h3>
              <p className="mt-2 text-base leading-7 text-[#3f5068] dark:text-[#c7d4e2]">{j.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="rounded-2xl bg-[#13294b] p-7 text-center dark:bg-[#0a1f38]">
        <p className="text-lg text-[#dbe4ef]">Ready to try it?</p>
        <Link
          href="/vendors"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#d4af37] px-6 py-3 text-base font-semibold text-[#0a1f38] transition-colors hover:bg-[#e8c95c]"
        >
          Assess a vendor <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  );
}
