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
import InterrogatePanel, { type InterrogateConfig } from "@/components/assessment/InterrogatePanel";
import GradeChip from "@/components/assessment/GradeChip";
import { BulletGraph, ConfidenceVeil } from "@/components/instrument";

const PILLAR_LABEL = Object.fromEntries(PILLARS.map((p) => [p.id, p.label])) as Record<string, string>;

// The audit-grade line — a domain only reaches 4–5 with E4/E5 evidence, so the
// bullet tick at 4.0 separates proven strength from directional signal per domain.
const AUDIT_GRADE_LINE = 4;

// Slider scale: framework default 0.11 → 11. normalizeWeights() renormalises.
const defaultSliders = (): Record<DomainId, number> =>
  ASSESSMENT_DOMAINS.reduce((acc, d) => {
    acc[d] = Math.round(DEFAULT_DOMAIN_WEIGHTS[d] * 100);
    return acc;
  }, {} as Record<DomainId, number>);

export default function WeightedScorecard({
  scorecard,
  interrogate,
  vendorCategoryId,
}: {
  scorecard: VendorScorecard;
  /** Wave-3: when present + enabled, renders the member-gated Interrogate panel
   *  whose context re-run drives these same sliders. Absent → Wave-2 behaviour. */
  interrogate?: InterrogateConfig;
  /** Prompt 4: the vendor's own ranked-category id, so vendor-scoped
   *  Interrogate can also offer "save as decision" (previously category-scope
   *  only — see InterrogatePanel's vendorCategoryId prop). */
  vendorCategoryId?: string;
}) {
  const [sliders, setSliders] = useState<Record<DomainId, number>>(defaultSliders);

  const byDomain = useMemo(
    () => new Map<DomainId, DomainScore>(scorecard.domains.map((d) => [d.domain, d])),
    [scorecard.domains],
  );

  const result = useMemo(() => computeWeightedComposite(scorecard.domains, sliders as DomainWeights), [scorecard.domains, sliders]);
  const norm = useMemo(() => normalizeWeights(sliders as DomainWeights), [sliders]);
  const lowConfidenceCount = useMemo(
    () => scorecard.domains.filter((d) => d.state === "scored" && d.lowConfidence).length,
    [scorecard.domains],
  );

  const isDefault = ASSESSMENT_DOMAINS.every((d) => sliders[d] === Math.round(DEFAULT_DOMAIN_WEIGHTS[d] * 100));

  return (
    <div>
      {interrogate && (
        <InterrogatePanel
          config={interrogate}
          activeDomains={ASSESSMENT_DOMAINS}
          onApplyLens={(next) => setSliders((s) => ({ ...s, ...next }))}
          currentSliders={sliders}
          vendorCategoryId={vendorCategoryId}
          asOfDate={null}
        />
      )}
      <p className="mb-3 text-xs leading-5 text-[#5e6b7e] dark:text-[#a7bacd]">
        Weight the 12 domains to <strong>your</strong> priorities — the composite and coverage recompute live from
        reviewed, source-backed evidence. A domain only reaches 4–5 with audit-grade (E4/E5) evidence; domains with no
        reviewed evidence stay <strong>“insufficient evidence”</strong> and contribute 0 — re-weighting can’t conjure a
        score or hide thin coverage. Draft assessment — pressure-test against the cited sources.
      </p>

      {/* Legend for the per-domain bullet: gold bar = 0–5 score, ink tick = audit-grade line (4.0). */}
      <div className="mb-4 flex items-center gap-2 text-[10px] text-[#7a8aa0] dark:text-[#7a9bb8]">
        <span className="relative inline-block h-3.5 w-9 shrink-0 overflow-hidden rounded-sm bg-[#e9e0c9] align-middle dark:bg-[#102135]">
          <span className="absolute bottom-[2px] left-0 top-[2px] w-5 rounded-sm bg-[#b08d2f] dark:bg-[#e8c95c]" />
          <span className="absolute bottom-0 left-[80%] top-0 w-[2px] bg-[#13294b] opacity-70 dark:bg-[#eef3f8]" />
        </span>
        Bar = 0–5 score · the ink tick marks the{" "}
        <strong className="font-semibold text-[#5e6b7e] dark:text-[#a7bacd]">audit-grade line (4.0)</strong> — only
        E4/E5 evidence clears it. Faded + hatched = low confidence.
      </div>

      {/* Live composite headline */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-[#d4af37]/50 bg-[#fbf6e4]/60 px-4 py-3 dark:border-[#d4af37]/40 dark:bg-[#1a1605]/30">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#a07f1f] dark:text-[#d4af37]">
            Your weighted composite — global view
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums text-[#13294b] dark:text-[#eef3f8]">
            {result.composite.toFixed(2)}<span className="text-sm text-[#7a8aa0]">/5</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#7a8aa0]">
            Category-agnostic (12 domains) — category-specific standing below can differ
          </div>
        </div>
        <div className="text-xs text-[#3f5068] dark:text-[#a7bacd]">
          <div>Coverage {Math.round(result.rawCoverage * 100)}%</div>
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

      {/* W2-2 — show the working: an honest, deterministic trace of what the rubric
          actually did. Every figure is real (counts from the Wave-1 rubric output +
          your weights); no fabricated steps, no fake timing. The composite/coverage
          terms update live as you re-weight. The honest answer to "why so fast?" —
          it's a rubric, and this is the rubric. */}
      <div className="mb-4 rounded-lg border border-[#e3d9c0] bg-white/60 px-3 py-2 text-[11px] leading-5 text-[#3f5068] dark:border-[#1d3a57] dark:bg-[#0c2238]/40 dark:text-[#a7bacd]">
        <span className="font-semibold uppercase tracking-wide text-[#7a8aa0] dark:text-[#7a9bb8]">How this was computed</span>{" "}
        <span className="font-semibold text-[#13294b] dark:text-[#eef3f8]">{scorecard.totalEvidenceRows.toLocaleString()}</span> reviewed,
        source-backed records →{" "}
        <span className="font-semibold text-[#13294b] dark:text-[#eef3f8]">{result.scoredCount}/12 domains</span> scored from cited
        evidence (best grade caps each band) → <span className="font-semibold text-[#13294b] dark:text-[#eef3f8]">your weights</span> applied →
        composite <span className="font-semibold text-[#13294b] dark:text-[#eef3f8]">{result.composite.toFixed(2)}/5</span> at{" "}
        <span className="font-semibold text-[#13294b] dark:text-[#eef3f8]">{Math.round(result.rawCoverage * 100)}%</span> coverage →{" "}
        <span className="font-semibold text-[#13294b] dark:text-[#eef3f8]">{lowConfidenceCount}</span> low-confidence,{" "}
        <span className="font-semibold text-[#13294b] dark:text-[#eef3f8]">{result.insufficientCount}</span> insufficient-evidence.{" "}
        Deterministic — no model call.
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
                    // Neutral ink number (no red↔green) — certainty carried by the veil, not hue.
                    <ConfidenceVeil confidence={d!.state === "scored" ? d!.confidence : null} label={`${DOMAIN_LABEL[domain]} score`} as="div" className="text-right">
                      <div className="font-mono text-lg font-semibold tabular-nums text-[#13294b] dark:text-[#eef3f8]">
                        {d!.state === "scored" ? d!.score.toFixed(1) : "—"}<span className="text-xs text-[#7a8aa0]">/5</span>
                      </div>
                      <div className="text-[11px] text-[#5e6b7e] dark:text-[#a7bacd]">
                        {d!.state === "scored" ? DOMAIN_BAND_TEXT[d!.bandLabel] : ""}
                      </div>
                    </ConfidenceVeil>
                  ) : (
                    <span className="rounded-full border border-[#d6c9a8] bg-[#f6f1e3] px-2 py-0.5 text-[11px] font-semibold text-[#5e6b7e] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#a7bacd]">
                      Insufficient evidence
                    </span>
                  )}
                  {scored && d!.state === "scored" && <GradeChip grade={d!.bestGrade} />}
                </div>
              </div>

              {/* Evidence-Instrument bullet — same gold bar + audit-grade tick (4.0) as the
                  read-only scorecard, so re-weighting never changes how a score *looks*. */}
              <div className="mt-2">
                <BulletGraph
                  value={d && d.state === "scored" ? d.score : null}
                  max={5}
                  benchmark={AUDIT_GRADE_LINE}
                  lowConfidence={!!d && d.state === "scored" && d.lowConfidence}
                  label={DOMAIN_LABEL[domain]}
                />
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
