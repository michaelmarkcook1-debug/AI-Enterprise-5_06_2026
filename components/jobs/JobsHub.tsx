"use client";

// "Start here" launchpad. Rebuilt 2026-07-13 (owner): the front door now routes
// DIRECTLY to the two things that ARE the product — the tailored Interrogate
// finding and the deep 12-domain vendor assessment — then three honest quick
// jumps. Every card lands on the functionality it names (the old cards dumped
// you on a list; Interrogate wasn't linked at all). Client-side only for the
// peer-benchmark resume chip; nothing here reads or writes canonical data.

import { useEffect, useState } from "react";
import Link from "next/link";
import { VERTICALS, SIZE_BANDS, REGIONS, type Segment } from "@/lib/peer/segments";

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";
const SEGMENT_KEY = "ae_peer_segment";

const PRIMARY = [
  {
    href: "/interrogate",
    title: "Interrogate — get a tailored finding",
    detail:
      "Tell it your situation in plain words. It asks a few sharp questions, each shaped by your last answer — never a fixed form — then writes a source-cited finding for your case. Nothing invented; where the data is thin it says so.",
    cta: "Start interrogating",
  },
  {
    href: "/vendors",
    title: "Assess a vendor",
    detail:
      "Open any vendor for its 12-domain evidence scorecard — every score 0–5 and cited — then re-weight the domains to your priorities and save or export the decision for your meeting.",
    cta: "Browse & assess",
  },
];

const SECONDARY: { href: string; title: string; detail: string; note?: string; resume?: boolean }[] = [
  { href: "/", title: "Watch the market", detail: "What moved today, who leads each category, who depends on whom." },
  { href: "/peers", title: "Benchmark vs peers", detail: "What enterprises like yours have publicly disclosed adopting.", resume: true },
  { href: "/vendors", title: "Prep a meeting", detail: "Open the vendor you're meeting for a take-in-the-room prep kit + procurement pack.", note: "members" },
];

export default function JobsHub() {
  const [resume, setResume] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SEGMENT_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Segment;
      const v = VERTICALS.find((x) => x.id === s.vertical)?.label;
      const b = SIZE_BANDS.find((x) => x.id === s.sizeBand)?.label;
      const r = REGIONS.find((x) => x.id === s.region)?.label;
      if (v && b && r) setResume(`${v} · ${b.split(" (")[0]} · ${r}`);
    } catch {
      /* resume chip is a convenience — never let saved state break the hub */
    }
  }, []);

  return (
    <section className="mb-10" aria-label="What do you want to do?">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#b08d2f] dark:text-[#d4af37]">
        What do you want to do?
      </h2>

      {/* The two deep tools — the tailored finding + the evidence assessment. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PRIMARY.map((j) => (
          <Link
            key={j.title}
            href={j.href}
            className="group flex flex-col rounded-2xl border border-[#d4af37]/40 bg-[#fbf6e4]/40 p-5 transition-colors hover:border-[#d4af37] dark:border-[#d4af37]/30 dark:bg-[#1a1605]/20"
          >
            <h3 className="text-lg font-semibold text-[#123d2c] dark:text-[#eef3f8]">{j.title}</h3>
            <p className={`mt-1.5 flex-1 text-sm leading-6 ${MUTED}`}>{j.detail}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#a07f1f] dark:text-[#d4af37]">
              {j.cta} <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Three quick jumps. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SECONDARY.map((j) => (
          <Link
            key={j.title}
            href={j.href}
            className="group rounded-xl border border-black/10 bg-white/60 p-4 transition-colors hover:border-[#d4af37]/60 dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold underline-offset-2 group-hover:underline">{j.title}</h3>
              {j.note && (
                <span className={`shrink-0 rounded-full border border-black/10 px-1.5 py-0.5 text-xs font-semibold uppercase dark:border-white/15 ${MUTED}`}>
                  {j.note}
                </span>
              )}
            </div>
            <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{j.detail}</p>
            {j.resume && resume && (
              <p className="mt-2 inline-block rounded-full border border-[#d4af37]/50 bg-[#d4af37]/10 px-2 py-0.5 text-xs font-medium">
                Resume: {resume}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
