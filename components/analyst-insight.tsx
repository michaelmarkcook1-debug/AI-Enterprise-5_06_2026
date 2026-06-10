// Analyst Insight — a paragraph of analyst-style reading of the tab's
// current output. Sits at the top of Query, Understand, Demonstrate and
// Monitor. The text is DERIVED deterministically from the same data the
// tab renders (no LLM, no editorial): the generators live in
// lib/insights/tab-insights.ts. Labelled platform-derived for provenance.

export default function AnalystInsight({ paragraph }: { paragraph: string }) {
  if (!paragraph) return null;
  return (
    <section className="mb-6 rounded-xl border border-[#d9e3d2] bg-gradient-to-br from-[#f6f9f3] to-white p-4 dark:border-emerald-900/60 dark:from-emerald-950/30 dark:to-zinc-950">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
          Analyst insight
        </h2>
        <span className="text-[9px] uppercase tracking-wide text-[#8a948a] dark:text-zinc-500">
          platform-derived from the data on this page
        </span>
      </div>
      <p className="text-[13px] leading-6 text-[#28332a] dark:text-zinc-200">{paragraph}</p>
    </section>
  );
}
