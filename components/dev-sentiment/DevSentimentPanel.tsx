import type { DevSentimentAggregate } from "@/lib/dev-sentiment/aggregate";
import { DEV_SENTIMENT_COMPILED_AT } from "@/lib/dev-sentiment/data";

// Developer-sentiment panel (Reputation-Tracker style) — coding vendors ONLY.
// Server-safe (pure props). Shows the analyst-curated reading + tier + the
// three cited sources + top cited threads, or an honest "insufficient" state.
// Never rendered for out-of-scope vendors (caller gates on aggregate !== null).

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

const TAG_STYLE: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  leaning_positive: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  mixed: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  leaning_negative: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  negative: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};
const TAG_LABEL: Record<string, string> = {
  positive: "Positive",
  leaning_positive: "Leaning positive",
  mixed: "Mixed",
  leaning_negative: "Leaning negative",
  negative: "Negative",
};
const SOURCE_LABEL: Record<string, string> = {
  hackernews: "Hacker News",
  github: "GitHub",
  stackoverflow_survey: "Stack Overflow survey",
  reddit: "Reddit",
};

export default function DevSentimentPanel({ agg }: { agg: DevSentimentAggregate }) {
  const insufficient = agg.state === "insufficient_evidence";

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className={`text-xs ${MUTED}`}>
          What developers actually say about {agg.subject} — from official dev sources (Hacker News,
          GitHub, the Stack Overflow survey). Scoped to coding/developer models only.
        </p>
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Analyst-curated · directional
        </span>
      </div>

      {insufficient ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4" role="status">
          <p className="text-sm font-semibold">Insufficient developer-sentiment data</p>
          <p className={`mt-1 text-xs ${MUTED}`}>{agg.coverageNote}</p>
          {agg.record.sources.length > 0 && (
            <p className={`mt-2 text-[11px] ${MUTED}`}>
              What exists so far: {agg.record.sources.map((s) => SOURCE_LABEL[s.source]).join(", ")} —
              shown below, but not enough independent signal to characterise sentiment.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-black/5 p-4 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            {agg.reading && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${TAG_STYLE[agg.reading.tag]}`}>
                {TAG_LABEL[agg.reading.tag]}
              </span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
              agg.tier === "strong"
                ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                : "border-black/15 dark:border-white/20 " + MUTED
            }`}>
              {agg.tier} signal · {agg.countingSources.length} sources
            </span>
          </div>
          {agg.reading && <p className="mt-2 text-sm leading-6">{agg.reading.rationale}</p>}
          <p className={`mt-1.5 text-[11px] ${MUTED}`}>{agg.coverageNote}</p>
        </div>
      )}

      {/* Cited source breakdown (shown in both states — honesty). */}
      <div className="mt-3 space-y-3">
        {agg.record.sources.map((s) => (
          <div key={s.source} className="border-t border-black/5 pt-3 dark:border-white/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{SOURCE_LABEL[s.source]}</span>
              <span className={`text-[10px] uppercase tracking-wide ${MUTED}`}>measures: {s.measures}</span>
            </div>
            <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{s.metric}</p>
            <ul className={`mt-1 space-y-0.5 text-[11px] ${MUTED}`}>
              {s.citations.map((c) => (
                <li key={c.url}>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#15263c] dark:hover:text-[#eef3f8]">
                    {c.title}
                  </a>
                  {c.date ? ` · ${c.date}` : ""}
                </li>
              ))}
            </ul>
            {(s.topThreads ?? []).length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-[11px]">
                {(s.topThreads ?? []).map((t) => (
                  <li key={t.url}>
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {t.title}
                    </a>
                    <span className={MUTED}> — {t.points} pts · {t.comments} comments · {t.date}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <p className={`mt-2 text-[11px] ${MUTED}`}>
        Compiled {DEV_SENTIMENT_COMPILED_AT} from official APIs (HN Algolia, GitHub REST) + the
        Stack Overflow Developer Survey. Engagement/adoption metrics are factual; the sentiment
        reading is an analyst interpretation, tier- and coverage-gated — a labelled input, never
        an authoritative score.
      </p>
    </div>
  );
}
