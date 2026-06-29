"use client";

// Phase 3 Assessment — Wave 2 (W2-1): live within-category re-rank.
// One shared set of domain weights re-orders every vendor in the category by
// their weighted 0–5 composite — pure client-side arithmetic on Wave 1's
// per-domain scores. NO network, NO LLM. Vendors below the coverage floor stay
// HELD (you can't re-weight your way out of thin coverage). The server still
// SSRs the canonical pillar ranking above this; this is the personal-lens view.

import { useMemo, useState } from "react";
import Link from "next/link";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";
import { type DomainScore } from "@/lib/assessment/domain-rubric";
import {
  rankVendorsByComposite,
  computeGap,
  normalizeWeights,
  activeDomains,
  DEFAULT_DOMAIN_WEIGHTS,
  ASSESSMENT_COVERAGE_FLOOR,
  type DomainWeights,
} from "@/lib/assessment/composite";
import type { DomainId } from "@/lib/types";

export interface RerankVendor {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  domains: DomainScore[];
}

// Percent-scaled slider seed from a resolved weight profile, over that profile's
// ACTIVE domains only (default categories = the 12; frontier = 13 incl model_quality).
const slidersFromWeights = (weights: DomainWeights): Record<DomainId, number> =>
  activeDomains(weights).reduce((acc, d) => {
    acc[d] = Math.round((weights[d] ?? 0) * 100);
    return acc;
  }, {} as Record<DomainId, number>);

