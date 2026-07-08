"use client";

// C5 "jobs, not journeys" — the jobs hub (piece 2 of the AnalystGenius batch).
// ────────────────────────────────────────────────────────────────────────────
// Users arrive with a JOB, not a topic: the hub surfaces the four jobs and
// lets them enter any one cold. The "benchmark my org" job is RE-ENTERABLE:
// its card reads the saved primary-org + peer-scope selection (written by
// PeerBenchmark to localStorage) and shows a resume chip — leave, come back,
// pick up where you left off. Client-side per-browser state only; nothing
// here reads or writes canonical data.

import { useEffect, useState } from "react";
import Link from "next/link";
import { VERTICALS, SIZE_BANDS, REGIONS, type Segment } from "@/lib/peer/segments";

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";
const CARD =
  "group block rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4 transition-colors hover:border-[#d4af37]/60";

const SEGMENT_KEY = "ae_peer_segment";

interface JobDef {
  href: string;
  title: string;
  detail: string;
  note?: string;
}

const JOBS: JobDef[] = [
  {
    href: "/vendors",
    title: "Assess a vendor",
    detail: "Evidence-backed scorecards, rankings within layer, cited signals.",
  },
  {
    href: "/peers",
    title: "Benchmark my org vs peers",
    detail: "Observable, cited peer AI-adoption signals — are we behind?",
  },
  {
    href: "/",
    title: "Watch the market",
    detail: "Breaking verified news, movers and the dependency graph.",
  },
  {
    href: "/vendors",
    title: "Prep a meeting",
    detail: "Open the vendor you're meeting — the prep kit lives on their profile.",
    note: "members",
  },
];

export default function JobsHub() {
  // Saved benchmark state (the user's segment) — hydrated after mount (SSR-safe).
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
    <section className="mb-8" aria-label="Pick the job you're here to do">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#b08d2f] dark:text-[#d4af37]">
        Pick the job you&apos;re here to do
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {JOBS.map((job) => (
          <Link key={job.title} href={job.href} className={CARD}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold underline-offset-2 group-hover:underline">
                {job.title}
              </h3>
              {job.note && (
                <span className={`shrink-0 rounded-full border border-black/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase dark:border-white/15 ${MUTED}`}>
                  {job.note}
                </span>
              )}
            </div>
            <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{job.detail}</p>
            {job.href === "/peers" && resume && (
              <p className="mt-2 inline-block rounded-full border border-[#d4af37]/50 bg-[#d4af37]/10 px-2 py-0.5 text-[10px] font-medium">
                Resume: {resume}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
