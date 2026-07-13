// Analyst Insight — a paragraph of analyst-style reading of the tab's
// current output. Sits at the top of Query, Understand, Demonstrate and
// Monitor. The text is DERIVED deterministically from the same data the
// tab renders (no LLM, no editorial): the generators live in
// lib/insights/tab-insights.ts. Labelled platform-derived for provenance.

export default function AnalystInsight({ paragraph }: { paragraph: string }) {
  if (!paragraph) return null;
  return (
    <section className="mb-6 rounded-lg border border-[#e3d9c0] bg-[#fffdf7] p-5 dark:border-[#1d3a57] dark:bg-[#0c2238]">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[#d4af37]" aria-hidden />
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#a07f1f] dark:text-[#d4af37]">
          Analyst insight
        </h2>
        <span className="text-[9px] uppercase tracking-wide text-[#7e8a99] dark:text-[#8fa5bb]">
          platform-derived from the data on this page
        </span>
      </div>
      <p className="text-[13px] leading-6 text-[#28332a] dark:text-[#d8e2ec]">{paragraph}</p>
    </section>
  );
}
