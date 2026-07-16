// "Start here" — the product's front door. Rebuilt 2026-07-16 (owner): landing here
// now IMMEDIATELY runs the visitor through the interrogation engine's decision
// process (AIE-05 — adaptive Q&A, never a fixed form, ending in a cited finding)
// instead of requiring a click-through to /interrogate. JobsHub demotes to a
// secondary "other ways in" strip below it, then the cited evidence library.
// The old industry × maturity gate stays removed — it implied a per-industry
// sourcing read the evidence doesn't support (23 of 29 cited rows are
// cross-industry). force-dynamic: the interrogation flag check is request-time,
// same as /interrogate.
import type { Metadata } from "next";
import UseCaseEvidenceLibrary from "./UseCaseEvidenceLibrary";
import JobsHub from "@/components/jobs/JobsHub";
import InterrogationFlow from "@/components/interrogate/InterrogationFlow";
import { INTERROGATION_ENGINE_ENABLED } from "@/lib/availability";
import DataUnavailable from "@/components/DataUnavailable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Start here — a tailored enterprise-AI finding",
  description:
    "Tell me your situation. I'll ask a few nuanced questions, each shaped by your last answer, then write a source-cited finding tailored to your case — plus a cited library of enterprise-AI workflows with independently-evidenced task-level impact.",
  alternates: { canonical: "/use-cases" },
};

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

export default function StartHerePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* The decision process itself — narrower column for readable prose,
          centered inside the wider page shell the sections below use. */}
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
            Adaptive · grounded · source-cited
          </p>
          <h1 className="font-[var(--font-display)] mt-2 text-3xl font-extrabold tracking-tight">Start here</h1>
          <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>
            Tell me your situation. I&apos;ll ask a few nuanced questions — each shaped by your last answer, never a
            fixed form — then write a tailored finding grounded only in live, cited evidence. Every claim traces to
            a source; where the data is thin, I&apos;ll say so rather than guess.
          </p>
        </header>

        {INTERROGATION_ENGINE_ENABLED ? (
          <InterrogationFlow />
        ) : (
          <DataUnavailable
            title="Interrogate is not enabled"
            detail="The interrogation engine is turned off in this environment."
          />
        )}
      </div>

      {/* Other ways in — the same launchpad, now secondary to the flow above. */}
      <div className="mt-12">
        <JobsHub />
      </div>

      {/* The cited evidence library — where AI has actually been measured to pay off. */}
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#b08d2f] dark:text-[#d4af37]">
          Where AI pays off
        </p>
        <h2 className="mt-1 font-[var(--font-display)] text-3xl font-extrabold tracking-tight">
          Workflows with evidenced impact
        </h2>
        <p className={`mt-2 max-w-2xl text-sm leading-6 ${MUTED}`}>
          The enterprise-AI workflows where an independent study actually measured a task-level gain — each
          cited and evidence-graded, sorted strongest first. No industry guesswork: most evidence is
          cross-industry, and where it isn&apos;t we say so. Route any into the vendor rankings.
        </p>
      </header>
      <UseCaseEvidenceLibrary />
    </main>
  );
}
