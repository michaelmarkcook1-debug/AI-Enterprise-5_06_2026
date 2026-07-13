// "Start here" — the product's front door. Rebuilt 2026-07-13 (owner): a launchpad
// that routes DIRECTLY to the two deep tools (Interrogate + the vendor assessment),
// then a CITED evidence library of enterprise-AI workflows. The old industry ×
// maturity gate was removed — it implied a per-industry sourcing read the evidence
// doesn't support (23 of 29 cited rows are cross-industry). Static; no DB/LLM.
import type { Metadata } from "next";
import UseCaseEvidenceLibrary from "./UseCaseEvidenceLibrary";
import JobsHub from "@/components/jobs/JobsHub";

export const metadata: Metadata = {
  title: "Where to start with enterprise AI",
  description:
    "Start here: run a tailored Interrogate finding or open a vendor's deep 12-domain assessment — plus a cited library of enterprise-AI workflows with independently-evidenced task-level impact.",
  alternates: { canonical: "/use-cases" },
};

export default function StartHerePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* The launchpad — pick a tool, land on it. */}
      <JobsHub />

      {/* The cited evidence library — where AI has actually been measured to pay off. */}
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#b08d2f] dark:text-[#d4af37]">
          Where AI pays off
        </p>
        <h1 className="mt-1 font-[var(--font-display)] text-3xl font-extrabold tracking-tight">
          Workflows with evidenced impact
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#15263c]/65 dark:text-[#eef3f8]/60">
          The enterprise-AI workflows where an independent study actually measured a task-level gain — each
          cited and evidence-graded, sorted strongest first. No industry guesswork: most evidence is
          cross-industry, and where it isn&apos;t we say so. Route any into the vendor rankings.
        </p>
      </header>
      <UseCaseEvidenceLibrary />
    </main>
  );
}
