"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DisclosedAdopter } from "@/lib/peer/adopters";
import { VERTICALS, SIZE_BANDS, REGIONS, type Segment } from "@/lib/peer/segments";

// "Disclosed enterprise adopters" — the demand side of a vendor's assessment.
// Curated, cited reference data with its provenance label, in the same class as
// Implementation partners: it renders regardless of the score gating and has no
// path into scores. `adopters` is unchanged — still computed server-side exactly
// as before; this is a client component ONLY so it can read the visitor's own
// segment (vertical/size/region) preference and sort/badge the SAME list by it.
//
// That preference is the SAME explicit, voluntary choice the /peers Cohort
// Explorer already persists to localStorage under "ae_peer_segment" — reused
// here rather than invented. HONESTY: unlike Cohort Explorer, this panel does
// NOT fall back to a default segment (financial services / global enterprise /
// NA) when nothing is stored — that would silently assert a fact about the
// visitor nobody gave us. No stored preference reads as an explicit "we don't
// know your segment yet," not an optimistic default.

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";
const SEGMENT_KEY = "ae_peer_segment";

const VERTICAL_LABEL = new Map<string, string>(VERTICALS.map((v) => [v.id, v.label]));
const SIZE_LABEL = new Map<string, string>(SIZE_BANDS.map((b) => [b.id, b.label]));

function readStoredSegment(): Segment | null {
  try {
    const raw = window.localStorage.getItem(SEGMENT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Segment;
    const valid =
      VERTICALS.some((v) => v.id === s.vertical) &&
      SIZE_BANDS.some((b) => b.id === s.sizeBand) &&
      REGIONS.some((r) => r.id === s.region);
    return valid ? s : null;
  } catch {
    return null; // a corrupt/blocked store is an honest "don't know", never an error
  }
}

/** Industry-usage rollup — a straight group-by-count over the SAME cited
 *  adopter list rendered below, no new data or fetch. Deliberately thin: the
 *  peer-AI benchmark currently covers a small curated company set, so this
 *  reads as a real-but-sparse signal, never a market-wide claim. */
function industryBreakdown(adopters: DisclosedAdopter[]): { industry: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of adopters) {
    counts.set(a.company.industry, (counts.get(a.company.industry) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count || a.industry.localeCompare(b.industry));
}

export default function DisclosedAdoptersPanel({
  vendorName,
  adopters,
}: {
  vendorName: string;
  adopters: DisclosedAdopter[];
}) {
  const [mySegment, setMySegment] = useState<Segment | null>(null);
  useEffect(() => {
    setMySegment(readStoredSegment());
  }, []);

  // Presentation-only reorder — never changes which peers are shown, only their
  // order + badges. Same-vertical-and-size first, same-vertical next, everyone
  // else keeps the original (dataset) order — a stable sort within each tier.
  const sorted = useMemo(() => {
    if (!mySegment) return adopters;
    const tier = (a: DisclosedAdopter) => {
      const seg = a.company.segment;
      if (!seg) return 2;
      const sameVertical = seg.vertical === mySegment.vertical;
      const sameSize = seg.sizeBand === mySegment.sizeBand;
      if (sameVertical && sameSize) return 0;
      if (sameVertical) return 1;
      return 2;
    };
    return adopters
      .map((a, i) => ({ a, i, t: tier(a) }))
      .sort((x, y) => x.t - y.t || x.i - y.i)
      .map(({ a }) => a);
  }, [adopters, mySegment]);

  if (adopters.length === 0) return null;
  const byIndustry = industryBreakdown(adopters);
  const verticalLabel = mySegment ? (VERTICAL_LABEL.get(mySegment.vertical) ?? mySegment.vertical) : null;
  const sizeLabel = mySegment ? (SIZE_LABEL.get(mySegment.sizeBand) ?? mySegment.sizeBand) : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className={`text-xs ${MUTED}`}>
          Enterprises that have publicly disclosed adopting {vendorName} — from the cited
          peer-AI benchmark. Disclosure only: absence here never means non-use.
        </p>
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Analyst-curated
        </span>
      </div>
      {mySegment && (
        <p className={`mb-2 text-xs ${MUTED}`}>
          Sorted to your segment — {verticalLabel} · {sizeLabel}.{" "}
          <Link href="/peers" className="underline underline-offset-2">
            Change
          </Link>
        </p>
      )}
      {byIndustry.length > 1 && (
        <p className={`mb-2 text-xs ${MUTED}`}>
          By industry (disclosed count): {byIndustry.map((b) => `${b.industry} (${b.count})`).join(" · ")}
        </p>
      )}
      <ul className="space-y-3">
        {sorted.map((a) => {
          const seg = a.company.segment;
          const sameVertical = !!mySegment && !!seg && seg.vertical === mySegment.vertical;
          const sameSize = !!mySegment && !!seg && seg.sizeBand === mySegment.sizeBand;
          return (
            <li key={a.company.id} className="rounded-lg border border-black/5 p-3 dark:border-white/10">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{a.company.name}</span>
                <div className="flex items-center gap-1.5">
                  {sameVertical && (
                    <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                      {sameSize ? "Same industry · size" : "Same industry"}
                    </span>
                  )}
                  <span className={`text-xs ${MUTED}`}>{a.company.industry}</span>
                </div>
              </div>
              {a.summary && <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{a.summary}</p>}
              <ul className={`mt-1.5 space-y-0.5 text-xs ${MUTED}`}>
                {a.citations.map((c) => (
                  <li key={c.url}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-[#123d2c] dark:hover:text-[#eef3f8]"
                    >
                      {c.title}
                    </a>{" "}
                    — {c.publisher}
                  </li>
                ))}
              </ul>
              {a.citations.length === 0 && a.citationStatus === "pending_enrichment" && (
                <p className="mt-1.5 text-xs italic text-amber-700 dark:text-amber-300">
                  Fact is real and rubric-computed from named public reporting — sources being linked.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className={`mt-2 text-xs ${MUTED}`}>
        {mySegment ? (
          <Link href="/peers" className="underline underline-offset-2">
            Benchmark your organisation against these peers →
          </Link>
        ) : (
          <Link href="/peers" className="underline underline-offset-2">
            Tell us your industry &amp; size on Peers — it sorts your closest peers here too →
          </Link>
        )}
      </p>
    </div>
  );
}
