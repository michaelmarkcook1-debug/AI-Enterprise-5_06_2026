"use client";

// Restore-shortlist banner.
// ─────────────────────────
// When a user lands on /demonstrate via the top-nav (no ?vendors= URL
// param) but they previously completed an assessment, the results page
// wrote their shortlist + context into sessionStorage under the key
// "demonstrate_shortlist". This banner reads that on mount and offers
// a one-click restore that pushes them to /demonstrate?vendors=...
// pre-filled with the same context the Results CTA would have used.
//
// Renders nothing when:
//   - already on a URL-scoped Demonstrate render (URL has ?vendors)
//   - no shortlist exists in sessionStorage
//   - sessionStorage throws (private mode etc)

import Link from "next/link";
import { useEffect, useState } from "react";

interface StoredShortlist {
  runId: string;
  generatedAt: string;
  vendorIds: string[];
  vendorNames: string[];
  industries: string[];
  useCases: string[];
  region: string;
  dataSensitivity: number;
  costSensitivity: number;
}

function buildUrl(s: StoredShortlist): string {
  const params = new URLSearchParams();
  if (s.vendorIds.length > 0) params.set("vendors", s.vendorIds.join(","));
  if (s.industries.length > 0) params.set("industries", s.industries.join(","));
  if (s.useCases.length > 0) params.set("useCases", s.useCases.join(","));
  if (s.region) params.set("region", s.region);
  if (s.dataSensitivity) params.set("dataSensitivity", `${s.dataSensitivity}/5`);
  if (s.costSensitivity) params.set("costSensitivity", `${s.costSensitivity}/5`);
  return `/demonstrate?${params.toString()}`;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} day(s) ago`;
}

interface Props {
  /** True when the server-rendered page already has a URL-scoped shortlist. */
  hasUrlShortlist: boolean;
}

export default function RestoreShortlistBanner({ hasUrlShortlist }: Props) {
  const [stored, setStored] = useState<StoredShortlist | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (hasUrlShortlist) return;
    try {
      const raw = window.sessionStorage.getItem("demonstrate_shortlist");
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredShortlist;
      if (parsed.vendorIds && parsed.vendorIds.length > 0) {
        setStored(parsed);
      }
    } catch {
      // sessionStorage unavailable; swallow.
    }
  }, [hasUrlShortlist]);

  if (hasUrlShortlist || !stored || dismissed) return null;

  return (
    <div className="mb-6 rounded-2xl border-2 border-emerald-500/60 bg-emerald-50/60 px-5 py-4 dark:border-emerald-500/40 dark:bg-emerald-950/30">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            Restore your last shortlist
          </div>
          <div className="mt-1 text-sm leading-5 text-emerald-900 dark:text-emerald-100">
            Your last assessment ({formatRelative(stored.generatedAt)}) shortlisted{" "}
            <strong>{stored.vendorNames.join(", ")}</strong>
            {stored.industries.length > 0 && (
              <> for <strong>{stored.industries.join(", ")}</strong></>
            )}
            . Scope every panel below to those vendors with one click.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-full px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
          >
            Dismiss
          </button>
          <Link
            href={buildUrl(stored)}
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          >
            Restore shortlist →
          </Link>
        </div>
      </div>
    </div>
  );
}
