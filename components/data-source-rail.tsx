// Left-hand "Data sources" rail.
// ───────────────────────────────
// A collapsible per-tab menu that makes each surface's provenance explicit:
// which live connectors, vendor evidence, and modelled/seed estimates back it.
// Native <details> → expand/collapse with zero JS. Rendered in PageFrame's
// optional `aside` slot. Colour-coded: emerald = live, sky = mixed, amber = seed.

import Link from "next/link";
import { dataSourcesForTab, type TabKey, type SourceKind } from "@/lib/ui/data-sources";
import { evidenceGradeClasses } from "@/lib/ui/semantic-colors";

const KIND_DOT: Record<SourceKind, string> = {
  live: "bg-emerald-500",
  mixed: "bg-sky-500",
  seed: "bg-amber-500",
};
const KIND_LABEL: Record<SourceKind, string> = {
  live: "Live",
  mixed: "Mixed",
  seed: "Modelled",
};

export default function DataSourceRail({ tab, title = "Data sources" }: { tab: TabKey; title?: string }) {
  const groups = dataSourcesForTab(tab);
  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.sources.length, 0);

  return (
    <details open className="group rounded-lg border border-[#e3d9c0] bg-[#fffdf7] dark:border-[#1d3a57] dark:bg-[#0c2238]">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2.5 marker:content-none">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3f5068] dark:text-[#9fb3c8]">{title}</span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-[#ece3cb] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[#5a4f33] dark:bg-[#16314c] dark:text-[#a7bacd]">{total}</span>
          <span className="text-[#8a98a8] transition-transform group-open:rotate-180" aria-hidden>▾</span>
        </span>
      </summary>

      <div className="border-t border-[#ece4d0] px-3 py-2.5 dark:border-[#16314e]">
        {groups.map((group) => (
          <details key={group.label} open className="mb-1.5 last:mb-0">
            <summary className="flex cursor-pointer select-none items-center gap-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7d93] dark:text-[#7a9bb8] marker:content-none">
              <span className="text-[8px] text-[#a0adba]" aria-hidden>▶</span>
              {group.label}
            </summary>
            <ul className="mb-1.5 ml-1 space-y-1.5 border-l border-[#ece4d0] pl-2.5 dark:border-[#16314e]">
              {group.sources.map((s) => (
                <li key={s.name} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[s.kind]}`} title={KIND_LABEL[s.kind]} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium leading-4 text-[#20314a] dark:text-[#dce7f1]">{s.name}</span>
                    {s.note && <span className="block text-[10px] leading-4 text-[#7a8696] dark:text-[#7a9bb8]">{s.note}</span>}
                  </span>
                  {s.grade && (
                    <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${evidenceGradeClasses(s.grade)}`}>{s.grade}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ))}

        {/* Legend + link to live connector status */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#ece4d0] pt-2 text-[9px] text-[#7a8696] dark:border-[#16314e] dark:text-[#7a9bb8]">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Live</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" />Mixed</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Modelled</span>
        </div>
        <Link href="/admin/data-sources" className="mt-2 block text-[11px] font-medium text-[#a07f1f] hover:underline dark:text-[#d4af37]">
          Connector status →
        </Link>
      </div>
    </details>
  );
}
