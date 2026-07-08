import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";
import { INTERROGATION_ENGINE_ENABLED } from "@/lib/availability";
import InterrogationFlow from "@/components/interrogate/InterrogationFlow";
import DataUnavailable from "@/components/DataUnavailable";

// AIE-05 — the interrogation engine's front door. Open test site (single default
// seat). The page shell is static; the flow itself is a client driver over the
// /api/interrogate routes. force-dynamic keeps the flag check request-time.
export const dynamic = "force-dynamic";

const TITLE = "Interrogate — a tailored AI market finding";
const DESCRIPTION =
  "Answer a few sharp questions and get a written, source-cited finding tailored to your situation — grounded in live model benchmarks and cited peer data, never invented.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/interrogate" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/interrogate"), type: "website" },
};

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

export default function InterrogatePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
          Adaptive · grounded · source-cited
        </p>
        <h1 className="font-[var(--font-display)] mt-2 text-3xl font-extrabold tracking-tight">Interrogate</h1>
        <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>
          Tell me your situation. I&apos;ll ask a few nuanced questions — each shaped by your last answer, never a
          fixed form — then write a tailored finding grounded only in live, cited evidence. Every claim traces to a
          source; where the data is thin, I&apos;ll say so rather than guess.
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
    </main>
  );
}
