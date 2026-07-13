// Phase 3 Assessment — the 12-domain evidence scorecard (Wave 1).
// Server component, no client JS (native <details> for citations). Renders one
// row per framework domain: a 0–5 score by evidence standard, or an explicit
// "insufficient evidence" state — never a guessed number. Every scored domain
// links to the source URLs behind it.
import { PILLARS } from "@/lib/types";
import { EvidenceBadge, lowEvidenceClass } from "@/components/intelligence-ui";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";
import { DOMAIN_BAND_TEXT, type DomainScore } from "@/lib/assessment/domain-rubric";
import type { VendorScorecard } from "@/lib/assessment/domain-scores";
import { BulletGraph, ConfidenceVeil } from "@/components/instrument";

const PILLAR_LABEL = Object.fromEntries(PILLARS.map((p) => [p.id, p.label])) as Record<string, string>;

// Bullet benchmark: the audit-grade line. The rubric only lets a domain reach
// 4–5 with audit-grade (E4/E5) evidence, so a tick at 4.0 tells a buyer, per
// domain, whether this vendor has *proven* strength or merely directional
// evidence — the platform's evidence-first thesis made scannable, no new data.
const AUDIT_GRADE_LINE = 4;

function ScoreRow({ d }: { d: DomainScore }) {
  const name = DOMAIN_LABEL[d.domain];
  const pillar = PILLAR_LABEL[d.pillar] ?? d.pillar;

  if (d.state === "insufficient_evidence") {
    return (
      <div className="flex flex-col gap-1.5 border-t border-[#ece4d0] py-3 dark:border-[#1d3a57]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-[#13294b] dark:text-[#eef3f8]">{name}</div>
            <div className="text-[10px] uppercase tracking-wide text-[#7a8aa0] dark:text-[#7a9bb8]">{pillar}</div>
          </div>
          <span className="inline-flex w-fit rounded-full border border-[#d6c9a8] bg-[#f6f1e3] px-2 py-0.5 text-[11px] font-semibold text-[#5e6b7e] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#a7bacd]">
            Insufficient evidence
          </span>
        </div>
        {/* Honest-absence bullet — no bar, no implied zero — keeps the stack a uniform instrument column. */}
        <BulletGraph value={null} max={5} label={name} />
      </div>
    );
  }

  return (
    <div className={`border-t border-[#ece4d0] py-3 dark:border-[#1d3a57] ${lowEvidenceClass(d.evidenceCount)}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-[#13294b] dark:text-[#eef3f8]">{name}</div>
          <div className="text-[10px] uppercase tracking-wide text-[#7a8aa0] dark:text-[#7a9bb8]">{pillar}</div>
        </div>
        <div className="flex items-center gap-3">
          {/* Neutral ink number (no red↔green) — certainty carried by the veil, not hue. */}
          <ConfidenceVeil confidence={d.confidence} label={`${name} score`} as="div" className="text-right">
            <div className="font-mono text-lg font-semibold tabular-nums text-[#13294b] dark:text-[#eef3f8]">
              {d.score.toFixed(1)}<span className="text-xs text-[#7a8aa0]">/5</span>
            </div>
            <div className="text-[11px] text-[#5e6b7e] dark:text-[#a7bacd]">{DOMAIN_BAND_TEXT[d.bandLabel]}</div>
          </ConfidenceVeil>
          <EvidenceBadge grade={d.bestGrade} />
        </div>
      </div>

      {/* Evidence-Instrument bullet: gold value bar, faint rubric bands, and an ink
          tick at the audit-grade line (4.0). Low-confidence → hatched + faded so a
          thin-evidence score can never look as solid as a measured one. */}
      <div className="mt-2">
        <BulletGraph value={d.score} max={5} benchmark={AUDIT_GRADE_LINE} lowConfidence={d.lowConfidence} label={name} />
      </div>

      {/* confidence + low-confidence flag */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#5e6b7e] dark:text-[#a7bacd]">
        <span>Confidence {d.confidence}%</span>
        {d.lowConfidence && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Low confidence
          </span>
        )}
        <span>· {d.evidenceCount} reviewed {d.evidenceCount === 1 ? "source" : "sources"}</span>
      </div>

      {/* expandable citations */}
      {d.citations.length > 0 ? (
        <details className="mt-1.5">
          <summary className="cursor-pointer select-none text-[11px] font-medium text-[#4c5d75] hover:text-[#13294b] dark:text-[#7a9bb8] dark:hover:text-[#eef3f8]">
            ▸ {d.citations.length} {d.citations.length === 1 ? "citation" : "citations"}
          </summary>
          <ul className="mt-1 space-y-1 pl-3">
            {d.citations.map((c) => (
              <li key={c.sourceUrl} className="flex items-center gap-2 text-[11px]">
                <EvidenceBadge grade={c.evidenceGrade} />
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sky-700 hover:underline dark:text-sky-400"
                >
                  {c.sourceUrl}
                </a>
                <span className="shrink-0 text-[#7a8aa0]">{c.capturedAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <div className="mt-1 text-[11px] italic text-[#7a8aa0] dark:text-[#7a9bb8]">reviewed — source on file</div>
      )}
    </div>
  );
}

export default function DomainScorecard({ scorecard }: { scorecard: VendorScorecard }) {
  return (
    <div>
      <p className="mb-3 text-xs leading-5 text-[#5e6b7e] dark:text-[#a7bacd]">
        Each domain is scored <strong>0–5 by evidence standard</strong> from reviewed, source-backed evidence — a domain
        only reaches 4–5 when audit-grade (E4/E5) evidence supports it. Domains with no reviewed evidence show{" "}
        <strong>“insufficient evidence,”</strong> never a guessed score. Draft assessment — pressure-test against the
        cited sources.
      </p>
      <div className="text-[11px] text-[#7a8aa0] dark:text-[#7a9bb8]">
        {scorecard.scoredCount} of {scorecard.domains.length} domains evidenced · {scorecard.totalEvidenceRows} reviewed,
        source-backed records
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-[#7a8aa0] dark:text-[#7a9bb8]">
        <span className="inline-block h-3 w-6 rounded-sm bg-[#e9e0c9] dark:bg-[#102135]">
          <span className="ml-[2px] inline-block h-3 w-3 rounded-sm bg-[#b08d2f] align-top dark:bg-[#e8c95c]" />
        </span>
        Bar = 0–5 score · the ink tick marks the <strong className="font-semibold">audit-grade line (4.0)</strong> — only E4/E5 evidence clears it
      </div>
      <div className="mt-1">
        {scorecard.domains.map((d) => (
          <ScoreRow key={d.domain} d={d} />
        ))}
      </div>
    </div>
  );
}
