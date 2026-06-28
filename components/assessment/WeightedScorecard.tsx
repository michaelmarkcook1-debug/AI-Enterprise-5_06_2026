"use client";

// Phase 3 Assessment — Wave 2 (W2-1): interactive weighted scorecard.
// Sliders adjust the 12 domain weights; the composite, coverage and per-domain
// contributions recompute LIVE, client-side, via computeWeightedComposite —
// pure arithmetic on Wave 1's already-computed scores. NO network call, NO LLM.
// Weights are session-local; they never touch a canonical/stored score.

import { useMemo, useState } from "react";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";
import { ASSESSMENT_DOMAINS, DOMAIN_BAND_TEXT, type DomainScore } from "@/lib/assessment/domain-rubric";
import {
  computeWeightedComposite,
  normalizeWeights,
  DEFAULT_DOMAIN_WEIGHTS,
  type DomainWeights,
} from "@/lib/assessment/composite";
import type { VendorScorecard } from "@/lib/assessment/domain-scores";
import { PILLARS, type DomainId } from "@/lib/types";

const PILLAR_LABEL = Object.fromEntries(PILLARS.map((p) => [p.id, p.label])) as Record<string, string>;

// Slider scale: framework default 0.11 → 11. normalizeWeights() renormalises.
const defaultSliders = (): Record<DomainId, number> =>
  ASSESSMENT_DOMAINS.reduce((acc, d) => {
    acc[d] = Math.round(DEFAULT_DOMAIN_WEIGHTS[d] * 100);
    return acc;
  }, {} as Record<DomainId, number>);

function tone(score: number | null): string {
  if (score == null) return "text-[#7a8aa0] dark:text-[#7a9bb8]";
  if (score >= 4) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 3) return "text-amber-700 dark:text-amber-300";
  if (score >= 2) return "text-[#a07f1f] dark:text-[#d4af37]";
  return "text-rose-700 dark:text-rose-300";
}

