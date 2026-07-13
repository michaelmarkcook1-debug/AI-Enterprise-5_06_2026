/**
 * Global "data is not live" banner.
 *
 * Server component that calls getDataProvenance() at request time and renders
 * a bold red strip directly under the TopNav whenever the portal is operating
 * on seed/typed-module data instead of reviewed, source-backed evidence.
 *
 * Purpose: every executive who lands on any page must see, in red, that the
 * numbers in front of them are not live, AND be told exactly what to do to
 * make them live. No silent seed-data demos.
 *
 * Hidden when source === "live". On error (DB unreachable) it still renders
 * — better to over-communicate the seed state than silently mislead.
 */

import Link from "next/link";
import { getDataProvenance } from "@/lib/intelligence/provenance";

export default async function NotLiveBanner() {
  const provenance = await getDataProvenance();
  if (provenance.source === "live") return null;

  return (
    <div
      role="alert"
      className="border-b-4 border-rose-600 bg-rose-50 px-4 py-2.5 text-rose-900 shadow-sm dark:border-rose-500 dark:bg-rose-950/70 dark:text-rose-100"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs leading-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-rose-600 text-xs font-extrabold text-white"
          >
            !
          </span>
          <span className="font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
            Not live
          </span>
          <span className="font-semibold">
            Portal is rendering from typed seed data — every figure on this page is illustrative until live ingestion lands.
          </span>
          <span className="text-rose-800/85 dark:text-rose-200/85">
            Reason: {provenance.reason}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-semibold">
          <span className="rounded-full border border-rose-300 bg-white/70 px-2 py-0.5 text-xs uppercase tracking-wide dark:border-rose-700 dark:bg-rose-950/40">
            Reviewed evidence: <span className="font-extrabold tabular-nums">{provenance.evidenceCount}</span>
          </span>
          <span className="rounded-full border border-rose-300 bg-white/70 px-2 py-0.5 text-xs uppercase tracking-wide dark:border-rose-700 dark:bg-rose-950/40">
            Approved proposals: <span className="font-extrabold tabular-nums">{provenance.approvedProposalCount}</span>
          </span>
          <Link
            href="/admin/ingestion"
            className="rounded-md bg-rose-700 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500"
          >
            Run ingestion →
          </Link>
          <Link
            href="/admin/evidence"
            className="rounded-md border border-rose-700 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-100 dark:border-rose-400 dark:bg-transparent dark:text-rose-200 dark:hover:bg-rose-900/40"
          >
            Approve evidence →
          </Link>
        </div>
      </div>
    </div>
  );
}
