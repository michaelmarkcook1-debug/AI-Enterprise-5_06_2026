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
import { getPeerById } from "@/lib/peer/heatmap";

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";
const CARD =
  "group block rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4 transition-colors hover:border-[#d4af37]/60";

const ORG_KEY = "ae_peer_primary_org";
const SCOPE_KEY = "ae_peer_scope";

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
  // Saved benchmark state — hydrated after mount (SSR-safe).
  const [resume, setResume] = useState<{ orgName: string; peers: number } | null>(null);

  useEffect(() => {
    try {
      const org = window.localStorage.getItem(ORG_KEY);
      const scopeRaw = window.localStorage.getItem(SCOPE_KEY);
      const peers = scopeRaw ? (JSON.parse(scopeRaw) as string[]).length : 0;
      const company = org ? getPeerById(org) : undefined;
      if (company) setResume({ orgName: company.name, peers });
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
                Resume: {resume.orgName} vs {Math.max(0, resume.peers - 1)} peers
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
