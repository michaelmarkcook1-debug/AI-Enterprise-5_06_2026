"use client";

// Shortlisted-vendor cards — shared by Demonstrate and Monitor.
// ─────────────────────────────────────────────────────────────
// Shows the user's assessed shortlist as prominent cards near the top of
// the page. Clicking a card expands it to show the top 3 vendors in that
// vendor's category (by overall score), with the shortlisted vendor
// highlighted, so the reader can see the pick in its competitive context.
//
// Shortlist sources, in priority order:
//   1. `initialShortlistIds` (server-derived from ?vendors= URL params)
//   2. sessionStorage "demonstrate_shortlist" written by the Assess
//      results page (same mechanism RestoreShortlistBanner uses)
// Renders nothing when no shortlist exists from either source.

import { useEffect, useMemo, useState } from "react";

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
      // private mode / malformed storage — show nothing rather than guess
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

  if (shortlisted.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#697362] dark:text-zinc-500">
          Your assessed shortlist
        </h2>
        <span className="text-[10px] text-[#697362] dark:text-zinc-500">Tap a card to compare against the top 3 in its category</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {shortlisted.map((v) => {
          const isOpen = expanded === v.id;
          const top3 = (topOfCategory.get(v.category) ?? []).slice(0, 3);
          return (
            <button
              key={v.id}
              onClick={() => setExpanded(isOpen ? null : v.id)}
              aria-expanded={isOpen}
              className={`rounded-xl border bg-white p-4 text-left transition-colors dark:bg-zinc-900 ${
                isOpen
                  ? "border-emerald-400 dark:border-emerald-600"
                  : "border-[#dfe4da] hover:border-emerald-300 dark:border-zinc-800 dark:hover:border-emerald-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold text-[#18201b] dark:text-zinc-100">{v.name}</div>
                  <div className="mt-0.5 text-[11px] text-[#697362] dark:text-zinc-400">{v.category}</div>
                </div>
                <span aria-hidden className={`mt-1 text-xs text-[#697362] transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </div>
              <div className="mt-3 flex items-baseline gap-4 font-mono">
                <span>
                  <span className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">{v.score}</span>
                  <span className="ml-1 text-[10px] uppercase text-[#697362]">score</span>
                </span>
                <span>
                  <span className="text-xl font-semibold text-[#18201b] dark:text-zinc-100">{v.confidence}</span>
                  <span className="ml-1 text-[10px] uppercase text-[#697362]">conf.</span>
                </span>
              </div>
              {isOpen && (
                <div className="mt-3 border-t border-[#edf0ea] pt-3 dark:border-zinc-800">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#697362] dark:text-zinc-500">
                    Top 3 — {v.category}
                  </div>
                  <ol className="space-y-1">
                    {top3.map((t, i) => (
                      <li
                        key={t.id}
                        className={`flex items-center justify-between rounded-md px-2 py-1 text-sm ${
                          t.id === v.id
                            ? "bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "text-[#3c463b] dark:text-zinc-300"
                        }`}
                      >
                        <span>
                          <span className="mr-1.5 font-mono text-[10px] text-[#697362]">{i + 1}.</span>
                          {t.name}
                          {t.id === v.id && <span className="ml-1.5 text-[9px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">shortlisted</span>}
                        </span>
                        <span className="font-mono text-xs">{t.score}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
