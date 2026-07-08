// C6 — Use-case-first front door: "where's my low-hanging fruit?"
// The intended entry point of the product: WHAT to AI-enable before WHICH vendor.
// Server shell only — the guided flow is a client component over the static,
// curated use-case library (no DB, no LLM at request time; deterministic model).
import type { Metadata } from "next";
import UseCaseFrontDoorClient from "./UseCaseFrontDoorClient";
import JobsHub from "@/components/jobs/JobsHub";

export const metadata: Metadata = {
  title: "Where to start with enterprise AI",
  description:
    "Map your industry and AI maturity to prioritised, real-world AI use-cases — a transparent feasibility model over a curated workflow library, routed into evidence-backed vendor rankings.",
  alternates: { canonical: "/use-cases" },
};

export default function UseCaseFrontDoorPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* C5 jobs hub — the user picks the JOB they're in; the C6 guided flow
          below is the "find my use-case" job's content. */}
      <JobsHub />
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#b08d2f] dark:text-[#d4af37]">
          Find my use-case
        </p>
        <h1 className="mt-1 font-[var(--font-display)] text-3xl font-extrabold tracking-tight">
          Where&apos;s your low-hanging fruit?
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#15263c]/65 dark:text-[#eef3f8]/60">
          Most AI programmes fail at use-case choice, not vendor choice. Two questions map your
          context to a prioritised set of real enterprise AI workflows — then route each into the
          evidence-backed vendor rankings.
        </p>
      </header>
      <UseCaseFrontDoorClient />
    </main>
  );
}