function GradeChip({ grade }: { grade: string }) {
  const label = grade === "E5" || grade === "E4" ? "verified" : grade === "E3" ? "tested" : grade === "E2" ? "documented" : "inferred";
  const cls =
    grade === "E5" || grade === "E4"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : grade === "E3"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-[#ece3cb] text-[#3f5068] dark:bg-[#143049] dark:text-[#a7bacd]";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{grade} {label}</span>;
}

export default function WeightedScorecard({ scorecard }: { scorecard: VendorScorecard }) {
  const [sliders, setSliders] = useState<Record<DomainId, number>>(defaultSliders);

  const byDomain = useMemo(
    () => new Map<DomainId, DomainScore>(scorecard.domains.map((d) => [d.domain, d])),
    [scorecard.domains],
  );

  const result = useMemo(() => computeWeightedComposite(scorecard.domains, sliders as DomainWeights), [scorecard.domains, sliders]);
  const norm = useMemo(() => normalizeWeights(sliders as DomainWeights), [sliders]);

  const isDefault = ASSESSMENT_DOMAINS.every((d) => sliders[d] === Math.round(DEFAULT_DOMAIN_WEIGHTS[d] * 100));

  return (
    <div>
      <p className="mb-3 text-xs leading-5 text-[#5e6b7e] dark:text-[#a7bacd]">
        Weight the 12 domains to <strong>your</strong> priorities — the composite and coverage recompute live from
        reviewed, source-backed evidence. A domain only reaches 4–5 with audit-grade (E4/E5) evidence; domains with no
        reviewed evidence stay <strong>“insufficient evidence”</strong> and contribute 0 — re-weighting can’t conjure a
        score or hide thin coverage. Draft assessment — pressure-test against the cited sources.
      </p>

      {/* Live composite headline */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-[#d4af37]/50 bg-[#fbf6e4]/60 px-4 py-3 dark:border-[#d4af37]/40 dark:bg-[#1a1605]/30">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#a07f1f] dark:text-[#d4af37]">
            Your weighted composite
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums text-[#13294b] dark:text-[#eef3f8]">
            {result.composite.toFixed(2)}<span className="text-sm text-[#7a8aa0]">/5</span>
          </div>
        </div>
        <div className="text-xs text-[#3f5068] dark:text-[#a7bacd]">
          <div>Coverage {Math.round(result.coverage * 100)}%</div>
          <div>Confidence {result.confidence}%</div>
          <div>{result.scoredCount}/12 domains evidenced · {result.insufficientCount} insufficient</div>
        </div>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => setSliders(defaultSliders())}
          className="ml-auto rounded-full border border-[#d6c9a8] px-3 py-1 text-xs font-medium text-[#4c5d75] hover:bg-white disabled:opacity-40 dark:border-[#2a4a6b] dark:text-[#a7bacd] dark:hover:bg-[#0c2238]"
        >
          Reset to framework default
        </button>
      </div>

      {/* Per-domain rows: weight slider + live contribution + citations */}
      <div>
        {ASSESSMENT_DOMAINS.map((domain) => {
          const d = byDomain.get(domain);
          const c = result.contributions.find((x) => x.domain === domain)!;
          const weightPct = Math.round(norm[domain] * 100);
          const scored = d && d.state === "scored";
          return (
            <div key={domain} className="border-t border-[#ece4d0] py-3 dark:border-[#1d3a57]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#13294b] dark:text-[#eef3f8]">{DOMAIN_LABEL[domain]}</div>
                  <div className="text-[10px] uppercase tracking-wide text-[#7a8aa0] dark:text-[#7a9bb8]">
                    {PILLAR_LABEL[c.pillar] ?? c.pillar}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {scored ? (
                    <div className="text-right">
                      <div className={`font-mono text-lg font-semibold tabular-nums ${tone(d!.state === "scored" ? d!.score : null)}`}>
                        {d!.state === "scored" ? d!.score.toFixed(1) : "—"}<span className="text-xs text-[#7a8aa0]">/5</span>
                      </div>
                      <div className="text-[11px] text-[#5e6b7e] dark:text-[#a7bacd]">
                        {d!.state === "scored" ? DOMAIN_BAND_TEXT[d!.bandLabel] : ""}
                      </div>
                    </div>
                  ) : (
                    <span className="rounded-full border border-[#d6c9a8] bg-[#f6f1e3] px-2 py-0.5 text-[11px] font-semibold text-[#5e6b7e] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#a7bacd]">
                      Insufficient evidence
                    </span>
                  )}
                  {scored && d!.state === "scored" && <GradeChip grade={d!.bestGrade} />}
                </div>
              </div>

              {/* weight slider */}
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={sliders[domain]}
                  onChange={(e) => setSliders((s) => ({ ...s, [domain]: Number(e.target.value) }))}
                  className="h-1 flex-1 cursor-pointer accent-[#b08d2f] dark:accent-[#d4af37]"
                  aria-label={`Weight for ${DOMAIN_LABEL[domain]}`}
                />
                <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-[#3f5068] dark:text-[#a7bacd]">
                  {weightPct}%
                </span>
                <span className="w-24 shrink-0 text-right text-[11px] text-[#7a8aa0] dark:text-[#7a9bb8]">
                  {c.contribution != null ? `+${c.contribution.toFixed(2)}` : "contributes 0"}
                </span>
              </div>

              {/* confidence + citations */}
              {scored && d!.state === "scored" && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[#5e6b7e] dark:text-[#a7bacd]">
                  <span>Confidence {d!.confidence}%</span>
                  {d!.lowConfidence && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      Low confidence
                    </span>
                  )}
                  <span>· {d!.evidenceCount} reviewed {d!.evidenceCount === 1 ? "source" : "sources"}</span>
                  {d!.citations.length > 0 && (
                    <details className="w-full">
                      <summary className="cursor-pointer select-none font-medium text-[#4c5d75] hover:text-[#13294b] dark:text-[#7a9bb8] dark:hover:text-[#eef3f8]">
                        ▸ {d!.citations.length} {d!.citations.length === 1 ? "citation" : "citations"}
                      </summary>
                      <ul className="mt-1 space-y-1 pl-3">
                        {d!.citations.map((cit) => (
                          <li key={cit.sourceUrl} className="flex items-center gap-2">
                            <GradeChip grade={cit.evidenceGrade} />
                            <a href={cit.sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate text-sky-700 hover:underline dark:text-sky-400">
                              {cit.sourceUrl}
                            </a>
                            <span className="shrink-0 text-[#7a8aa0]">{cit.capturedAt.slice(0, 10)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