export default function CategoryRerank({
  vendors,
  defaultWeights = DEFAULT_DOMAIN_WEIGHTS,
}: {
  vendors: RerankVendor[];
  /** The per-category resolved default weights (the SAME ones the static ranking
   *  used) — so the untouched re-rank reproduces the static order, and Reset
   *  returns to this category's default, not the framework default. */
  defaultWeights?: DomainWeights;
}) {
  // The category's active domains, in canonical order — what the sliders render.
  const domainList = useMemo(() => activeDomains(defaultWeights), [defaultWeights]);
  const defaultSliders = useMemo(() => slidersFromWeights(defaultWeights), [defaultWeights]);
  const [sliders, setSliders] = useState<Record<DomainId, number>>(defaultSliders);
  const norm = useMemo(() => normalizeWeights(sliders as DomainWeights), [sliders]);
  const isDefault = domainList.every((d) => sliders[d] === defaultSliders[d]);

  const computed = useMemo(() => {
    // Single source of ranking truth — the SAME function the static category
    // ranking calls. At default weights this reproduces the static order exactly
    // (parity by construction); RAW coverage gates eligibility (can't re-weight
    // out of thin coverage). Merge the ranker output back with name/slug/domains.
    const byId = new Map(vendors.map((v) => [v.vendorId, v]));
    const ordered = rankVendorsByComposite(vendors, sliders as DomainWeights);
    const enrich = (r: { vendorId: string; composite: number; coverage: number; confidence: number }) => {
      const v = byId.get(r.vendorId)!;
      return { ...v, composite: r.composite, coverage: r.coverage, confidence: r.confidence };
    };
    return {
      ranked: ordered.filter((r) => r.ranked).map(enrich),
      held: ordered.filter((r) => !r.ranked).map(enrich),
    };
  }, [vendors, sliders]);

  return (
    <div className="rounded-xl border border-[#d4af37]/50 bg-[#fbf6e4]/50 p-4 dark:border-[#d4af37]/40 dark:bg-[#1a1605]/30">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Assessment re-rank — your weights</h2>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => setSliders(defaultSliders)}
          className="rounded-full border border-[#d6c9a8] px-3 py-1 text-xs font-medium text-[#4c5d75] hover:bg-white disabled:opacity-40 dark:border-[#2a4a6b] dark:text-[#a7bacd] dark:hover:bg-[#0c2238]"
        >
          Reset to framework default
        </button>
      </div>
      <p className="mt-1 text-xs text-[#5e6b7e] dark:text-[#a7bacd]">
        Weight the 12 domains to your priorities; vendors re-order live by their weighted 0–5 composite from reviewed,
        source-backed evidence. Vendors below {Math.round(ASSESSMENT_COVERAGE_FLOOR * 100)}% domain coverage are held —
        re-weighting can’t mask thin evidence. Draft — pressure-test the sources on each profile.
      </p>

      {/* compact weight sliders */}
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {domainList.map((d) => (
          <label key={d} className="flex items-center gap-2 text-[11px]">
            <span className="w-44 shrink-0 truncate text-[#3f5068] dark:text-[#a7bacd]" title={DOMAIN_LABEL[d]}>
              {DOMAIN_LABEL[d]}
            </span>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={sliders[d]}
              onChange={(e) => setSliders((s) => ({ ...s, [d]: Number(e.target.value) }))}
              className="h-1 flex-1 cursor-pointer accent-[#b08d2f] dark:accent-[#d4af37]"
              aria-label={`Weight for ${DOMAIN_LABEL[d]}`}
            />
            <span className="w-9 shrink-0 text-right font-mono tabular-nums text-[#7a8aa0]">{Math.round(norm[d] * 100)}%</span>
          </label>
        ))}
      </div>

      {/* live ranking + W2-3 "why above the next" deterministic explainer */}
      <ol className="mt-4 divide-y divide-black/5 dark:divide-white/10">
        {computed.ranked.map((v, i) => {
          const next = computed.ranked[i + 1];
          // Deterministic gap vs the next-ranked vendor under the CURRENT weights —
          // recomputes whenever sliders change. Top domains where this vendor leads.
          const gap = next ? computeGap(v.domains, next.domains, sliders as DomainWeights) : null;
          const drivers = gap ? gap.drivers.filter((d) => d.weightedDelta > 0.001).slice(0, 3) : [];
          return (
            <li key={v.vendorId} className="py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="font-mono tabular-nums text-[#b08d2f] dark:text-[#d4af37]">#{i + 1}</span>
                  <Link href={`/vendors/${v.vendorSlug}`} className="truncate font-medium underline-offset-2 hover:underline">
                    {v.vendorName}
                  </Link>
                </span>
                <span className="flex shrink-0 items-baseline gap-3 text-xs">
                  <span className="font-mono tabular-nums text-[#13294b] dark:text-[#eef3f8]">
                    {v.composite.toFixed(2)}<span className="ml-0.5 text-[10px] text-[#7a8aa0]">/5</span>
                  </span>
                  <span className="font-mono tabular-nums text-[#7a8aa0]">{Math.round(v.coverage * 100)}% cov</span>
                </span>
              </div>
              {next && gap && (
                <details className="mt-0.5">
                  <summary className="cursor-pointer select-none text-[10px] text-[#7a8aa0] hover:text-[#13294b] dark:hover:text-[#eef3f8]">
                    ▸ why above {next.vendorName} (+{gap.compositeDelta.toFixed(2)})
                  </summary>
                  {drivers.length === 0 ? (
                    <p className="mt-1 pl-3 text-[11px] text-[#7a8aa0]">
                      Effectively tied at your current weights — re-weight to separate them. (Draft — interrogate the cited evidence.)
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1 pl-3 text-[11px] text-[#5e6b7e] dark:text-[#a7bacd]">
                      {drivers.map((d) => (
                        <li key={d.domain} className="flex flex-wrap items-center gap-x-1.5">
                          <span className="font-medium text-[#13294b] dark:text-[#eef3f8]">{DOMAIN_LABEL[d.domain]}</span>
                          {d.note === "leader_only" ? (
                            <span>— {v.vendorName} has reviewed evidence here ({d.leaderScore?.toFixed(1)}/5); {next.vendorName} does not</span>
                          ) : (
                            <span>{d.leaderScore?.toFixed(1)} vs {d.runnerScore?.toFixed(1)}/5</span>
                          )}
                          {d.citation && (
                            <a href={d.citation.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline dark:text-sky-400">
                              ({d.citation.evidenceGrade} · source)
                            </a>
                          )}
                        </li>
                      ))}
                      <li className="text-[10px] italic text-[#7a8aa0]">Draft — a decomposition of the gap, not a verdict. Interrogate the cited evidence.</li>
                    </ul>
                  )}
                </details>
              )}
            </li>
          );
        })}
      </ol>

      {computed.held.length > 0 && (
        <div className="mt-3 border-t border-black/5 pt-2 dark:border-white/10">
          <div className="text-[11px] font-semibold text-[#5e6b7e] dark:text-[#a7bacd]">
            Held — insufficient domain coverage ({computed.held.length})
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#7a8aa0]">
            {computed.held.map((v) => (
              <Link key={v.vendorId} href={`/vendors/${v.vendorSlug}`} className="underline-offset-2 hover:underline">
                {v.vendorName} ({Math.round(v.coverage * 100)}%)
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
