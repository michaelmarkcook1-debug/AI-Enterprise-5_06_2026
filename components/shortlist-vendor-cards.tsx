"use client";

// Shortlisted-vendor cards — shared by Demonstrate and Monitor.
// ─────────────────────────────────────────────────────────────
// Shows the user's assessed shortlist as prominent cards near the top of
// the page. Clicking a card opens a FULL-WIDTH comparison strip below the
// card row (the old in-card expansion stretched its grid row and broke the
// layout) showing the top 3 vendors in that category with the shortlisted
// vendor highlighted.
//
// Shortlist sources, in priority order:
//   1. `initialShortlistIds` (server-derived from ?vendors= URL params)
//   2. sessionStorage "demonstrate_shortlist" written by the Assess
//      results page (same mechanism RestoreShortlistBanner uses)
// When no shortlist exists, renders an explicit empty state pointing at
// Assess — an invisible section read as "broken", so we never render nothing.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export interface ShortlistUniverseVendor {
  id: string;
  name: string;
  category: string;
  score: number;
  confidence: number;
  ownershipType?: string;
}

export default function ShortlistVendorCards({
  universe,
  initialShortlistIds = [],
}: {
  universe: ShortlistUniverseVendor[];
  initialShortlistIds?: string[];
}) {
  const [shortlistIds, setShortlistIds] = useState<string[]>(initialShortlistIds);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (initialShortlistIds.length > 0) return;
    try {
      const raw = sessionStorage.getItem("demonstrate_shortlist");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { vendorIds?: string[] };
      if (Array.isArray(parsed.vendorIds) && parsed.vendorIds.length > 0) {
        setShortlistIds(parsed.vendorIds);
      }
    } catch {
      // private mode / malformed storage — fall through to the empty state
    }
  }, [initialShortlistIds]);

  const byId = useMemo(() => new Map(universe.map((v) => [v.id, v])), [universe]);
  const shortlisted = shortlistIds.map((id) => byId.get(id)).filter((v): v is ShortlistUniverseVendor => Boolean(v));

  const topOfCategory = useMemo(() => {
    const map = new Map<string, ShortlistUniverseVendor[]>();
    for (const v of universe) {
      const list = map.get(v.category) ?? [];
      list.push(v);
      map.set(v.category, list);
    }
    for (const list of map.values()) list.sort((a, b) => b.score - a.score);
    return map;
  }, [universe]);

  const openVendor = expanded ? byId.get(expanded) ?? null : null;
  const openTop3 = openVendor ? (topOfCategory.get(openVendor.category) ?? []).slice(0, 3) : [];

  if (shortlisted.length === 0) {
    return (
      <section className="mb-6">
        <div className="rounded-lg border border-dashed border-[#d6c9a8] bg-[#fdfaf1] px-4 py-3.5 dark:border-[#2a4a6b] dark:bg-[#0c2238]/60">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#a07f1f] dark:text-[#d4af37]">Your assessed shortlist</span>
          <p className="mt-1 text-sm text-[#475a72] dark:text-[#b9c8d9]">
            No shortlist loaded yet. Run an assessment in{" "}
            <Link href="/assess" className="font-semibold text-[#13294b] underline dark:text-[#eef3f8]">Assess</Link>{" "}
            and your shortlisted vendors will appear here with their competitive context.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#a07f1f] dark:text-[#d4af37]">
          Your assessed shortlist
        </h2>
        <span className="text-[10px] text-[#5b6b7f] dark:text-[#8fa5bb]">Select a card to compare against the top 3 in its category</span>
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shortlisted.map((v) => {
          const isOpen = expanded === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setExpanded(isOpen ? null : v.id)}
              aria-expanded={isOpen}
              className={`rounded-lg border bg-[#fffdf7] p-4 text-left transition-colors dark:bg-[#0c2238] ${
                isOpen
                  ? "border-[#b08d2f] shadow-[inset_0_2px_0_#d4af37] dark:border-[#d4af37]"
                  : "border-[#e3d9c0] hover:border-[#b08d2f]/60 dark:border-[#1d3a57] dark:hover:border-[#d4af37]/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-[#13294b] dark:text-[#eef3f8]">{v.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-[#5b6b7f] dark:text-[#a7bacd]">{v.category}</div>
                </div>
                <span aria-hidden className={`mt-1 shrink-0 text-xs text-[#a07f1f] transition-transform dark:text-[#d4af37] ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </div>
              <div className="mt-3 flex items-baseline gap-5 font-mono">
                <span>
                  <span className="text-xl font-semibold text-[#13294b] dark:text-[#eef3f8]">{v.score}</span>
                  <span className="ml-1 text-[10px] uppercase text-[#5b6b7f] dark:text-[#8fa5bb]">score</span>
                </span>
                <span>
                  <span className="text-xl font-semibold text-[#475a72] dark:text-[#a7bacd]">{v.confidence}</span>
                  <span className="ml-1 text-[10px] uppercase text-[#5b6b7f] dark:text-[#8fa5bb]">conf.</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Full-width comparison strip — outside the card grid so expanding never distorts the cards */}
      {openVendor && (
        <div className="mt-3 rounded-lg border border-[#e3d9c0] bg-[#fffdf7] p-4 dark:border-[#1d3a57] dark:bg-[#0c2238]">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a07f1f] dark:text-[#d4af37]">
            Top 3 — {openVendor.category}
          </div>
          <ol className="grid gap-2 md:grid-cols-3">
            {openTop3.map((t, i) => {
              const isPick = t.id === openVendor.id;
              return (
                <li
                  key={t.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    isPick
                      ? "border-[#b08d2f] bg-[#f7f0dc] font-semibold text-[#13294b] dark:border-[#d4af37] dark:bg-[#0e2740] dark:text-[#eef3f8]"
                      : "border-[#efe9d9] text-[#3a4a63] dark:border-[#1d3a57] dark:text-[#c2d1e0]"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    <span className="mr-1.5 font-mono text-[10px] text-[#5b6b7f] dark:text-[#8fa5bb]">{i + 1}.</span>
                    {t.name}
                    {isPick && <span className="ml-1.5 text-[9px] uppercase tracking-wide text-[#a07f1f] dark:text-[#d4af37]">shortlisted</span>}
                  </span>
                  <span className="ml-2 shrink-0 font-mono text-xs">{t.score}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
