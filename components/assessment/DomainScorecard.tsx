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

const PILLAR_LABEL = Object.fromEntries(PILLARS.map((p) => [p.id, p.label])) as Record<string, string>;

function bandTone(band: number): string {
  if (band >= 4) return "text-emerald-700 dark:text-emerald-300";
  if (band >= 3) return "text-amber-700 dark:text-amber-300";
  if (band >= 2) return "text-[#a07f1f] dark:text-[#d4af37]";
  return "text-rose-700 dark:text-rose-300";
}
function barTone(band: number): string {
  if (band >= 4) return "bg-emerald-500";
  if (band >= 3) return "bg-amber-500";
  if (band >= 2) return "bg-[#b08d2f] dark:bg-[#d4af37]";
  return "bg-rose-400";
}

function ScoreRow({ d }: { d: DomainScore }) {
  const name = DOMAIN_LABEL[d.domain];
  const pillar = PILLAR_LABEL[d.pillar] ?? d.pillar;

  if (d.state === "insufficient_evidence") {
    return (
      <div className="flex flex-col gap-1 border-t border-[#ece4d0] py-3 dark:border-[#1d3a57] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-[#13294b] dark:text-[#eef3f8]">{name}</div>
          <div className="text-[10px] uppercase tracking-wide text-[#7a8aa0] dark:text-[#7a9bb8]">{pillar}</div>
        </div>
        <span className="inline-flex w-fit rounded-full border border-[#d6c9a8] bg-[#f6f1e3] px-2 py-0.5 text-[11px] font-semibold text-[#5e6b7e] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#a7bacd]">
          Insufficient evidence
        </span>
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
          <div className="text-right">
            <div className={`font-mono text-lg font-semibold tabular-nums ${bandTone(d.band)}`}>
              {d.score.toFixed(1)}<span className="text-xs text-[#7a8aa0]">/5</span>
            </div>
            <div className="text-[11px] text-[#5e6b7e] dark:text-[#a7bacd]">{DOMAIN_BAND_TEXT[d.bandLabel]}</div>
          </div>
          <EvidenceBadge grade={d.bestGrade} />
        </div>
      </div>

      {/* 0–5 bar */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#ece3cb] dark:bg-[#122c49]">
        <div className={`h-full ${barTone(d.band)}`} style={{ width: `${Math.max(2, (d.score / 5) * 100)}%` }} />
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
      <div className="mt-1">
        {scorecard.domains.map((d) => (
          <ScoreRow key={d.domain} d={d} />
        ))}
      </div>
    </div>
  );
}
